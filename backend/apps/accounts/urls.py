from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("me/", views.MeView.as_view(), name="me"),
    path("me/export/", views.ExportMyDataView.as_view(), name="me-export"),
    path("me/delete/", views.DeleteMyAccountView.as_view(), name="me-delete"),
    path("change-password/", views.ChangePasswordView.as_view(), name="change-password"),
    path("users/search/", views.UserSearchView.as_view(), name="user-search"),
    path("users/quick-create/", views.QuickCreateVolunteerView.as_view(), name="quick-create-volunteer"),
]
