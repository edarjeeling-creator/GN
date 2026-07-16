import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Lock, ChevronRight, User, AlertCircle, Phone, Calendar, CheckCircle2, History } from 'lucide-react';

const ParentPortal = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login State
  const [uid, setUid] = useState('');
  const [dob, setDob] = useState('');

  // Setup State
  const [newDob, setNewDob] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupStudentId, setSetupStudentId] = useState(null);

  // Dashboard State
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
    // Force dark mode for portals
    document.documentElement.classList.add('dark');
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('parent_login', {
        p_uid: uid,
        p_dob: dob || null
      });

      if (rpcError) throw rpcError;

      if (!data.success) {
        setError(data.error);
        setLoading(false);
        return;
      }

      const student = data.student;
      
      // If student has no DOB set in database, force them to set it up now
      if (!student.date_of_birth) {
        setSetupStudentId(student.id);
        setNeedsSetup(true);
      } else {
        startSession(student);
      }

    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred.");
    }
    setLoading(false);
  };

  const handleSetup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: updateError } = await supabase
        .from('students')
        .update({ date_of_birth: newDob, contact_number: newMobile })
        .eq('id', setupStudentId)
        .select()
        .single();

      if (updateError) throw updateError;
      
      setNeedsSetup(false);
      startSession(data);
    } catch (err) {
      console.error(err);
      setError("Failed to secure account. Please try again.");
    }
    setLoading(false);
  };

  const startSession = async (student) => {
    setSession(student);
    
    // Fetch enriched details
    const { data: enrichedStudent } = await supabase
      .from('students')
      .select('*, classes(name, section)')
      .eq('id', student.id)
      .single();
      
    if (enrichedStudent) setStudentDetails(enrichedStudent);

    // Fetch Demands
    const { data: fetchedDemands } = await supabase
      .from('fee_demands')
      .select('*, fee_demand_items(*, fee_heads(name))')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });
    
    if (fetchedDemands) setDemands(fetchedDemands);

    // Fetch Payments
    const { data: fetchedPayments } = await supabase
      .from('fee_payments')
      .select('*')
      .eq('student_id', student.id)
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
        student_id: session.id,
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
        .eq('student_id', session.id)
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


  // --- VIEW: LOGIN ---
  if (!session && !needsSetup) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05070c', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #090d16, #030508)' }}></div>
        </div>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '2.5rem', borderRadius: '1.5rem', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(37, 99, 235, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#60a5fa' }}>
              <Shield size={32} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f9fafb' }}>Parent Fee Portal</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.5rem' }}>Securely access your ward's fee records.</p>
          </div>

          {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Student UID / Bill Book No</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#4b5563" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input required type="text" value={uid} onChange={e => setUid(e.target.value)} placeholder="e.g. 21866" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '0.5rem', border: '1px solid #1f2937', background: '#090d16', color: '#f9fafb', outline: 'none' }} />
              </div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Date of Birth <span style={{ color: '#6b7280', fontWeight: 400 }}>(If registered)</span></label>
              <div style={{ position: 'relative' }}>
                <Calendar size={18} color="#4b5563" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '0.5rem', border: '1px solid #1f2937', background: '#090d16', color: '#f9fafb', outline: 'none' }} />
              </div>
            </div>

            <button disabled={loading} type="submit" style={{ background: '#2563eb', color: 'white', padding: '1rem', borderRadius: '0.5rem', fontWeight: 700, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer', transition: 'background 0.2s', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}>
              {loading ? 'Authenticating...' : <>Secure Login <ChevronRight size={18} /></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW: ACCOUNT SETUP ---
  if (needsSetup) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#05070c', padding: '1rem' }}>
        <div style={{ background: '#111827', border: '1px solid #1f2937', padding: '2.5rem', borderRadius: '1.5rem', width: '100%', maxWidth: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#fbbf24' }}>
              <Lock size={32} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f9fafb' }}>Secure Your Account</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.5rem', lineHeight: 1.5 }}>This is your first time logging in. Please set your Date of Birth and Mobile Number to secure access for future logins.</p>
          </div>

          <form onSubmit={handleSetup} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Student's Exact Date of Birth</label>
              <input required type="date" value={newDob} onChange={e => setNewDob(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #1f2937', background: '#090d16', color: '#f9fafb', outline: 'none' }} />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Parent's Mobile Number (For Notifications)</label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="#4b5563" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input required type="tel" pattern="[0-9]{10}" title="10 digit mobile number" value={newMobile} onChange={e => setNewMobile(e.target.value)} placeholder="10 Digit Number" style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '0.5rem', border: '1px solid #1f2937', background: '#090d16', color: '#f9fafb', outline: 'none' }} />
              </div>
            </div>

            <button disabled={loading} type="submit" style={{ background: '#10b981', color: 'white', padding: '1rem', borderRadius: '0.5rem', fontWeight: 700, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}>
              {loading ? 'Saving...' : <>Save & Access Dashboard <CheckCircle2 size={18} /></>}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VIEW: DASHBOARD ---
  const activeDemands = demands.filter(d => d.status === 'pending' || d.status === 'partial');

  return (
    <div style={{ minHeight: '100vh', background: '#090d16', color: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* App Bar */}
      <div style={{ background: '#111827', color: 'white', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid #1f2937' }}>
        <div style={{ fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.05em', color: '#3b82f6' }}>GYANODAY NIKETAN</div>
        <button onClick={() => {setSession(null); setUid(''); setDob('');}} style={{ background: 'transparent', color: '#cbd5e1', border: '1px solid #374151', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', transition: 'all 0.2s' }}>Logout</button>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem' }}>
        
        {/* Verification Alert */}
        {payments.some(p => p.status === 'pending_verification') && (
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Payment Under Review</strong>
              <span style={{ fontSize: '0.9rem', color: 'rgba(251, 191, 36, 0.9)' }}>You have submitted a payment declaration that is currently being verified by the Accounts Office.</span>
            </div>
          </div>
        )}

        {/* Student Details Card */}
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f9fafb', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>{studentDetails?.name}</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
            <div><span style={{ color: '#9ca3af' }}>Bill Book No:</span> <strong style={{ color: '#f3f4f6' }}>{studentDetails?.uid}</strong></div>
            <div><span style={{ color: '#9ca3af' }}>Class:</span> <strong style={{ color: '#f3f4f6' }}>{studentDetails?.classes?.name} {studentDetails?.classes?.section}</strong></div>
            <div><span style={{ color: '#9ca3af' }}>Roll No:</span> <strong style={{ color: '#f3f4f6' }}>{studentDetails?.roll_no}</strong></div>
            <div><span style={{ color: '#9ca3af' }}>Session:</span> <strong style={{ color: '#f3f4f6' }}>2026-2027</strong></div>
          </div>
        </div>

        {/* Financial Summary */}
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)', marginBottom: '2rem' }}>
          <div style={{ padding: '1.5rem', background: 'rgba(37, 99, 235, 0.08)', borderBottom: '1px solid rgba(37, 99, 235, 0.15)' }}>
            <p style={{ color: '#93c5fd', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Amount Payable</p>
            <h1 style={{ fontSize: '3rem', fontWeight: 850, color: '#3b82f6', lineHeight: 1 }}>₹{paymentAmount.toLocaleString('en-IN')}</h1>
          </div>
          
          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 750, color: '#e5e7eb', marginBottom: '1rem' }}>Fees Breakdown</h3>
            
            {activeDemands.length === 0 ? (
              <p style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={18} /> All dues are cleared.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeDemands.map(d => (
                  <div key={d.id} style={{ borderBottom: '1px dashed #1f2937', paddingBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#f9fafb', marginBottom: '0.5rem' }}>
                      <span>{d.month} {d.academic_year} Fees</span>
                      <span>₹{Number(d.total_amount).toLocaleString('en-IN')}</span>
                    </div>
                    {d.fee_demand_items?.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                        <span>• {item.fee_heads?.name}</span>
                        <span>₹{Number(item.amount).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#f87171', marginTop: '0.5rem', fontWeight: 500 }}>
                      <span>Due Date: {new Date(d.due_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '1.5rem', background: '#0e131f', borderTop: '1px solid #1f2937' }}>
            <button 
              onClick={() => setShowPaymentModal(true)}
              disabled={paymentAmount <= 0}
              style={{ width: '100%', background: paymentAmount > 0 ? '#2563eb' : '#374151', color: 'white', padding: '1.25rem', borderRadius: '0.75rem', fontWeight: 700, fontSize: '1.1rem', border: 'none', cursor: paymentAmount > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.2s', boxShadow: paymentAmount > 0 ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none' }}
            >
              Pay Now (Gateway-Free)
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.75rem' }}>Supports Google Pay, PhonePe, Paytm, and NEFT.</p>
          </div>
        </div>

        {/* History */}
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f9fafb', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={20} className="text-brand-400" /> Payment History
        </h3>
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          {payments.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>No payments recorded.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {payments.map((p, i) => (
                <div key={p.id} style={{ padding: '1.25rem', borderBottom: i !== payments.length - 1 ? '1px solid #1f2937' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#f9fafb', marginBottom: '0.25rem' }}>₹{Number(p.amount).toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{new Date(p.payment_date).toLocaleDateString()} • Ref: {p.reference_number || 'N/A'}</div>
                  </div>
                  <div>
                    {p.status === 'approved' && <span style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>Verified</span>}
                    {p.status === 'pending_verification' && <span style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>Under Review</span>}
                    {p.status === 'rejected' && <span style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700 }}>Rejected</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- PAYMENT MODAL --- */}
      {showPaymentModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#111827', borderTop: '1px solid #1f2937', width: '100%', maxWidth: '600px', borderRadius: '1.5rem 1.5rem 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
            
            {submitSuccess ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 1.5rem' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f9fafb', marginBottom: '0.5rem' }}>Declaration Submitted</h2>
                <p style={{ color: '#9ca3af', lineHeight: 1.5 }}>Your payment details have been sent to the Accounts Office. Your ledger will update once verified.</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #1f2937', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#111827', zIndex: 2 }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Complete Payment</h2>
                  <button onClick={() => setShowPaymentModal(false)} style={{ background: '#1f2937', border: 'none', color: '#f9fafb', width: '32px', height: '32px', borderRadius: '50%', fontWeight: 700, cursor: 'pointer' }}>✕</button>
                </div>

                <div style={{ padding: '1.5rem' }}>
                  
                  {/* Step 1: Bank Details & QR */}
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'inline-block', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700, marginBottom: '1rem' }}>STEP 1: MAKE PAYMENT</div>
                    
                    <div style={{ background: '#090d16', border: '1px solid #1f2937', borderRadius: '1rem', padding: '1.5rem', textAlign: 'center', marginBottom: '1rem' }}>
                      <p style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '1rem' }}>Scan and pay using any UPI App</p>
                      {/* Fake QR Code UI for Demo */}
                      <div style={{ width: '200px', height: '200px', background: 'white', border: '2px solid #e2e8f0', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.5rem' }}>
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=upi://pay?pa=${bankDetails.upiId}&pn=${encodeURIComponent(bankDetails.accountName)}&am=${paymentAmount}&cu=INR`} alt="UPI QR" />
                      </div>
                      <p style={{ fontWeight: 900, fontSize: '1.8rem', marginTop: '1rem', color: '#3b82f6' }}>₹{paymentAmount.toLocaleString('en-IN')}</p>
                      <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginTop: '0.25rem' }}>UPI ID: {bankDetails.upiId}</p>
                    </div>

                    <div style={{ fontSize: '0.9rem' }}>
                      <p style={{ fontWeight: 700, color: '#cbd5e1', marginBottom: '0.5rem' }}>Or Bank Transfer (NEFT/IMPS):</p>
                      <div style={{ background: '#090d16', border: '1px solid #1f2937', padding: '1rem', borderRadius: '0.5rem', color: '#9ca3af', lineHeight: 1.6 }}>
                        <div>Account Name: <strong className="text-slate-200">{bankDetails.accountName}</strong></div>
                        <div>Bank: <strong className="text-slate-200">{bankDetails.bankName}</strong></div>
                        <div>Account No: <strong className="text-slate-200">{bankDetails.accountNo}</strong></div>
                        <div>IFSC Code: <strong className="text-slate-200">{bankDetails.ifscCode}</strong></div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Declaration */}
                  <div>
                    <div style={{ display: 'inline-block', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 700, marginBottom: '1rem' }}>STEP 2: DECLARE PAYMENT</div>
                    
                    <form onSubmit={submitDeclaration} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.5rem' }}>Amount Paid (₹)</label>
                          <input type="number" required value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #1f2937', background: '#090d16', color: '#f9fafb', fontWeight: 700, outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.5rem' }}>Payment Date</label>
                          <input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #1f2937', background: '#090d16', color: '#f9fafb', outline: 'none' }} />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.5rem' }}>Method</label>
                          <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #1f2937', background: '#090d16', color: '#f9fafb', outline: 'none' }}>
                            <option value="upi">UPI</option>
                            <option value="neft">NEFT / IMPS</option>
                            <option value="bank_deposit">Bank Deposit</option>
                            <option value="cash">Cash</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#9ca3af', marginBottom: '0.5rem' }}>UTR / Reference Number</label>
                          <input type="text" required placeholder="e.g. 312345678901" value={utr} onChange={e => setUtr(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #1f2937', background: '#090d16', color: '#f9fafb', outline: 'none' }} />
                        </div>
                      </div>

                      <button disabled={submitting} type="submit" style={{ background: '#10b981', color: 'white', padding: '1.25rem', borderRadius: '0.75rem', fontWeight: 800, fontSize: '1.1rem', border: 'none', marginTop: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)' }}>
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

export default ParentPortal;
