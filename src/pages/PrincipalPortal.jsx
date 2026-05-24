import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Loader2, Shield, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrincipalPortal = () => {
  const [pin, setPin] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!pin || !searchQuery) return;
    
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const { data, error } = await supabase.rpc('search_students_by_principal', { 
        p_pin: pin,
        p_query: searchQuery
      });

      if (error) throw error;
      if (!data) {
        setError('Invalid Principal PIN.');
        return;
      }

      setResults(data);
    } catch (err) {
      console.error(err);
      setError('An error occurred while searching. Ensure your PIN is correct.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintCard = (uid) => {
    window.open(`/result?uid=${uid}`, '_blank');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', padding: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary-color)', color: 'white', width: '60px', height: '60px', borderRadius: '50%', marginBottom: '1rem' }}>
            <Shield size={32} />
          </div>
          <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Principal Portal</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Securely search the global student database.</p>
        </div>

        <div className="card p-6 mb-6" style={{ background: 'var(--surface-color)' }}>
          <form onSubmit={handleSearch} className="flex flex-col gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Principal Master PIN</label>
                <input
                  type="password"
                  placeholder="Enter Master PIN"
                  className="input-field w-full"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Student Name Search</label>
                <div className="relative">
                  <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="e.g. Ahmed"
                    className="input-field w-full"
                    style={{ paddingLeft: '40px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {error && (
              <div style={{ color: 'var(--danger-color)', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full py-3 mt-2" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Search Database'}
            </button>
          </form>
        </div>

        {results && (
          <div className="card p-6" style={{ background: 'var(--surface-color)' }}>
            <h3 className="mb-4">Search Results ({results.length})</h3>
            
            {results.length === 0 ? (
              <div className="text-center p-8 text-muted" style={{ color: 'var(--text-muted)' }}>
                No students found matching "{searchQuery}"
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      <th style={{ padding: '0.75rem' }}>Name</th>
                      <th style={{ padding: '0.75rem' }}>Class</th>
                      <th style={{ padding: '0.75rem' }}>Roll No</th>
                      <th style={{ padding: '0.75rem' }}>UID (PIN)</th>
                      <th style={{ padding: '0.75rem' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(student => (
                      <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: '500' }}>
                          <div className="flex items-center gap-2">
                            <User size={16} className="text-primary" />
                            {student.name}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem' }}>{student.class_name} {student.class_section}</td>
                        <td style={{ padding: '0.75rem' }}>{student.roll_no}</td>
                        <td style={{ padding: '0.75rem', letterSpacing: '1px' }}>{student.uid}</td>
                        <td style={{ padding: '0.75rem' }}>
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePrintCard(student.uid)}
                          >
                            View Report Card
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrincipalPortal;
