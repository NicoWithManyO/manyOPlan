"""Image validation, re-encoding, and SSRF-safe remote fetching.

Two public helpers:
- validate_and_process_image(file_obj) -> ContentFile
- fetch_remote_image(url) -> ContentFile

Both return a ContentFile with a server-generated random filename, ready to be
assigned to an ImageField. Both go through Pillow re-encoding, which is the
final security gate: original bytes are never persisted.
"""

from __future__ import annotations

import http.client
import ipaddress
import secrets
import socket
import ssl
from io import BytesIO
from urllib.parse import urljoin, urlparse

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from PIL import Image, UnidentifiedImageError

# Disk / wire caps
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_FETCH_BYTES = 2 * 1024 * 1024

# Pixel cap (decompression bomb defense, above Pillow's default 89 MP)
Image.MAX_IMAGE_PIXELS = 50_000_000

# Output bounding box
MAX_IMAGE_DIMENSION = 512

# Whitelists
ALLOWED_MIMES = frozenset({"image/png", "image/jpeg", "image/webp"})
ALLOWED_PIL_FORMATS = frozenset({"PNG", "JPEG", "WEBP"})
_FORMAT_TO_EXT = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp"}

# Remote fetch knobs
CONNECT_TIMEOUT = 5.0
READ_TIMEOUT = 10.0
MAX_REDIRECTS = 3
READ_CHUNK = 64 * 1024

# Generic error for remote fetch — we never leak why a URL was refused, to
# avoid turning the endpoint into a port scanner / network probe.
_GENERIC_URL_ERROR = "URL invalide ou inaccessible."


def _random_name(ext: str) -> str:
    return f"{secrets.token_urlsafe(16)}.{ext}"


def validate_and_process_image(file_obj) -> ContentFile:
    """Validate, strip metadata, resize, re-encode.

    Accepts any object with .read() (UploadedFile, BytesIO, ...). Raises
    ValidationError with a user-facing French message on any rejection.
    Returns a ContentFile whose .name is a random server-generated filename.
    """
    raw = file_obj.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise ValidationError(
            f"Fichier trop volumineux (max {MAX_UPLOAD_BYTES // (1024 * 1024)} Mo)."
        )

    # Pillow's verify() consumes the file, so re-open for actual processing.
    try:
        Image.open(BytesIO(raw)).verify()
        img = Image.open(BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise ValidationError("Fichier image invalide ou corrompu.") from None

    fmt = img.format
    if fmt not in ALLOWED_PIL_FORMATS:
        raise ValidationError("Format non supporté. Utilisez PNG, JPEG ou WebP.")

    # Pick output mode based on alpha. Conversion strips EXIF/XMP/IPTC/ICC.
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    target_mode = "RGBA" if has_alpha else "RGB"
    if img.mode != target_mode:
        img = img.convert(target_mode)

    img.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.LANCZOS)

    # JPEG can't carry alpha — promote those uploads to PNG.
    if has_alpha:
        out_fmt = "PNG"
    elif fmt == "WEBP":
        out_fmt = "WEBP"
    else:
        out_fmt = "JPEG"

    buf = BytesIO()
    save_kwargs: dict = {"format": out_fmt, "optimize": True}
    if out_fmt == "JPEG":
        save_kwargs.update(quality=85, progressive=True)
    elif out_fmt == "WEBP":
        save_kwargs.update(quality=85, method=6)

    img.save(buf, **save_kwargs)
    return ContentFile(buf.getvalue(), name=_random_name(_FORMAT_TO_EXT[out_fmt]))


def _check_ip_safe(addr: str) -> None:
    ip = ipaddress.ip_address(addr)
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    ):
        raise ValidationError(_GENERIC_URL_ERROR)
    # AWS / GCP metadata endpoints (defense in depth — already covered by
    # is_link_local for IPv4 169.254.0.0/16, but explicit is good).
    if str(ip) in {"169.254.169.254", "fd00:ec2::254"}:
        raise ValidationError(_GENERIC_URL_ERROR)


def _resolve_safe(host: str) -> str:
    """Resolve host, validate every returned IP, return one safe IP to connect to."""
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise ValidationError(_GENERIC_URL_ERROR) from None
    if not infos:
        raise ValidationError(_GENERIC_URL_ERROR)
    # Validate ALL resolved IPs (not just the first), to defend against
    # round-robin DNS where one record points to a public IP and another to a
    # private one.
    chosen: str | None = None
    for info in infos:
        addr = info[4][0]
        _check_ip_safe(addr)  # raises if any record is unsafe
        if chosen is None:
            chosen = addr
    assert chosen is not None
    return chosen


def _fetch_once(url: str) -> tuple[int, dict[str, str], bytes | None]:
    """One HTTPS request with SSRF protections.

    Returns (status, headers, body). Body is None for 3xx (caller follows).
    """
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise ValidationError(_GENERIC_URL_ERROR)
    if "@" in (parsed.netloc or "") or not parsed.hostname:
        raise ValidationError(_GENERIC_URL_ERROR)

    host = parsed.hostname
    port = parsed.port or 443
    if port != 443:
        raise ValidationError(_GENERIC_URL_ERROR)

    # Resolve & validate, then connect by IP with explicit Host: header
    # (defeats DNS rebinding between resolve and connect).
    ip = _resolve_safe(host)

    # SNI / cert validation still need the hostname, not the IP.
    ctx = ssl.create_default_context()

    conn = http.client.HTTPSConnection(
        ip, port, timeout=CONNECT_TIMEOUT, context=ctx, server_hostname=host
    )
    try:
        path = parsed.path or "/"
        if parsed.query:
            path = f"{path}?{parsed.query}"
        conn.request(
            "GET",
            path,
            headers={
                "Host": host,
                "User-Agent": "manyoplan/1.0 (logo-fetch)",
                "Accept": "image/png,image/jpeg,image/webp",
            },
        )
        conn.sock.settimeout(READ_TIMEOUT)
        resp = conn.getresponse()
        status = resp.status
        headers = {k.lower(): v for k, v in resp.getheaders()}

        if 300 <= status < 400:
            return status, headers, None

        if status != 200:
            raise ValidationError(_GENERIC_URL_ERROR)

        ctype = headers.get("content-type", "").split(";")[0].strip().lower()
        if ctype not in ALLOWED_MIMES:
            raise ValidationError(_GENERIC_URL_ERROR)

        clen = headers.get("content-length")
        if clen is not None:
            try:
                if int(clen) > MAX_FETCH_BYTES:
                    raise ValidationError(_GENERIC_URL_ERROR)
            except ValueError:
                raise ValidationError(_GENERIC_URL_ERROR) from None

        body = bytearray()
        while True:
            chunk = resp.read(READ_CHUNK)
            if not chunk:
                break
            body.extend(chunk)
            if len(body) > MAX_FETCH_BYTES:
                raise ValidationError(_GENERIC_URL_ERROR)
        return status, headers, bytes(body)
    except (TimeoutError, OSError, http.client.HTTPException):
        raise ValidationError(_GENERIC_URL_ERROR) from None
    finally:
        conn.close()


def fetch_remote_image(url: str) -> ContentFile:
    """SSRF-safe HTTPS fetch + Pillow re-encoding pipeline.

    Failure modes all collapse to one generic French error to avoid leaking
    network topology / port-scan info via differential error messages.
    """
    if not isinstance(url, str) or len(url) > 2048:
        raise ValidationError(_GENERIC_URL_ERROR)

    current = url
    for _ in range(MAX_REDIRECTS + 1):
        status, headers, body = _fetch_once(current)
        if body is not None:
            # Final hop: re-validate via Pillow (defeats Content-Type lying).
            return validate_and_process_image(BytesIO(body))
        location = headers.get("location")
        if not location:
            raise ValidationError(_GENERIC_URL_ERROR)
        current = urljoin(current, location)

    raise ValidationError(_GENERIC_URL_ERROR)
