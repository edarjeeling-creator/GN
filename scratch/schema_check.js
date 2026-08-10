import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY)

async function check() {
  const { data, error } = await supabase.from('students').select('*').limit(1)
  console.log(Object.keys(data[0]))
}
check()
