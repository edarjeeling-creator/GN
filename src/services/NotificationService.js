import { supabase } from '../lib/supabase';

class NotificationService {
  /**
   * Queue a new notification
   * @param {Object} params
   * @param {string} params.profileId - The user receiving the notification
   * @param {string} params.type - The type of notification (e.g. 'message', 'announcement', 'attendance')
   * @param {string} params.title - Notification title
   * @param {string} params.body - Notification body/content
   * @param {string} [params.linkUrl] - URL to navigate to when clicked
   * @param {string} [params.schoolId] - The school ID
   */
  async create({ profileId, userId, type, title, body, message, linkUrl, schoolId }) {
    try {
      const targetUserId = userId || profileId;
      const content = message || body;

      // 1. Insert into database (source of truth for in-app notifications)
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          type,
          title,
          message: content,
          school_id: schoolId,
          is_read: false
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Trigger FCM Mobile Push to registered device tokens
      try {
        const { data: devices } = await supabase
          .from('user_devices')
          .select('fcm_token')
          .eq('profile_id', targetUserId)
          .neq('is_active', false);

        const tokens = (devices || []).map(d => d.fcm_token).filter(Boolean);
        if (tokens.length > 0) {
          await supabase.functions.invoke('send-notification', {
            body: {
              tokens,
              notification: { title, body: content },
              data: { linkUrl: linkUrl || '/', type }
            }
          });
        }
      } catch (pushErr) {
        console.warn('FCM dispatch skipped:', pushErr);
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error creating notification:', error);
      return { success: false, error };
    }
  }

  async markAsRead(notificationId) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
    
    return !error;
  }
}

export const notificationService = new NotificationService();
