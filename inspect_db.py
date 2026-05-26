import urllib.request
import json

supabase_url = 'https://supabase.gyanodayniketan.cloud'
supabase_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'

def inspect():
    try:
        print("Fetching profiles...")
        req = urllib.request.Request(
            f"{supabase_url}/rest/v1/profiles?select=name,role,uid",
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}'
            }
        )
        with urllib.request.urlopen(req) as response:
            data = response.read().decode('utf-8')
            profiles = json.loads(data)
            print("\n--- Faculty/Admin Profiles ---")
            for p in profiles:
                print(f"Name: {p.get('name')}, Role: {p.get('role')}, UID: {p.get('uid')}")
                
        print("\nFetching first 10 students...")
        req2 = urllib.request.Request(
            f"{supabase_url}/rest/v1/students?select=name,roll_no,uid&limit=10",
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}'
            }
        )
        with urllib.request.urlopen(req2) as response2:
            data2 = response2.read().decode('utf-8')
            students = json.loads(data2)
            print("\n--- Sample Student Profiles ---")
            for s in students:
                print(f"Name: {s.get('name')}, Roll No: {s.get('roll_no')}, UID: {s.get('uid')}")
                
    except Exception as e:
        print("Error inspecting DB:", e)

if __name__ == '__main__':
    inspect()
