/**
 * tuesdayAssemblySchedule.js
 * 
 * Business Rule:
 * Final term marks reflect immediately on Principal Portal and Teacher Portal.
 * For students (Student Portal & Result Portal), Final term marks only reflect
 * on Tuesday during Morning Assembly (08:30 AM IST).
 * 
 * If a teacher posts/updates marks on any day after Tuesday (e.g. Wednesday, Thursday,
 * Friday, Saturday, Sunday, Monday, or Tuesday after 8:30 AM), the marks for students
 * will reflect on the NEXT Tuesday Assembly.
 */

// Assembly is scheduled at 08:30 AM Indian Standard Time (IST, UTC+5:30)
export const ASSEMBLY_HOUR = 8;
export const ASSEMBLY_MINUTE = 30;

/**
 * Converts a given date to IST (Indian Standard Time)
 * Returns { year, month, date, day, hours, minutes, seconds } in IST
 */
export function getISTDateParts(date = new Date()) {
  const d = new Date(date);
  // Format in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });

  const parts = formatter.formatToParts(d);
  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });

  const weekdayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };

  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10) - 1, // 0-indexed
    dayOfMonth: parseInt(map.day, 10),
    dayOfWeek: weekdayMap[map.weekday] ?? 0,
    hours: parseInt(map.hour, 10),
    minutes: parseInt(map.minute, 10),
    seconds: parseInt(map.second, 10)
  };
}

/**
 * Gets the exact UTC Date object representing a specific IST date & time
 */
export function createISTDate(year, month, day, hours = 8, minutes = 30, seconds = 0) {
  // IST is UTC + 5 hours 30 minutes
  // UTC time = IST time - 5 hours 30 minutes
  return new Date(Date.UTC(year, month, day, hours - 5, minutes - 30, seconds));
}

/**
 * Calculates the next Tuesday Assembly release date for a given posted/reference date.
 * 
 * Rule:
 * - If reference date is Tuesday before 8:30 AM IST -> release is THAT Tuesday at 8:30 AM IST.
 * - If reference date is Tuesday after 8:30 AM IST, or Wednesday, Thursday, Friday, Saturday, Sunday, Monday ->
 *   release is the NEXT Tuesday at 8:30 AM IST.
 * 
 * @param {Date|string|number} postedDate - The date when marks were posted/updated
 * @returns {Date} The scheduled Tuesday Assembly release Date (UTC Date object representing 8:30 AM IST)
 */
export function getTuesdayAssemblyReleaseDate(postedDate = new Date()) {
  const p = getISTDateParts(new Date(postedDate));
  
  let daysUntilTuesday = 0;
  if (p.dayOfWeek === 2) { // Tuesday
    // If posted at or after 08:30 AM, it goes to next Tuesday (7 days later)
    if (p.hours > ASSEMBLY_HOUR || (p.hours === ASSEMBLY_HOUR && p.minutes >= ASSEMBLY_MINUTE)) {
      daysUntilTuesday = 7;
    } else {
      daysUntilTuesday = 0; // Today Tuesday before 8:30 AM
    }
  } else if (p.dayOfWeek < 2) {
    // Sunday (0) -> Tuesday (+2)
    // Monday (1) -> Tuesday (+1)
    daysUntilTuesday = 2 - p.dayOfWeek;
  } else {
    // Wednesday (3) -> Next Tuesday (+6)
    // Thursday (4)  -> Next Tuesday (+5)
    // Friday (5)    -> Next Tuesday (+4)
    // Saturday (6)  -> Next Tuesday (+3)
    daysUntilTuesday = (7 - p.dayOfWeek) + 2;
  }

  return createISTDate(p.year, p.month, p.dayOfMonth + daysUntilTuesday, ASSEMBLY_HOUR, ASSEMBLY_MINUTE, 0);
}

/**
 * Checks whether Final Term marks are released for students as of `currentTime`.
 * 
 * @param {Array|Object} marks - List of student marks or a single mark object
 * @param {string} term - The selected term (e.g. 'Finalterm', 'Finalterm_Exam', 'Finalterm_Test')
 * @param {Date} currentTime - Optional current date for testing (defaults to now)
 * @returns {Object} { isReleased: boolean, releaseDate: Date, latestPostedDate: Date }
 */
export function checkFinalTermStudentRelease(marks = [], term = 'Finalterm', currentTime = new Date()) {
  const isFinalTerm = typeof term === 'string' && (
    term.toLowerCase().includes('final') || 
    term.toLowerCase().includes('combined')
  );

  // Non-final terms (e.g. Midterm) follow standard publication rules without Tuesday assembly deferral
  if (!isFinalTerm) {
    return {
      isReleased: true,
      releaseDate: null,
      latestPostedDate: null,
      isFinalTerm: false
    };
  }

  // Find the latest posted/updated timestamp for Final term marks
  let latestDate = null;
  const marksList = Array.isArray(marks) ? marks : [marks];

  for (const m of marksList) {
    if (!m) continue;
    const mTerm = (m.term || '').toLowerCase();
    if (mTerm.includes('final')) {
      const d = m.updated_at || m.created_at || m.timestamp;
      if (d) {
        const parsed = new Date(d);
        if (!isNaN(parsed.getTime())) {
          if (!latestDate || parsed > latestDate) {
            latestDate = parsed;
          }
        }
      }
    }
  }

  // If no specific timestamp found on marks, use current time as reference
  const referenceDate = latestDate || new Date();
  const scheduledReleaseDate = getTuesdayAssemblyReleaseDate(referenceDate);

  const isReleased = new Date(currentTime) >= scheduledReleaseDate;

  return {
    isReleased,
    releaseDate: scheduledReleaseDate,
    latestPostedDate: latestDate,
    isFinalTerm: true
  };
}

/**
 * Formats a date into a friendly string in IST
 * Example: "Tuesday, 22 September 2026 at 08:30 AM (Assembly)"
 */
export function formatAssemblyDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(new Date(date)) + ' (Assembly)';
}

/**
 * Calculates remaining time until the target date
 */
export function getTimeUntilAssembly(targetDate, fromDate = new Date()) {
  const target = new Date(targetDate).getTime();
  const now = new Date(fromDate).getTime();
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isReached: true };
  }

  const seconds = Math.floor((diff / 1000) % 60);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  return { days, hours, minutes, seconds, isReached: false };
}
