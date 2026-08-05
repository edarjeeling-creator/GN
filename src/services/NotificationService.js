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
  async create({ profileId, type, title, body, linkUrl, schoolId }) {
    try {
      // 1. Insert into database (this acts as the source of truth and triggers realtime in-app notifications)
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          profile_id: profileId,
          type,
          title,
          body,
          link_url: linkUrl,
          school_id: schoolId
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Trigger FCM (In a production environment, this should ideally be done 
      // via a Supabase Database Webhook to an Edge Function, but for now we'll 
      // rely on the client or Edge Function to pick this up).
      // If we are sending direct to an Edge Function from client:
      // await supabase.functions.invoke('send-fcm', { body: { notification: data } });

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
