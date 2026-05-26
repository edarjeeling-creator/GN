const supabaseUrl = 'https://supabase.gyanodayniketan.cloud';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o';

async function inspect() {
  try {
    console.log("Fetching profiles...");
    const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=name,role,uid`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (!res.ok) {
      console.error("Profiles fetch error:", await res.text());
      return;
    }
    
    const profiles = await res.json();
    console.log("\n--- Faculty/Admin Profiles ---");
    console.table(profiles);
    
    console.log("\nFetching first 10 students...");
    const res2 = await fetch(`${supabaseUrl}/rest/v1/students?select=name,roll_no,uid&limit=10`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (res2.ok) {
      const students = await res2.json();
      console.log("\n--- Sample Student Profiles ---");
      console.table(students);
    }
  } catch (err) {
    console.error("Error inspecting database:", err);
  }
}

inspect();
