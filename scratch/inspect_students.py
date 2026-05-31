import urllib.request
import json

supabase_url = 'https://supabase.gyanodayniketan.cloud'
supabase_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'

def inspect_students():
    try:
        # Get class 8 B id
        req = urllib.request.Request(
            f"{supabase_url}/rest/v1/classes?name=eq.8%20B&select=*",
            headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'}
        )
        with urllib.request.urlopen(req) as res:
            classes = json.loads(res.read().decode('utf-8'))
            print("Classes matching '8 B':", classes)
            if not classes:
                return
            
            class_id = classes[0]['id']
            
            # Now fetch all students for class_id
            req2 = urllib.request.Request(
                f"{supabase_url}/rest/v1/students?class_id=eq.{class_id}&select=*",
                headers={'apikey': supabase_key, 'Authorization': f'Bearer {supabase_key}'}
            )
            with urllib.request.urlopen(req2) as res2:
                students = json.loads(res2.read().decode('utf-8'))
                print(f"Total students in class 8 B: {len(students)}")
                
                # Print first 10 students to inspect duplicates
                for s in students[:12]:
                    print(f"ID: {s['id']}, Roll No: {s['roll_no']}, Name: {s['name']}, UID: {s['uid']}")
                    
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    inspect_students()
