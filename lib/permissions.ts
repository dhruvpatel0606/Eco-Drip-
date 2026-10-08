import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { requestNotificationPermissions } from './notifications';

export const requestAllPermissions = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      // Notifications
      await requestNotificationPermissions();
      
      // Camera
      const cameraStatus = await Camera.checkPermissions();
      if (cameraStatus.camera !== 'granted') {
        await Camera.requestPermissions();
      }
      
      // Location
      const geoStatus = await Geolocation.checkPermissions();
      if (geoStatus.location !== 'granted') {
        await Geolocation.requestPermissions();
      }
      
    } catch (e) {
      console.error('Failed to request all permissions:', e);
    }
  }
};
