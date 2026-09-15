import React, { useState, useEffect } from 'react';
import { Key, User, Mail, Eye, EyeOff, RefreshCw, CheckCircle2, AlertCircle, Loader2, X, ShieldCheck } from 'lucide-react';
import { UserCredentialService } from '../../services/UserCredentialService';

export default function UserCredentialsModal({ user, isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setNewPassword('');
      setShowPassword(false);
      setStatusMessage({ type: '', text: '' });
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleGeneratePassword = () => {
    const pwd = UserCredentialService.generateRandomPassword();
    setNewPassword(pwd);
    setShowPassword(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMessage({ type: '', text: '' });

    const hasNameChange = name.trim() !== (user.name || '').trim();
    const hasEmailChange = email.trim().toLowerCase() !== (user.email || '').trim().toLowerCase();
    const hasPasswordChange = !!newPassword.trim();

    if (!hasNameChange && !hasEmailChange && !hasPasswordChange) {
      setStatusMessage({
        type: 'info',
        text: 'No changes detected. Modify the Name, Email, or enter a new Password to update.'
      });
      return;
    }

    if (hasPasswordChange && newPassword.trim().length < 6) {
      setStatusMessage({
        type: 'error',
        text: 'Password must be at least 6 characters long.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await UserCredentialService.updateStaffCredentials({
        targetUserId: user.id,
        name: hasNameChange ? name.trim() : null,
        email: hasEmailChange ? email.trim() : null,
        password: hasPasswordChange ? newPassword.trim() : null
      });

      if (result.success) {
        setStatusMessage({
          type: 'success',
          text: result.message || 'Credentials updated successfully!'
        });
        
        // Notify parent to refresh staff list with new name/email
        if (onSuccess) {
          onSuccess({
            ...user,
            name: name.trim(),
            email: email.trim()
          });
        }

        // Clear sensitive password field after successful reset
        setNewPassword('');
      } else {
        setStatusMessage({
          type: 'error',
          text: result.error || 'Failed to update credentials. Please check permissions.'
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'An unexpected error occurred.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 border border-indigo-500/30 rounded-lg text-indigo-400">
              <Key size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">User Credentials & Security</h3>
              <p className="text-xs text-indigo-200">Manage account access, login email & password</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          
          {/* User Badge Info */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Role</span>
              <p className="font-semibold text-slate-800 capitalize">{user.role || 'Staff'}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">User UID</span>
              <p className="font-mono text-xs text-slate-600 truncate max-w-[160px]" title={user.id}>{user.id}</p>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
              <User size={16} className="text-slate-400" />
              Full Name
            </label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm shadow-sm transition-all"
              placeholder="e.g. Pallavi Bakshi Gupta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Login Email */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-2">
              <Mail size={16} className="text-slate-400" />
              Login Email (Username)
            </label>
            <input
              type="email"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm shadow-sm transition-all"
              placeholder="e.g. teacher@gyanodayniketan.cloud"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-slate-500 mt-1">This is the email the user enters on the login page.</p>
          </div>

          {/* New Password Section */}
          <div className="p-4 bg-amber-50/60 border border-amber-200/70 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <ShieldCheck size={16} className="text-amber-600" />
                Set / Reset Password
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors"
              >
                <RefreshCw size={12} />
                Generate Random
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full px-3.5 py-2.5 pr-11 bg-white border border-amber-300/80 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm shadow-sm font-mono tracking-wide"
                placeholder="Leave blank to keep existing password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-amber-700/80 leading-relaxed">
              Entering a password here immediately updates the account in Supabase Auth. The user can log in right away with no email confirmation needed.
            </p>
          </div>

          {/* Feedback Messages */}
          {statusMessage.text && (
            <div
              className={`p-3.5 rounded-xl border text-sm flex items-start gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : statusMessage.type === 'info'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
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

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              disabled={isSubmitting}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <Key size={16} />
                  <span>Save Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
