from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.accounts.views import AdminUserDetailView, AdminUserListView
from apps.assignments.views import MyAssignmentsView
from apps.events.views import InvitationAcceptView, InvitationPreviewView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/admin/users/", AdminUserListView.as_view(), name="admin-user-list"),
    path("api/admin/users/<int:pk>/", AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("api/organizations/", include("apps.organizations.urls")),
    path("api/assignments/mine/", MyAssignmentsView.as_view(), name="my-assignments"),
    path("api/events/", include("apps.events.urls")),
    path("api/events/<int:event_pk>/tasks/", include("apps.tasks.urls")),
    path("api/events/<int:event_pk>/assignments/", include("apps.assignments.urls")),
    path("api/events/<int:event_pk>/news/", include("apps.news.urls")),
    path("api/messages/", include("apps.messaging.urls")),
    path(
        "api/invitations/<str:token>/",
        InvitationPreviewView.as_view(),
        name="invitation-preview",
    ),
    path(
        "api/invitations/<str:token>/accept/",
        InvitationAcceptView.as_view(),
        name="invitation-accept",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
