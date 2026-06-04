import os
import requests
from dotenv import load_dotenv

load_dotenv('.env.local')

supabase_url = os.environ.get('VITE_SUPABASE_URL')
supabase_key = os.environ.get('VITE_SUPABASE_ANON_KEY')

headers = {
    'apikey': supabase_key,
    'Authorization': f'Bearer {supabase_key}'
}

response = requests.get(
    f"{supabase_url}/rest/v1/teacher_attendance?date=eq.2026-06-04",
    headers=headers
)

print(response.status_code)
print(response.json())
