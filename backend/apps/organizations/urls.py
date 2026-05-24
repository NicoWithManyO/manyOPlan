from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("", views.OrganizationViewSet, basename="organization")

urlpatterns = [
    path("<int:pk>/members/", views.OrganizationMembersView.as_view(), name="org-members"),
    path(
        "<int:pk>/members/<int:user_id>/",
        views.OrganizationMemberActionView.as_view(),
        name="org-member-action",
    ),
    path(
        "<int:organization_pk>/invitations/",
        views.OrganizationInvitationListCreateView.as_view(),
        name="org-invitation-list",
    ),
    path(
        "<int:organization_pk>/invitations/promoted/",
        views.OrganizationPromotedInvitationsView.as_view(),
        name="org-invitation-promoted",
    ),
    path(
        "<int:organization_pk>/invitations/<int:pk>/",
        views.OrganizationInvitationDetailView.as_view(),
        name="org-invitation-detail",
    ),
    path(
        "<int:organization_pk>/external-qrs/",
        views.OrganizationExternalQRListCreateView.as_view(),
        name="org-external-qr-list",
    ),
    path(
        "<int:organization_pk>/external-qrs/<int:pk>/",
        views.OrganizationExternalQRDetailView.as_view(),
        name="org-external-qr-detail",
    ),
] + router.urls
