import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, History, ChevronDown, ChevronUp, Calendar, AlertTriangle, ShieldCheck, FileText, ChevronRight } from 'lucide-react';
import { 
  calculateStudentFeeSummary, 
  fetchLateFeeRules, 
  DEFAULT_LATE_FEE_RULES, 
  formatFeeCurrency, 
  formatDueDateDisplay 
} from '../services/fee/LateFeeService';

const FeeDashboardView = ({ studentId }) => {
  const [studentDetails, setStudentDetails] = useState(null);
  const [demands, setDemands] = useState([]);
  const [payments, setPayments] = useState([]);
  const [lateFeeRules, setLateFeeRules] = useState(DEFAULT_LATE_FEE_RULES);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [showItemizedDetails, setShowItemizedDetails] = useState(true);
  const [expandedDemandIds, setExpandedDemandIds] = useState({});

  // Declaration Form State
  const [utr, setUtr] = useState('');
  const [paymentMode, setPaymentMode] = useState('upi');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Bank Settings
  const [bankDetails, setBankDetails] = useState({
    accountName: 'Gyanoday Niketan',
    bankName: 'State Bank of India',
    accountNo: '31245678901',
    ifscCode: 'SBIN0001234',
    upiId: 'gyanoday@sbi'
  });

  useEffect(() => {
    if (studentId) {
      fetchData();
    }
  }, [studentId]);

  const fetchData = async () => {
    // 1. Fetch enriched details
    const { data: enrichedStudent } = await supabase
      .from('students')
      .select('*, classes(name, section)')
      .eq('id', studentId)
      .single();
      
    if (enrichedStudent) setStudentDetails(enrichedStudent);

    // 2. Fetch Demands
    const { data: fetchedDemands } = await supabase
      .from('fee_demands')
      .select('*, fee_demand_items(*, fee_heads(name))')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (fetchedDemands) setDemands(fetchedDemands);

    // 3. Fetch Payments
    const { data: fetchedPayments } = await supabase
      .from('fee_payments')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (fetchedPayments) setPayments(fetchedPayments);

    // 4. Fetch Bank Settings
    const { data: settingsData } = await supabase
      .from('fee_settings')
      .select('value')
      .eq('key', 'school_bank_details')
      .single();
    if (settingsData?.value) {
      setBankDetails(prev => ({ ...prev, ...settingsData.value }));
    }

    // 5. Fetch Late Fee Rules from centralized fee_settings
    const rules = await fetchLateFeeRules(supabase);
    setLateFeeRules(rules);
  };

  // Centralized single source of truth for fee calculation
  const feeSummary = useMemo(() => {
    return calculateStudentFeeSummary({
      demands,
      payments,
      lateFeeRules,
      currentDate: new Date()
    });
  }, [demands, payments, lateFeeRules]);

  // Keep payment amount synced with total payable amount
  useEffect(() => {
    setPaymentAmount(feeSummary.totalPayableAmount);
  }, [feeSummary.totalPayableAmount]);

  const toggleDemandExpand = (demandId) => {
    setExpandedDemandIds(prev => ({
      ...prev,
      [demandId]: !prev[demandId]
    }));
  };

  const submitDeclaration = async (e) => {
    e.preventDefault();
    if (paymentAmount <= 0) return alert("Amount must be greater than 0");
    if (!utr) return alert("Reference Number is required");

    setSubmitting(true);
    
    try {
      // Basic duplicate check on client side for safety
      const isDuplicate = payments.some(p => p.reference_number === utr);
      if (isDuplicate) {
        alert("This Reference/UTR number has already been submitted.");
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from('fee_payments').insert({
        student_id: studentId,
        amount: paymentAmount,
        payment_mode: paymentMode,
        reference_number: utr,
        payment_date: paymentDate,
        status: 'pending_verification'
      });

      if (error) throw error;

      setSubmitSuccess(true);
      
      // Refresh payments list
      const { data: fetchedPayments } = await supabase
        .from('fee_payments')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      if (fetchedPayments) setPayments(fetchedPayments);

      setTimeout(() => {
        setShowPaymentModal(false);
        setSubmitSuccess(false);
      }, 3000);

    } catch (err) {
      console.error(err);
      alert("Failed to submit declaration. Please try again.");
    }
    setSubmitting(false);
  };

  const activeDemands = feeSummary.activeDemands;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      
      {/* Verification Alert */}
      {payments.some(p => p.status === 'pending_verification') && (
        <div style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Payment Under Review</strong>
            <span style={{ fontSize: '0.9rem' }}>You have submitted a payment declaration that is currently being verified by the Accounts Office.</span>
          </div>
        </div>
      )}

      {/* --- REDESIGNED FEES SUMMARY (Inspired by Loreto Convent Darjeeling reference) --- */}
      <div style={{ 
        background: '#ffffff', 
        borderRadius: '0.75rem', 
        border: '1px solid #e2e8f0', 
        borderLeft: '5px solid #0284c7', 
        boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.05)', 
        overflow: 'hidden', 
        marginBottom: '2rem' 
      }}>
        {/* Card Header Title */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0284c7', letterSpacing: '0.025em' }}>Fees Summary</span>
          {feeSummary.hasActiveDues && (
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Academic Session: <strong>2026-2027</strong>
            </span>
          )}
        </div>

        {/* Card Hero Row (Amount Payable | Amount | Due Date | Late Fees | Total Amount | Details Button) */}
        <div style={{ padding: '1.5rem', background: '#fafafa', display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr auto', gap: '1.5rem', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
          {/* Circular Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', fontWeight: 800, fontSize: '1.1rem' }}>
              ₹
            </div>
            <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '1rem' }}>Amount Payable</span>
          </div>

          {/* Amount */}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
              {formatFeeCurrency(feeSummary.totalBaseAmount)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '0.15rem' }}>Amount</div>
          </div>

          {/* Due Date */}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
              {feeSummary.earliestDueDate}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '0.15rem' }}>Due Date</div>
          </div>

          {/* Late Fees */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontWeight: 800, fontSize: '1.1rem', color: feeSummary.totalLateFees > 0 ? '#dc2626' : '#0f172a' }}>
                {formatFeeCurrency(feeSummary.totalLateFees)}
              </span>
              {feeSummary.totalLateFees > 0 && (
                <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#b91c1c', padding: '0.1rem 0.4rem', borderRadius: '0.25rem', fontWeight: 800 }}>
                  OVERDUE
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '0.15rem' }}>Late Fees</div>
          </div>

          {/* Total Amount */}
          <div>
            <div style={{ fontWeight: 900, fontSize: '1.25rem', color: '#0284c7' }}>
              {formatFeeCurrency(feeSummary.totalPayableAmount)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginTop: '0.15rem' }}>Total Amount</div>
          </div>

          {/* Toggle Details Button */}
          <div>
            <button 
              type="button"
              onClick={() => setShowItemizedDetails(!showItemizedDetails)}
              style={{
                background: '#0284c7',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <FileText size={14} /> Details
            </button>
          </div>
        </div>

        {/* --- ITEMIZED FEE BREAKDOWN TABLE --- */}
        {showItemizedDetails && (
          <div style={{ padding: '1rem 1.5rem' }}>
            {!feeSummary.hasActiveDues ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={24} /> All dues have been cleared! No pending demands found.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '0.75rem', fontWeight: 700 }}>Fees Category / Month</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700, textAlign: 'right' }}>Amount</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700, textAlign: 'center' }}>Due Date</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700, textAlign: 'right' }}>Late Fees</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700, textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '0.75rem', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeDemands.map((demand) => {
                      const isExpanded = expandedDemandIds[demand.id] !== false; // default expanded
                      return (
                        <React.Fragment key={demand.id}>
                          {/* Demand Master Row */}
                          <tr style={{ borderBottom: '1px solid #e2e8f0', background: demand.isOverdue ? '#fef2f2' : '#ffffff' }}>
                            <td style={{ padding: '0.85rem 0.75rem', fontWeight: 600, color: '#0f172a' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>Session Fees - {demand.month} {demand.academic_year}</span>
                                <span style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '0.25rem', fontWeight: 700 }}>
                                  {demand.month}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                              {formatFeeCurrency(demand.baseAmount)}
                            </td>
                            <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
                              {demand.formattedDueDate}
                            </td>
                            <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 700, color: demand.lateFee > 0 ? '#dc2626' : '#475569' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                                <span>{formatFeeCurrency(demand.lateFee)}</span>
                                {demand.isOverdue && (
                                  <span style={{ fontSize: '0.65rem', background: '#fee2e2', color: '#b91c1c', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontWeight: 800 }}>
                                    +{demand.overdueMonths}m
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#0284c7' }}>
                              {formatFeeCurrency(demand.totalAmountWithLateFee)}
                            </td>
                            <td style={{ padding: '0.85rem 0.5rem', textAlign: 'center' }}>
                              {demand.items?.length > 0 && (
                                <button 
                                  type="button" 
                                  onClick={() => toggleDemandExpand(demand.id)}
                                  style={{ background: '#16a34a', color: 'white', border: 'none', width: '22px', height: '22px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700 }}
                                  title="Toggle itemized heads"
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              )}
                            </td>
                          </tr>

                          {/* Sub-table for fee heads under this demand */}
                          {isExpanded && demand.items?.length > 0 && (
                            <tr>
                              <td colSpan={6} style={{ padding: '0', background: '#f8fafc' }}>
                                <div style={{ borderLeft: '3px solid #cbd5e1', margin: '0.5rem 1rem 0.75rem 1.5rem', background: '#ffffff', borderRadius: '0.375rem', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                  <div style={{ background: '#1e293b', color: '#f8fafc', padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                                    <div>Fee Head Description</div>
                                    <div style={{ textAlign: 'right' }}>Payable Amount</div>
                                    <div style={{ textAlign: 'center' }}>Due Date</div>
                                    <div style={{ textAlign: 'right' }}>Late Fees</div>
                                  </div>
                                  {demand.items.map((item, idx) => (
                                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '0.5rem 0.75rem', fontSize: '0.8rem', borderBottom: idx !== demand.items.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                                      <div style={{ color: '#334155', fontWeight: 600 }}>• {item.name}</div>
                                      <div style={{ textAlign: 'right', color: '#0f172a', fontWeight: 600 }}>{formatFeeCurrency(item.amount)}</div>
                                      <div style={{ textAlign: 'center', color: '#64748b' }}>{demand.formattedDueDate}</div>
                                      <div style={{ textAlign: 'right', color: '#64748b' }}>
                                        {idx === 0 && demand.lateFee > 0 ? (
                                          <span style={{ color: '#dc2626', fontWeight: 700 }}>{formatFeeCurrency(demand.lateFee)}</span>
                                        ) : '₹0.00'}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #0f172a', background: '#f8fafc' }}>
                      <td style={{ padding: '0.85rem 0.75rem', fontWeight: 800, color: '#0f172a' }}>Total</td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                        {formatFeeCurrency(feeSummary.totalBaseAmount)}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'center' }}></td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 800, color: feeSummary.totalLateFees > 0 ? '#dc2626' : '#0f172a' }}>
                        {formatFeeCurrency(feeSummary.totalLateFees)}
                      </td>
                      <td style={{ padding: '0.85rem 0.75rem', textAlign: 'right', fontWeight: 900, color: '#0284c7', fontSize: '1rem' }}>
                        {formatFeeCurrency(feeSummary.totalPayableAmount)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Action Button: Initiate Payment */}
        <div style={{ padding: '1rem 1.5rem', background: '#ffffff', borderTop: '1px solid #e2e8f0' }}>
          <button 
            onClick={() => {
              setPaymentAmount(feeSummary.totalPayableAmount);
              setShowPaymentModal(true);
            }}
            disabled={feeSummary.totalPayableAmount <= 0}
            style={{ 
              width: '100%', 
              background: feeSummary.totalPayableAmount > 0 ? '#0284c7' : '#94a3b8', 
              color: 'white', 
              padding: '1rem', 
              borderRadius: '0.5rem', 
              fontWeight: 800, 
              fontSize: '1.05rem', 
              border: 'none', 
              cursor: feeSummary.totalPayableAmount > 0 ? 'pointer' : 'not-allowed', 
              boxShadow: feeSummary.totalPayableAmount > 0 ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem'
            }}
          >
            <span>Initiate Payment</span>
            <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '0.2rem 0.6rem', borderRadius: '0.25rem', fontSize: '1.05rem' }}>
              {formatFeeCurrency(feeSummary.totalPayableAmount)}
            </span>
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem' }}>
            Supports UPI (Google Pay, PhonePe, Paytm), NEFT, and Net Banking.
          </p>
        </div>
      </div>


      {/* History */}
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <History size={20} /> Payment History
      </h3>
      <div style={{ background: 'white', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {payments.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No payments recorded.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {payments.map((p, i) => (
              <div key={p.id} style={{ padding: '1.25rem', borderBottom: i !== payments.length - 1 ? '1px solid #e2e8f0' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>₹{Number(p.amount).toLocaleString('en-IN')}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{new Date(p.payment_date).toLocaleDateString()} • Ref: {p.reference_number || 'N/A'}</div>
                </div>
                <div>
                  {p.status === 'approved' && <span style={{ background: '#dcfce7', color: '#166534', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>Verified</span>}
                  {p.status === 'pending_verification' && <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>Under Review</span>}
                  {p.status === 'rejected' && <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>Rejected</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- PAYMENT MODAL --- */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white w-full max-w-xl rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            
            {submitSuccess ? (
              <div className="p-8 text-center">
                <CheckCircle2 size={64} className="text-emerald-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Declaration Submitted</h2>
                <p className="text-slate-600 dark:text-slate-400">Your payment details have been sent to the Accounts Office. Your ledger will update once verified.</p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-10">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Complete Payment</h2>
                  <button onClick={() => setShowPaymentModal(false)} className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 w-8 h-8 rounded-full font-bold flex items-center justify-center transition-colors">✕</button>
                </div>

                <div className="p-6 space-y-6">
                  
                  {/* Fee Breakdown Summary */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
                    <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                      <span>Outstanding Fees</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{formatFeeCurrency(feeSummary.totalBaseAmount)}</span>
                    </div>
                    <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1.5">
                        Late Fee {feeSummary.totalLateFees > 0 && <span className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-1.5 py-0.2 rounded font-bold">Overdue</span>}
                      </span>
                      <span className={`font-semibold ${feeSummary.totalLateFees > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                        {formatFeeCurrency(feeSummary.totalLateFees)}
                      </span>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-700 my-2 pt-2 flex justify-between font-bold text-base text-slate-900 dark:text-white">
                      <span>Amount Payable</span>
                      <span className="text-sky-600 dark:text-sky-400 font-extrabold">{formatFeeCurrency(feeSummary.totalPayableAmount)}</span>
                    </div>
                  </div>

                  {/* Step 1: Bank Details & QR */}
                  <div>
                    <div className="inline-block bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full text-xs font-bold mb-3 border border-indigo-200 dark:border-indigo-800/50">STEP 1: MAKE PAYMENT</div>
                    
                    <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center mb-4">
                      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-4">Scan and pay using any UPI App</p>
                      <div className="w-[200px] h-[200px] bg-white border-2 border-slate-200 mx-auto flex items-center justify-center rounded-lg p-2 shadow-sm">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${bankDetails.upiId}&pn=${encodeURIComponent(bankDetails.accountName)}&am=${paymentAmount}&cu=INR`} alt="UPI QR" className="w-full h-full object-contain" />
                      </div>
                      <p className="font-extrabold text-2xl mt-4 text-brand-600 dark:text-brand-400">₹{Number(paymentAmount || 0).toLocaleString('en-IN')}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">UPI ID: <span className="font-semibold text-slate-700 dark:text-slate-300">{bankDetails.upiId}</span></p>
                    </div>

                    <div className="text-sm">
                      <p className="font-bold text-slate-800 dark:text-slate-200 mb-2">Or Bank Transfer (NEFT/IMPS):</p>
                      <div className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-slate-600 dark:text-slate-300 space-y-1">
                        <div>Account Name: <strong className="text-slate-900 dark:text-white font-semibold">{bankDetails.accountName}</strong></div>
                        <div>Bank: <strong className="text-slate-900 dark:text-white font-semibold">{bankDetails.bankName}</strong></div>
                        <div>Account No: <strong className="text-slate-900 dark:text-white font-semibold">{bankDetails.accountNo}</strong></div>
                        <div>IFSC Code: <strong className="text-slate-900 dark:text-white font-semibold">{bankDetails.ifscCode}</strong></div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Declaration */}
                  <div>
                    <div className="inline-block bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full text-xs font-bold mb-3 border border-emerald-200 dark:border-emerald-800/50">STEP 2: DECLARE PAYMENT</div>
                    
                    <form onSubmit={submitDeclaration} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Amount Paid (₹)</label>
                          <input 
                            type="number" 
                            required 
                            value={paymentAmount} 
                            onChange={e => setPaymentAmount(e.target.value)} 
                            className="input-field w-full font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-brand-500" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Payment Date</label>
                          <input 
                            type="date" 
                            required 
                            value={paymentDate} 
                            onChange={e => setPaymentDate(e.target.value)} 
                            className="input-field w-full font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-brand-500" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-1">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">Method</label>
                          <select 
                            value={paymentMode} 
                            onChange={e => setPaymentMode(e.target.value)} 
                            className="input-field w-full font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-brand-500"
                          >
                            <option value="upi">UPI</option>
                            <option value="neft">NEFT / IMPS</option>
                            <option value="bank_deposit">Bank Deposit</option>
                            <option value="cash">Cash</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">UTR / Reference Number</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="e.g. 312345678901" 
                            value={utr} 
                            onChange={e => setUtr(e.target.value)} 
                            className="input-field w-full font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg p-3 outline-none focus:ring-2 focus:ring-brand-500" 
                          />
                        </div>
                      </div>

                      <button 
                        disabled={submitting} 
                        type="submit" 
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-bold text-base shadow-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                      >
                        {submitting ? 'Submitting securely...' : 'Submit Payment Declaration'}
                      </button>
                    </form>
                  </div>

                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default FeeDashboardView;
