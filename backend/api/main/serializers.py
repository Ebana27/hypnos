from rest_framework import serializers
from .models import Notification

class NotifSerializer(serializers.ModelSerializer):
    """ Notification Serializer """
    
    class Meta:
        model = Notification
        fields = [
            'id_notif',
            'user',
            'title',
            'detail',
            'action',
            'lu',
            'created_at'
        ]