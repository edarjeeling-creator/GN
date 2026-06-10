import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Shield, Key, Search, Mail, Edit, Trash2, Power, Download, Upload, Activity } from 'lucide-react';
import BulkUserImport from './BulkUserImport';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // New User Form State
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'teacher', password: '', employee_id: '', uid: '' });
  
  const edgeFunctionUrl = 'https://supabase.gyanodayniketan.cloud/functions/v1/admin-users'; // Update with actual URL

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setUsers(data);
    setLoading(false);
  };

  const callAdminAction = async (action, payload) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Not authenticated' };

    try {
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ action, payload })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Request failed');
      return { success: true, data: result };
    } catch (err) {
      alert(`Error: ${err.message}`);
      return { error: err.message };
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const result = await callAdminAction('createUser', newUser);
    if (result.success) {
      alert('User created successfully');
      setIsCreateModalOpen(false);
      setNewUser({ name: '', email: '', role: 'teacher', password: '', employee_id: '', uid: '' });
      fetchUsers();
    }
  };

  const handleDeactivate = async (user, status) => {
    if (confirm(`Change status of ${user.name} to ${status}?`)) {
      const result = await callAdminAction('deactivateUser', { targetUserId: user.id, newStatus: status });
      if (result.success) fetchUsers();
    }
  };

  const handleSendPasswordReset = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) alert(`Error sending email: ${error.message}`);
    else alert(`Password reset link sent to ${email}`);
  };

  const filteredUsers = users.filter(u => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (searchTerm) {
      return u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             (u.uid && u.uid.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return true;
  });

  // Calculate Dashboard Stats
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'Active' || !u.status).length;
  const suspendedUsers = users.filter(u => u.status === 'Suspended').length;

  return (
    <div className="flex flex-col gap-6">
      
      {/* User Activity Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bento-card bg-white p-4 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600"><User size={24} /></div>
          <div><p className="text-sm text-gray-500 font-medium">Total Users</p><h4 className="text-2xl font-bold">{totalUsers}</h4></div>
        </div>
        <div className="bento-card bg-white p-4 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-lg text-green-600"><Activity size={24} /></div>
          <div><p className="text-sm text-gray-500 font-medium">Active Accounts</p><h4 className="text-2xl font-bold">{activeUsers}</h4></div>
        </div>
        <div className="bento-card bg-white p-4 flex items-center gap-4">
          <div className="p-3 bg-red-100 rounded-lg text-red-600"><Power size={24} /></div>
          <div><p className="text-sm text-gray-500 font-medium">Suspended</p><h4 className="text-2xl font-bold">{suspendedUsers}</h4></div>
        </div>
        <div className="bento-card bg-white p-4 flex flex-col justify-center">
          <button onClick={() => setIsCreateModalOpen(true)} className="btn-hero-primary py-3 flex justify-center items-center gap-2">
            <Shield size={18} /> Create Staff User
          </button>
        </div>
      </div>

      {/* Bulk Import UI */}
      <BulkUserImport currentUsers={users} onImportSuccess={fetchUsers} />

      {/* Main Table Container */}
      <div className="bento-card bg-white p-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h3 className="text-xl font-bold text-gray-800">User Directory</h3>
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input type="text" placeholder="Search users..." className="input-field pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <select className="input-field" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="teacher">Teachers</option>
              <option value="student">Students</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-4 font-semibold text-gray-600">Name</th>
                <th className="p-4 font-semibold text-gray-600">Role</th>
                <th className="p-4 font-semibold text-gray-600">Status</th>
                <th className="p-4 font-semibold text-gray-600">Last Login</th>
                <th className="p-4 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="p-4 text-center">Loading...</td></tr> : 
               filteredUsers.map(user => (
                <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.uid ? `UID: ${user.uid}` : 'No UID'}</p>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${!user.status || user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {user.status || 'Active'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => handleSendPasswordReset(user.email || 'user@example.com')} className="text-gray-500 hover:text-blue-600 p-1" title="Send Password Reset Email">
                      <Mail size={16} />
                    </button>
                    {user.role !== 'student' && (
                      <button onClick={() => handleDeactivate(user, 'Suspended')} className="text-gray-500 hover:text-red-600 p-1" title="Suspend User">
                        <Power size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create Staff User</h3>
            <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
              <div><label className="text-sm font-medium">Role</label>
                <select className="input-field w-full mt-1" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})}>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div><label className="text-sm font-medium">Full Name</label>
                <input type="text" className="input-field w-full mt-1" required value={newUser.name} onChange={e=>setNewUser({...newUser, name: e.target.value})} />
              </div>
              <div><label className="text-sm font-medium">Email Address</label>
                <input type="email" className="input-field w-full mt-1" required value={newUser.email} onChange={e=>setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div><label className="text-sm font-medium">Temporary Password</label>
                <input type="password" className="input-field w-full mt-1" required value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value, uid: e.target.value})} />
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={()=>setIsCreateModalOpen(false)} className="btn-hero-outline">Cancel</button>
                <button type="submit" className="btn-hero-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
