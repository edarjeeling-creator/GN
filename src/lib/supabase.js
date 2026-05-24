import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://supabase.gyanodayniketan.cloud'
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseKey) {
  console.warn("VITE_SUPABASE_KEY is missing. Please add it to your .env.local file.");
}

export const supabase = createClient(supabaseUrl, supabaseKey)
