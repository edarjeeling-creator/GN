import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AttendanceVerificationService } from '../services/AttendanceVerificationService';
import { 
  FileText, 
  Clock, 
  Calendar, 
  Send, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert,
  HelpCircle
} from 'lucide-react';

const AttendanceCorrectionModal = ({ 
  isOpen, 
  onClose, 
  teacherId, 
  defaultDate = new Date().toISOString().split('T')[0],
  onSubmitted 
}) => {
  const [attendanceDate, setAttendanceDate] = useState(defaultDate);
  const [requestType, setRequestType] = useState('CHECK_IN_MISSED');
  const [requestedStatus, setRequestedStatus] = useState('Present');
  const [requestedCheckInTime, setRequestedCheckInTime] = useState('08:30');
  const [requestedCheckOutTime, setRequestedCheckOutTime] = useState('15:30');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim() || reason.trim().length < 8) {
      setError('Please provide a specific, detailed explanation for the correction request (at least 8 characters).');
      return;
    }

    try {
      setSubmitting(true);

      const result = await AttendanceVerificationService.submitCorrectionRequest({
        teacherId,
        attendanceDate,
        requestType,
        requestedStatus,
        requestedCheckInTime: (requestType === 'CHECK_IN_MISSED' || requestType === 'CAMERA_ISSUE' || requestType === 'LOCATION_ISSUE') ? requestedCheckInTime : null,
        requestedCheckOutTime: (requestType === 'CHECK_OUT_MISSED' || requestType === 'CAMERA_ISSUE' || requestType === 'LOCATION_ISSUE') ? requestedCheckOutTime : null,
        reason: reason.trim()
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit correction request.');
      }

      setSuccessMessage('Your attendance correction request has been submitted to the School Coordinator / Principal for review.');
      if (onSubmitted) onSubmitted(result);

      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2200);

    } catch (err) {
      console.error('Correction submission error:', err);
      setError(err.message || 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-white animate-scale-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-white">
                Request Attendance Correction
              </h3>
              <p className="text-xs text-slate-400">
                Official audit review by Coordinator / Principal
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        {successMessage ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-full flex items-center justify-center mb-4 text-emerald-400">
              <CheckCircle2 size={36} />
            </div>
            <h4 className="text-xl font-bold text-white mb-2">Request Submitted</h4>
            <p className="text-slate-300 text-sm max-w-sm">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-rose-300 text-xs">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Attendance Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Calendar size={13} /> Attendance Date *
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  required
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500 text-xs"
                />
              </div>

              {/* Request Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <HelpCircle size={13} /> Issue Category *
                </label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500 text-xs"
                >
                  <option value="CHECK_IN_MISSED">Missed Morning Check-In</option>
                  <option value="CHECK_OUT_MISSED">Missed Afternoon Check-Out</option>
                  <option value="LOCATION_ISSUE">GPS / Geofence Error at School</option>
                  <option value="CAMERA_ISSUE">Camera / Phone Scanner Error</option>
                  <option value="DUTY_TRAVEL">Official External School Duty</option>
                  <option value="OTHER">Other Genuine Reason</option>
                </select>
              </div>
            </div>

            {/* Time Adjustments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-800/30 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <Clock size={12} /> Actual Arrival Time
                </label>
                <input
                  type="time"
                  value={requestedCheckInTime}
                  onChange={(e) => setRequestedCheckInTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
                  <Clock size={12} /> Actual Departure Time
                </label>
                <input
                  type="time"
                  value={requestedCheckOutTime}
                  onChange={(e) => setRequestedCheckOutTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs"
                />
              </div>
            </div>

            {/* Requested Attendance Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Requested Status *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['Present', 'Half Day', 'Official Duty'].map((status) => (
                  <button
                    type="button"
                    key={status}
                    onClick={() => setRequestedStatus(status)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                      requestedStatus === status
                        ? 'bg-brand-500/20 border-brand-500 text-brand-300 shadow-sm'
                        : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Reason Textarea (Mandatory) */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Detailed Reason for Correction *
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Present at school by 8:35 AM for morning assembly; phone camera failed to focus on QR screen..."
                required
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 text-xs"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Note: All requests and administrator decisions are recorded in the permanent audit log.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-500 hover:bg-brand-600 text-white transition-all shadow-md hover:shadow-brand-500/25 flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>Submitting...</>
                ) : (
                  <>
                    <Send size={14} /> Submit for Review
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AttendanceCorrectionModal;
