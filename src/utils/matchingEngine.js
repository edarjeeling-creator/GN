import fuzzysort from 'fuzzysort';

export const normalizeName = (name) => {
  if (!name) return '';
  return name.replace(/[,\.]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
};

// Converts "Tamang Rajesh" to "Rajesh Tamang" and vice versa
export const getReversedName = (name) => {
  if (!name) return '';
  const parts = normalizeName(name).split(' ');
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  // For 3+ names (e.g. "B.K. ELEANA SINGH")
  if (parts.length > 2) {
    // Try taking the last word and putting it first
    const last = parts.pop();
    return `${last} ${parts.join(' ')}`;
  }
  return name;
};

export const calculateConfidence = (extractedData, student) => {
  const { uid, name, rollNo, className, sec } = extractedData;
  const dbUid = student.uid ? String(student.uid) : null;
  const dbRollNo = student.roll_no ? String(student.roll_no) : null;
  const dbClassName = student.class_name ? String(student.class_name).toLowerCase() : null;
  const dbSec = student.section ? String(student.section).toLowerCase() : null;
  
  // 1. Admission Number (UID) Match
  if (uid && dbUid && uid === dbUid) {
    return { score: 100, type: 'UID Match', student };
  }

  // 2. Exact Name Match
  const normExtracted = normalizeName(name);
  const normDb = normalizeName(student.name);
  
  if (normExtracted && normDb && normExtracted === normDb) {
    return { score: 95, type: 'Exact Name Match', student };
  }

  // 3. Reversed Name Match
  if (normExtracted && normDb && getReversedName(normExtracted) === normDb) {
    return { score: 90, type: 'Reversed Name Match', student };
  }

  // 4. Roll Number + Class + Section Match
  if (rollNo && className && dbRollNo && dbClassName) {
    if (rollNo === dbRollNo && className.toLowerCase() === dbClassName && (sec ? sec.toLowerCase() === dbSec : true)) {
      return { score: 98, type: 'Roll+Class Match', student };
    }
  }

  // 5. Fuzzy Match
  if (normExtracted && normDb) {
    // Use fuzzysort to score
    const result = fuzzysort.single(normExtracted, normDb);
    if (result && result.score > -200) { // arbitrary threshold for fuzzysort
      // Normalize fuzzysort score (0 is perfect, negative is worse)
      // Math.max(0, 89 + (result.score / 10)) -> gives a score between 70-89
      let fuzzyScore = 89 + (result.score / 10);
      fuzzyScore = Math.max(70, Math.min(89, Math.round(fuzzyScore)));
      return { score: fuzzyScore, type: 'Fuzzy Match', student };
    }
  }

  return { score: 0, type: 'No Match', student };
};

export const findBestMatch = (extractedData, students) => {
  let bestMatch = null;
  let highestScore = 0;

  for (const student of students) {
    const match = calculateConfidence(extractedData, student);
    if (match.score > highestScore) {
      highestScore = match.score;
      bestMatch = match;
    }
  }

  return bestMatch || { score: 0, type: 'No Match', student: null };
};
