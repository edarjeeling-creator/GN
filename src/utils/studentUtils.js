/**
 * Utility functions for student data formatting and messages
 */

// Comprehensive regional and Indian surname dictionary for Himalayan, Nepali, Bengali, and North Indian school records
export const KNOWN_SURNAMES = new Set([
  // Nepali / Gorkha
  'chettri', 'chhetri', 'chherti', 'thapa', 'rai', 'gurung', 'tamang', 'subba', 
  'pradhan', 'sharma', 'mukhia', 'lama', 'biswakarma', 'baraily', 'bardewa', 
  'basnet', 'basfore', 'bhujel', 'bimali', 'dahal', 'darjee', 'darnal', 'dewan', 
  'dhungel', 'diyali', 'dong', 'gadaily', 'gadal', 'gazmer', 'ghalay', 'ghatani', 
  'ghatraj', 'ghimiray', 'ghising', 'giri', 'harizan', 'karki', 'katwal', 'khatri', 
  'khawas', 'lakandri', 'limboo', 'limbu', 'lohar', 'magar', 'mangrati', 'mohra', 
  'moktan', 'pakhrin', 'pariyar', 'rasaily', 'rawat', 'rejwan', 'rizal', 'roka', 'roy', 
  'ruchal', 'santra', 'sarki', 'sashankar', 'sewa', 'shankar', 'sharma', 
  'shashankar', 'sheikh', 'sherpa', 'shil', 'sinchury', 'singh', 'sinha', 
  'siryal', 'subba', 'sundas', 'tamang', 'thakur', 'thakuri', 'thami', 
  'thapa', 'thatal', 'thulung', 'bista', 'bhandari', 
  'pandey', 'tiwari', 'adhikari', 'koirala', 'acharya', 'shrestha', 'b.k.', 'bk',

  // Bhutia / Lepcha / Tibetan / Sherpa / Yolmo
  'bhutia', 'lepcha', 'sherpa', 'yolmo', 'dorje', 'dukpa', 'dikka',

  // Indian / Bihari / Bengali / Marwari
  'agarwal', 'gupta', 'singh', 'yadav', 'prasad', 'kumar', 'kumari', 'roy', 
  'shil', 'chaudhary', 'halder', 'paul', 'poddar', 'thakur', 'sinha', 'das', 
  'santra', 'jaiswal', 'joshi', 'mahato', 'majhi', 'mallay', 'mallick', 'mandal', 
  'garg', 'guida', 'wilkins',

  // Muslim community
  'ali', 'ahmed', 'alam', 'aftab', 'anjum', 'fatima', 'feroz', 'hussain', 
  'islam', 'khan', 'kulshum', 'nawbagh', 'rejwan', 'sheikh'
]);

export const PREFIX_TITLES = new Set([
  'md', 'md.', 'mohd', 'mohd.', 'sk', 'sk.'
]);

/**
 * Format a single name token with proper capitalization and dotted-initial preservation
 */
const formatWord = (p) => {
  if (!p) return '';
  if (p.includes('.')) {
    return p.toUpperCase();
  }
  const upper = p.toUpperCase();
  if (upper === 'BK') {
    return 'BK';
  }
  if (upper === 'SK') {
    return 'Sk';
  }
  if (upper === 'MD') {
    return 'Md';
  }
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
};

/**
 * Intelligent student display name formatter: Single Source of Truth
 * 
 * Rules:
 * 1. Single word names (e.g. "Gyan") are preserved as-is.
 * 2. Prefix titles (e.g. "Md Farhan Aslam") preserve the title at the beginning.
 * 3. Existing names already in First Name -> Last Name order (e.g. "Aarav Singh", "Hridhan Chettri")
 *    are detected and kept as-is (NOT blindly reversed).
 * 4. Two-word compound surnames at the start (e.g. "Thapa Chettri Aanshika") are flipped
 *    together: "Aanshika Thapa Chettri".
 * 5. Multi-word given names in register format (e.g. "Bhutia Druksel Wangdi", "Sherpa Dechen Doma")
 *    are flipped correctly: "Druksel Wangdi Bhutia", "Dechen Doma Sherpa".
 * 6. Standard register names (e.g. "Chettri Hridhan", "Singh Aarav") are flipped to
 *    "Hridhan Chettri", "Aarav Singh".
 * 
 * @param {string} name - Raw student name from database
 * @returns {string} Formatted display name (First Name Last Name)
 */
export const formatStudentDisplayName = (name) => {
  if (!name || typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return parts.map(formatWord).join(' ');
  }

  // Preserve title prefix at the start (e.g. "Md Farhan Aslam", "Sk Imran")
  const firstWordClean = parts[0].toLowerCase().replace(/[.,]/g, '');
  if (PREFIX_TITLES.has(firstWordClean) || PREFIX_TITLES.has(parts[0].toLowerCase())) {
    return parts.map(formatWord).join(' ');
  }

  const firstWordLower = parts[0].toLowerCase();
  const lastWordLower = parts[parts.length - 1].toLowerCase();
  const lastWordClean = lastWordLower.replace(/[.,]/g, '');

  const firstWordIsSurname = KNOWN_SURNAMES.has(firstWordClean) || KNOWN_SURNAMES.has(firstWordLower);
  const lastWordIsSurname = KNOWN_SURNAMES.has(lastWordClean) || KNOWN_SURNAMES.has(lastWordLower);

  // If already in First Name -> Last Name order (e.g. "Aarav Singh", "Hridhan Chettri"):
  // First word is NOT a known surname, but the last word IS a known surname:
  if (!firstWordIsSurname && lastWordIsSurname) {
    return parts.map(formatWord).join(' ');
  }

  // Handle 2-word compound surname at the start (e.g. "Thapa Chettri Aanshika")
  if (parts.length >= 3) {
    const secondWordClean = parts[1].toLowerCase().replace(/[.,]/g, '');
    const secondWordIsSurname = KNOWN_SURNAMES.has(secondWordClean) || KNOWN_SURNAMES.has(parts[1].toLowerCase());
    if (firstWordIsSurname && secondWordIsSurname && !lastWordIsSurname) {
      const compoundSurname = parts.slice(0, 2);
      const given = parts.slice(2);
      const reordered = [...given, ...compoundSurname];
      return reordered.map(formatWord).join(' ');
    }
  }

  // Standard register flipping: [Surname, GivenName(s)...] -> [GivenName(s)..., Surname]
  const surname = parts[0];
  const givenNames = parts.slice(1);
  const reordered = [...givenNames, surname];
  return reordered.map(formatWord).join(' ');
};

/**
 * Format date string into DD-Mon-YYYY format (e.g. 06-Sept-2026)
 * 
 * @param {string|Date} date - Date string or Date object
 * @returns {string} Formatted date string
 */
export const formatDisplayDate = (date) => {
  if (!date) return 'today';
  if (typeof date === 'string' && /^\d{2}-[A-Za-z]{3,4}-\d{4}$/.test(date)) {
    return date;
  }
  try {
    const dt = new Date(date);
    if (!isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).replace(/ /g, '-');
    }
  } catch (e) {}
  return String(date);
};

/**
 * Build the standardized absentee message for parents
 * e.g. "Dear Parent, Aarush Chettri (Class 6 A, Roll No. 1) is *ABSENT* today (06-Sept-2026)."
 */
export const buildAbsenteeParentMessage = ({ name, className, rollNo, date }) => {
  const displayName = formatStudentDisplayName(name);
  const classLabel = className 
    ? (String(className).trim().toLowerCase().startsWith('class') ? className.trim() : `Class ${className.trim()}`)
    : 'Class N/A';
  const rollLabel = rollNo !== undefined && rollNo !== null && rollNo !== ''
    ? (String(rollNo).trim().toLowerCase().includes('roll') ? String(rollNo).trim() : `Roll No. ${rollNo}`)
    : 'Roll No. N/A';
  const formattedDate = formatDisplayDate(date);

  return `Dear Parent, ${displayName} (${classLabel}, ${rollLabel}) is *ABSENT* today (${formattedDate}).`;
};
