from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .models import Event


@receiver(pre_delete, sender=Event)
def delete_poster_file(sender, instance, **kwargs):
    if instance.poster:
        instance.poster.delete(save=False)
