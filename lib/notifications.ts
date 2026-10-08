import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export const requestNotificationPermissions = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const permissionStatus = await LocalNotifications.checkPermissions();
      if (permissionStatus.display !== 'granted') {
        const result = await LocalNotifications.requestPermissions();
        console.log('Notification permission request result:', result);
      }
    } catch (e) {
      console.error('Failed to request notification permissions:', e);
    }
  }
};

export const sendPushNotification = async (title: string, body: string, id: number = new Date().getTime()) => {
  if (Capacitor.isNativePlatform()) {
    const permissionStatus = await LocalNotifications.checkPermissions();
    if (permissionStatus.display === 'granted') {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id,
            schedule: { at: new Date(Date.now() + 1000) }, // Schedule 1 second from now
            actionTypeId: '',
            extra: null
          }
        ]
      });
    }
  } else {
    // Fallback for web or just log
    console.log(`[Web Push Notification] ${title}: ${body}`);
  }
};
