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
] + router.urls
