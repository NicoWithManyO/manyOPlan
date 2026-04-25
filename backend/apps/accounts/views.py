from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.organizations.serializers import OrganizationSerializer

from .serializers import AdminUserSerializer, ChangePasswordSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        org = getattr(serializer, "_created_org", None)
        org_data = (
            OrganizationSerializer(org, context={"request": request}).data if org else None
        )
        return Response(
            {
                "user": UserSerializer(user).data,
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
                "organization": org_data,
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ChangePasswordView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not request.user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"old_password": ["Mot de passe actuel incorrect."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response({"detail": "Mot de passe modifié."})


class AdminUserListView(generics.ListCreateAPIView):
    queryset = User.objects.all().order_by("-date_joined")
    serializer_class = AdminUserSerializer
    permission_classes = (IsAdminUser,)

    def create(self, request, *args, **kwargs):
        data = request.data
        password = data.get("password", "")
        if not password:
            return Response(
                {"password": ["Mot de passe requis."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            user = User.objects.create_user(
                username=data.get("username", ""),
                email=data.get("email", ""),
                password=password,
                first_name=data.get("first_name", ""),
                last_name=data.get("last_name", ""),
            )
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer
    permission_classes = (IsAdminUser,)


class UserSearchView(APIView):
    """Search users by username/email/name, scoped to orgs the requester shares."""

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if len(q) < 2:
            return Response([])
        from django.db.models import Q

        from apps.organizations.models import OrganizationMembership

        if request.user.is_staff:
            base_qs = User.objects.all()
        else:
            shared_org_ids = OrganizationMembership.objects.filter(
                user=request.user
            ).values_list("organization_id", flat=True)
            base_qs = User.objects.filter(
                org_memberships__organization_id__in=shared_org_ids
            ).distinct()

        users = base_qs.filter(
            Q(username__icontains=q)
            | Q(email__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
        )[:10]
        return Response(
            [
                {"id": u.id, "username": u.username, "full_name": str(u), "email": u.email}
                for u in users
            ]
        )


class QuickCreateVolunteerView(APIView):
    """Admin-only: create a minimal volunteer account (no password) for assignment."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        first_name = request.data.get("first_name", "").strip()
        last_name = request.data.get("last_name", "").strip()
        if not first_name:
            return Response(
                {"detail": "Le prénom est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Auto-generate a unique username
        import uuid

        base = f"{first_name.lower()}.{last_name.lower()}".replace(" ", "")
        username = base or f"volunteer-{uuid.uuid4().hex[:6]}"
        if User.objects.filter(username=username).exists():
            username = f"{base}-{uuid.uuid4().hex[:4]}"
        user = User.objects.create_user(
            username=username,
            password=None,
            first_name=first_name,
            last_name=last_name,
            is_placeholder=True,
        )
        user.set_unusable_password()
        user.save()
        return Response(
            {"id": user.id, "username": user.username, "full_name": str(user)},
            status=status.HTTP_201_CREATED,
        )


class LogoutView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except KeyError:
            return Response(
                {"detail": "Le token refresh est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )
