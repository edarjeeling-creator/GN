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

    const { base64Image, classId, mimeType, selectedDate, scanMode = 'day' } = await req.json()
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
    let prompt = '';
    if (scanMode === 'month') {
      prompt = `You are extracting full-month attendance data from a photograph of a physical school attendance register page.
Analyze the image carefully.

Reference Date Context: Month of ${targetMonth} ${targetYear}.

Your primary task: Extract attendance markings for ALL days across the month that contain attendance records.

Follow these critical steps:
1. Examine the register header for Month and Year (e.g., "Attendance Register For the Month of February 2026").
   Extract the detected month name and year (if partially obscured, use ${targetMonth} ${targetYear}).
2. Locate the date column headers across the page (columns numbered 1 through 31).
3. Identify ALL date columns that contain attendance entries (check marks, ticks, 'P', 'p', 'ab', 'a', 'A', 'L', 'ML', 'Leave', crosses, etc.).
   Completely ignore columns that are entirely blank (e.g. days before the session started, holidays/Sundays with no entries, or blank future days).
4. For every student row on the register:
   a. Read their Roll No / Serial Number (Sl No) and Student Name.
   b. For EVERY active date column identified in step 3, determine the student's attendance status.
5. Standardize attendance status for each day:
   - "Present": checkmark / tick mark (✓) or 'P' or 'p'
   - "Absent": 'ab' or 'a' or 'A' or cross (✗)
   - "Late": 'L' or 'l'
   - "Leave": 'ML' or 'CL' or 'Leave' or 'Lv'
   - null: if the cell for that day is blank or unreadable
6. Return the detected days as numbers [1, 2, ...] and also as full ISO date strings "YYYY-MM-DD" based on the detected year and month.

Return ONLY a valid JSON object matching this exact structure:
{
  "scan_mode": "full_month",
  "month_name": "${targetMonth}",
  "year": ${targetYear},
  "detected_days": [18, 19, 20, 21, 23, 24, 25, 26, 27, 28],
  "detected_dates": ["${targetYear}-02-18", "${targetYear}-02-19"],
  "records": [
    {
      "roll_no": 1,
      "name": "Balmiki Ishika",
      "attendance": {
        "${targetYear}-02-18": "Present",
        "${targetYear}-02-19": "Present"
      },
      "confidence": 0.95
    }
  ]
}

Rules:
1. Do not invent students or roll numbers. Use only visible rows.
2. If roll number is unclear, return null.
3. Every student's "attendance" object MUST include an entry for each date in "detected_dates". If blank for that day, set value to null.
4. Return ONLY raw JSON without markdown code fences or backticks.`;
    } else {
      prompt = `You are extracting attendance information from a photograph of a school attendance register.
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
`;
    }

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
    if (scanMode === 'month') {
      const detectedMonthName = extractedData.month_name || targetMonth;
      const detectedYear = typeof extractedData.year === 'number' ? extractedData.year : targetYear;

      const monthMap: Record<string, string> = {
        january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
        july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
      };
      const mKey = detectedMonthName.toString().toLowerCase().trim();
      const targetMM = String(targetDateObj.getMonth() + 1).padStart(2, '0');
      const monthNumStr = monthMap[mKey] || targetMM;

      const dateSet = new Set<string>();
      if (Array.isArray(extractedData.detected_dates)) {
        extractedData.detected_dates.forEach((d: any) => {
          if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
            dateSet.add(d.trim());
          }
        });
      }
      if (Array.isArray(extractedData.detected_days)) {
        extractedData.detected_days.forEach((day: any) => {
          const num = parseInt(day, 10);
          if (!isNaN(num) && num >= 1 && num <= 31) {
            const dayStr = String(num).padStart(2, '0');
            dateSet.add(`${detectedYear}-${monthNumStr}-${dayStr}`);
          }
        });
      }

      const detectedDates = Array.from(dateSet).sort();

      const validatedRecords = (extractedData.records || []).map((item: any) => {
        const normAttendance: Record<string, any> = {};
        detectedDates.forEach(dateStr => {
          const dayNum = parseInt(dateStr.split('-')[2], 10);
          const val = item.attendance?.[dateStr] ?? item.attendance?.[String(dayNum)] ?? item.attendance?.[dayNum];

          if (['Present', 'Absent', 'Late', 'Leave', 'Half Day'].includes(val)) {
            normAttendance[dateStr] = val;
          } else if (typeof val === 'string' && (val.toLowerCase().includes('present') || val === 'P' || val === 'p' || val === '✓')) {
            normAttendance[dateStr] = 'Present';
          } else if (typeof val === 'string' && (val.toLowerCase().includes('absent') || val.toLowerCase() === 'ab' || val === 'A' || val === 'a' || val === '✗')) {
            normAttendance[dateStr] = 'Absent';
          } else if (typeof val === 'string' && (val.toLowerCase().includes('leave') || val.toLowerCase() === 'ml' || val.toLowerCase() === 'cl')) {
            normAttendance[dateStr] = 'Leave';
          } else if (typeof val === 'string' && val.toLowerCase().includes('late')) {
            normAttendance[dateStr] = 'Late';
          } else {
            normAttendance[dateStr] = null;
          }
        });

        return {
          name: typeof item.name === 'string' ? item.name.trim() : '',
          roll_no: typeof item.roll_no === 'number' ? item.roll_no : (parseInt(item.roll_no, 10) || null),
          attendance: normAttendance,
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.95
        };
      }).filter((item: any) => item.name || item.roll_no);

      return new Response(JSON.stringify({ 
        scan_mode: 'full_month',
        month_name: detectedMonthName,
        year: detectedYear,
        detected_days: detectedDates.map(d => parseInt(d.split('-')[2], 10)),
        detected_dates: detectedDates,
        results: validatedRecords 
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      });
    }

    const validatedRecords = extractedData.records.map((item: any) => ({
      name: typeof item.name === 'string' ? item.name : '',
      roll_no: typeof item.roll_no === 'number' ? item.roll_no : null,
      status: ['Present', 'Absent', 'Late', 'Leave'].includes(item.status) ? item.status : null,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0
    })).filter((item: any) => item.name || item.roll_no) // Keep only valid items

    return new Response(JSON.stringify({ 
      scan_mode: 'single_day',
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
