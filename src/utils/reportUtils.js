// Authoritative Matchers for 6th Subject electives (ICSE Group III / Senior School)
export const SIXTH_SUBJECT_MATCHERS = [
  'computer application', 'computer applications',
  'fine arts', 'fine art', 'art',
  'home science', 'home sc',
  'physical education', 'physical ed', 'pe',
  'commercial application', 'commercial applications',
  '6th subject', 'sixth subject'
];

export const isSixthSubjectEligibleClass = (className) => {
  if (!className) return false;
  const s = String(className).trim().toLowerCase();
  const numMatch = s.match(/(?:class\s*)?(\d+)/i);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    return num >= 9 && num <= 12;
  }
  return /\b(ix|x|xi|xii)\b/i.test(s) || /^(ix|x|xi|xii)/i.test(s);
};

export const isSixthSubject = (subjectName, className = null) => {
  if (!subjectName) return false;
  if (className && !isSixthSubjectEligibleClass(className)) return false;
  const s = String(subjectName).toLowerCase().trim();
  return SIXTH_SUBJECT_MATCHERS.some(m => s === m || s.includes(m));
};

export const getGroupsForClass = (className) => {
  const isEligible = isSixthSubjectEligibleClass(className);
  const isICSEClass = className?.match(/\b(9|10|ix|x)\b/i);
  const isISCClass = className?.match(/\b(11|12|xi|xii)\b/i);

  const sixthSubjectGroup = {
    name: '6th Subject',
    matchers: SIXTH_SUBJECT_MATCHERS
  };

  if (isICSEClass) {
    return [
      { name: 'English', matchers: ['english paper', 'english language', 'english literature'] },
      { name: 'HCG', matchers: ['history', 'civics', 'geography'] },
      { name: 'Science', matchers: ['physics', 'chemistry', 'biology', 'science'] },
      sixthSubjectGroup
    ];
  } else if (isISCClass) {
    return [
      { name: 'English', matchers: ['english paper', 'english language', 'english literature'] },
      sixthSubjectGroup
    ];
  } else if (isEligible) {
    return [sixthSubjectGroup];
  }
  // For classes below 9 (e.g. Classes 1 to 8), 6th Subject does not exist
  return [];
};

export const getDynamicSubjectName = (name, student) => {
  if (!name) return '';
  const lowerName = name.toLowerCase();
  const isSec = lowerName.includes('2nd language') || lowerName.includes('second language');
  const isThird = lowerName.includes('3rd language') || lowerName.includes('third language');
  const isElective = lowerName.includes('elective') || lowerName.includes('evs/math') || lowerName.includes('maths/evs') || lowerName.includes('math/evs');
  const isSixth = lowerName.includes('6th') || lowerName.includes('sixth') || isSixthSubject(name);
  
  if (isSec && student?.second_language && !lowerName.includes(student.second_language.toLowerCase())) {
    return `${name} (${student.second_language})`;
  }
  if (isThird && student?.third_language && !lowerName.includes(student.third_language.toLowerCase())) {
    return `${name} (${student.third_language})`;
  }
  if (isElective && student?.elective_subject) {
    return student.elective_subject;
  }
  if (isSixth && student?.sixth_subject && (lowerName.includes('6th') || lowerName.includes('sixth'))) {
    return student.sixth_subject;
  }
  return name;
};

export const calculateAttendancePercentage = (attendanceData, studentId, academicYear) => {
  if (!attendanceData) return '-';
  const stuAtt = attendanceData.filter(a => 
    (!studentId || a.student_id === studentId) && 
    (!academicYear || a.academic_year === academicYear)
  );
  
  const totalWorkingDays = stuAtt.length;
  if (totalWorkingDays === 0) return '-';

  const daysPresent = stuAtt.filter(a => a.status === 'Present' || a.status === 'Late').length;
  const daysHalfDay = stuAtt.filter(a => a.status === 'Half Day').length;
  const effectivePresent = daysPresent + (daysHalfDay * 0.5);
  
  return ((effectivePresent / totalWorkingDays) * 100).toFixed(1);
};

export const getGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
};

export const getGradeColor = (grade) => {
  if (grade === 'A+' || grade === 'A') return '#16a34a';
  if (grade === 'B+' || grade === 'B') return '#2563eb';
  if (grade === 'C') return '#ca8a04';
  if (grade === 'D') return '#ea580c';
  return '#dc2626';
};
