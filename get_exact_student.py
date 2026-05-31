import urllib.request
import json

supabase_url = 'https://supabase.gyanodayniketan.cloud'
supabase_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'

def get_exact():
    try:
        # Fetch by unique UID
        req = urllib.request.Request(
            f"{supabase_url}/rest/v1/students?uid=eq.18502&select=*",
            headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'}
        )
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            print("Student matching UID '18502':", result)
            if result:
                name = result[0].get('name')
                print(f"Exact Name string representation: {repr(name)}")
    except Exception as e:
        print("Error getting exact student:", e)

if __name__ == '__main__':
    get_exact()
