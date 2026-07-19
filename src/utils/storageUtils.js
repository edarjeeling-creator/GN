import { supabase } from '../lib/supabase';

export const uploadFileToSupabase = async (file, folder) => {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
  const filePath = `${folder}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('public-assets')
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from('public-assets').getPublicUrl(filePath);
  return data.publicUrl;
};

export const deleteFileFromSupabase = async (publicUrl) => {
  if (!publicUrl || !publicUrl.includes('/public-assets/')) return;
  try {
    // Extract the file path relative to the bucket
    const urlParts = publicUrl.split('/public-assets/');
    if (urlParts.length === 2) {
      const filePath = urlParts[1];
      await supabase.storage.from('public-assets').remove([filePath]);
    }
  } catch (error) {
    console.error("Error deleting old file from Supabase:", error);
  }
};
