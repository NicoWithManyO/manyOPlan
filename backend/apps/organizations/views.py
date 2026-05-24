from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.serializers import UserSerializer
from core.image_utils import fetch_remote_image, validate_and_process_image
from core.permissions import IsOrgAdmin, IsOrgMember

from .models import (
    ExternalQRCode,
    Organization,
    OrganizationInvitation,
    OrganizationMembership,
)
from .serializers import (
    ExternalQRCodeSerializer,
    JoinOrganizationSerializer,
    OrganizationCreateSerializer,
    OrganizationInvitationPreviewSerializer,
    OrganizationInvitationSerializer,
    OrganizationMembershipSerializer,
    OrganizationSerializer,
    OrganizationUpdateSerializer,
    OrgInvitationAcceptSerializer,
)

User = get_user_model()


class OrganizationViewSet(viewsets.ModelViewSet):
    """List/create/update orgs the current user is a member of."""

    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Organization.objects.all()
        return Organization.objects.filter(memberships__user=user).distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return OrganizationCreateSerializer
        if self.action in ("update", "partial_update"):
            return OrganizationUpdateSerializer
        return OrganizationSerializer

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [permissions.IsAuthenticated(), IsOrgAdmin()]
        if self.action == "retrieve":
            return [permissions.IsAuthenticated(), IsOrgMember()]
        return [permissions.IsAuthenticated()]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            org = serializer.save(created_by=request.user)
            OrganizationMembership.objects.create(
                user=request.user,
                organization=org,
                role=OrganizationMembership.Role.ADMIN,
            )
        return Response(
            OrganizationSerializer(org, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="me")
    def my_orgs(self, request):
        orgs = self.get_queryset()
        serializer = OrganizationSerializer(
            orgs, many=True, context=self.get_serializer_context()
        )
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["post"],
        url_path="join",
        permission_classes=[permissions.IsAuthenticated],
    )
    def join(self, request):
        serializer = JoinOrganizationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        org = serializer.organization
        membership, created = OrganizationMembership.objects.get_or_create(
            user=request.user,
            organization=org,
            defaults={"role": OrganizationMembership.Role.MEMBER},
        )
        if not created:
            return Response(
                {"detail": "Vous êtes déjà membre de cette association."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            OrganizationSerializer(org, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="leave")
    def leave(self, request, pk=None):
        org = self.get_object()
        membership = OrganizationMembership.objects.filter(
            user=request.user, organization=org
        ).first()
        if not membership:
            return Response(
                {"detail": "Vous n'êtes pas membre de cette association."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if membership.role == OrganizationMembership.Role.ADMIN:
            admin_count = org.memberships.filter(role=OrganizationMembership.Role.ADMIN).count()
            if admin_count <= 1:
                return Response(
                    {"detail": "Impossible de quitter : vous êtes le seul admin."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(
        detail=True,
        methods=["post", "delete"],
        url_path="logo",
        permission_classes=[permissions.IsAuthenticated, IsOrgAdmin],
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def logo(self, request, pk=None):
        """Set (POST file or URL) or remove (DELETE) the org logo. Admin only."""
        org = self.get_object()
        if request.method == "DELETE":
            if org.logo:
                org.logo.delete(save=False)
                org.logo = None
                org.save(update_fields=["logo"])
            return Response(status=status.HTTP_204_NO_CONTENT)

        try:
            if "file" in request.FILES:
                content = validate_and_process_image(request.FILES["file"])
            else:
                url = request.data.get("url")
                if not url:
                    return Response(
                        {"detail": "Fournir un fichier ou une URL."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                content = fetch_remote_image(url)
        except DjangoValidationError as exc:
            return Response(
                {"detail": exc.messages[0] if exc.messages else "Image invalide."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if org.logo:
            org.logo.delete(save=False)
        org.logo.save(content.name, content, save=False)
        org.save(update_fields=["logo"])
        return Response(
            OrganizationSerializer(org, context=self.get_serializer_context()).data
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="regenerate-code",
        permission_classes=[permissions.IsAuthenticated, IsOrgAdmin],
    )
    def regenerate_code(self, request, pk=None):
        """Optional helper: generates a random code. The admin can also set their own via PATCH."""
        import secrets
        import string

        org = self.get_object()
        alphabet = string.ascii_lowercase + string.digits
        for _ in range(20):
            code = "".join(secrets.choice(alphabet) for _ in range(10))
            if not Organization.objects.filter(invite_code=code).exists():
                org.invite_code = code
                org.save(update_fields=["invite_code"])
                return Response({"invite_code": code})
        return Response(
            {"detail": "Impossible de générer un code unique, réessayez."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


class OrganizationMembersView(APIView):
    """List members of an org (admin only)."""

    permission_classes = (permissions.IsAuthenticated, IsOrgAdmin)

    def get(self, request, pk):
        try:
            org = Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        # IsOrgAdmin checks against the user, but we need to also verify the org from URL
        # Re-check membership for security
        if not OrganizationMembership.objects.filter(
            user=request.user, organization=org, role=OrganizationMembership.Role.ADMIN
        ).exists() and not request.user.is_staff:
            return Response(status=status.HTTP_403_FORBIDDEN)
        members = org.memberships.select_related("user").order_by("-role", "user__username")
        return Response(OrganizationMembershipSerializer(members, many=True).data)


class OrganizationMemberActionView(APIView):
    """Promote / demote / kick a member."""

    permission_classes = (permissions.IsAuthenticated, IsOrgAdmin)

    def _get_org_and_target(self, request, pk, user_id):
        try:
            org = Organization.objects.get(pk=pk)
        except Organization.DoesNotExist:
            return None, None, Response(status=status.HTTP_404_NOT_FOUND)
        if not OrganizationMembership.objects.filter(
            user=request.user, organization=org, role=OrganizationMembership.Role.ADMIN
        ).exists() and not request.user.is_staff:
            return None, None, Response(status=status.HTTP_403_FORBIDDEN)
        target = OrganizationMembership.objects.filter(
            organization=org, user_id=user_id
        ).first()
        if not target:
            return org, None, Response(
                {"detail": "Ce membre n'existe pas."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return org, target, None

    def post(self, request, pk, user_id):
        action_name = request.data.get("action")  # "promote" or "demote"
        org, target, err = self._get_org_and_target(request, pk, user_id)
        if err:
            return err
        if action_name == "promote":
            if target.role == OrganizationMembership.Role.ADMIN:
                return Response({"detail": "Déjà admin."}, status=status.HTTP_400_BAD_REQUEST)
            target.role = OrganizationMembership.Role.ADMIN
            target.save(update_fields=["role"])
            return Response(OrganizationMembershipSerializer(target).data)
        if action_name == "demote":
            if target.role != OrganizationMembership.Role.ADMIN:
                return Response({"detail": "N'est pas admin."}, status=status.HTTP_400_BAD_REQUEST)
            admin_count = org.memberships.filter(role=OrganizationMembership.Role.ADMIN).count()
            if admin_count <= 1:
                return Response(
                    {"detail": "Impossible : c'est le dernier admin."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target.role = OrganizationMembership.Role.MEMBER
            target.save(update_fields=["role"])
            return Response(OrganizationMembershipSerializer(target).data)
        return Response(
            {"detail": "Action inconnue. Utilisez 'promote' ou 'demote'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk, user_id):
        """Kick a member."""
        org, target, err = self._get_org_and_target(request, pk, user_id)
        if err:
            return err
        if target.role == OrganizationMembership.Role.ADMIN:
            admin_count = org.memberships.filter(role=OrganizationMembership.Role.ADMIN).count()
            if admin_count <= 1:
                return Response(
                    {"detail": "Impossible : c'est le dernier admin."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        target.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class OrganizationInvitationListCreateView(generics.ListCreateAPIView):
    serializer_class = OrganizationInvitationSerializer
    permission_classes = (permissions.IsAuthenticated, IsOrgAdmin)
    pagination_class = None

    def get_queryset(self):
        return OrganizationInvitation.objects.filter(organization_id=self.kwargs["organization_pk"])

    def perform_create(self, serializer):
        serializer.save(
            organization_id=self.kwargs["organization_pk"],
            created_by=self.request.user,
        )


class OrganizationInvitationDetailView(generics.UpdateAPIView, generics.DestroyAPIView):
    serializer_class = OrganizationInvitationSerializer
    permission_classes = (permissions.IsAuthenticated, IsOrgAdmin)
    http_method_names = ["patch", "delete", "options", "head"]

    def get_queryset(self):
        return OrganizationInvitation.objects.filter(organization_id=self.kwargs["organization_pk"])


class OrganizationPromotedInvitationsView(generics.ListAPIView):
    serializer_class = OrganizationInvitationSerializer
    permission_classes = (permissions.IsAuthenticated, IsOrgMember)
    pagination_class = None

    def get_queryset(self):
        now = timezone.now()
        return (
            OrganizationInvitation.objects.filter(
                organization_id=self.kwargs["organization_pk"],
                is_promoted=True,
                is_active=True,
            )
            .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
            .filter(Q(max_uses__isnull=True) | Q(use_count__lt=F("max_uses")))
        )


class OrganizationExternalQRListCreateView(generics.ListCreateAPIView):
    serializer_class = ExternalQRCodeSerializer
    permission_classes = (permissions.IsAuthenticated, IsOrgMember)
    pagination_class = None

    def get_queryset(self):
        return ExternalQRCode.objects.filter(
            organization_id=self.kwargs["organization_pk"]
        ).select_related("created_by")

    def perform_create(self, serializer):
        serializer.save(
            organization_id=self.kwargs["organization_pk"],
            created_by=self.request.user,
        )


class OrganizationExternalQRDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExternalQRCodeSerializer
    permission_classes = (permissions.IsAuthenticated, IsOrgMember)
    http_method_names = ["get", "patch", "delete", "options", "head"]

    def get_queryset(self):
        return ExternalQRCode.objects.filter(
            organization_id=self.kwargs["organization_pk"]
        ).select_related("created_by")


class OrgInvitationPreviewView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request, token):
        invitation = get_object_or_404(
            OrganizationInvitation.objects.select_related("organization"),
            token=token,
        )
        return Response(OrganizationInvitationPreviewSerializer(invitation).data)


class OrgInvitationAcceptView(APIView):
    """Public: accept an org invitation. If unauthenticated, creates a user.

    Adds the user to the org (as MEMBER). Does not touch any event.
    """

    permission_classes = (permissions.AllowAny,)

    def post(self, request, token):
        invitation = get_object_or_404(
            OrganizationInvitation.objects.select_related("organization"),
            token=token,
        )
        ok, reason = invitation.is_valid()
        if not ok:
            return Response(
                {"detail": "Cette invitation n'est plus valide.", "invalid_reason": reason},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_signup = not request.user.is_authenticated
        signup_data = None
        if is_signup:
            serializer = OrgInvitationAcceptSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            signup_data = serializer.validated_data

        with transaction.atomic():
            invitation = (
                OrganizationInvitation.objects.select_for_update()
                .select_related("organization")
                .get(pk=invitation.pk)
            )
            ok, reason = invitation.is_valid()
            if not ok:
                return Response(
                    {"detail": "Cette invitation n'est plus valide.", "invalid_reason": reason},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if is_signup:
                user = User.objects.create_user(
                    username=signup_data["email"],
                    email=signup_data["email"],
                    password=signup_data["password"],
                    first_name=signup_data["first_name"],
                    last_name=signup_data["last_name"],
                    nickname=signup_data.get("nickname", ""),
                )
            else:
                user = request.user

            OrganizationMembership.objects.get_or_create(
                user=user,
                organization=invitation.organization,
                defaults={"role": OrganizationMembership.Role.MEMBER},
            )

            invitation.use_count = invitation.use_count + 1
            invitation.save(update_fields=["use_count"])

        payload = {
            "user": UserSerializer(user).data,
            "organization_id": invitation.organization_id,
        }
        if is_signup:
            refresh = RefreshToken.for_user(user)
            payload["tokens"] = {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }
        return Response(payload, status=status.HTTP_200_OK)
