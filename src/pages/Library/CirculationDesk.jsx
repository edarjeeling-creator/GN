import React, { useState } from 'react';
import { Search, User, Book as BookIcon, CheckCircle, AlertCircle, ArrowRightLeft, CornerUpLeft, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const CirculationDesk = () => {
  const [scanInput, setScanInput] = useState('');
  const [activeMember, setActiveMember] = useState(null);
  const [scannedBook, setScannedBook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      // 1. Check if it's a member barcode (assuming member barcode starts with "MEM" or matches membership_number)
      const { data: memberData, error: memberError } = await supabase
        .from('lib_members')
        .select(`
          *,
          students(name, roll_no, uid, class_id, picture_url)
        `)
        .ilike('membership_number', scanInput)
        .maybeSingle();

      if (memberData) {
        setActiveMember(memberData);
        setScanInput('');
        setLoading(false);
        return;
      }

      // 2. Check if it's a book barcode or accession number
      let { data: bookData } = await supabase
        .from('lib_book_copies')
        .select(`
          *,
          lib_books(title, isbn, cover_image_url)
        `)
        .or(`barcode.ilike.${scanInput},accession_number.ilike.${scanInput}`)
        .limit(1)
        .maybeSingle();

      // 3. Fallback: Search by book title
      let foundBookWithoutCopy = false;
      if (!bookData) {
        const { data: books } = await supabase.from('lib_books').select('id').ilike('title', `%${scanInput}%`).limit(1);
        if (books && books.length > 0) {
          foundBookWithoutCopy = true;
          const { data: copyData } = await supabase
            .from('lib_book_copies')
            .select(`
              *,
              lib_books(title, isbn, cover_image_url)
            `)
            .eq('book_id', books[0].id)
            .eq('status', 'available')
            .limit(1)
            .maybeSingle();
            
          if (copyData) bookData = copyData;
        }
      }

      if (bookData) {
        setScannedBook(bookData);
        setScanInput('');
        setLoading(false);
        return;
      }

      if (foundBookWithoutCopy) {
        setMessage({ type: 'error', text: 'Book found in catalog, but there are no physical copies currently available to issue.' });
      } else {
        setMessage({ type: 'error', text: 'Barcode or ID not found. Please check and try again.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'An error occurred while scanning.' });
    } finally {
      setLoading(false);
      setScanInput('');
    }
  };

  const handleIssue = async () => {
    if (!activeMember || !scannedBook) return;
    setLoading(true);
    
    // In a real implementation, we would call an RPC function to handle the transaction safely
    // For now, we simulate the issue process
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14); // 14 days default

      const { error: txError } = await supabase
        .from('lib_transactions')
        .insert({
          copy_id: scannedBook.id,
          member_id: activeMember.id,
          due_date: dueDate.toISOString(),
          status: 'issued'
        });

      if (txError) throw txError;

      const { error: copyError } = await supabase
        .from('lib_book_copies')
        .update({ status: 'issued' })
        .eq('id', scannedBook.id);

      if (copyError) throw copyError;

      setMessage({ type: 'success', text: `Book issued successfully to ${activeMember.students?.first_name || 'Member'}` });
      setScannedBook(null); // Clear book after issue
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to issue book.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!scannedBook) return;
    setLoading(true);

    try {
      // Find active transaction
      const { data: txData } = await supabase
        .from('lib_transactions')
        .select('*')
        .eq('copy_id', scannedBook.id)
        .eq('status', 'issued')
        .single();

      if (!txData) throw new Error("No active transaction found for this book.");

      const { error: txError } = await supabase
        .from('lib_transactions')
        .update({ status: 'returned', return_date: new Date().toISOString() })
        .eq('id', txData.id);

      if (txError) throw txError;

      const { error: copyError } = await supabase
        .from('lib_book_copies')
        .update({ status: 'available' })
        .eq('id', scannedBook.id);

      if (copyError) throw copyError;

      setMessage({ type: 'success', text: 'Book returned successfully!' });
      setScannedBook(null);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Failed to return book.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      {/* Left Column: Scanner & Actions */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Scanner Panel */}
        <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: '#0f172a' }}>Scanner</h3>
          <form onSubmit={handleScan} style={{ position: 'relative' }}>
            <input
              type="text"
              autoFocus
              placeholder="Scan Member ID or Book Barcode..."
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              style={{
                width: '100%',
                padding: '1rem 1rem 1rem 3rem',
                fontSize: '1.125rem',
                borderRadius: '0.75rem',
                border: '2px solid #cbd5e1',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              disabled={loading}
            />
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={24} />
          </form>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.75rem' }}>
            Scanner active. Ready to scan.
          </p>
        </div>

        {/* Message Banner */}
        {message && (
          <div style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: message.type === 'success' ? '#166534' : '#991b1b',
            border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
          }}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            <span style={{ fontWeight: '500' }}>{message.text}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: 'auto' }}>
          <button
            onClick={handleIssue}
            disabled={!activeMember || !scannedBook || scannedBook.status !== 'available' || loading}
            style={{
              padding: '1rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: (!activeMember || !scannedBook || scannedBook.status !== 'available') ? '#e2e8f0' : '#2563eb',
              color: (!activeMember || !scannedBook || scannedBook.status !== 'available') ? '#94a3b8' : 'white',
              fontWeight: '700',
              fontSize: '1.125rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: (!activeMember || !scannedBook || scannedBook.status !== 'available') ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <ArrowRightLeft size={20} />
            Issue Book
          </button>
          
          <button
            onClick={handleReturn}
            disabled={!scannedBook || scannedBook.status !== 'issued' || loading}
            style={{
              padding: '1rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: (!scannedBook || scannedBook.status !== 'issued') ? '#e2e8f0' : '#10b981',
              color: (!scannedBook || scannedBook.status !== 'issued') ? '#94a3b8' : 'white',
              fontWeight: '700',
              fontSize: '1.125rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: (!scannedBook || scannedBook.status !== 'issued') ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <CornerUpLeft size={20} />
            Return Book
          </button>
        </div>
      </div>

      {/* Right Column: Details */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Member Card */}
        <div style={{ 
          border: '1px solid #e2e8f0', 
          borderRadius: '1rem', 
          padding: '1.5rem', 
          position: 'relative',
          minHeight: '200px'
        }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
            Active Member
          </h4>
          
          {activeMember ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {activeMember.students?.picture_url ? (
                    <img src={activeMember.students.picture_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={24} color="#64748b" />
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                    {activeMember.students ? activeMember.students.name : 'Staff Member'}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    {activeMember.member_type.charAt(0).toUpperCase() + activeMember.member_type.slice(1)} • ID: {activeMember.membership_number}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveMember(null)}
                style={{ fontSize: '0.875rem', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Clear Member
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '120px', color: '#94a3b8' }}>
              <User size={48} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>Scan member card</p>
            </div>
          )}
        </div>

        {/* Book Card */}
        <div style={{ 
          border: '1px solid #e2e8f0', 
          borderRadius: '1rem', 
          padding: '1.5rem',
          position: 'relative',
          minHeight: '200px',
          flex: '1'
        }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
            Scanned Book
          </h4>
          
          {scannedBook ? (
            <div>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ width: '60px', height: '90px', background: '#e2e8f0', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {scannedBook.lib_books?.cover_image_url ? (
                    <img src={scannedBook.lib_books.cover_image_url} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <BookIcon size={24} color="#94a3b8" />
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.25rem' }}>
                    {scannedBook.lib_books?.title || 'Unknown Title'}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Barcode: {scannedBook.barcode}
                  </p>
                  <span style={{ 
                    display: 'inline-block', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '0.25rem', 
                    fontSize: '0.75rem', 
                    fontWeight: '700',
                    background: scannedBook.status === 'available' ? '#dcfce7' : '#fee2e2',
                    color: scannedBook.status === 'available' ? '#16a34a' : '#dc2626'
                  }}>
                    {scannedBook.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setScannedBook(null)}
                style={{ fontSize: '0.875rem', color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Clear Book
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
              <BookIcon size={48} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>Scan book barcode</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default CirculationDesk;
