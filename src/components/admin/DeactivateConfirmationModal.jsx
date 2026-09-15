import React, { useState } from 'react';
import { AlertTriangle, UserX, UserCheck, Trash2, Loader2, X, ShieldAlert } from 'lucide-react';
import { UserCredentialService } from '../../services/UserCredentialService';

export default function DeactivateConfirmationModal({
  user,
  actionType = 'deactivate', // 'deactivate' | 'reactivate' | 'delete'
  isOpen,
  onClose,
  onSuccess
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !user) return null;

  const isDeactivate = actionType === 'deactivate';
  const isReactivate = actionType === 'reactivate';
  const isDelete = actionType === 'delete';

  const handleConfirm = async () => {
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      let res;
      if (isDeactivate) {
        res = await UserCredentialService.deactivateUser(user.id);
      } else if (isReactivate) {
        res = await UserCredentialService.reactivateUser(user.id);
      } else if (isDelete) {
        res = await UserCredentialService.deleteUserPermanently(user.id);
      }

      if (res && res.success) {
        if (onSuccess) {
          onSuccess({
            ...user,
            status: isDeactivate ? 'Inactive' : (isReactivate ? 'Active' : 'Deleted')
          }, actionType);
        }
        onClose();
      } else {
        setErrorMessage(res?.error || 'Action could not be completed.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className={`px-6 py-4 text-white flex items-center justify-between ${
          isDelete
            ? 'bg-gradient-to-r from-red-950 via-rose-900 to-slate-900'
            : isDeactivate
            ? 'bg-gradient-to-r from-amber-950 via-orange-900 to-slate-900'
            : 'bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg border ${
              isDelete
                ? 'bg-red-500/20 border-red-500/30 text-red-400'
                : isDeactivate
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
            }`}>
              {isDelete ? <Trash2 size={20} /> : isDeactivate ? <UserX size={20} /> : <UserCheck size={20} />}
            </div>
            <div>
              <h3 className="text-base font-bold">
                {isDelete ? 'Permanently Delete User' : isDeactivate ? 'Deactivate User Account' : 'Reactivate User Account'}
              </h3>
              <p className="text-xs opacity-80">Confirm account lifecycle action</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
          {/* User Preview Card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">User Details</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize ${
                user.status === 'Inactive' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {user.status || 'Active'}
              </span>
            </div>
            <p className="font-bold text-slate-900 text-sm">{user.name}</p>
            <p className="font-mono text-xs text-slate-600">{user.email || 'No email attached'}</p>
            <p className="text-xs text-slate-500 capitalize">Role: {user.role || 'Staff'} • Campus: {user.campus || 'Senior School'}</p>
          </div>

          {/* Explanation Text */}
          {isDeactivate && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                Soft Deactivation (Safe for ERP records)
              </p>
              <p className="leading-relaxed text-amber-800">
                Deactivating this user immediately blocks them from logging into the portal. All attendance logs, submitted student marks, and historical records are <strong>100% preserved</strong> and will not be lost.
              </p>
            </div>
          )}

          {isReactivate && (
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <UserCheck size={15} className="text-emerald-600 shrink-0" />
                Restore Account Access
              </p>
              <p className="leading-relaxed text-emerald-800">
                Reactivating this user will allow them to log in again using their existing credentials.
              </p>
            </div>
          )}

          {isDelete && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldAlert size={15} className="text-rose-600 shrink-0" />
                Safety Check on Permanent Deletion
              </p>
              <p className="leading-relaxed text-rose-800">
                Permanent deletion removes this user from both Auth and Profiles. If this user has active teaching assignments, student marks, or attendance history, the database will automatically block deletion and prompt you to Deactivate instead.
              </p>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting}
              className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
                isDelete
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : isDeactivate
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {isDelete ? <Trash2 size={14} /> : isDeactivate ? <UserX size={14} /> : <UserCheck size={14} />}
                  <span>{isDelete ? 'Permanently Delete' : isDeactivate ? 'Confirm Deactivation' : 'Confirm Reactivation'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
