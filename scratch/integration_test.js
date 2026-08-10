import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runTests() {
  console.log("Starting Integration Tests...")

  // 1. Get a random student
  const { data: students, error: studentError } = await supabase.from('students').select('*').limit(1)
  if (studentError || !students || students.length === 0) {
    console.error("Could not fetch a student to test.", studentError)
    return
  }
  const student = students[0]
  console.log(`Using Student ID: ${student.id} (${student.name})`)

  // 2. Generate a token
  console.log("Testing token generation...")
  const { data: token, error: tokenError } = await supabase.rpc('generate_form_token', {
    p_user_id: student.id,
    p_role: 'student'
  })
  
  if (tokenError) {
    console.error("Failed to generate token:", tokenError)
    return
  }
  console.log("Token generated:", token)

  // 3. Validate the token
  console.log("Testing token validation...")
  const { data: validData, error: validError } = await supabase.rpc('validate_form_token', { p_token: token })
  if (validError || !validData.valid) {
    console.error("Token validation failed:", validError || validData)
    return
  }
  console.log("Token is valid. User Data:", validData)

  // 4. Submit the form
  console.log("Testing form submission...")
  const payload = {
    blood_group: 'B+',
    dob: '2010-01-01',
    contact_number: '9876543210',
    address: 'Test Address 123',
    father_name: 'Test Father',
    picture_path: 'https://example.com/test.jpg',
    photo_width: 600,
    photo_height: 800,
    photo_size_bytes: 150000
  }
  
  const { data: submitData, error: submitError } = await supabase.rpc('submit_id_form', {
    p_token: token,
    p_role: 'student',
    p_data: payload
  })
  
  if (submitError || !submitData.success) {
    console.error("Form submission failed:", submitError || submitData)
    return
  }
  console.log("Form submitted successfully:", submitData)

  // 5. Test Duplicate Submission
  console.log("Testing duplicate submission protection...")
  const { data: dupData, error: dupError } = await supabase.rpc('submit_id_form', {
    p_token: token,
    p_role: 'student',
    p_data: payload
  })
  
  if (dupError || dupData.success) {
    console.error("Duplicate protection failed! It allowed the submission.", dupError || dupData)
    return
  }
  console.log("Duplicate protection works. Outcome:", dupData.error)

  console.log("All Integration Tests Passed Successfully!")
}

runTests()
