import urllib.request
import json

supabase_url = 'https://supabase.gyanodayniketan.cloud'
supabase_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'

def inspect_students_by_id():
    try:
        class_id = '8ec03107-ee3e-4604-aa3d-6a84d12f3d3b'
        req = urllib.request.Request(
            f"{supabase_url}/rest/v1/students?class_id=eq.{class_id}&select=*",
            headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'}
        )
        with urllib.request.urlopen(req) as res:
            students = json.loads(res.read().decode('utf-8'))
            print(f"Total students in class 8 B: {len(students)}")
            
            # Group by roll_no to see duplicates
            duplicates = {}
            for s in students:
                roll = s['roll_no']
                if roll not in duplicates:
                    duplicates[roll] = []
                duplicates[roll].append(s)
                
            # Print duplicates count
            print("Roll No Duplication count:")
            for roll, list_s in sorted(duplicates.items())[:5]:
                print(f"Roll No: {roll} has {len(list_s)} rows: {[s['name'] for s in list_s]}")
                for s in list_s:
                    print(f"   ID: {s['id']}, UID: {s['uid']}")
                    
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    inspect_students_by_id()
