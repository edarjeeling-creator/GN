import { createClient } from '@supabase/supabase-js'

// Hardcoded URL and Key to ensure perfect matching and bypass broken Dokploy variables
const supabaseUrl = 'https://supabase.gyanodayniketan.cloud'
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NzE0MDY0MCwiZXhwIjo0OTIyODE0MjQwLCJyb2xlIjoiYW5vbiJ9.Vl3qQP1iC2oZ7622xUFZen6IM25QdSLzL0-NbwEQd-o'

if (!supabaseKey) {
  console.warn("VITE_SUPABASE_KEY is missing. Please add it to your .env.local file.");
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Multi-Tenant SaaS State
let activeSchoolId = null;

export const setClientSchoolId = (id) => {
  activeSchoolId = id;
};

export const getClientSchoolId = () => activeSchoolId;

// Intercept Supabase queries to inject school_id tenant isolation transparently!
const originalFrom = supabase.from;
supabase.from = (table) => {
  const builder = originalFrom.call(supabase, table);
  
  // List of tables that require school_id isolation
  const tenantTables = [
    'classes', 'subjects', 'students', 'teacher_subjects', 'marks', 
    'profiles', 'attendance', 'news', 'faculty', 'gallery', 
    'site_settings', 'python_lessons', 'python_assignments', 'python_submissions'
  ];
  
  if (activeSchoolId && tenantTables.includes(table)) {
    const originalSelect = builder.select;
    builder.select = function(...args) {
      return originalSelect.apply(this, args).eq('school_id', activeSchoolId);
    };
    
    const originalInsert = builder.insert;
    builder.insert = function(values, ...args) {
      if (Array.isArray(values)) {
        values = values.map(v => ({ ...v, school_id: activeSchoolId }));
      } else if (values && typeof values === 'object') {
        values = { ...values, school_id: activeSchoolId };
      }
      return originalInsert.call(this, values, ...args);
    };

    const originalUpdate = builder.update;
    builder.update = function(values, ...args) {
      if (values && typeof values === 'object') {
        values = { ...values, school_id: activeSchoolId };
      }
      return originalUpdate.call(this, values, ...args).eq('school_id', activeSchoolId);
    };

    const originalDelete = builder.delete;
    builder.delete = function(...args) {
      return originalDelete.apply(this, args).eq('school_id', activeSchoolId);
    };

    const originalUpsert = builder.upsert;
    builder.upsert = function(values, ...args) {
      if (Array.isArray(values)) {
        values = values.map(v => ({ ...v, school_id: activeSchoolId }));
      } else if (values && typeof values === 'object') {
        values = { ...values, school_id: activeSchoolId };
      }
      return originalUpsert.call(this, values, ...args);
    };
  }
  
  return builder;
};
