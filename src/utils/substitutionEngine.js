/**
 * Generates substitutions for absent teachers based on priority hierarchy and load balancing.
 * 
 * @param {string} targetDate - The date of substitution (YYYY-MM-DD)
 * @param {number} dayOfWeek - 1 (Mon) to 5 (Fri)
 * @param {Array} absentTeacherIds - Array of UUIDs of absent teachers
 * @param {Array} masterRoutine - The full master routine array
 * @param {Array} existingDeltas - Any already assigned substitutions for the day
 * @param {Array} teachersMeta - Array of teacher metadata objects
 * @param {Array} teacherSubjects - Array of teacher-class-subject relations
 * @param {Array} allProfiles - All teacher profiles for names/roles
 * @returns {Array} Array of new substitution delta objects to be saved
 */
export const generateSubstitutions = (
  targetDate, 
  dayOfWeek, 
  absentTeacherIds, 
  masterRoutine, 
  existingDeltas, 
  teachersMeta, 
  teacherSubjects,
  allProfiles
) => {
  const newDeltas = [];

  // Filter master routine for today
  const todaysRoutine = masterRoutine.filter(r => r.day_of_week === dayOfWeek);

  // Find all periods that need substitution
  const blocksToSub = todaysRoutine.filter(r => absentTeacherIds.includes(r.teacher_id));
  
  // Sort by period to handle them sequentially
  blocksToSub.sort((a, b) => a.period_num - b.period_num);

  // Helper to get current load for a teacher today
  const getTeacherLoad = (teacherId) => {
    const baseLoad = todaysRoutine.filter(r => r.teacher_id === teacherId).length;
    const existingSubLoad = existingDeltas.filter(d => d.substitute_teacher_id === teacherId).length;
    const newlyAssignedSubLoad = newDeltas.filter(d => d.substitute_teacher_id === teacherId).length;
    
    // If they are absent, their base load is effectively 0 for the day, but they can't take subs anyway.
    return baseLoad + existingSubLoad + newlyAssignedSubLoad;
  };

  const getSubstitutionsToday = (teacherId) => {
    const existingSubLoad = existingDeltas.filter(d => d.substitute_teacher_id === teacherId).length;
    const newlyAssignedSubLoad = newDeltas.filter(d => d.substitute_teacher_id === teacherId).length;
    return existingSubLoad + newlyAssignedSubLoad;
  };

  // Helper to check if a teacher is free in a specific period
  const isTeacherFree = (teacherId, periodNum) => {
    // 1. Check if absent
    if (absentTeacherIds.includes(teacherId)) return false;
    
    // 2. Check metadata constraints
    const meta = teachersMeta.find(m => m.teacher_id === teacherId) || {};
    if (meta.can_take_substitution === false) return false;
    
    const startP = meta.availability_start_period || 1;
    const endP = meta.availability_end_period || 9;
    if (periodNum < startP || periodNum > endP) return false;

    // 3. Check workload limits
    const maxLoad = meta.max_periods_per_day || 6;
    if (getTeacherLoad(teacherId) >= maxLoad) return false;
    if (getSubstitutionsToday(teacherId) >= 2) return false;

    // 4. Check if they have a base class in this period
    const hasBaseClass = todaysRoutine.some(r => r.teacher_id === teacherId && r.period_num === periodNum);
    if (hasBaseClass) return false;

    // 5. Check if they are already subbing in this period
    const hasExistingSub = existingDeltas.some(d => {
      const origBlock = masterRoutine.find(m => m.id === d.master_routine_id);
      return origBlock && origBlock.period_num === periodNum && d.substitute_teacher_id === teacherId;
    });
    if (hasExistingSub) return false;

    const hasNewSub = newDeltas.some(d => d.period_num === periodNum && d.substitute_teacher_id === teacherId);
    if (hasNewSub) return false;

    return true;
  };

  for (const block of blocksToSub) {
    let assignedSubId = null;
    let priorityUsed = null;
    let overrideModifier = null;

    // Build list of free teachers for this period
    const freeTeachers = allProfiles
      .filter(p => p.role === 'teacher')
      .map(p => p.id)
      .filter(id => isTeacherFree(id, block.period_num));

    if (freeTeachers.length > 0) {
      // Get missing teacher's department
      const absentMeta = teachersMeta.find(m => m.teacher_id === block.teacher_id) || {};
      const targetDept = absentMeta.department;

      // Priority 1: Department Match
      const p1Candidates = freeTeachers.filter(id => {
        const meta = teachersMeta.find(m => m.teacher_id === id);
        return meta && meta.department === targetDept;
      });

      if (p1Candidates.length > 0) {
        // Sort by lowest load to balance even within P1
        p1Candidates.sort((a, b) => getTeacherLoad(a) - getTeacherLoad(b));
        assignedSubId = p1Candidates[0];
        priorityUsed = 1;
      }

      // Priority 2: Grade-Level Familiarity (teaches this class another subject)
      if (!assignedSubId) {
        const p2Candidates = freeTeachers.filter(id => {
          return teacherSubjects.some(ts => ts.teacher_id === id && ts.class_id === block.class_id);
        });
        
        if (p2Candidates.length > 0) {
          p2Candidates.sort((a, b) => getTeacherLoad(a) - getTeacherLoad(b));
          assignedSubId = p2Candidates[0];
          priorityUsed = 2;
        }
      }

      // Priority 3: General Load Balancing (any free teacher, lowest load first)
      if (!assignedSubId) {
        freeTeachers.sort((a, b) => getTeacherLoad(a) - getTeacherLoad(b));
        assignedSubId = freeTeachers[0];
        priorityUsed = 3;
      }
    }

    // Priority 4: Contingency (No one available -> Library / Supervisor)
    if (!assignedSubId) {
      priorityUsed = 4;
      overrideModifier = '[LIB] / Self-Study';
    }

    // Record the delta
    newDeltas.push({
      date: targetDate,
      master_routine_id: block.id,
      absent_teacher_id: block.teacher_id,
      substitute_teacher_id: assignedSubId,
      priority_used: priorityUsed,
      override_modifier: overrideModifier,
      period_num: block.period_num, // Used internally for conflict checking
      status: 'Pending'
    });
  }

  return newDeltas;
};
