import { supabase } from '../lib/supabase';
import { formatStudentDisplayName, formatDisplayDate } from '../utils/studentUtils';

/**
 * Factory Default Templates (Hardened fallback)
 */
export const FACTORY_TEMPLATES = {
  absentee_alert: {
    id: 'absentee_alert',
    name: 'Absentee Alert',
    description: 'Sent to parents when a student is marked absent for the day.',
    template: `*GYANODAY NIKETAN*
*ABSENCE ALERT*

Dear Parent,
Your ward *{student_name}* (Class {class_name}, Roll No: {roll_no}) is marked *ABSENT* today ({date}).

Please ensure regular attendance. Contact the school if this absence was unavoidable.`,
    availablePlaceholders: ['{school_name}', '{student_name}', '{class_name}', '{roll_no}', '{date}', '{teacher_name}', '{custom_text}']
  },
  daily_absence_summary: {
    id: 'daily_absence_summary',
    name: 'Daily Absence Report',
    description: 'Consolidated report sent to Principal and broadcast to class teacher groups.',
    template: `📋 *DAILY ABSENCE REPORT - {class_name}*
Date: {date}
Teacher: {teacher_name}
Total Absentees: {absent_count}

{absent_list}

- {school_name} ERP`,
    availablePlaceholders: ['{school_name}', '{class_name}', '{date}', '{teacher_name}', '{absent_count}', '{absent_list}']
  },
  general_notice: {
    id: 'general_notice',
    name: 'General Notice',
    description: 'General communication or announcement sent to a parent.',
    template: `*GYANODAY NIKETAN*

Dear Parent of *{student_name}* (Class {class_name}, Roll No: {roll_no}),

{custom_text}

Regards,
{school_name}`,
    availablePlaceholders: ['{school_name}', '{student_name}', '{class_name}', '{roll_no}', '{date}', '{teacher_name}', '{custom_text}']
  },
  fee_reminder: {
    id: 'fee_reminder',
    name: 'Fee Reminder',
    description: 'Gentle reminder sent to parents regarding pending fee dues.',
    template: `*GYANODAY NIKETAN*
*FEE NOTICE*

Dear Parent of *{student_name}* (Class {class_name}, Roll No: {roll_no}),

This is a gentle reminder regarding pending school fees. Kindly clear the dues at your earliest convenience.

Thank you,
{school_name}`,
    availablePlaceholders: ['{school_name}', '{student_name}', '{class_name}', '{roll_no}', '{school_name}', '{custom_text}']
  }
};

export const PLACEHOLDERS_LEGEND = [
  { tag: '{student_name}', label: 'Student Name', desc: 'Formatted first-name-first' },
  { tag: '{class_name}', label: 'Class & Sec', desc: 'e.g., 6 A' },
  { tag: '{roll_no}', label: 'Roll No', desc: 'Student roll number' },
  { tag: '{date}', label: 'Date', desc: 'DD-Mon-YYYY (e.g. 06-Sept-2026)' },
  { tag: '{school_name}', label: 'School Name', desc: 'Gyanoday Niketan' },
  { tag: '{teacher_name}', label: 'Teacher Name', desc: 'Name of the class teacher' },
  { tag: '{custom_text}', label: 'Custom Text', desc: 'Custom note added before sending' },
  { tag: '{absent_count}', label: 'Absent Count', desc: 'Total number of absentees' },
  { tag: '{absent_list}', label: 'Absent List', desc: 'Numbered list of absent students' }
];

const SETTING_KEY = 'whatsapp_message_templates';
const LOCAL_STORAGE_CACHE_KEY = 'gn_whatsapp_templates_cache';

class MessageTemplateService {
  constructor() {
    this._cachedData = null;
    this._cacheTimestamp = 0;
  }

  /**
   * Normalize standard Indian phone numbers to international WhatsApp format
   */
  normalizePhoneNumber(phone) {
    if (!phone) return null;
    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 10) return `91${cleaned}`;
    if (cleaned.length === 12 && cleaned.startsWith('91')) return cleaned;
    return cleaned;
  }

  /**
   * Generates a properly encoded WhatsApp URL (https://wa.me/{phone}?text={encoded})
   */
  generateWhatsAppUrl(phoneNumber, messageText) {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone) return null;
    const text = messageText || '';
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
  }

  /**
   * Return factory defaults
   */
  getFactoryDefaults() {
    const defaults = {};
    for (const [key, val] of Object.entries(FACTORY_TEMPLATES)) {
      defaults[key] = val.template;
    }
    return defaults;
  }

  /**
   * Read raw settings container from Supabase school_settings or fallback
   */
  async _fetchRemoteSettings() {
    try {
      const { data, error } = await supabase
        .from('school_settings')
        .select('setting_value')
        .eq('setting_key', SETTING_KEY)
        .maybeSingle();

      if (error) {
        console.warn('Error reading whatsapp_message_templates from school_settings:', error.message);
        return null;
      }

      if (!data || !data.setting_value) return null;

      let parsed = null;
      if (typeof data.setting_value === 'object') {
        parsed = data.setting_value;
      } else {
        parsed = JSON.parse(data.setting_value);
      }
      return parsed;
    } catch (err) {
      console.warn('Fallback: failed to parse whatsapp_message_templates:', err);
      return null;
    }
  }

  /**
   * Save entire structure to school_settings
   */
  async _saveRemoteSettings(settingsObj) {
    const payload = {
      setting_key: SETTING_KEY,
      setting_value: typeof settingsObj === 'string' ? settingsObj : JSON.stringify(settingsObj),
      description: 'WhatsApp communication templates for Admin and Teachers',
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('school_settings')
      .upsert(payload, { onConflict: 'setting_key' });

    if (error) {
      console.error('Failed to save whatsapp_message_templates:', error);
      throw error;
    }

    // Update memory & local cache
    this._cachedData = settingsObj;
    this._cacheTimestamp = Date.now();
    try {
      localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(settingsObj));
    } catch (e) {
      // Ignore localStorage errors
    }
  }

  /**
   * Get raw store (merges school and teachers dictionaries)
   */
  async getRawStore(forceRefresh = false) {
    if (!forceRefresh && this._cachedData && (Date.now() - this._cacheTimestamp < 60000)) {
      return this._cachedData;
    }

    // Try reading local storage first for instant rendering
    if (!this._cachedData) {
      try {
        const local = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
        if (local) {
          this._cachedData = JSON.parse(local);
          this._cacheTimestamp = Date.now();
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    // Fetch from Supabase
    const remote = await this._fetchRemoteSettings();
    if (remote && typeof remote === 'object') {
      this._cachedData = remote;
      this._cacheTimestamp = Date.now();
      try {
        localStorage.setItem(LOCAL_STORAGE_CACHE_KEY, JSON.stringify(remote));
      } catch (e) {
        // Ignore
      }
    }

    if (!this._cachedData) {
      this._cachedData = {
        school: this.getFactoryDefaults(),
        teachers: {}
      };
    }

    return this._cachedData;
  }

  /**
   * Load effective templates for a given teacher.
   * Precedence: Teacher Override -> School Default -> Factory Default
   */
  async loadTemplates(teacherId = null) {
    const raw = await this.getRawStore();
    const factory = this.getFactoryDefaults();
    const school = raw?.school || {};
    const teacherOverrides = (teacherId && raw?.teachers && raw?.teachers[teacherId]) || {};

    const effective = {};
    const meta = {};

    for (const key of Object.keys(FACTORY_TEMPLATES)) {
      const factoryVal = factory[key];
      const schoolVal = school[key] || factoryVal;
      const teacherVal = teacherOverrides[key];

      if (teacherVal && typeof teacherVal === 'string' && teacherVal.trim()) {
        effective[key] = teacherVal;
        meta[key] = { isCustom: true, source: 'teacher' };
      } else if (school[key] && typeof school[key] === 'string' && school[key].trim()) {
        effective[key] = school[key];
        meta[key] = { isCustom: false, source: 'school' };
      } else {
        effective[key] = factoryVal;
        meta[key] = { isCustom: false, source: 'factory' };
      }
    }

    return {
      templates: effective,
      schoolTemplates: { ...factory, ...school },
      teacherOverrides,
      meta
    };
  }

  /**
   * Save school-wide templates (Admin action)
   */
  async saveSchoolTemplates(updatedSchoolTemplates) {
    const current = await this.getRawStore(true);
    const updated = {
      ...current,
      school: {
        ...(current.school || this.getFactoryDefaults()),
        ...updatedSchoolTemplates
      }
    };
    await this._saveRemoteSettings(updated);
    return updated.school;
  }

  /**
   * Save personal template overrides for a teacher
   */
  async saveTeacherTemplates(teacherId, updatedTeacherTemplates) {
    if (!teacherId) throw new Error('teacherId is required to save teacher templates.');
    const current = await this.getRawStore(true);
    const teachers = current.teachers || {};
    const existingTeacher = teachers[teacherId] || {};

    const updated = {
      ...current,
      teachers: {
        ...teachers,
        [teacherId]: {
          ...existingTeacher,
          ...updatedTeacherTemplates
        }
      }
    };
    await this._saveRemoteSettings(updated);
    return updated.teachers[teacherId];
  }

  /**
   * Reset a teacher's template overrides to school default
   */
  async resetTeacherTemplates(teacherId, templateKey = null) {
    if (!teacherId) throw new Error('teacherId is required.');
    const current = await this.getRawStore(true);
    const teachers = current.teachers || {};
    if (!teachers[teacherId]) return;

    if (templateKey) {
      delete teachers[teacherId][templateKey];
    } else {
      delete teachers[teacherId];
    }

    const updated = {
      ...current,
      teachers: { ...teachers }
    };
    await this._saveRemoteSettings(updated);
  }

  /**
   * Reset school templates to factory default (Admin action)
   */
  async resetSchoolTemplatesToFactory(templateKey = null) {
    const current = await this.getRawStore(true);
    const factory = this.getFactoryDefaults();

    let newSchool = { ...current.school };
    if (templateKey) {
      newSchool[templateKey] = factory[templateKey];
    } else {
      newSchool = { ...factory };
    }

    const updated = {
      ...current,
      school: newSchool
    };
    await this._saveRemoteSettings(updated);
    return updated.school;
  }

  /**
   * Interpolate a template string with runtime variables.
   * Safe with null, undefined, and unprovided keys.
   */
  interpolate(templateString, variables = {}) {
    if (!templateString) return '';
    let result = String(templateString);

    const formatClassLabel = (cls) => {
      if (!cls) return '';
      const str = String(cls).trim();
      return str.toLowerCase().startsWith('class') ? str.replace(/^Class\s+/i, '') : str;
    };

    const studentName = variables.student_name 
      ? formatStudentDisplayName(variables.student_name)
      : (variables.name ? formatStudentDisplayName(variables.name) : 'Student');

    const className = variables.class_name || variables.className || '';
    const rollNo = variables.roll_no !== undefined ? variables.roll_no : (variables.rollNo !== undefined ? variables.rollNo : 'N/A');
    const date = variables.date ? formatDisplayDate(variables.date) : formatDisplayDate(new Date());
    const schoolName = variables.school_name || variables.schoolName || 'Gyanoday Niketan';
    const teacherName = variables.teacher_name || variables.teacherName || 'Class Teacher';
    const customText = variables.custom_text !== undefined ? variables.custom_text : (variables.customText || '');
    const absentCount = variables.absent_count !== undefined ? variables.absent_count : (variables.absentCount || '0');
    const absentList = variables.absent_list || variables.absentList || '';

    // Direct token replacements
    const map = {
      '{student_name}': studentName,
      '{class_name}': formatClassLabel(className),
      '{roll_no}': String(rollNo),
      '{date}': date,
      '{school_name}': schoolName,
      '{teacher_name}': teacherName,
      '{custom_text}': customText,
      '{absent_count}': String(absentCount),
      '{absent_list}': absentList
    };

    for (const [token, value] of Object.entries(map)) {
      result = result.split(token).join(value);
    }

    return result.trim();
  }

  /**
   * Render a message for a given templateKey or custom string
   */
  renderMessage(templateKey, variables = {}, customTemplate = null) {
    if (customTemplate) {
      return this.interpolate(customTemplate, variables);
    }

    // Default template fallback if no custom template is provided
    const factory = this.getFactoryDefaults();
    const fallbackTemplate = factory[templateKey] || factory.absentee_alert;

    return this.interpolate(fallbackTemplate, variables);
  }
}

export const messageTemplateService = new MessageTemplateService();
