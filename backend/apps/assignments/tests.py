from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.events.models import Event
from apps.organizations.models import Organization, OrganizationMembership
from apps.tasks.models import Slot, Task

from .models import Assignment


class AssignmentListPaginationTest(TestCase):
    """Le planning doit renvoyer TOUTES les inscriptions d'un event.

    Régression : la liste était paginée à 20, donc les inscriptions au-delà
    du 20e rang n'étaient jamais envoyées au front (invisibles), alors que le
    check de chevauchement les voyait toujours.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="member", password="pass")
        self.org = Organization.objects.create(
            name="Org", slug="org", invite_code="code", created_by=self.user
        )
        OrganizationMembership.objects.create(
            user=self.user,
            organization=self.org,
            role=OrganizationMembership.Role.MEMBER,
        )
        self.event = Event.objects.create(
            organization=self.org,
            name="Event",
            start_date=timezone.now(),
            end_date=timezone.now() + timedelta(days=1),
        )
        task = Task.objects.create(event=self.event, name="Maquillage")
        self.slot = Slot.objects.create(
            task=task,
            start_date=timezone.now() + timedelta(hours=1),
            end_date=timezone.now() + timedelta(hours=3),
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_returns_all_assignments_beyond_page_size(self):
        for i in range(25):
            volunteer = User.objects.create_user(username=f"vol{i}", password="pass")
            Assignment.objects.create(
                user=volunteer,
                slot=self.slot,
                start_date=self.slot.start_date,
                end_date=self.slot.end_date,
            )

        response = self.client.get(f"/api/events/{self.event.id}/assignments/")

        self.assertEqual(response.status_code, 200)
        # Liste brute non paginée : pas de wrapper {"results": [...]}
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 25)
