import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, History } from 'lucide-react';

const FeeDashboardView = ({ studentId }) => {
  const [studentDetails, setStudentDetails] = useState(null);
  const [demands, setDemands] = useState([]);
  const [payments, setPayments] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);

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
    // Fetch enriched details
    const { data: enrichedStudent } = await supabase
      .from('students')
      .select('*, classes(name, section)')
      .eq('id', studentId)
      .single();
      
    if (enrichedStudent) setStudentDetails(enrichedStudent);

    // Fetch Demands
    const { data: fetchedDemands } = await supabase
      .from('fee_demands')
      .select('*, fee_demand_items(*, fee_heads(name))')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    
    if (fetchedDemands) setDemands(fetchedDemands);

    // Fetch Payments
    const { data: fetchedPayments } = await supabase
      .from('fee_payments')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (fetchedPayments) setPayments(fetchedPayments);

    // Fetch Bank Settings
    const { data: settingsData } = await supabase
      .from('fee_settings')
      .select('value')
      .eq('key', 'school_bank_details')
      .single();
    if (settingsData?.value) {
      setBankDetails(prev => ({ ...prev, ...settingsData.value }));
    }

    // Calculate total payable (Billed - Paid/Pending Verification)
    let totalBilled = 0;
    let totalPaidOrPending = 0;

    fetchedDemands?.forEach(d => {
      if (d.status !== 'cancelled') totalBilled += Number(d.total_amount);
    });

    fetchedPayments?.forEach(p => {
      if (p.status !== 'rejected') totalPaidOrPending += Number(p.amount);
    });

    const outstanding = totalBilled - totalPaidOrPending;
    setPaymentAmount(outstanding > 0 ? outstanding : 0);
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

  const activeDemands = demands.filter(d => d.status === 'pending' || d.status === 'partial');

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      
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

      {/* Financial Summary */}
      <div style={{ background: 'white', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
          <p style={{ color: '#1e3a8a', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Amount Payable</p>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, color: '#1d4ed8', lineHeight: 1 }}>₹{paymentAmount.toLocaleString('en-IN')}</h1>
        </div>
        
        <div style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#334155', marginBottom: '1rem' }}>Fees Breakdown</h3>
          
          {activeDemands.length === 0 ? (
            <p style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={18} /> All dues are cleared.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeDemands.map(d => (
                <div key={d.id} style={{ borderBottom: '1px dashed #e2e8f0', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
                    <span>{d.month} {d.academic_year} Fees</span>
                    <span>₹{Number(d.total_amount).toLocaleString('en-IN')}</span>
                  </div>
                  {d.fee_demand_items?.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem' }}>
                      <span>• {item.fee_heads?.name}</span>
                      <span>₹{Number(item.amount).toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ef4444', marginTop: '0.5rem', fontWeight: 500 }}>
                    <span>Due Date: {new Date(d.due_date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <button 
            onClick={() => setShowPaymentModal(true)}
            disabled={paymentAmount <= 0}
            style={{ width: '100%', background: paymentAmount > 0 ? '#2563eb' : '#94a3b8', color: 'white', padding: '1.25rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '1.1rem', border: 'none', cursor: paymentAmount > 0 ? 'pointer' : 'not-allowed', boxShadow: paymentAmount > 0 ? '0 4px 6px -1px rgba(37, 99, 235, 0.3)' : 'none' }}
          >
            Pay Now (Gateway-Free)
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#64748b', marginTop: '0.75rem' }}>Supports Google Pay, PhonePe, Paytm, and NEFT.</p>
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
