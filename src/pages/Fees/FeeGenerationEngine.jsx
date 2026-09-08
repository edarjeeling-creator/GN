import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Play, AlertCircle, FileText, CheckCircle2, Users, Calendar, RotateCcw } from 'lucide-react';
import { fetchLateFeeRules, DEFAULT_LATE_FEE_RULES, formatDueDateDisplay } from '../../services/fee/LateFeeService';

const FeeGenerationEngine = () => {
  const [classes, setClasses] = useState([]);
  const [academicYear, setAcademicYear] = useState('2026');
  const [month, setMonth] = useState('April');
  const [targetClass, setTargetClass] = useState('all'); // 'all' or specific class_id
  const [lateFeeRules, setLateFeeRules] = useState(DEFAULT_LATE_FEE_RULES);
  const [dueDate, setDueDate] = useState('');
  const [isOverridden, setIsOverridden] = useState(false);
  
  const [previewData, setPreviewData] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const computeDefaultDueDate = (selectedMonth, selectedAcademicYear, dueDay) => {
    const monthIdx = months.indexOf(selectedMonth);
    let year = parseInt(selectedAcademicYear, 10) || new Date().getFullYear();
    // In an April-March academic session (e.g. 2026-2027), Jan, Feb, Mar are in the next calendar year
    if (monthIdx >= 0 && monthIdx < 3) {
      year += 1;
    }
    const safeMonthIdx = monthIdx >= 0 ? monthIdx : 3;
    // Find number of days in this target month
    const maxDaysInMonth = new Date(year, safeMonthIdx + 1, 0).getDate();
    const clampedDay = Math.min(Math.max(1, Number(dueDay) || 20), maxDaysInMonth);
    const dayStr = String(clampedDay).padStart(2, '0');
    const monthStr = String(safeMonthIdx + 1).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    const { data: classData } = await supabase.from('classes').select('*').order('name');
    if (classData) setClasses(classData);

    const rules = await fetchLateFeeRules(supabase);
    setLateFeeRules(rules);

    const initialDue = computeDefaultDueDate(month, academicYear, rules.dueDay);
    setDueDate(initialDue);
    setIsOverridden(false);
  };

  // When month or academic year changes, update default due date if user hasn't overridden
  useEffect(() => {
    if (!isOverridden && lateFeeRules) {
      setDueDate(computeDefaultDueDate(month, academicYear, lateFeeRules.dueDay));
    }
  }, [month, academicYear, lateFeeRules]);


  const handleSimulate = async () => {
    if (!dueDate) return alert("Please select a due date.");
    setIsSimulating(true);
    setPreviewData(null);
    setGenerationSuccess(false);

    try {
      // 1. Fetch Students
      let studentsQuery = supabase.from('students').select('id, name, class_id');
      if (targetClass !== 'all') {
        studentsQuery = studentsQuery.eq('class_id', targetClass);
      }
      const { data: students, error: studentErr } = await studentsQuery;
      
      // 2. Fetch Fee Structures
      const { data: structures } = await supabase.from('fee_structures').select('*, fee_heads(name, is_recurring)');
      
      // 3. Fetch Existing Demands to avoid duplicates
      let existingDemandsQuery = supabase.from('fee_demands').select('student_id').eq('academic_year', academicYear).eq('month', month);
      const { data: existingDemands } = await existingDemandsQuery;
      const existingStudentIds = new Set(existingDemands?.map(d => d.student_id) || []);

      // Simulation Logic
      let eligibleStudents = 0;
      let skippedStudents = 0;
      let totalExpectedAmount = 0;
      let demandsToCreate = [];

      for (const student of (students || [])) {
        if (existingStudentIds.has(student.id)) {
          skippedStudents++;
          continue;
        }

        // Find applicable fee structures for this student's class
        const applicableFees = structures?.filter(s => s.class_id === student.class_id) || [];
        
        let studentTotal = 0;
        let items = [];

        for (const fee of applicableFees) {
          // Rule: If fee is NOT recurring, we only charge it in 'April' (the start of session)
          if (!fee.fee_heads.is_recurring && month !== 'April') continue;
          
          studentTotal += Number(fee.amount);
          items.push({
            fee_head_id: fee.fee_head_id,
            amount: Number(fee.amount)
          });
        }

        if (studentTotal > 0) {
          eligibleStudents++;
          totalExpectedAmount += studentTotal;
          demandsToCreate.push({
            student_id: student.id,
            academic_year: academicYear,
            month: month,
            total_amount: studentTotal,
            due_date: dueDate,
            items: items
          });
        }
      }

      setPreviewData({
        eligibleStudents,
        skippedStudents,
        totalExpectedAmount,
        demandsToCreate
      });

    } catch (err) {
      alert("Error in simulation: " + err.message);
    }
    
    setIsSimulating(false);
  };

  const handleGenerate = async () => {
    if (!previewData || previewData.demandsToCreate.length === 0) return;
    if (!window.confirm(`Are you absolutely sure you want to generate ${previewData.eligibleStudents} invoices? This action cannot be easily undone.`)) return;
    
    setIsGenerating(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // We do this in a simple loop for safety in Supabase. In a real heavy enterprise, this would be a server-side Edge Function.
      // Since it's ~633 students, client side looping batch inserts is acceptable for now.
      
      let successCount = 0;

      for (const demand of previewData.demandsToCreate) {
        // Insert Demand
        const { data: newDemand, error: demandError } = await supabase
          .from('fee_demands')
          .insert({
            student_id: demand.student_id,
            academic_year: demand.academic_year,
            month: demand.month,
            total_amount: demand.total_amount,
            due_date: demand.due_date,
            status: 'pending',
            generated_by: userId
          })
          .select()
          .single();

        if (demandError || !newDemand) {
          console.error("Failed to insert demand for student:", demand.student_id, demandError);
          continue;
        }

        // Insert Items
        const itemsToInsert = demand.items.map(item => ({
          demand_id: newDemand.id,
          fee_head_id: item.fee_head_id,
          amount: item.amount
        }));

        await supabase.from('fee_demand_items').insert(itemsToInsert);
        successCount++;
      }

      setGenerationSuccess(true);
      setPreviewData(null);
      alert(`Successfully generated invoices for ${successCount} students.`);
    } catch (err) {
      alert("Error generating invoices: " + err.message);
    }

    setIsGenerating(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>Batch Fee Generation Engine</h2>
          <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Automatically calculate and generate monthly or annual fee demands for all students.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left Column: Configuration */}
        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #cbd5e1' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={18} color="#2563eb" /> Generation Parameters
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>Academic Year</label>
              <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '0.9rem' }}>
                <option value="2025">2025-2026</option>
                <option value="2026">2026-2027</option>
                <option value="2027">2027-2028</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>Billing Month</label>
              <select value={month} onChange={e => setMonth(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '0.9rem' }}>
                {months.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.5rem' }}>Note: Annual (one-time) fees are only applied during April billing.</p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>Target Group</label>
              <select value={targetClass} onChange={e => setTargetClass(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a', fontSize: '0.9rem' }}>
                <option value="all">Entire School (All Classes)</option>
                {classes.map(c => <option key={c.id} value={c.id}>Only {c.name} {c.section}</option>)}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>Payment Due Date</label>
                {isOverridden ? (
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsOverridden(false);
                      setDueDate(computeDefaultDueDate(month, academicYear, lateFeeRules.dueDay));
                    }} 
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <RotateCcw size={12} /> Reset to Default ({formatDueDateDisplay(computeDefaultDueDate(month, academicYear, lateFeeRules.dueDay))})
                  </button>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, background: '#d1fae5', padding: '0.15rem 0.5rem', borderRadius: '0.375rem' }}>
                    Configured Default (Day {lateFeeRules.dueDay})
                  </span>
                )}
              </div>
              <input 
                type="date" 
                value={dueDate} 
                onChange={e => {
                  setDueDate(e.target.value);
                  setIsOverridden(e.target.value !== computeDefaultDueDate(month, academicYear, lateFeeRules.dueDay));
                }} 
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  borderRadius: '0.5rem', 
                  border: isOverridden ? '2px solid #f59e0b' : '1px solid #cbd5e1', 
                  background: '#ffffff', 
                  color: '#0f172a', 
                  fontSize: '0.9rem' 
                }} 
              />
              <p style={{ fontSize: '0.75rem', color: isOverridden ? '#b45309' : '#64748b', marginTop: '0.35rem' }}>
                {isOverridden 
                  ? `⚠️ Overridden: Default is ${formatDueDateDisplay(computeDefaultDueDate(month, academicYear, lateFeeRules.dueDay))}. Demands in this batch will be assigned ${formatDueDateDisplay(dueDate)}.`
                  : `Default date is automatically computed from global fee settings (Day ${lateFeeRules.dueDay}). You can override it above.`}
              </p>
            </div>

            <button 
              onClick={handleSimulate}
              disabled={isSimulating || isGenerating}
              style={{
                width: '100%', padding: '1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem',
                fontWeight: 700, fontSize: '1rem', cursor: isSimulating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem'
              }}
            >
              {isSimulating ? 'Analyzing...' : <><Play size={18} /> Run Simulation & Preview</>}
            </button>
          </div>
        </div>

        {/* Right Column: Preview & Action */}
        <div>
          {generationSuccess && (
            <div style={{ background: '#dcfce7', border: '1px solid #86efac', padding: '1.5rem', borderRadius: '1rem', color: '#166534', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <CheckCircle2 size={32} color="#16a34a" />
              <div>
                <h4 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.25rem' }}>Generation Complete!</h4>
                <p>The invoices have been successfully generated and published to student ledgers.</p>
              </div>
            </div>
          )}

          {!previewData && !generationSuccess && (
            <div style={{ border: '2px dashed #cbd5e1', borderRadius: '1rem', padding: '3rem', textAlign: 'center', color: '#94a3b8', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>Run a simulation to see the fee projection here.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>No data will be saved until you confirm the preview.</p>
            </div>
          )}

          {previewData && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ background: '#1e293b', color: 'white', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={20} color="#fbbf24" /> Review Generation Batch
                </h3>
                <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: '0.25rem' }}>Please review these numbers carefully before generating.</p>
              </div>
              
              <div style={{ padding: '1.5rem' }}>
                <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                  <div><strong>Month:</strong> {month} {academicYear}</div>
                  <div><strong>Assigned Due Date:</strong> <span style={{ color: '#1e40af', fontWeight: 700 }}>{formatDueDateDisplay(dueDate)}</span> {isOverridden && <span style={{ color: '#b45309', fontWeight: 600 }}>(Override)</span>}</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ background: '#eff6ff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #bfdbfe' }}>
                    <p style={{ color: '#1e3a8a', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Eligible Students</p>
                    <p style={{ color: '#1d4ed8', fontSize: '2rem', fontWeight: 800 }}>{previewData.eligibleStudents}</p>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                    <p style={{ color: '#475569', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>Skipped (Already Billed)</p>
                    <p style={{ color: '#64748b', fontSize: '2rem', fontWeight: 800 }}>{previewData.skippedStudents}</p>
                  </div>
                </div>

                <div style={{ background: '#f0fdf4', padding: '1.5rem', borderRadius: '0.75rem', border: '1px solid #bbf7d0', textAlign: 'center', marginBottom: '2rem' }}>
                  <p style={{ color: '#166534', fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>Total Expected Revenue Projection</p>
                  <p style={{ color: '#15803d', fontSize: '2.5rem', fontWeight: 800 }}>₹{previewData.totalExpectedAmount.toLocaleString('en-IN')}</p>
                </div>

                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating || previewData.eligibleStudents === 0}
                  style={{
                    width: '100%', padding: '1.25rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '0.75rem',
                    fontWeight: 700, fontSize: '1.1rem', cursor: (isGenerating || previewData.eligibleStudents === 0) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {isGenerating ? 'Publishing Invoices...' : (previewData.eligibleStudents === 0 ? 'No Eligible Students Found' : <><CheckCircle2 size={24} /> Confirm & Generate Demands</>)}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Import this locally just for the icon since Settings wasn't imported at top
function Settings(props) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={props.size} height={props.size} viewBox="0 0 24 24" fill="none" stroke={props.color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
}

export default FeeGenerationEngine;
