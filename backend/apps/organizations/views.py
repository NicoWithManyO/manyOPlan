from django.db import transaction
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsOrgAdmin, IsOrgMember

from .models import Organization, OrganizationMembership
from .serializers import (
    JoinOrganizationSerializer,
    OrganizationCreateSerializer,
    OrganizationMembershipSerializer,
    OrganizationSerializer,
    OrganizationUpdateSerializer,
)


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
