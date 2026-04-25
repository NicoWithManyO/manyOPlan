from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

task_router = DefaultRouter()
task_router.register("", views.TaskViewSet, basename="task")

slot_router = DefaultRouter()
slot_router.register("", views.SlotViewSet, basename="slot")

urlpatterns = [
    path(
        "<int:task_pk>/slots/",
        include(slot_router.urls),
    ),
    path("", include(task_router.urls)),
]
