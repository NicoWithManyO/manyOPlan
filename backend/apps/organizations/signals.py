from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .models import Organization


@receiver(pre_delete, sender=Organization)
def delete_logo_file(sender, instance, **kwargs):
    if instance.logo:
        instance.logo.delete(save=False)
