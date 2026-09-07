/**
 * Centralized utility to map HPC terms to existing ERP marks term conventions.
 * 
 * ERP expects: `YYYY-YYYY_TermName` e.g., `2024-2025_Midterm_Exam`
 * HPC provides: Academic Year Name (`2024-2025`) and Term Name (`Term 1`)
 */
export function resolveMarksTerm(academicYearName, termName) {
  if (!academicYearName || !termName) return null;

  // Basic mapping of common HPC term names to existing ERP term conventions
  const termMapping = {
    'Term 1': 'Midterm_Exam',
    'Term 2': 'Final_Exam',
    'Midterm': 'Midterm_Exam',
    'Final': 'Final_Exam'
  };

  const mappedTerm = termMapping[termName] || termName.replace(/\s+/g, '_');
  return `${academicYearName}_${mappedTerm}`;
}
