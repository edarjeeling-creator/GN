import React, { useState } from 'react';
import { UserPlus, User, Mail, Lock, Eye, EyeOff, RefreshCw, Shield, Building, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { UserCredentialService } from '../../services/UserCredentialService';

export default function CreateUserModal({ isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('teacher');
  const [campus, setCampus] = useState('Senior School');
  const [status, setStatus] = useState('Active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  if (!isOpen) return null;

  const handleGeneratePassword = () => {
    const pwd = UserCredentialService.generateRandomPassword();
    setPassword(pwd);
    setShowPassword(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    if (!name.trim() || !email.trim() || !password.trim()) {
      setStatusMessage({ type: 'error', text: 'Please fill in Name, Email, and Password.' });
      return;
    }

    if (password.trim().length < 6) {
      setStatusMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await UserCredentialService.createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
        role,
        campus,
        status
      });

      if (res.success) {
        setStatusMessage({ type: 'success', text: res.message || 'User created successfully!' });
        if (onSuccess) {
          onSuccess({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            campus,
            status
          });
        }
        setTimeout(() => {
          onClose();
          setName('');
          setEmail('');
          setPassword('');
          setRole('teacher');
          setCampus('Senior School');
          setStatus('Active');
          setStatusMessage({ type: '', text: '' });
        }, 1200);
      } else {
        setStatusMessage({ type: 'error', text: res.error || 'Failed to create user.' });
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
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Create New User</h3>
              <p className="text-xs text-emerald-200">Add teacher, administrator, or staff account</p>
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
          
          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
              <User size={15} className="text-slate-400" />
              Full Name
            </label>
            <input
              type="text"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm"
              placeholder="e.g. Pallavi Bakshi Gupta"
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
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm"
              placeholder="e.g. pallavi@gyanodayniketan.cloud"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Password with generator */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Lock size={15} className="text-slate-400" />
                Temporary Password
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 transition-colors"
              >
                <RefreshCw size={11} />
                Generate Password
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full px-3.5 py-2 pr-10 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono shadow-sm"
                placeholder="Initial password for login"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Role & Campus Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                <Shield size={15} className="text-slate-400" />
                Role
              </label>
              <select
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm capitalize"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="teacher">Teacher</option>
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
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm shadow-sm"
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
              >
                <option value="Senior School">Senior School</option>
                <option value="Junior School">Junior School</option>
                <option value="All Campuses">All Campuses (Multi-Campus)</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Account Status
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="Active"
                  checked={status === 'Active'}
                  onChange={() => setStatus('Active')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  Active (Can Log In)
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="status"
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
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Create User</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
