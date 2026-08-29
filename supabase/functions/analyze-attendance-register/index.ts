import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-flash'
    
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured.')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // 1. Authenticate Request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { base64Image, classId, mimeType, selectedDate } = await req.json()
    if (!base64Image || !classId || !mimeType || !selectedDate) {
      throw new Error('Missing required fields: base64Image, mimeType, classId, or selectedDate')
    }

    // 2. Authorize User against Class
    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const role = profile.role
    if (!['teacher', 'admin', 'superadmin', 'principal'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Forbidden. Invalid role.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (role === 'teacher') {
      // Check if they are class teacher
      const { data: classData } = await supabaseAdmin.from('classes').select('class_teacher_id').eq('id', classId).single()
      
      // Check if they teach any subject in that class
      const { data: tsData } = await supabaseAdmin.from('teacher_subjects').select('id').eq('teacher_id', user.id).eq('class_id', classId).limit(1)

      const isAuthorized = (classData?.class_teacher_id === user.id) || (tsData && tsData.length > 0)
      if (!isAuthorized) {
        return new Response(JSON.stringify({ error: 'Forbidden. You are not authorized to manage attendance for this class.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // Parse the target date
    const targetDateObj = new Date(selectedDate);
    const targetDay = targetDateObj.getDate();
    const targetMonth = targetDateObj.toLocaleString('en-US', { month: 'long' });
    const targetYear = targetDateObj.getFullYear();

    // 3. Prepare Gemini API Request
    const prompt = `You are extracting attendance information from a photograph of a school attendance register.
Analyze the image carefully.

The teacher selected the date: ${targetMonth} ${targetDay}, ${targetYear}. 
Your primary task is to extract attendance ONLY for this specific date.

Follow these critical steps:
1. First, check if the register belongs to the expected month and year (${targetMonth} ${targetYear}). If it clearly belongs to a completely different month/year, set "month_year_match" to false.
2. Locate the date headers (e.g., numbers 1 to 31 across the top).
3. Identify the specific header corresponding to the target day: ${targetDay}.
4. Trace that exact column downward.
5. Extract attendance marks ONLY from that specific column.
6. Completely ignore attendance marks appearing under other days and all other date columns. Do not use marks from neighboring columns to infer the selected day's status.
7. If the column for day ${targetDay} is completely blank for a student, their status is null. Do not copy marks from adjacent columns.

If you cannot confidently locate the column for day ${targetDay} (e.g., it is cut off, too blurry, or not present), you MUST set "date_column_found" to false and return an empty records array. DO NOT GUESS.

Return ONLY a valid JSON object matching this exact structure:
{
  "date_column_found": <boolean>,
  "date_column_label": <string or null, e.g., "28">,
  "date_column_confidence": <number between 0 and 1>,
  "month_year_match": <boolean>,
  "records": [
    {
      "name": "student name exactly or approximately as written",
      "roll_no": <number or null>,
      "status": "Present" or "Absent" or "Late" or "Leave" or null,
      "confidence": <number between 0 and 1>
    }
  ]
}

Rules:
1. Do not invent students or roll numbers.
2. If a roll number is unreadable, return null.
3. If the student's identity is unclear, return the visible text but mark confidence low.
4. If the attendance mark in the TARGET COLUMN is unclear, return status null.
5. Never guess Present or Absent.
6. Return only the JSON object, no markdown, no backticks.
`

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`
    
    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topK: 32,
        topP: 1,
        responseMimeType: "application/json"
      }
    }

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API Error:', errorText)
      throw new Error('Failed to analyze image with Gemini API.')
    }

    const responseData = await response.json()
    const rawText = responseData.candidates[0].content.parts[0].text
    
    // Parse the JSON
    let extractedData = null
    try {
      extractedData = JSON.parse(rawText)
      if (typeof extractedData !== 'object' || !Array.isArray(extractedData.records)) {
         throw new Error("Response structure invalid")
      }
    } catch (err) {
      console.error("JSON parsing error:", rawText)
      throw new Error("AI returned invalid data format.")
    }

    // 4. Validate output
    const validatedRecords = extractedData.records.map((item: any) => ({
      name: typeof item.name === 'string' ? item.name : '',
      roll_no: typeof item.roll_no === 'number' ? item.roll_no : null,
      status: ['Present', 'Absent', 'Late', 'Leave'].includes(item.status) ? item.status : null,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0
    })).filter((item: any) => item.name || item.roll_no) // Keep only valid items

    return new Response(JSON.stringify({ 
      date_column_found: extractedData.date_column_found === true,
      date_column_label: extractedData.date_column_label || null,
      date_column_confidence: extractedData.date_column_confidence || 0,
      month_year_match: extractedData.month_year_match !== false,
      results: validatedRecords 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 200 
    })

  } catch (error: any) {
    console.error('Edge Function Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 400 
    })
  }
})
