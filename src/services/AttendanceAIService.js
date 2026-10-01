import { supabase } from '../lib/supabase';

/**
 * Service for analyzing physical attendance register photos using AI.
 * First tries the Supabase Edge Function 'analyze-attendance-register'.
 * If the Edge Function fails (e.g. 404, not deployed on self-hosted Dokploy, or missing server key),
 * it seamlessly falls back to direct Google Gemini Vision API using a school-configured or local API key.
 */

export const AttendanceAIService = {
  /**
   * Retrieve configured Gemini API Key from school_settings or local storage
   */
  async getGeminiApiKey() {
    // 1. Try school_settings table from Supabase
    try {
      const { data, error } = await supabase
        .from('school_settings')
        .select('setting_value')
        .eq('setting_key', 'gemini_api_key')
        .maybeSingle();

      if (!error && data?.setting_value) {
        const val = typeof data.setting_value === 'string' ? data.setting_value : data.setting_value?.key;
        if (val && typeof val === 'string' && val.trim().length > 10) {
          return val.trim();
        }
      }
    } catch (e) {
      console.warn('Could not read gemini_api_key from school_settings:', e);
    }

    // 2. Try localStorage
    try {
      const localKey = localStorage.getItem('gemini_api_key');
      if (localKey && localKey.trim().length > 10) {
        return localKey.trim();
      }
    } catch (e) {
      console.warn('Could not read gemini_api_key from localStorage:', e);
    }

    // 3. Try Vite env variable
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY.trim();
    }

    return null;
  },

  /**
   * Save Gemini API Key to school_settings and localStorage
   */
  async saveGeminiApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
      throw new Error('Please enter a valid Gemini API Key.');
    }
    const cleanKey = apiKey.trim();

    // Save to localStorage
    try {
      localStorage.setItem('gemini_api_key', cleanKey);
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }

    // Save to school_settings so all teachers in the school share it
    try {
      const { error } = await supabase
        .from('school_settings')
        .upsert({
          setting_key: 'gemini_api_key',
          setting_value: cleanKey,
          updated_at: new Date().toISOString()
        }, { onConflict: 'setting_key' });

      if (error) {
        console.warn('Failed to persist gemini_api_key to school_settings:', error.message);
      }
    } catch (e) {
      console.warn('Error saving gemini_api_key to school_settings:', e);
    }

    return cleanKey;
  },

  /**
   * Direct Gemini API Vision extraction
   */
  async callDirectGeminiVision({ base64Image, mimeType, selectedDate, apiKey, scanMode = 'day' }) {
    const targetDateObj = new Date(selectedDate);
    const targetDay = targetDateObj.getDate();
    const targetMonth = targetDateObj.toLocaleString('en-US', { month: 'long' });
    const targetYear = targetDateObj.getFullYear();

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
   CRITICAL CALENDAR RULE: Only extract dates that actually exist in ${targetMonth} (e.g., April, June, September, November have only 30 days — NEVER include day 31; February has 28 or 29 days). If the register page has pre-printed column headers up to 31 in a month with fewer days, IGNORE column 31 completely.
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
  "date_column_found": true,
  "date_column_label": "${targetDay}",
  "date_column_confidence": 0.9,
  "month_year_match": true,
  "records": [
    {
      "name": "student name",
      "roll_no": 1,
      "status": "Present",
      "confidence": 0.95
    }
  ]
}

Rules:
1. Status must be one of: "Present", "Absent", "Late", "Leave", or null.
2. If roll number is unclear, return null.
3. If attendance mark in the target column is unclear, return status null.
4. Return ONLY raw JSON without markdown code fences or backticks.`;
    }

    // 1. Build a robust candidate list with modern models first
    let candidateModels = [
      { model: 'gemini-2.0-flash', version: 'v1beta' },
      { model: 'gemini-2.0-flash', version: 'v1' },
      { model: 'gemini-2.5-flash', version: 'v1beta' },
      { model: 'gemini-2.0-flash-exp', version: 'v1beta' },
      { model: 'gemini-1.5-flash-latest', version: 'v1beta' },
      { model: 'gemini-1.5-flash', version: 'v1' },
      { model: 'gemini-1.5-pro', version: 'v1' },
      { model: 'gemini-2.5-pro', version: 'v1beta' },
      { model: 'gemini-1.5-flash-002', version: 'v1beta' }
    ];

    // Try dynamic model discovery via ListModels to prepend active models
    try {
      const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listResponse.ok) {
        const listData = await listResponse.json();
        const available = (listData.models || [])
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''));

        const discovered = [];
        // Prioritize 2.5 and 2.0 Flash models FIRST
        for (const name of available) {
          if (name.includes('2.5') && name.includes('flash')) {
            discovered.push({ model: name, version: 'v1beta' });
          } else if (name.includes('2.0') && name.includes('flash')) {
            discovered.push({ model: name, version: 'v1beta' }, { model: name, version: 'v1' });
          }
        }
        // Then other flash models (for 1.5, try v1 first because Google deprecated 1.5 on v1beta)
        for (const name of available) {
          if (name.includes('flash') && !name.includes('2.0') && !name.includes('2.5') && !name.includes('8b')) {
            discovered.push({ model: name, version: 'v1' }, { model: name, version: 'v1beta' });
          }
        }
        // Then Pro models
        for (const name of available) {
          if (name.includes('pro')) {
            discovered.push({ model: name, version: 'v1' }, { model: name, version: 'v1beta' });
          }
        }

        if (discovered.length > 0) {
          const seen = new Set();
          const merged = [];
          for (const item of [...discovered, ...candidateModels]) {
            const id = `${item.version}/${item.model}`;
            if (!seen.has(id)) {
              seen.add(id);
              merged.push(item);
            }
          }
          candidateModels = merged;
        }
      }
    } catch (e) {
      console.warn('Could not query ListModels, using default candidate list:', e);
    }

    let lastError = null;

    for (const { model, version } of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
        
        const requestBody = {
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType || 'image/jpeg',
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
        };

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errText = await response.text();
          let parsedErr = errText;
          try {
            const j = JSON.parse(errText);
            parsedErr = j.error?.message || errText;
          } catch {}

          // If the key is invalid or quota exhausted, prompt for a new key immediately
          if (response.status === 400 && (parsedErr.toLowerCase().includes('api key') || parsedErr.toLowerCase().includes('api_key') || parsedErr.toLowerCase().includes('key not valid'))) {
            const keyErr = new Error(`Invalid Gemini API Key: ${parsedErr}`);
            keyErr.needsApiKey = true;
            throw keyErr;
          }

          throw new Error(`(${version}/${model}): ${parsedErr}`);
        }

        const data = await response.json();
        const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawContent) {
          throw new Error('AI returned an empty response.');
        }

        // Clean any accidental markdown backticks
        const cleanJsonStr = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJsonStr);

        if (scanMode === 'month') {
          const detectedMonthName = parsed.month_name || targetMonth;
          const detectedYear = typeof parsed.year === 'number' ? parsed.year : targetYear;

          // Helper to map month name to 2-digit number (1-12)
          const monthMap = {
            january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
            july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
          };
          const mKey = detectedMonthName.toString().toLowerCase().trim();
          const targetMM = String(targetDateObj.getMonth() + 1).padStart(2, '0');
          const monthNumStr = monthMap[mKey] || targetMM;

          const mNum = parseInt(monthNumStr, 10);
          const yNum = parseInt(String(detectedYear), 10);
          // Calculate exact number of days in the detected month/year (UTC date 0 of next month)
          const maxDaysInMonth = new Date(Date.UTC(yNum, mNum, 0)).getUTCDate();

          // Calendar validator: ensures YYYY-MM-DD is an actual calendar date (e.g. rejects 2026-04-31)
          const isValidISODate = (dateStr) => {
            if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return false;
            const [y, m, d] = dateStr.trim().split('-').map(num => parseInt(num, 10));
            if (m < 1 || m > 12 || d < 1 || d > 31) return false;
            const dt = new Date(Date.UTC(y, m - 1, d));
            return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === m && dt.getUTCDate() === d;
          };

          // Build list of valid unique ISO dates
          const dateSet = new Set();
          if (Array.isArray(parsed.detected_dates)) {
            parsed.detected_dates.forEach(d => {
              if (typeof d === 'string') {
                const trimmed = d.trim();
                if (isValidISODate(trimmed)) {
                  const day = parseInt(trimmed.split('-')[2], 10);
                  if (day >= 1 && day <= maxDaysInMonth) {
                    dateSet.add(trimmed);
                  }
                }
              }
            });
          }
          if (Array.isArray(parsed.detected_days)) {
            parsed.detected_days.forEach(day => {
              const num = parseInt(day, 10);
              if (!isNaN(num) && num >= 1 && num <= maxDaysInMonth) {
                const dayStr = String(num).padStart(2, '0');
                const iso = `${detectedYear}-${monthNumStr}-${dayStr}`;
                if (isValidISODate(iso)) {
                  dateSet.add(iso);
                }
              }
            });
          }

          // If no dates extracted yet, scan keys in first records attendance
          if (dateSet.size === 0 && Array.isArray(parsed.records)) {
            parsed.records.forEach(r => {
              if (r.attendance && typeof r.attendance === 'object') {
                Object.keys(r.attendance).forEach(k => {
                  if (isValidISODate(k)) {
                    const day = parseInt(k.split('-')[2], 10);
                    if (day >= 1 && day <= maxDaysInMonth) {
                      dateSet.add(k);
                    }
                  } else {
                    const num = parseInt(k, 10);
                    if (!isNaN(num) && num >= 1 && num <= maxDaysInMonth) {
                      const iso = `${detectedYear}-${monthNumStr}-${String(num).padStart(2, '0')}`;
                      if (isValidISODate(iso)) {
                        dateSet.add(iso);
                      }
                    }
                  }
                });
              }
            });
          }

          const detectedDates = Array.from(dateSet).filter(isValidISODate).sort();

          const validatedRecords = (parsed.records || []).map((item) => {
            const normAttendance = {};
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
          }).filter(item => item.name || item.roll_no);

          return {
            scan_mode: 'full_month',
            month_name: detectedMonthName,
            year: detectedYear,
            detected_days: detectedDates.map(d => parseInt(d.split('-')[2], 10)),
            detected_dates: detectedDates,
            results: validatedRecords
          };
        }

        const validatedRecords = (parsed.records || []).map((item) => ({
          name: typeof item.name === 'string' ? item.name : '',
          roll_no: typeof item.roll_no === 'number' ? item.roll_no : null,
          status: ['Present', 'Absent', 'Late', 'Leave'].includes(item.status) ? item.status : null,
          confidence: typeof item.confidence === 'number' ? item.confidence : 0
        })).filter(item => item.name || item.roll_no);

        return {
          scan_mode: 'single_day',
          date_column_found: parsed.date_column_found === true,
          date_column_label: parsed.date_column_label || null,
          date_column_confidence: parsed.date_column_confidence || 0,
          month_year_match: parsed.month_year_match !== false,
          results: validatedRecords
        };
      } catch (err) {
        lastError = err;
        if (err.needsApiKey) {
          throw err;
        }
        console.warn(`Attempt with ${version}/${model} failed:`, err.message);
      }
    }

    throw lastError || new Error('Failed to analyze image with Gemini Vision.');
  },

  /**
   * Main entry point to analyze attendance register photo.
   * First calls Edge Function. If Edge Function fails or is not deployed, falls back to direct Gemini.
   */
  async analyzeRegister({ base64Image, mimeType, classId, selectedDate, scanMode = 'day' }) {
    // 1. Attempt Supabase Edge Function
    let edgeFunctionError = null;
    try {
      const { data, error } = await supabase.functions.invoke('analyze-attendance-register', {
        body: { base64Image, mimeType, classId, selectedDate, scanMode }
      });

      if (!error && data && data.results) {
        return data;
      }

      if (error) {
        let msg = error.message;
        let status = error.context?.status;
        if (error.context) {
          try {
            const txt = await error.context.text();
            try {
              const j = JSON.parse(txt);
              msg = j.error || j.message || txt;
            } catch {
              msg = txt || error.message;
            }
          } catch {}
        }
        edgeFunctionError = { status, message: msg };
        console.warn('Edge function returned error, attempting client-side Gemini fallback:', edgeFunctionError);
      }
    } catch (e) {
      edgeFunctionError = { message: e.message };
      console.warn('Edge function invoke exception, attempting client-side Gemini fallback:', e);
    }

    // 2. Direct Gemini Fallback
    const apiKey = await this.getGeminiApiKey();
    if (!apiKey) {
      const err = new Error(
        edgeFunctionError?.message 
          ? `AI Server Error: ${edgeFunctionError.message}. To enable direct AI scanning, please configure a Gemini API Key.`
          : 'AI attendance service requires a Google Gemini API Key. Please configure your key.'
      );
      err.needsApiKey = true;
      err.edgeFunctionError = edgeFunctionError;
      throw err;
    }

    return await this.callDirectGeminiVision({
      base64Image,
      mimeType,
      selectedDate,
      apiKey,
      scanMode
    });
  }
};
