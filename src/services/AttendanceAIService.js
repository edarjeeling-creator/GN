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
  async callDirectGeminiVision({ base64Image, mimeType, selectedDate, apiKey }) {
    const targetDateObj = new Date(selectedDate);
    const targetDay = targetDateObj.getDate();
    const targetMonth = targetDateObj.toLocaleString('en-US', { month: 'long' });
    const targetYear = targetDateObj.getFullYear();

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

        const validatedRecords = (parsed.records || []).map((item) => ({
          name: typeof item.name === 'string' ? item.name : '',
          roll_no: typeof item.roll_no === 'number' ? item.roll_no : null,
          status: ['Present', 'Absent', 'Late', 'Leave'].includes(item.status) ? item.status : null,
          confidence: typeof item.confidence === 'number' ? item.confidence : 0
        })).filter(item => item.name || item.roll_no);

        return {
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
  async analyzeRegister({ base64Image, mimeType, classId, selectedDate }) {
    // 1. Attempt Supabase Edge Function
    let edgeFunctionError = null;
    try {
      const { data, error } = await supabase.functions.invoke('analyze-attendance-register', {
        body: { base64Image, mimeType, classId, selectedDate }
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
      apiKey
    });
  }
};
