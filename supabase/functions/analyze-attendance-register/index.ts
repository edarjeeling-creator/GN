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

    const { base64Image, classId, mimeType } = await req.json()
    if (!base64Image || !classId || !mimeType) {
      throw new Error('Missing required fields: base64Image, mimeType, or classId')
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

    // 3. Prepare Gemini API Request
    const prompt = `You are extracting attendance information from a photograph of a school attendance register.
Analyze the image carefully.
Identify each student row and determine the attendance mark for that row.

Return ONLY valid JSON array. Do not include markdown formatting or extra text.

For each recognizable student, return an object matching this exact structure:
{
  "name": "student name exactly or approximately as written",
  "roll_no": <number or null>,
  "status": "Present" or "Absent" or null,
  "confidence": <number between 0 and 1>
}

Rules:
1. Do not invent students.
2. Do not invent roll numbers.
3. If a roll number is unreadable, return null.
4. If the student's identity is unclear, return the visible text but mark confidence low (e.g. 0.4).
5. If the attendance mark is unclear, return status null.
6. Never guess Present or Absent.
7. Do not interpret blank cells as Present unless the register clearly uses blank cells as Present (usually 'P' means Present, 'A' or red ink means Absent).
8. Return only the JSON array.
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
    let extractedData = []
    try {
      extractedData = JSON.parse(rawText)
      if (!Array.isArray(extractedData)) {
         throw new Error("Response was not a JSON array")
      }
    } catch (err) {
      console.error("JSON parsing error:", rawText)
      throw new Error("AI returned invalid data format.")
    }

    // 4. Validate output
    const validatedData = extractedData.map(item => ({
      name: typeof item.name === 'string' ? item.name : '',
      roll_no: typeof item.roll_no === 'number' ? item.roll_no : null,
      status: ['Present', 'Absent', 'Late', 'Leave'].includes(item.status) ? item.status : null,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0
    })).filter(item => item.name || item.roll_no) // Keep only valid items

    return new Response(JSON.stringify({ results: validatedData }), { 
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
