import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Search, CreditCard, AlertCircle, User, Plus } from 'lucide-react';
import { useData } from '../context/DataContext';

const LibraryMembers = () => {
  const { students } = useData();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Add Member State
  const [showAddModal, setShowAddModal] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMember, setNewMember] = useState({
    membership_number: `LIB-${Math.floor(10000 + Math.random() * 90000)}`,
    member_type: 'student',
    student_id: '',
    staff_id: ''
  });

  useEffect(() => {
    fetchMembers();
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    const { data } = await supabase.from('profiles').select('id, name, role').neq('role', 'student');
    if (data) setStaffList(data);
  };

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lib_members')
        .select(`
          *,
          students(name, roll_no, class_id, uid),
          profiles(name, role)
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
    m.students?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (newMember.member_type === 'student' && !newMember.student_id) return alert('Select a student');
    if (newMember.member_type === 'staff' && !newMember.staff_id) return alert('Select a staff member');
    if (!newMember.membership_number) return alert('Membership number is required');

    setIsSubmitting(true);
    try {
      const payload = {
        membership_number: newMember.membership_number,
        member_type: newMember.member_type,
        student_id: newMember.member_type === 'student' ? newMember.student_id : null,
        staff_id: newMember.member_type === 'staff' ? newMember.staff_id : null,
        max_books_allowed: newMember.member_type === 'staff' ? 5 : 2
      };

      const { error } = await supabase.from('lib_members').insert([payload]);
      if (error) {
        if (error.code === '23505') throw new Error('Membership number already exists or user is already a member.');
        throw error;
      }

      alert('Member added successfully!');
      setShowAddModal(false);
      setNewMember({
        membership_number: `LIB-${Math.floor(10000 + Math.random() * 90000)}`,
        member_type: 'student',
        student_id: '',
        staff_id: ''
      });
      fetchMembers();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>Library Members</h2>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', outline: 'none' }}
            />
            <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            style={{ padding: '0.75rem 1.5rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
          >
            <Plus size={18} /> Add Member
          </button>
        </div>
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '1rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: '#0f172a' }}>Register Library Member</h3>
            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Membership Number</label>
                <input 
                  type="text" required value={newMember.membership_number} onChange={e => setNewMember({...newMember, membership_number: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Member Type</label>
                <select 
                  value={newMember.member_type} onChange={e => setNewMember({...newMember, member_type: e.target.value, student_id: '', staff_id: ''})}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                >
                  <option value="student">Student</option>
                  <option value="staff">Staff (Teacher/Admin)</option>
                </select>
              </div>
              
              {newMember.member_type === 'student' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Select Student</label>
                  <select 
                    required value={newMember.student_id} onChange={e => setNewMember({...newMember, student_id: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name} (Roll: {s.roll_no})</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Select Staff</label>
                  <select 
                    required value={newMember.staff_id} onChange={e => setNewMember({...newMember, staff_id: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: 'white' }}
                  >
                    <option value="">-- Choose Staff --</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '0.75rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ flex: 1, padding: '0.75rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>{isSubmitting ? 'Saving...' : 'Register Member'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    {member.member_type === 'student' ? (member.students?.name || 'Unknown Student') : (member.profiles?.name || 'Unknown Staff')}
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
