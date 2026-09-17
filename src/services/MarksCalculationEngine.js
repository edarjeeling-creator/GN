/**
 * MarksCalculationEngine.js
 * Centralized, Database-Driven Calculation Engine for Gyanoday Niketan ERP
 * 
 * Implements:
 * - Dynamic pattern resolution based on Class & Academic Year (No hard-coded formulas)
 * - Safe component conversion (e.g. Exam 100 -> 75, Test 25)
 * - Configurable rounding rules (Integer, 1 Decimal, 2 Decimals)
 * - Pattern-specific grade boundary evaluation
 * - Special subject rules (e.g. 6th Subject / Additional inclusion/exclusion)
 * - Full calculation breakdown for Coordinator verification
 */

export class MarksCalculationEngine {
  /**
   * Resolve applicable assessment pattern for a class and year
   */
  static resolvePattern(className, academicYear = '2026', patterns = []) {
    if (!className || !patterns || patterns.length === 0) return null;

    const normClass = String(className).trim().toLowerCase();

    // 1. Direct match in applicable_classes JSON array
    const exactMatch = patterns.find(p => {
      if (p.status !== 'ACTIVE') return false;
      if (p.academic_year && p.academic_year !== academicYear) return false;
      const classes = Array.isArray(p.applicable_classes) ? p.applicable_classes : [];
      return classes.some(c => String(c).trim().toLowerCase() === normClass);
    });
    if (exactMatch) return exactMatch;

    // 2. Class group heuristics fallback if explicit list didn't match
    const isJunior = /(^|\b)(playgroup|lkg|ukg|nursery|1|2|3|4|i|ii|iii|iv)(\b|$)/i.test(normClass);
    const isSenior5to8 = /(^|\b)(5|6|7|8|v|vi|vii|viii)(\b|$)/i.test(normClass) && !normClass.includes('11') && !normClass.includes('12');
    const isSecondary9to10 = /(^|\b)(9|10|ix|x)(\b|$)/i.test(normClass);
    const isHigherSec11to12 = /(^|\b)(11|12|xi|xii)(\b|$)/i.test(normClass);

    let targetGroup = 'SENIOR_5_8';
    if (isJunior) targetGroup = 'JUNIOR';
    else if (isSenior5to8) targetGroup = 'SENIOR_5_8';
    else if (isSecondary9to10) targetGroup = 'SECONDARY_9_10';
    else if (isHigherSec11to12) targetGroup = 'HIGHER_SECONDARY_11_12';

    return patterns.find(p => p.status === 'ACTIVE' && p.class_group === targetGroup) || patterns[0];
  }

  /**
   * Alias helper: resolvePatternForClass
   */
  static resolvePatternForClass(arg1, arg2, academicYear = '2026') {
    if (Array.isArray(arg1)) {
      return this.resolvePattern(arg2, academicYear, arg1);
    }
    if (Array.isArray(arg2)) {
      return this.resolvePattern(arg1, academicYear, arg2);
    }
    return this.resolvePattern(arg1, academicYear, arg2);
  }

  /**
   * Calculate student totals, percentage and grade from components and componentScores
   * Used by CoordinatorMarksReview and audit views
   */
  static calculateStudentScores(components = [], componentScores = {}, pattern = null) {
    const roundingRule = pattern?.rounding_rule || 'ROUND_2_DECIMALS';
    const gradeBoundaries = pattern?.grade_boundaries || [];

    let totalRaw = 0;
    let totalMarks = 0;
    let maxTotal = 0;
    let hasAnyMark = false;
    let isAllAbsent = true;

    components.forEach(comp => {
      const scoreData = componentScores[comp.id] || componentScores[comp.component_code] || {};
      const status = scoreData.status || 'MARKED';
      const rawVal = scoreData.rawScore !== undefined ? scoreData.rawScore : scoreData.raw_score;
      let convVal = scoreData.convertedScore !== undefined ? scoreData.convertedScore : scoreData.converted_score;

      const rawMax = Number(comp.raw_max_marks || 100);
      const convMax = Number(comp.converted_max_marks || rawMax);

      if (status === 'MARKED' && rawVal !== null && rawVal !== undefined && rawVal !== '') {
        hasAnyMark = true;
        isAllAbsent = false;
        const numRaw = Number(rawVal);
        totalRaw += numRaw;

        if (convVal === null || convVal === undefined || convVal === '') {
          convVal = this.convertComponentScore(numRaw, comp, roundingRule);
        } else {
          convVal = Number(convVal);
        }

        if (comp.contributes_to_total !== false) {
          totalMarks += (convVal || 0);
          maxTotal += convMax;
        }
      } else if (status === 'ABSENT') {
        hasAnyMark = true;
        if (comp.contributes_to_total !== false) {
          maxTotal += convMax;
        }
      } else if (status === 'NOT_APPLICABLE') {
        // Excluded from total and max
      }
    });

    totalMarks = this.applyRounding(totalMarks, roundingRule);
    totalRaw = this.applyRounding(totalRaw, roundingRule);

    let percentage = null;
    if (maxTotal > 0 && hasAnyMark && !isAllAbsent) {
      percentage = this.applyRounding((totalMarks / maxTotal) * 100, 'ROUND_2_DECIMALS');
    } else if (isAllAbsent && hasAnyMark) {
      percentage = 0;
    }

    let grade = null;
    if (percentage !== null && gradeBoundaries && gradeBoundaries.length > 0) {
      const matched = gradeBoundaries.find(b =>
        percentage >= Number(b.min_percentage) && percentage <= Number(b.max_percentage)
      );
      if (matched) grade = matched.grade_name;
    }

    return {
      totalMarks,
      totalConverted: totalMarks,
      maxTotal,
      maxPossibleConverted: maxTotal,
      totalRaw,
      percentage,
      grade,
      hasAnyMark,
      isAllAbsent
    };
  }

  /**
   * Apply rounding rule to numeric score
   */
  static applyRounding(value, rule = 'ROUND_2_DECIMALS') {
    if (value === null || value === undefined || isNaN(value)) return null;
    const num = Number(value);
    switch (rule) {
      case 'ROUND_NEAREST_INTEGER':
        return Math.round(num);
      case 'ROUND_1_DECIMAL':
        return Math.round(num * 10) / 10;
      case 'NO_ROUNDING':
        return num;
      case 'ROUND_2_DECIMALS':
      default:
        return Math.round(num * 100) / 100;
    }
  }

  /**
   * Convert raw component mark using component configuration
   */
  static convertComponentScore(rawScore, component, roundingRule = 'ROUND_2_DECIMALS') {
    if (rawScore === null || rawScore === undefined || rawScore === '') return null;
    const raw = Number(rawScore);
    if (isNaN(raw)) return null;

    const rawMax = Number(component.raw_max_marks || 100);
    const convMax = Number(component.converted_max_marks || rawMax);

    if (rawMax <= 0) return raw;

    // Linear conversion: Raw * ConvertedMax / RawMax
    const converted = (raw * convMax) / rawMax;
    return this.applyRounding(converted, roundingRule);
  }

  /**
   * Calculate complete student assessment result across components
   */
  static calculateStudentResult({
    components = [],
    rawScores = {}, // { componentCode: rawValue }
    statuses = {},   // { componentCode: 'MARKED' | 'ABSENT' | 'NOT_APPLICABLE' }
    gradeBoundaries = [],
    roundingRule = 'ROUND_2_DECIMALS',
    subjectRule = null
  }) {
    let totalRaw = 0;
    let totalConverted = 0;
    let maxPossibleConverted = 0;
    const componentBreakdown = [];
    let hasAnyMark = false;
    let isAllAbsent = true;

    components.forEach(comp => {
      const code = comp.component_code;
      const status = statuses[code] || 'MARKED';
      const rawVal = rawScores[code];

      let converted = null;
      if (status === 'MARKED' && rawVal !== undefined && rawVal !== null && rawVal !== '') {
        hasAnyMark = true;
        isAllAbsent = false;
        const numRaw = Number(rawVal);
        converted = this.convertComponentScore(numRaw, comp, roundingRule);

        if (comp.contributes_to_total !== false) {
          totalRaw += numRaw;
          totalConverted += (converted || 0);
          maxPossibleConverted += Number(comp.converted_max_marks || comp.raw_max_marks);
        }
      } else if (status === 'ABSENT') {
        hasAnyMark = true;
        converted = 0;
        if (comp.contributes_to_total !== false) {
          maxPossibleConverted += Number(comp.converted_max_marks || comp.raw_max_marks);
        }
      } else if (status === 'NOT_APPLICABLE') {
        // Excluded from total and max
      }

      componentBreakdown.push({
        componentCode: code,
        componentName: comp.component_name,
        rawMax: Number(comp.raw_max_marks),
        convertedMax: Number(comp.converted_max_marks),
        weightage: Number(comp.weightage_percentage || 100),
        rawScore: rawVal !== undefined && rawVal !== '' ? Number(rawVal) : null,
        convertedScore: converted,
        status: status,
        contributesToTotal: comp.contributes_to_total !== false
      });
    });

    totalConverted = this.applyRounding(totalConverted, roundingRule);

    // Percentage
    let percentage = null;
    if (maxPossibleConverted > 0 && hasAnyMark && !isAllAbsent) {
      percentage = this.applyRounding((totalConverted / maxPossibleConverted) * 100, 'ROUND_2_DECIMALS');
    } else if (isAllAbsent && hasAnyMark) {
      percentage = 0;
    }

    // Grade
    let grade = null;
    if (percentage !== null && gradeBoundaries && gradeBoundaries.length > 0) {
      const matched = gradeBoundaries.find(b => 
        percentage >= Number(b.min_percentage) && percentage <= Number(b.max_percentage)
      );
      if (matched) grade = matched.grade_name;
    }

    // Special subject rules check
    const isSpecialSubject = subjectRule?.subject_category === 'SIXTH_SUBJECT' || subjectRule?.subject_category === 'ADDITIONAL';
    const isExcludedFromAggregate = subjectRule?.include_in_aggregate === false;

    return {
      hasAnyMark,
      isAllAbsent,
      totalRaw: this.applyRounding(totalRaw, roundingRule),
      totalConverted,
      maxPossibleConverted,
      percentage,
      grade,
      isSpecialSubject,
      isExcludedFromAggregate,
      componentBreakdown
    };
  }

  /**
   * Generate a human-readable calculation breakdown explanation
   */
  static getCalculationExplanation({
    patternName,
    patternVersion = 1,
    studentResult
  }) {
    const steps = [];
    steps.push(`Pattern Applied: ${patternName || 'Default School Scheme'} (Version ${patternVersion})`);

    studentResult.componentBreakdown.forEach(c => {
      if (c.status === 'ABSENT') {
        steps.push(`${c.componentName}: Marked ABSENT (0 / ${c.convertedMax})`);
      } else if (c.status === 'NOT_APPLICABLE') {
        steps.push(`${c.componentName}: Marked NOT APPLICABLE (Excluded from total)`);
      } else if (c.rawScore !== null) {
        if (c.rawMax === c.convertedMax) {
          steps.push(`${c.componentName}: Raw ${c.rawScore} / ${c.rawMax} (Direct weight: ${c.convertedScore})`);
        } else {
          steps.push(
            `${c.componentName}: Raw ${c.rawScore} / ${c.rawMax} converted to / ${c.convertedMax} ` +
            `(${c.rawScore} × ${c.convertedMax} / ${c.rawMax}) = ${c.convertedScore}`
          );
        }
      } else {
        steps.push(`${c.componentName}: Not entered`);
      }
    });

    if (studentResult.maxPossibleConverted > 0) {
      steps.push(
        `Final Aggregate: ${studentResult.totalConverted} / ${studentResult.maxPossibleConverted} ` +
        `(${studentResult.percentage}%)`
      );
    }
    if (studentResult.grade) {
      steps.push(`Assigned Grade: ${studentResult.grade}`);
    }

    return steps;
  }

  /**
   * Authoritative Ranking & Requires Attention Engine
   * Deterministic, server-authoritative shared logic for Tuesday Assembly Honours
   * 
   * @param {Array} studentsList - Array of student records
   * @param {Object} config - Ranking & threshold configuration
   */
  static calculateHonoursAndAttention(studentsList = [], config = {}) {
    const rankingPolicy = config.rankingPolicy || 'DENSE';
    const threshold = config.requiresAttentionThreshold !== undefined ? Number(config.requiresAttentionThreshold) : 10;
    const thresholdType = config.thresholdType || 'SCORE';
    const excludeAbsent = config.excludeAbsentFromRanking !== false;
    const excludeNA = config.excludeNAFromRanking !== false;
    const maxPositions = config.maxPositions || 3;

    // Filter valid non-empty students
    const validStudents = (studentsList || []).filter(Boolean);

    // 1. Determine eligible students for ranking
    const eligibleStudents = validStudents.filter(s => {
      if (excludeAbsent && s.isAbsent) return false;
      if (excludeNA && s.isNA) return false;
      return true;
    });

    // Sort eligible by total score descending
    eligibleStudents.sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));

    // 2. Compute rankings according to configured policy
    const topScorers = [];
    if (rankingPolicy === 'DENSE') {
      // Dense Ranking: unique scores get 1, 2, 3... Ties share exact rank
      const uniqueScores = [...new Set(eligibleStudents.map(s => Number(s.total) || 0))].sort((a, b) => b - a);
      for (const s of eligibleStudents) {
        const score = Number(s.total) || 0;
        const rank = uniqueScores.indexOf(score) + 1;
        if (rank <= maxPositions) {
          const tiedCount = eligibleStudents.filter(o => (Number(o.total) || 0) === score).length;
          topScorers.push({
            ...s,
            rank,
            isTie: tiedCount > 1,
            rankDisplay: rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'
          });
        }
      }
    } else if (rankingPolicy === 'COMPETITION') {
      // Standard Competition Ranking: 1, 1, 3 (rank = index + 1)
      let prevScore = null;
      let currentRank = 1;
      for (let i = 0; i < eligibleStudents.length; i++) {
        const s = eligibleStudents[i];
        const score = Number(s.total) || 0;
        if (prevScore !== null && score < prevScore) {
          currentRank = i + 1;
        }
        prevScore = score;
        if (currentRank <= maxPositions) {
          const tiedCount = eligibleStudents.filter(o => (Number(o.total) || 0) === score).length;
          topScorers.push({
            ...s,
            rank: currentRank,
            isTie: tiedCount > 1,
            rankDisplay: currentRank === 1 ? '1st' : currentRank === 2 ? '2nd' : '3rd'
          });
        }
      }
    } else { // 'SHARED'
      const uniqueScores = [...new Set(eligibleStudents.map(s => Number(s.total) || 0))].sort((a, b) => b - a);
      for (const s of eligibleStudents) {
        const score = Number(s.total) || 0;
        const rank = uniqueScores.indexOf(score) + 1;
        const tiedCount = eligibleStudents.filter(o => (Number(o.total) || 0) === score).length;
        if (rank <= maxPositions) {
          topScorers.push({
            ...s,
            rank,
            isTie: tiedCount > 1,
            rankDisplay: (rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd') + (tiedCount > 1 ? ' (Tie)' : '')
          });
        }
      }
    }

    // 3. Evaluate Requires Attention (excluding absentees unless configured)
    const requiresAttention = validStudents.filter(s => {
      if (s.isAbsent || s.isNA) return false;
      const score = Number(s.total) || 0;
      if (thresholdType === 'PERCENTAGE') {
        const max = Number(s.maxMarks) || 100;
        const pct = max > 0 ? (score / max) * 100 : 0;
        return pct < threshold;
      }
      return score < threshold;
    }).map(s => ({
      ...s,
      reason: thresholdType === 'PERCENTAGE' 
        ? `Score below ${threshold}% threshold` 
        : `Score ${s.total} is below threshold (${threshold})`
    }));

    // Absentees list for explicit transparency
    const absentees = validStudents.filter(s => s.isAbsent);

    return {
      topScorers,
      requiresAttention,
      absentees,
      totalEvaluated: validStudents.length,
      totalEligible: eligibleStudents.length
    };
  }
}

export default MarksCalculationEngine;
