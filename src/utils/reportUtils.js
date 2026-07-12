export const getGroupsForClass = (className) => {
  const isICSEClass = className?.match(/\b(9|10|ix|x)\b/i);
  const isISCClass = className?.match(/\b(11|12|xi|xii)\b/i);

  if (isICSEClass) {
    return [
      { name: 'English', matchers: ['english paper', 'english language', 'english literature'] },
      { name: 'HCG', matchers: ['history', 'civics', 'geography'] },
      { name: 'Science', matchers: ['physics', 'chemistry', 'biology', 'science'] }
    ];
  } else if (isISCClass) {
    return [
      { name: 'English', matchers: ['english paper', 'english language', 'english literature'] }
    ];
  }
  return [];
};

export const getDynamicSubjectName = (name, student) => {
  const lowerName = name.toLowerCase();
  const isSec = lowerName.includes('2nd language') || lowerName.includes('second language');
  const isThird = lowerName.includes('3rd language') || lowerName.includes('third language');
  const isElective = lowerName.includes('elective') || lowerName.includes('evs/math') || lowerName.includes('maths/evs') || lowerName.includes('math/evs');
  const isSixth = lowerName.includes('6th') || lowerName.includes('sixth');
  
  if (isSec && student?.second_language && !lowerName.includes(student.second_language.toLowerCase())) {
    return `${name} (${student.second_language})`;
  }
  if (isThird && student?.third_language && !lowerName.includes(student.third_language.toLowerCase())) {
    return `${name} (${student.third_language})`;
  }
  if (isElective && student?.elective_subject) {
    return student.elective_subject;
  }
  if (isSixth && student?.sixth_subject) {
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
