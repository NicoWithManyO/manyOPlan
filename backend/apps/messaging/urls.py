from django.urls import path

from . import views

urlpatterns = [
    path("", views.ConversationListView.as_view(), name="conversation-list"),
    path("send/", views.SendMessageView.as_view(), name="send-message"),
    path("unread-count/", views.UnreadCountView.as_view(), name="unread-count"),
    path("<int:user_id>/", views.ThreadView.as_view(), name="thread"),
]
