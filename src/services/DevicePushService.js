import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabase';
import { requestFirebaseToken } from '../lib/firebase';

class DevicePushService {
  constructor() {
    this.initialized = false;
    this.activeChannel = null;
    this.nativeListenersAttached = false;
  }

  /**
   * Initializes native Capacitor push notifications on Android/iOS
   */
  async registerNativePushNotifications(user, schoolId) {
    if (!Capacitor.isNativePlatform()) return;

    try {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('Native push notification permission not granted:', permStatus.receive);
        return;
      }

      if (!this.nativeListenersAttached) {
        this.nativeListenersAttached = true;

        PushNotifications.addListener('registration', async (token) => {
          console.log('Native FCM Token registered:', token.value?.slice(0, 16) + '...');
          try {
            const platform = Capacitor.getPlatform();
            const deviceRecord = {
              profile_id: user.id,
              fcm_token: token.value,
              platform: platform === 'ios' ? 'ios' : 'android',
              device_name: `Native ${platform.toUpperCase()} - Capacitor`,
              school_id: schoolId || null,
              is_active: true,
              last_seen_at: new Date().toISOString()
            };

            const { error: upsertErr } = await supabase
              .from('user_devices')
              .upsert(deviceRecord, { onConflict: 'profile_id,fcm_token' });

            if (upsertErr) {
              console.warn('Failed to upsert native device token:', upsertErr);
            }
          } catch (e) {
            console.warn('Error saving native token to user_devices:', e);
          }
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.warn('Push registration error:', error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Foreground push notification received:', notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notificationAction) => {
          console.log('Push notification action performed:', notificationAction);
          const data = notificationAction.notification?.data || {};
          const linkUrl = data.linkUrl || (data.noticeId ? `/?noticeId=${data.noticeId}` : null);
          if (linkUrl) {
            window.location.href = linkUrl;
          }
        });
      }

      await PushNotifications.register();
    } catch (err) {
      console.warn('Graceful fallback: Native push registration issue:', err);
    }
  }

  /**
   * Register the current device in the `user_devices` table so mobile push alerts reach it.
   */
  async registerCurrentDevice(schoolId = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Register native push if on native Android / iOS
      if (Capacitor.isNativePlatform()) {
        await this.registerNativePushNotifications(user, schoolId);
      }

      // Detect OS platform
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
      const isAndroid = /Android/.test(userAgent);
      const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'web';

      // 1. Try Firebase Cloud Messaging first if configured
      let token = null;
      try {
        token = await requestFirebaseToken(schoolId, platform);
      } catch (fbErr) {
        console.warn('Firebase token retrieval skipped/failed, using Web Push fallback:', fbErr);
      }

      // 2. Fallback: Generate or retrieve persistent Web Push client token
      if (!token) {
        let storedToken = localStorage.getItem('gn_device_push_token');
        if (!storedToken) {
          const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          storedToken = `wp_${platform}_${user.id.slice(0, 8)}_${randomBytes}`;
          localStorage.setItem('gn_device_push_token', storedToken);
        }
        token = storedToken;
      }

      // 3. Upsert device registration to user_devices
      const deviceRecord = {
        profile_id: user.id,
        fcm_token: token,
        platform,
        device_name: `${platform.toUpperCase()} - ${navigator.userAgent.slice(0, 50)}`,
        school_id: schoolId || null,
        is_active: true,
        last_seen_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase
        .from('user_devices')
        .upsert(deviceRecord, { onConflict: 'profile_id,fcm_token' });

      if (upsertErr) {
        console.warn('Device push registration warning:', upsertErr);
      } else {
        console.log('Device registered for push notifications:', platform, token.slice(0, 16) + '...');
      }

      // 4. Request notification permission if not yet decided (web)
      this.requestNotificationPermission();

      // 5. Start real-time notification listener for OS tray alerts
      this.listenForRealtimePush(user.id);

      return token;
    } catch (err) {
      console.warn('Graceful fallback: device registration failed:', err);
      return null;
    }
  }

  /**
   * Request system notification permission from the user
   */
  async requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'default') {
      try {
        const permission = await Notification.requestPermission();
        return permission;
      } catch {
        return 'denied';
      }
    }
    return Notification.permission;
  }

  /**
   * Listens to real-time notification table insertions for this user
   * and triggers the Service Worker's OS notification panel display.
   */
  listenForRealtimePush(userId) {
    if (!userId || this.activeChannel) return;

    try {
      this.activeChannel = supabase.channel(`device_push_${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        }, async (payload) => {
          const notif = payload.new;
          if (!notif) return;

          const title = notif.title || '🔔 Gyanoday Niketan Alert';
          const body = notif.message || 'You have received a new school notification.';
          const linkUrl = notif.type === 'attendance_absent' 
            ? '/principal?tab=attendance' 
            : notif.type === 'notice'
              ? (notif.data?.notice_id ? `/?noticeId=${notif.data.notice_id}` : '/dashboard')
              : '/';

          // Pop notification in phone's notification panel via Service Worker
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            if (navigator.serviceWorker) {
              const reg = await navigator.serviceWorker.ready;
              if (reg && reg.showNotification) {
                reg.showNotification(title, {
                  body,
                  icon: '/logo.png',
                  badge: '/logo.png',
                  vibrate: [200, 100, 200],
                  data: { linkUrl, type: notif.type },
                  actions: [{ action: 'open', title: 'View Details' }]
                });
                return;
              }
            }
            new Notification(title, { body, icon: '/logo.png', data: { linkUrl } });
          }
        })
        .subscribe();
    } catch (err) {
      console.warn('Realtime push listener error:', err);
    }
  }

  cleanup() {
    if (this.activeChannel) {
      supabase.removeChannel(this.activeChannel);
      this.activeChannel = null;
    }
  }
}

export const devicePushService = new DevicePushService();
export default devicePushService;
