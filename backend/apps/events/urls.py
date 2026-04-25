from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("", views.EventViewSet, basename="event")

members_router = DefaultRouter()
members_router.register("", views.EventMembershipViewSet, basename="event-member")

urlpatterns = [
    path(
        "<int:event_pk>/members/",
        include(members_router.urls),
    ),
    path("", include(router.urls)),
]
