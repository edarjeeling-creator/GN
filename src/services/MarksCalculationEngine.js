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
   * Helper to check if a class and subject match Class 9H or Class 10H Economics
   * @param {string} className
   * @param {string} [classSection]
   * @param {string} [subjectName]
   * @returns {boolean}
   */
  static isEconomics9Hor10H(className, classSection = null, subjectName = null) {
    if (!subjectName) return false;
    const normSub = String(subjectName).trim().toLowerCase();
    if (!normSub.includes('eco')) return false;

    const normClass = String(className || '').trim().toLowerCase();
    const normSec = String(classSection || '').trim().toLowerCase();

    // Direct section match
    if (normSec === 'h') {
      return normClass === '9' || normClass === '10' || normClass === 'class 9' || normClass === 'class 10' || normClass === 'ix' || normClass === 'x';
    }

    // Combined name match e.g. "9H", "10H", "Class 9H", "Class 10 H"
    const is9H = /^(class\s*)?(9|ix)\s*h$/i.test(normClass);
    const is10H = /^(class\s*)?(10|x)\s*h$/i.test(normClass);
    return is9H || is10H;
  }

  /**
   * Get default fallback pattern for Economics 3-Test assessment (Classes 9H & 10H)
   */
  static getDefaultEconomics3TestPattern(academicYear = '2026') {
    return {
      id: 'e0190001-0000-4000-a000-000000000001',
      academic_year: academicYear,
      pattern_name: 'Secondary Economics (Classes 9H & 10H) Scheme',
      class_group: 'SECONDARY_ECONOMICS_3TEST',
      applicable_classes: ['Class 9 H', 'Class 10 H', '9 H', '10 H', '9H', '10H'],
      description: 'Special 3-Test Economics assessment with automated average for Classes 9H and 10H',
      rounding_rule: 'ROUND_2_DECIMALS',
      version: 1,
      status: 'ACTIVE',
      components: [
        {
          id: 'e0190001-0000-4000-a000-000000000002',
          component_code: 'TEST_1',
          component_name: 'Test 1',
          raw_max_marks: 20,
          converted_max_marks: 20,
          weightage_percentage: 20,
          display_order: 1,
          contributes_to_total: false,
          is_calculated: false
        },
        {
          id: 'e0190001-0000-4000-a000-000000000003',
          component_code: 'TEST_2',
          component_name: 'Test 2',
          raw_max_marks: 20,
          converted_max_marks: 20,
          weightage_percentage: 20,
          display_order: 2,
          contributes_to_total: false,
          is_calculated: false
        },
        {
          id: 'e0190001-0000-4000-a000-000000000004',
          component_code: 'TEST_3',
          component_name: 'Test 3',
          raw_max_marks: 20,
          converted_max_marks: 20,
          weightage_percentage: 20,
          display_order: 3,
          contributes_to_total: false,
          is_calculated: false
        },
        {
          id: 'e0190001-0000-4000-a000-000000000005',
          component_code: 'TEST_AVG',
          component_name: 'Average',
          raw_max_marks: 20,
          converted_max_marks: 20,
          weightage_percentage: 100,
          display_order: 4,
          contributes_to_total: true,
          is_calculated: true,
          formula: 'AVERAGE(TEST_1, TEST_2, TEST_3)'
        }
      ],
      grade_boundaries: [
        { grade_name: 'A', min_percentage: 80.00, max_percentage: 100.00, description: 'Excellent' },
        { grade_name: 'B', min_percentage: 65.00, max_percentage: 79.99, description: 'Very Good' },
        { grade_name: 'C', min_percentage: 50.00, max_percentage: 64.99, description: 'Good' },
        { grade_name: 'D', min_percentage: 35.00, max_percentage: 49.99, description: 'Pass' },
        { grade_name: 'E', min_percentage: 0.00, max_percentage: 34.99, description: 'Failed' }
      ]
    };
  }

  /**
   * Calculate Economics 3-Test Average for Classes 9H & 10H
   * Formula: Sum of tests with marks entered ÷ Number of tests attended (excluding ABSENT)
   * 
   * @param {Object} params
   * @param {string|number} params.test1 - Score for Test 1
   * @param {string|number} params.test2 - Score for Test 2
   * @param {string|number} params.test3 - Score for Test 3
   * @param {string} [params.status1='MARKED'] - 'MARKED' | 'ABSENT' | 'NOT_APPLICABLE'
   * @param {string} [params.status2='MARKED'] - 'MARKED' | 'ABSENT' | 'NOT_APPLICABLE'
   * @param {string} [params.status3='MARKED'] - 'MARKED' | 'ABSENT' | 'NOT_APPLICABLE'
   * @param {string} [params.roundingRule='ROUND_2_DECIMALS']
   * @returns {{ averageScore: number|null, status: string, displayText: string }}
   */
  static calculateEconomics3TestAverage({
    test1, test2, test3,
    status1 = 'MARKED', status2 = 'MARKED', status3 = 'MARKED',
    roundingRule = 'ROUND_2_DECIMALS'
  }) {
    const tests = [
      { raw: test1, status: status1 },
      { raw: test2, status: status2 },
      { raw: test3, status: status3 }
    ];

    let sum = 0;
    let attendedCount = 0;
    let absentCount = 0;

    for (const t of tests) {
      const isAbsent = t.status === 'ABSENT' || String(t.raw || '').trim().toUpperCase() === 'AB' || String(t.raw || '').trim().toUpperCase() === 'ABS';
      if (isAbsent) {
        absentCount++;
      } else if (t.status === 'MARKED' && t.raw !== '' && t.raw !== null && t.raw !== undefined) {
        const val = Number(t.raw);
        if (!isNaN(val)) {
          sum += val;
          attendedCount++;
        }
      }
    }

    // All 3 tests marked Absent -> Average remains AB (not 0!)
    if (absentCount === 3) {
      return { averageScore: null, status: 'ABSENT', displayText: 'AB' };
    }

    // If no test has been entered and none marked absent -> unentered
    if (attendedCount === 0 && absentCount === 0) {
      return { averageScore: null, status: 'MARKED', displayText: '' };
    }

    // If attendedCount is 0 but some tests are marked absent and others unentered
    if (attendedCount === 0) {
      return { averageScore: null, status: 'ABSENT', displayText: 'AB' };
    }

    // Attended at least 1 test: compute average based on attended tests
    const rawAvg = sum / attendedCount;
    const roundedAvg = this.applyRounding(rawAvg, roundingRule);

    return {
      averageScore: roundedAvg,
      status: 'MARKED',
      displayText: roundedAvg !== null ? roundedAvg.toFixed(2) : ''
    };
  }

  /**
   * Resolve applicable assessment pattern for a class, subject, and year
   */
  static resolvePattern(className, academicYear = '2026', patterns = [], subjectName = null, classSection = null) {
    if (!className) return null;

    // Special Scope Restriction: Class 9H or 10H AND Subject Economics
    if (this.isEconomics9Hor10H(className, classSection, subjectName)) {
      if (patterns && patterns.length > 0) {
        const ecoPattern = patterns.find(p => 
          p.status === 'ACTIVE' && 
          (p.class_group === 'SECONDARY_ECONOMICS_3TEST' || (p.pattern_name && p.pattern_name.toLowerCase().includes('economics')))
        );
        if (ecoPattern) return ecoPattern;
      }
      return this.getDefaultEconomics3TestPattern(academicYear);
    }

    if (!patterns || patterns.length === 0) return null;

    const normClass = String(className).trim().toLowerCase();

    // 1. Direct match in applicable_classes JSON array
    const exactMatch = patterns.find(p => {
      if (p.status !== 'ACTIVE') return false;
      if (p.academic_year && p.academic_year !== academicYear) return false;
      if (p.class_group === 'SECONDARY_ECONOMICS_3TEST') return false; // Reserved exclusively for Economics 9H/10H
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
  static resolvePatternForClass(arg1, arg2, academicYear = '2026', subjectName = null, classSection = null) {
    if (Array.isArray(arg1)) {
      return this.resolvePattern(arg2, academicYear, arg1, subjectName, classSection);
    }
    if (Array.isArray(arg2)) {
      return this.resolvePattern(arg1, academicYear, arg2, subjectName, classSection);
    }
    return this.resolvePattern(arg1, academicYear, arg2, subjectName, classSection);
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

    // Auto-calculate TEST_AVG if present in components
    const hasTestAvg = components.some(c => c.component_code === 'TEST_AVG');
    if (hasTestAvg) {
      const t1Comp = components.find(c => c.component_code === 'TEST_1');
      const t2Comp = components.find(c => c.component_code === 'TEST_2');
      const t3Comp = components.find(c => c.component_code === 'TEST_3');
      const avgComp = components.find(c => c.component_code === 'TEST_AVG');

      const s1 = (t1Comp && componentScores[t1Comp.id]) || componentScores['TEST_1'] || {};
      const s2 = (t2Comp && componentScores[t2Comp.id]) || componentScores['TEST_2'] || {};
      const s3 = (t3Comp && componentScores[t3Comp.id]) || componentScores['TEST_3'] || {};

      const avgCalc = this.calculateEconomics3TestAverage({
        test1: s1.rawScore !== undefined ? s1.rawScore : s1.raw_score,
        test2: s2.rawScore !== undefined ? s2.rawScore : s2.raw_score,
        test3: s3.rawScore !== undefined ? s3.rawScore : s3.raw_score,
        status1: s1.status || 'MARKED',
        status2: s2.status || 'MARKED',
        status3: s3.status || 'MARKED',
        roundingRule
      });

      if (avgComp) {
        const avgKey = avgComp.id;
        const existing = componentScores[avgKey] || componentScores['TEST_AVG'];
        if (!existing || existing.rawScore === null || existing.rawScore === undefined || existing.rawScore === '') {
          componentScores[avgKey] = {
            rawScore: avgCalc.averageScore,
            convertedScore: avgCalc.averageScore,
            status: avgCalc.status
          };
        }
      }
    }

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
    if (isAllAbsent && hasAnyMark) {
      grade = 'AB';
    } else if (percentage !== null && gradeBoundaries && gradeBoundaries.length > 0) {
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
      isAllAbsent: isAllAbsent && hasAnyMark
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

    // Auto-calculate TEST_AVG if present in components
    const hasTestAvg = components.some(c => c.component_code === 'TEST_AVG');
    if (hasTestAvg) {
      const avgCalc = this.calculateEconomics3TestAverage({
        test1: rawScores['TEST_1'],
        test2: rawScores['TEST_2'],
        test3: rawScores['TEST_3'],
        status1: statuses['TEST_1'] || 'MARKED',
        status2: statuses['TEST_2'] || 'MARKED',
        status3: statuses['TEST_3'] || 'MARKED',
        roundingRule
      });
      if (avgCalc.status === 'ABSENT') {
        statuses['TEST_AVG'] = 'ABSENT';
        rawScores['TEST_AVG'] = '';
      } else if (avgCalc.averageScore !== null) {
        statuses['TEST_AVG'] = 'MARKED';
        rawScores['TEST_AVG'] = avgCalc.averageScore;
      }
    }

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
    if (isAllAbsent && hasAnyMark) {
      grade = 'AB';
    } else if (percentage !== null && gradeBoundaries && gradeBoundaries.length > 0) {
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
