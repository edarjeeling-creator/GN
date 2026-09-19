import React, { useState, useEffect } from 'react';
import { Edit, User, Mail, Shield, Building, Key, CheckCircle2, AlertCircle, Loader2, X, Briefcase } from 'lucide-react';
import { UserCredentialService } from '../../services/UserCredentialService';

export default function EditUserModal({ user, isOpen, onClose, onSuccess, onOpenCredentials }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('teacher');
  const [designation, setDesignation] = useState('');
  const [campus, setCampus] = useState('Senior School');
  const [status, setStatus] = useState('Active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setRole(user.role || 'teacher');
      setDesignation(user.designation || '');
      setCampus(user.campus || 'Senior School');
      setStatus(user.status || 'Active');
      setStatusMessage({ type: '', text: '' });
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    if (!name.trim()) {
      setStatusMessage({ type: 'error', text: 'Full Name cannot be empty.' });
      return;
    }
    if (email.trim() && !email.includes('@')) {
      setStatusMessage({ type: 'error', text: 'Please enter a valid email address.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await UserCredentialService.updateUser({
        targetUserId: user.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        designation: designation.trim(),
        campus,
        status
      });

      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message || 'User profile updated successfully!' });
        if (onSuccess) {
          onSuccess({
            ...user,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            designation: designation.trim(),
            campus,
            status
          });
        }
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Failed to update user profile.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'An unexpected error occurred.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-400">
              <Edit size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Edit User Account</h3>
              <p className="text-xs text-blue-200">Update staff role, campus, and profile details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          
          {/* Quick password reset prompt */}
          <div className="flex items-center justify-between p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-indigo-600" />
              <div>
                <p className="text-xs font-bold text-indigo-950">Need to change or reset password?</p>
                <p className="text-[11px] text-indigo-700">Passwords are handled securely via the credential tool.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenCredentials) onOpenCredentials(user);
              }}
              className="px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              Set Password
            </button>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <User size={15} className="text-slate-400" />
              Full Name
            </label>
            <input
              type="text"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <Mail size={15} className="text-slate-400" />
              Login Email (Username)
            </label>
            <input
              type="email"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Role & Campus Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Shield size={15} className="text-slate-400" />
                Role
              </label>
              <select
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm capitalize"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="teacher">Teacher</option>
                <option value="non_teaching">Non-Teaching Staff</option>
                <option value="group_d">Group D Staff</option>
                <option value="admin">Administrator</option>
                <option value="principal">Principal</option>
                <option value="accountant">Accountant</option>
                <option value="librarian">Librarian</option>
                <option value="coordinator">Coordinator</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building size={15} className="text-slate-400" />
                Campus
              </label>
              <select
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
              >
                <option value="Senior School">Senior School</option>
                <option value="Junior School">Junior School</option>
                <option value="All Campuses">All Campuses (Multi-Campus)</option>
              </select>
            </div>
          </div>

          {/* Designation / Job Title */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Briefcase size={15} className="text-slate-400" />
              Designation / Job Title
            </label>
            <input
              type="text"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
              placeholder="e.g. Security Guard, Peon, Office Assistant, Driver, Cleaner"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Specific position title (displayed on their profile and digital ID badge).
            </p>
          </div>

          {/* Account Status */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Account Status
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="edit-status"
                  value="Active"
                  checked={status === 'Active'}
                  onChange={() => setStatus('Active')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  Active (Allowed to Log In)
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="edit-status"
                  value="Inactive"
                  checked={status === 'Inactive'}
                  onChange={() => setStatus('Inactive')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  Inactive (Login Blocked)
                </span>
              </label>
            </div>
          </div>

          {/* Feedback Messages */}
          {statusMessage.text && (
            <div
              className={`p-3.5 rounded-xl border text-sm flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-snug">{statusMessage.text}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Edit size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
