import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight,
  ArrowLeft,
  FileText,
  Search
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const BulkBankReceipts = () => {
  const { user } = useAuth();
  
  // -- STATE: Step Management --
  // 1: Batch Metadata, 2: Spreadsheet Grid, 3: Summary & Posting
  const [step, setStep] = useState(1);
  
  // -- STATE: Batch Metadata --
  const [batchData, setBatchData] = useState({
    depositDate: new Date().toISOString().split('T')[0],
    bankName: '',
    branch: '',
    totalAmount: '',
    slipCount: '',
    remarks: ''
  });
  
  // -- STATE: Spreadsheet Grid --
  const [entries, setEntries] = useState([
    { id: 1, uid: '', name: '', class: '', amount: '', slip: '', mode: 'Bank Transfer', alloc: 'fifo', status: 'pending', outstanding: 0, advance: 0 }
  ]);
  const [loadingRowId, setLoadingRowId] = useState(null);
  const [expectedTotal, setExpectedTotal] = useState(0);
  const [enteredTotal, setEnteredTotal] = useState(0);
  
  // -- STATE: Processing --
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);

  // References for keyboard navigation
  const gridRefs = useRef({});

  // -- CALCULATE TOTALS --
  useEffect(() => {
    const expected = parseFloat(batchData.totalAmount) || 0;
    setExpectedTotal(expected);
    
    const entered = entries.reduce((sum, entry) => {
      const amt = parseFloat(entry.amount) || 0;
      return sum + amt;
    }, 0);
    setEnteredTotal(entered);
  }, [batchData.totalAmount, entries]);

  // -- HANDLERS: Batch Metadata --
  const handleBatchChange = (e) => {
    const { name, value } = e.target;
    setBatchData(prev => ({ ...prev, [name]: value }));
  };

  const handleStartGrid = () => {
    if (!batchData.depositDate || !batchData.bankName || !batchData.totalAmount) {
      alert("Please fill in Date, Bank Name, and Total Amount.");
      return;
    }
    setStep(2);
  };

  // -- HANDLERS: Grid Entry --
  const handleEntryChange = (id, field, value) => {
    setEntries(prev => prev.map(entry => {
      if (entry.id === id) {
        return { ...entry, [field]: value, status: 'pending' };
      }
      return entry;
    }));
  };

  const addRow = () => {
    setEntries(prev => [
      ...prev,
      { id: Date.now(), uid: '', name: '', class: '', amount: '', slip: '', mode: 'Bank Transfer', alloc: 'fifo', status: 'pending', outstanding: 0, advance: 0 }
    ]);
  };

  const removeRow = (id) => {
    if (entries.length === 1) return;
    setEntries(prev => prev.filter(entry => entry.id !== id));
  };

  // Keyboard navigation logic
  const handleKeyDown = (e, rowId, field, rowIndex, colIndex) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rowIndex === entries.length - 1 && field === 'slip') {
        addRow();
        setTimeout(() => focusCell(rowIndex + 1, 0), 50);
      } else {
        focusCell(rowIndex + 1, colIndex);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusCell(rowIndex + 1, colIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusCell(rowIndex - 1, colIndex);
    }
  };

  const focusCell = (r, c) => {
    const key = `${r}-${c}`;
    if (gridRefs.current[key]) {
      gridRefs.current[key].focus();
    }
  };

  // -- FETCH STUDENT DATA --
  const handleUidBlur = async (id, uid) => {
    if (!uid) return;
    
    setLoadingRowId(id);
    try {
      // Fetch student details
      const { data: student, error } = await supabase
        .from('students')
        .select(`
          id, 
          name, 
          classes(name, section)
        `)
        .eq('uid', uid)
        .maybeSingle();
        
      if (error || !student) {
        setEntries(prev => prev.map(entry => 
          entry.id === id ? { ...entry, name: 'NOT FOUND', class: '-', status: 'error', student_id: null } : entry
        ));
        setLoadingRowId(null);
        return;
      }
      
      const className = student.classes ? `${student.classes.name} - ${student.classes.section}` : 'N/A';
      
      // Fetch outstanding balance
      const { data: demands } = await supabase
        .from('fee_demands')
        .select('total_amount, paid_amount')
        .eq('student_id', student.id)
        .in('status', ['pending', 'partial']);
        
      const outstanding = demands ? demands.reduce((sum, d) => sum + (d.total_amount - (d.paid_amount || 0)), 0) : 0;

      setEntries(prev => prev.map(entry => 
        entry.id === id ? { 
          ...entry, 
          name: student.name, 
          class: className, 
          student_id: student.id,
          outstanding: outstanding,
          status: 'valid'
        } : entry
      ));
      
    } catch (err) {
      console.error(err);
    }
    setLoadingRowId(null);
  };

  // -- PROCESSING --
  const handleGoToSummary = () => {
    // Validate
    const invalidRows = entries.filter(e => e.uid && (!e.student_id || !e.amount));
    if (invalidRows.length > 0) {
      alert("Please fix invalid rows before proceeding.");
      return;
    }
    setStep(3);
  };

  const processBatch = async () => {
    if (expectedTotal !== enteredTotal) {
      alert("Expected total must match entered total!");
      return;
    }
    
    setIsProcessing(true);
    try {
      // 1. Create Batch Record
      const batchNumber = `BATCH-${new Date().toISOString().split('T')[0].replace(/-/g,'')}-${Math.floor(Math.random()*1000)}`;
      
      const { data: batch, error: batchError } = await supabase
        .from('fee_batches')
        .insert([{
          batch_number: batchNumber,
          deposit_date: batchData.depositDate,
          bank_name: batchData.bankName,
          branch: batchData.branch,
          total_amount: expectedTotal,
          slip_count: entries.length,
          created_by: user.id
        }])
        .select()
        .single();
        
      if (batchError) throw batchError;
      
      // 2. Create Batch Entries
      const validEntries = entries.filter(e => e.uid && e.amount);
      const entryPayloads = validEntries.map((e, index) => ({
        batch_id: batch.id,
        entry_number: index + 1,
        student_id: e.student_id,
        student_uid: e.uid,
        student_name_snapshot: e.name,
        class_snapshot: e.class,
        amount_paid: parseFloat(e.amount),
        slip_number: e.slip,
        payment_mode: e.mode,
        allocation_method: e.alloc,
        previous_outstanding: e.outstanding
      }));
      
      const { error: entriesError } = await supabase
        .from('fee_batch_entries')
        .insert(entryPayloads);
        
      if (entriesError) throw entriesError;
      
      // 3. Trigger RPC
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('process_fee_batch', {
          p_batch_id: batch.id,
          p_user_id: user.id
        });
        
      if (rpcError) throw rpcError;
      
      setProcessResult({
        success: true,
        batchNumber: batchNumber,
        details: rpcData
      });
      
    } catch (err) {
      console.error(err);
      setProcessResult({
        success: false,
        error: err.message || "An error occurred during processing."
      });
    }
    setIsProcessing(false);
  };

  const resetAll = () => {
    setStep(1);
    setBatchData({
      depositDate: new Date().toISOString().split('T')[0],
      bankName: '',
      branch: '',
      totalAmount: '',
      slipCount: '',
      remarks: ''
    });
    setEntries([{ id: 1, uid: '', name: '', class: '', amount: '', slip: '', mode: 'Bank Transfer', alloc: 'fifo', status: 'pending', outstanding: 0, advance: 0 }]);
    setProcessResult(null);
  };

  // --- RENDER ---
  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1e293b' }}>Bulk Bank Receipts</h1>
        <p style={{ color: '#64748b' }}>Process large batches of bank counterfoils quickly and accurately.</p>
      </div>

      {/* STEP INDICATOR */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ 
            padding: '0.5rem 1rem', 
            borderRadius: '0.5rem', 
            background: step === s ? '#3b82f6' : (step > s ? '#10b981' : '#f1f5f9'),
            color: step === s || step > s ? 'white' : '#64748b',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {step > s && <CheckCircle size={16} />}
            Step {s}: {s === 1 ? 'Batch Info' : s === 2 ? 'Spreadsheet Entry' : 'Summary & Post'}
          </div>
        ))}
      </div>

      {/* STEP 1: BATCH METADATA */}
      {step === 1 && (
        <div style={{ background: 'white', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1e293b' }}>Initialize Batch</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#475569', marginBottom: '0.5rem' }}>Deposit Date *</label>
              <input 
                type="date" 
                name="depositDate"
                value={batchData.depositDate}
                onChange={handleBatchChange}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#475569', marginBottom: '0.5rem' }}>Bank Name *</label>
              <input 
                type="text" 
                name="bankName"
                placeholder="e.g., State Bank of India"
                value={batchData.bankName}
                onChange={handleBatchChange}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#475569', marginBottom: '0.5rem' }}>Branch (Optional)</label>
              <input 
                type="text" 
                name="branch"
                placeholder="e.g., Main Branch"
                value={batchData.branch}
                onChange={handleBatchChange}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#475569', marginBottom: '0.5rem' }}>Total Bundle Amount (₹) *</label>
              <input 
                type="number" 
                name="totalAmount"
                placeholder="Amount written on back of bundle"
                value={batchData.totalAmount}
                onChange={handleBatchChange}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '1.125rem', fontWeight: 'bold' }}
              />
            </div>
          </div>
          
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              onClick={handleStartGrid}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#3b82f6', color: 'white', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}
            >
              Continue to Data Entry <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: SPREADSHEET GRID */}
      {step === 2 && (
        <div>
          {/* Running Total Dashboard */}
          <div style={{ display: 'flex', gap: '2rem', background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>Expected Total</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>₹{expectedTotal.toLocaleString()}</p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>Entered Total</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: enteredTotal === expectedTotal ? '#10b981' : '#f59e0b' }}>₹{enteredTotal.toLocaleString()}</p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase' }}>Difference</p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: Math.abs(expectedTotal - enteredTotal) === 0 ? '#10b981' : '#ef4444' }}>
                ₹{Math.abs(expectedTotal - enteredTotal).toLocaleString()}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
               <button 
                  onClick={handleGoToSummary}
                  disabled={expectedTotal !== enteredTotal || expectedTotal === 0}
                  style={{ 
                    padding: '1rem 2rem', 
                    background: expectedTotal !== enteredTotal ? '#94a3b8' : '#10b981', 
                    color: 'white', 
                    borderRadius: '0.5rem', 
                    fontWeight: 'bold', 
                    border: 'none', 
                    cursor: expectedTotal !== enteredTotal ? 'not-allowed' : 'pointer',
                    fontSize: '1.125rem'
                  }}
                >
                  Review & Post
                </button>
            </div>
          </div>

          {/* SPREADSHEET */}
          <div style={{ background: 'white', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <tr>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#475569', fontWeight: '600', width: '50px' }}>#</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#475569', fontWeight: '600', width: '180px' }}>Student UID *</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#475569', fontWeight: '600' }}>Student Details</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#475569', fontWeight: '600', width: '150px' }}>Amount (₹) *</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#475569', fontWeight: '600', width: '180px' }}>Slip/Ref No</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#475569', fontWeight: '600', width: '80px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0', background: entry.status === 'error' ? '#fef2f2' : 'white' }}>
                    <td style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500', textAlign: 'center' }}>
                      {index + 1}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <input 
                        ref={el => gridRefs.current[`${index}-0`] = el}
                        type="text" 
                        value={entry.uid}
                        onChange={(e) => handleEntryChange(entry.id, 'uid', e.target.value)}
                        onBlur={(e) => handleUidBlur(entry.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, entry.id, 'uid', index, 0)}
                        placeholder="Scan or type"
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                      />
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {loadingRowId === entry.id ? (
                        <span style={{ color: '#94a3b8' }}>Loading...</span>
                      ) : entry.name ? (
                        <div>
                          <div style={{ fontWeight: '600', color: entry.status === 'error' ? '#ef4444' : '#1e293b' }}>{entry.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '1rem' }}>
                            <span>{entry.class}</span>
                            {entry.outstanding > 0 && <span style={{ color: '#f59e0b' }}>Due: ₹{entry.outstanding}</span>}
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <input 
                        ref={el => gridRefs.current[`${index}-1`] = el}
                        type="number" 
                        value={entry.amount}
                        onChange={(e) => handleEntryChange(entry.id, 'amount', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, entry.id, 'amount', index, 1)}
                        placeholder="0.00"
                        style={{ width: '100%', padding: '0.5rem', border: '2px solid #cbd5e1', borderRadius: '0.25rem', fontWeight: 'bold' }}
                      />
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <input 
                        ref={el => gridRefs.current[`${index}-2`] = el}
                        type="text" 
                        value={entry.slip}
                        onChange={(e) => handleEntryChange(entry.id, 'slip', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, entry.id, 'slip', index, 2)}
                        placeholder="Optional"
                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.25rem' }}
                      />
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button 
                        onClick={() => removeRow(entry.id)}
                        disabled={entries.length === 1}
                        style={{ background: 'none', border: 'none', color: entries.length === 1 ? '#cbd5e1' : '#ef4444', cursor: entries.length === 1 ? 'not-allowed' : 'pointer' }}
                      >
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ padding: '1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button 
                onClick={addRow}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', color: '#3b82f6', border: '1px solid #bfdbfe', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer' }}
              >
                <Plus size={18} /> Add Row
              </button>
            </div>
          </div>
          
          <div style={{ marginTop: '1.5rem' }}>
            <button 
              onClick={() => setStep(1)}
              style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}
            >
              ← Back to Batch Info
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SUMMARY & POSTING */}
      {step === 3 && !processResult && (
        <div style={{ background: 'white', padding: '2rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem', color: '#1e293b' }}>Batch Summary</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <h3 style={{ color: '#475569', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '1rem' }}>Metadata</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Date:</span> <span style={{ fontWeight: '500' }}>{batchData.depositDate}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Bank:</span> <span style={{ fontWeight: '500' }}>{batchData.bankName} {batchData.branch}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Total Valid Entries:</span> <span style={{ fontWeight: '500' }}>{entries.filter(e => e.uid && e.amount).length}</span></div>
              </div>
            </div>
            
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
              <h3 style={{ color: '#475569', fontSize: '0.875rem', fontWeight: '600', textTransform: 'uppercase', marginBottom: '1rem' }}>Financials</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Expected Total:</span> <span style={{ fontWeight: '500' }}>₹{expectedTotal.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#64748b' }}>Entered Total:</span> <span style={{ fontWeight: '500', color: '#10b981' }}>₹{enteredTotal.toLocaleString()}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <span style={{ color: '#1e293b', fontWeight: 'bold' }}>Difference:</span> 
                  <span style={{ fontWeight: 'bold', color: '#10b981' }}>₹0</span>
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              onClick={() => setStep(2)}
              disabled={isProcessing}
              style={{ background: 'none', border: 'none', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}
            >
              ← Edit Entries
            </button>
            
            <button 
              onClick={processBatch}
              disabled={isProcessing}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981', color: 'white', padding: '1rem 2rem', borderRadius: '0.5rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '1.125rem' }}
            >
              {isProcessing ? 'Processing Transaction...' : 'Process & Post Batch'} <CheckCircle size={20} />
            </button>
          </div>
        </div>
      )}

      {/* POST-PROCESSING RESULT */}
      {processResult && (
        <div style={{ background: 'white', padding: '3rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', textAlign: 'center' }}>
          {processResult.success ? (
            <>
              <div style={{ width: '80px', height: '80px', background: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <CheckCircle size={40} color="#10b981" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '1rem' }}>Batch Posted Successfully!</h2>
              <p style={{ color: '#64748b', fontSize: '1.125rem', marginBottom: '0.5rem' }}>Batch Number: <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{processResult.batchNumber}</span></p>
              <p style={{ color: '#64748b', marginBottom: '2rem' }}>
                {processResult.details?.processed_count} receipts generated. 
                {processResult.details?.advance_total > 0 && ` ₹${processResult.details.advance_total} recorded as advance.`}
              </p>
              
              <button 
                onClick={resetAll}
                style={{ background: '#3b82f6', color: 'white', padding: '0.75rem 2rem', borderRadius: '0.5rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}
              >
                Process Another Batch
              </button>
            </>
          ) : (
            <>
              <div style={{ width: '80px', height: '80px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <AlertCircle size={40} color="#ef4444" />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', marginBottom: '1rem' }}>Batch Processing Failed</h2>
              <p style={{ color: '#ef4444', marginBottom: '2rem', background: '#fef2f2', padding: '1rem', borderRadius: '0.5rem' }}>
                {processResult.error}
              </p>
              <p style={{ color: '#64748b', marginBottom: '2rem' }}>
                No records were posted. The entire transaction has been safely rolled back.
              </p>
              
              <button 
                onClick={() => setProcessResult(null)}
                style={{ background: '#3b82f6', color: 'white', padding: '0.75rem 2rem', borderRadius: '0.5rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}
              >
                Return to Summary
              </button>
            </>
          )}
        </div>
      )}

    </div>
  );
};

export default BulkBankReceipts;
