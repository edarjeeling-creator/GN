import urllib.request
import json

supabase_url = 'https://supabase.gyanodayniketan.cloud'
supabase_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'

def inspect_function():
    try:
        # Query pg_proc to find the function source code
        payload = json.dumps({
            'query': "SELECT prosrc FROM pg_proc WHERE proname = 'lookup_user_email';"
        }).encode('utf-8')
        
        # Note: Since pg_proc is in system catalog, Postgrest REST API cannot query pg_proc directly.
        # But we can query it via a SQL function or inspect via RPC if they have a generic run_sql.
        # Wait, instead of pg_proc, let's test if our python RPC script can call the RPC now to check if the user executed the SQL script!
        # Let's call the RPC function with 'student', 'Sangbo Bhutia  ', '18502' and with 'Sangbo Bhutia', '18502'
        
        for name in ['Sangbo Bhutia', 'Sangbo Bhutia  ', 'Sangbo Bhutia ']:
            payload = json.dumps({
                'p_role': 'student',
                'p_name': name,
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
            try:
                with urllib.request.urlopen(req) as response:
                    result = json.loads(response.read().decode('utf-8'))
                    print(f"RPC Result for '{name}':", result)
            except Exception as inner_e:
                print(f"Error calling RPC for '{name}':", inner_e)
                
    except Exception as e:
        print("Error inspecting function:", e)

if __name__ == '__main__':
    inspect_function()
