import urllib.request
import json
import urllib.parse

supabase_url = 'https://supabase.gyanodayniketan.cloud'
supabase_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'

def search_user():
    try:
        # Search profiles
        query = urllib.parse.quote(".*Subodh.*")
        req = urllib.request.Request(
            f"{supabase_url}/rest/v1/profiles?name=ilike.{query}&select=*",
            headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'}
        )
        with urllib.request.urlopen(req) as response:
            profiles = json.loads(response.read().decode('utf-8'))
            print("Matching Profiles:", profiles)
            
    except Exception as e:
        print("Error searching user:", e)

if __name__ == '__main__':
    search_user()
