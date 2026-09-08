/**
 * LateFeeService.js
 * Centralized business logic for Fee Due Date and Late Fee Calculations.
 * Single Source of Truth for Student Portal, Parent Portal, and Payment Modals.
 */

export const DEFAULT_LATE_FEE_RULES = {
  dueDay: 20,                      // Default: 20th of the month
  calculationMode: 'flat_monthly', // 'flat_monthly' | 'daily'
  lateFeeAmount: 100,              // Flat ₹100 per overdue month
  gracePeriod: 0                   // Default: 0 days
};

/**
 * Safely parse date into a local Date object without timezone shift bugs.
 */
export const parseLocalDate = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }
  if (typeof dateInput === 'string') {
    const cleanDate = dateInput.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
  }
  const parsed = new Date(dateInput);
  return isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

/**
 * Format currency consistently as ₹X,XXX.XX
 */
export const formatFeeCurrency = (amount) => {
  const num = Number(amount || 0);
  return '₹' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Format date as DD/MM/YYYY
 */
export const formatDueDateDisplay = (dateInput) => {
  const d = parseLocalDate(dateInput);
  if (!d) return 'N/A';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Fetch late fee rules from fee_settings table with default fallback.
 */
export const fetchLateFeeRules = async (supabase) => {
  try {
    const { data, error } = await supabase
      .from('fee_settings')
      .select('value')
      .eq('key', 'late_fee_rules')
      .maybeSingle();

    if (error || !data?.value) {
      return { ...DEFAULT_LATE_FEE_RULES };
    }

    return {
      dueDay: Number(data.value.dueDay) || DEFAULT_LATE_FEE_RULES.dueDay,
      calculationMode: data.value.calculationMode || DEFAULT_LATE_FEE_RULES.calculationMode,
      lateFeeAmount: Number(data.value.lateFeeAmount) ?? DEFAULT_LATE_FEE_RULES.lateFeeAmount,
      gracePeriod: Number(data.value.gracePeriod) ?? DEFAULT_LATE_FEE_RULES.gracePeriod
    };
  } catch (err) {
    console.error('Error fetching late fee rules:', err);
    return { ...DEFAULT_LATE_FEE_RULES };
  }
};

/**
 * Core calculation: Single Source of Truth
 * 
 * Rules:
 * - On or before due date: late fee = 0
 * - During grace period: late fee = 0
 * - Past due date + grace period:
 *   - 'flat_monthly': late fee = lateFeeAmount * overdueMonths
 *       e.g., Due Date 20/09/2026:
 *       - 20/09/2026 -> ₹0
 *       - 21/09/2026 - 30/09/2026 -> 1 month -> ₹100
 *       - 01/10/2026 - 31/10/2026 -> 2 months -> ₹200
 *       - 01/11/2026 -> 3 months -> ₹300
 *   - 'daily': late fee = lateFeeAmount * overdueDays
 */
export const calculateLateFee = ({
  dueDate,
  currentDate = new Date(),
  gracePeriod = 0,
  calculationMode = 'flat_monthly',
  lateFeeAmount = 100,
  outstandingAmount = null
}) => {
  // If explicitly specified that outstanding balance is 0 or paid, late fee is 0
  if (outstandingAmount !== null && Number(outstandingAmount) <= 0) {
    return {
      lateFee: 0,
      overdueDays: 0,
      overdueMonths: 0,
      isOverdue: false
    };
  }

  const due = parseLocalDate(dueDate);
  const current = parseLocalDate(currentDate);

  if (!due || !current) {
    return {
      lateFee: 0,
      overdueDays: 0,
      overdueMonths: 0,
      isOverdue: false
    };
  }

  // Milliseconds difference
  const diffMs = current.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // If today is on or before due date
  if (diffDays <= 0) {
    return {
      lateFee: 0,
      overdueDays: 0,
      overdueMonths: 0,
      isOverdue: false
    };
  }

  const overdueDays = diffDays;
  const grace = Number(gracePeriod) || 0;

  // If within grace period
  if (overdueDays <= grace) {
    return {
      lateFee: 0,
      overdueDays,
      overdueMonths: 0,
      isOverdue: false
    };
  }

  const feeRate = Number(lateFeeAmount) || 0;

  if (calculationMode === 'daily') {
    const lateFee = overdueDays * feeRate;
    const overdueMonths = Math.max(1, Math.ceil(overdueDays / 30));
    return {
      lateFee,
      overdueDays,
      overdueMonths,
      isOverdue: true
    };
  }

  // Default: 'flat_monthly'
  // Calculate calendar month difference between current date and due date
  const monthDiff = (current.getFullYear() - due.getFullYear()) * 12 + (current.getMonth() - due.getMonth());
  // If in the same calendar month as due date (monthDiff === 0), overdueMonths = 1
  // If in subsequent calendar months (e.g. October for September due date: monthDiff === 1), overdueMonths = 1 + 1 = 2
  const overdueMonths = Math.max(1, 1 + monthDiff);
  const lateFee = overdueMonths * feeRate;

  return {
    lateFee,
    overdueDays,
    overdueMonths,
    isOverdue: true
  };
};

/**
 * Calculate full summary for a list of demands and payments for a student
 */
/**
 * Calculate full summary for a list of demands and payments for a student
 */
export const calculateStudentFeeSummary = ({
  demands = [],
  payments = [],
  lateFeeRules = DEFAULT_LATE_FEE_RULES,
  currentDate = new Date()
}) => {
  // 1. Calculate total valid paid / pending verification payments
  let remainingPaymentCredit = 0;
  for (const p of payments) {
    if (p && p.status !== 'rejected') {
      remainingPaymentCredit += Number(p.amount) || 0;
    }
  }

  // 2. Sort demands chronologically (oldest first) to allocate payments correctly
  const sortedDemands = [...demands].sort((a, b) => {
    const dateA = a.created_at || a.due_date || '';
    const dateB = b.created_at || b.due_date || '';
    return dateA.localeCompare(dateB);
  });

  const activeDemands = [];
  const itemizedRows = [];
  let totalBaseAmount = 0;
  let totalLateFees = 0;
  let earliestDueDate = null;
  let isAnyOverdue = false;

  for (const demand of sortedDemands) {
    // Skip explicitly cancelled demands
    if (demand.status === 'cancelled') {
      continue;
    }

    const demandTotal = Number(demand.total_amount) || 0;
    if (demandTotal <= 0) continue;

    // Deduct payment credit from oldest demands first
    const paidForThisDemand = Math.min(demandTotal, remainingPaymentCredit);
    remainingPaymentCredit = Math.max(0, remainingPaymentCredit - paidForThisDemand);
    const outstandingBase = Math.max(0, demandTotal - paidForThisDemand);

    // If fully covered by payments or status is 'paid', skip from active dues
    if (demand.status === 'paid' || outstandingBase <= 0) {
      continue;
    }

    const dueDate = demand.due_date;
    const { lateFee, overdueDays, overdueMonths, isOverdue } = calculateLateFee({
      dueDate,
      currentDate,
      gracePeriod: lateFeeRules.gracePeriod,
      calculationMode: lateFeeRules.calculationMode,
      lateFeeAmount: lateFeeRules.lateFeeAmount,
      outstandingAmount: outstandingBase
    });

    const itemTotalWithLateFee = outstandingBase + lateFee;
    totalBaseAmount += outstandingBase;
    totalLateFees += lateFee;

    if (isOverdue) {
      isAnyOverdue = true;
    }

    // Track earliest due date of active unpaid demands
    const parsedDue = parseLocalDate(dueDate);
    if (parsedDue) {
      if (!earliestDueDate || parsedDue < earliestDueDate) {
        earliestDueDate = parsedDue;
      }
    }

    // Prepare itemized breakdown for this demand
    const items = (demand.fee_demand_items || []).map(item => ({
      id: item.id,
      name: item.fee_heads?.name || 'Fee',
      amount: Number(item.amount) || 0,
      dueDate: formatDueDateDisplay(dueDate),
      isOverdue
    }));

    activeDemands.push({
      ...demand,
      baseAmount: outstandingBase,
      originalAmount: demandTotal,
      paidAmount: paidForThisDemand,
      lateFee,
      totalAmountWithLateFee: itemTotalWithLateFee,
      overdueDays,
      overdueMonths,
      isOverdue,
      formattedDueDate: formatDueDateDisplay(dueDate),
      items
    });

    // Populate itemized rows for the table
    if (items.length > 0) {
      items.forEach((item, idx) => {
        itemizedRows.push({
          id: `${demand.id}-${item.id}`,
          demandId: demand.id,
          month: demand.month,
          academicYear: demand.academic_year,
          category: `${item.name} - ${demand.month || ''}`.trim(),
          headName: item.name,
          amount: item.amount,
          dueDate: formatDueDateDisplay(dueDate),
          lateFee: idx === 0 ? lateFee : 0, // Late fee attributed to this demand
          total: idx === 0 ? item.amount + lateFee : item.amount,
          isOverdue
        });
      });
    } else {
      itemizedRows.push({
        id: demand.id,
        demandId: demand.id,
        month: demand.month,
        academicYear: demand.academic_year,
        category: `${demand.month} ${demand.academic_year} Fees`.trim(),
        headName: 'Tuition & General Fees',
        amount: outstandingBase,
        dueDate: formatDueDateDisplay(dueDate),
        lateFee: lateFee,
        total: itemTotalWithLateFee,
        isOverdue
      });
    }
  }

  const totalPayableAmount = totalBaseAmount + totalLateFees;

  return {
    activeDemands,
    itemizedRows,
    totalBaseAmount,
    totalLateFees,
    totalPayableAmount,
    earliestDueDate: earliestDueDate ? formatDueDateDisplay(earliestDueDate) : 'N/A',
    isAnyOverdue,
    hasActiveDues: activeDemands.length > 0
  };
};
