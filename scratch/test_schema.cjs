const supabaseUrl = 'https://grades.gyanodayniketan.cloud';
async function test() {
  const res = await fetch(`${supabaseUrl}/rest/v1/`);
  const json = await res.json();
  console.log("Assignments properties:", Object.keys(json.definitions.assignments.properties));
}
test();
