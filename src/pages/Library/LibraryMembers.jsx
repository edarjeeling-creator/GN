import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Search, CreditCard, AlertCircle, User } from 'lucide-react';

const LibraryMembers = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lib_members')
        .select(`
          *,
          students(name, roll_no, class_id, uid)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMembers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(m => 
    m.membership_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.students?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Library Members</h2>
        
        <div style={{ position: 'relative', width: '300px' }}>
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #cbd5e1',
              outline: 'none'
            }}
          />
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading...</div>
      ) : filteredMembers.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', borderRadius: '1rem', border: '1px dashed #cbd5e1' }}>
          <Users size={48} color="#94a3b8" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: '#64748b' }}>No members found.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                <th style={{ padding: '1rem 0' }}>Member</th>
                <th style={{ padding: '1rem 0' }}>Type</th>
                <th style={{ padding: '1rem 0' }}>Card ID</th>
                <th style={{ padding: '1rem 0' }}>Status</th>
                <th style={{ padding: '1rem 0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map(member => (
                <tr key={member.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '1rem 0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={16} color="#64748b" />
                    </div>
                    {member.students ? member.students.name : 'Staff Member'}
                  </td>
                  <td style={{ padding: '1rem 0', color: '#64748b', textTransform: 'capitalize' }}>
                    {member.member_type}
                  </td>
                  <td style={{ padding: '1rem 0', fontFamily: 'monospace' }}>
                    {member.membership_number}
                  </td>
                  <td style={{ padding: '1rem 0' }}>
                    <span style={{ 
                      background: member.is_active ? '#dcfce7' : '#fee2e2', 
                      color: member.is_active ? '#16a34a' : '#dc2626',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '1rem',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}>
                      {member.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 0' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={{ padding: '0.5rem', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>
                        <CreditCard size={14} /> ID Card
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LibraryMembers;
