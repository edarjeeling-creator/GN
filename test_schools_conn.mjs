import { createClient } from '@supabase/supabase-js';

const url = 'https://results.gyanodayniketan.cloud';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODE3Mzk3NDQsImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6ImFub24iLCJpc3MiOiJzdXBhYmFzZSJ9.ccHXyyFKUWDXuX6Cs1JIY5h930G8rNXXNt4UvWQNUnE';

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('schools').select('*');
  console.log(JSON.stringify({ data, error }));
}
check();
