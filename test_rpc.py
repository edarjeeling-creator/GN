import urllib.request
import json

supabase_url = 'https://supabase.gyanodayniketan.cloud'
supabase_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'

def test_rpc():
    try:
        # We will call lookup_user_email RPC directly
        payload = json.dumps({
            'p_role': 'student',
            'p_name': 'Sangbo Bhutia',
            'p_uid': '18502'
        }).encode('utf-8')
        
        req = urllib.request.Request(
            f"{supabase_url}/rest/v1/rpc/lookup_user_email",
            data=payload,
            headers={
                'apikey': supabase_key,
                'Authorization': f'Bearer {supabase_key}',
                'Content-Type': 'application/json'
            }
        )
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            print("RPC Result for student 'Sangbo Bhutia' with '18502':", result)
            
        # Let's also do a direct SELECT query on students to check exact values and column types
        req2 = urllib.request.Request(
            f"{supabase_url}/rest/v1/students?name=eq.Sangbo%20Bhutia&select=*",
            headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'}
        )
        with urllib.request.urlopen(req2) as response2:
            student = json.loads(response2.read().decode('utf-8'))
            print("Direct Student Select:", student)
            
    except Exception as e:
        print("Error testing RPC:", e)

if __name__ == '__main__':
    test_rpc()
