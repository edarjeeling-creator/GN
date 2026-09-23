import { supabase } from '../lib/supabase';

class NotificationService {
  /**
   * Helper to strip HTML tags for concise notification text preview
   */
  stripHtml(html = '') {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+([,.:;?!])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Securely resolves active device tokens for a list of recipient profile IDs.
   * Uses SECURITY DEFINER RPC get_recipient_fcm_tokens, falling back to direct table query.
   */
  async resolveRecipientTokens(recipientUserIds = []) {
    if (!recipientUserIds || recipientUserIds.length === 0) return [];

    try {
      // 1. Try secure RPC first (bypasses restrictive RLS safely)
      const { data: rpcTokens, error: rpcErr } = await supabase.rpc('get_recipient_fcm_tokens', {
        p_recipient_ids: recipientUserIds
      });

      if (!rpcErr && rpcTokens) {
        return rpcTokens.map(t => t.fcm_token).filter(Boolean);
      }
    } catch (e) {
      console.warn('get_recipient_fcm_tokens RPC skipped, using direct query fallback:', e);
    }

    // 2. Direct fallback
    try {
      const { data: devices, error: devErr } = await supabase
        .from('user_devices')
        .select('fcm_token')
        .in('profile_id', recipientUserIds)
        .neq('is_active', false);

      if (!devErr && devices) {
        return devices.map(d => d.fcm_token).filter(Boolean);
      }
    } catch (err) {
      console.warn('Error querying user_devices directly:', err);
    }

    return [];
  }

  /**
   * Marks dead/unregistered FCM tokens inactive in user_devices.
   */
  async deactivateTokens(tokens = []) {
    if (!tokens || tokens.length === 0) return;
    try {
      const { error: rpcErr } = await supabase.rpc('deactivate_fcm_tokens', {
        p_tokens: tokens
      });
      if (rpcErr) {
        await supabase
          .from('user_devices')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in('fcm_token', tokens);
      }
    } catch (err) {
      console.warn('Error deactivating invalid FCM tokens:', err);
    }
  }

  /**
   * Dispatches push notifications for a newly published Principal/Admin Notice.
   * @param {Object} params
   * @param {string} params.noticeId - Notice UUID
   * @param {string} params.title - Notice title
   * @param {string} params.content - Notice raw content (HTML or plain text)
   * @param {string[]} params.recipientUserIds - Array of target user UUIDs
   */
  async dispatchNoticePush({ noticeId, title, content, recipientUserIds = [] }) {
    if (!recipientUserIds || recipientUserIds.length === 0) {
      return { success: true, tokenCount: 0, reason: 'No recipients provided' };
    }

    try {
      const tokens = await this.resolveRecipientTokens(recipientUserIds);
      if (tokens.length === 0) {
        return { success: true, tokenCount: 0, reason: 'No active device tokens found' };
      }

      const cleanPreview = this.stripHtml(content);
      const previewText = cleanPreview.length > 120 
        ? cleanPreview.slice(0, 117) + '...' 
        : cleanPreview || 'New notice from Principal';

      const payload = {
        tokens,
        notification: {
          title: `🔔 ${title || 'School Notice'}`,
          body: previewText
        },
        data: {
          noticeId: String(noticeId),
          notice_id: String(noticeId),
          type: 'notice',
          linkUrl: `/?noticeId=${noticeId}`
        }
      };

      const { data: resData, error: invokeErr } = await supabase.functions.invoke('send-notification', {
        body: payload
      });

      if (invokeErr) {
        console.warn('Edge function send-notification warning for notice push:', invokeErr);
      }

      return {
        success: !invokeErr,
        tokenCount: tokens.length,
        result: resData
      };
    } catch (err) {
      console.warn('Graceful handling: Notice push notification error:', err);
      return { success: false, error: err };
    }
  }

  /**
   * Queue a new single-user in-app notification and dispatch mobile push
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
        const tokens = await this.resolveRecipientTokens([targetUserId]);

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
export default notificationService;
