import { supabase } from './supabase';

const BUCKET_NAME = 'chat-attachments';

export const uploadChatAttachment = async (file, institutionId, conversationId) => {
  try {
    const fileExt = file.name.split('.').pop();
    // Path structure: institution_id/conversation_id/timestamp-uuid-filename
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const filePath = `${institutionId || 'default'}/${conversationId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;
    
    return { 
      path: filePath, 
      error: null 
    };
  } catch (error) {
    console.error('Error uploading chat attachment:', error);
    return { path: null, error };
  }
};

export const getAttachmentUrl = async (filePath) => {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days signed URL

    if (error) throw error;
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
};

export const deleteChatAttachment = async (filePath) => {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) throw error;
    return { error: null };
  } catch (error) {
    console.error('Error deleting chat attachment:', error);
    return { error };
  }
};
