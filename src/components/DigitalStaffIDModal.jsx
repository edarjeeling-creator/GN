import React from 'react';
import QRCode from 'react-qr-code';
import { X, ShieldCheck, Building, User, Phone, Droplet, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DigitalStaffIDModal({ isOpen, onClose, profile, onPhotoUpload }) {
  if (!isOpen || !profile) return null;

  const roleLabel = profile.role === 'group_d'
    ? 'Group D Staff'
    : profile.role === 'non_teaching' || profile.role === 'staff'
      ? 'Non-Teaching Staff'
      : profile.role === 'accountant'
        ? 'School Accountant'
        : profile.role === 'librarian'
          ? 'Librarian'
          : profile.role === 'teacher'
            ? 'Teaching Faculty'
            : profile.role === 'admin'
              ? 'Administrator'
              : 'Staff Member';

  const designation = profile.designation || roleLabel;
  const staffUid = profile.uid || profile.employee_id || `GN-${(profile.id || '').substring(0, 8).toUpperCase()}`;

  const qrPayload = JSON.stringify({
    org: 'Gyanoday Niketan',
    uid: staffUid,
    name: profile.name,
    role: profile.role,
    campus: profile.campus || 'Senior School',
    status: 'ACTIVE'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden relative text-white flex flex-col">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Card Header */}
        <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-6 pb-4 border-b border-slate-800 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xl">🏫</span>
            <h3 className="font-extrabold text-base tracking-tight text-white uppercase">Gyanoday Niketan</h3>
          </div>
          <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            Official Staff Identity Card
          </p>
        </div>

        {/* Card Body */}
        <div className="p-6 flex flex-col items-center text-center space-y-4">
          
          {/* Staff Photo */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-emerald-500/40 overflow-hidden shadow-lg flex items-center justify-center">
              {profile.picture_url ? (
                <img 
                  src={profile.picture_url} 
                  alt={profile.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User size={48} className="text-slate-500" />
              )}
            </div>

            {onPhotoUpload && (
              <label 
                className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md cursor-pointer transition-colors" 
                title="Change Photo"
              >
                <Camera size={14} />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={onPhotoUpload}
                />
              </label>
            )}
          </div>

          {/* Name & Designation */}
          <div>
            <h4 className="text-xl font-black text-white tracking-tight">{profile.name}</h4>
            <div className="mt-1 flex items-center justify-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {designation}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-medium">{roleLabel}</p>
          </div>

          {/* Staff Details Grid */}
          <div className="w-full bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 space-y-2 text-left text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-400" /> Staff ID:
              </span>
              <span className="font-mono font-bold text-slate-100">{staffUid}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Building size={14} className="text-indigo-400" /> Campus:
              </span>
              <span className="font-bold text-slate-100">{profile.campus || 'Senior School'}</span>
            </div>

            {profile.contact_number && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Phone size={14} className="text-blue-400" /> Phone:
                </span>
                <span className="font-medium text-slate-200">{profile.contact_number}</span>
              </div>
            )}

            {profile.blood_group && (
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium flex items-center gap-1.5">
                  <Droplet size={14} className="text-rose-400" /> Blood Group:
                </span>
                <span className="font-bold text-rose-400">{profile.blood_group}</span>
              </div>
            )}

            <div className="flex justify-between items-center pt-1 border-t border-slate-700/40">
              <span className="text-slate-400 font-medium">Status:</span>
              <span className="inline-flex items-center gap-1 font-bold text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ACTIVE VERIFIED
              </span>
            </div>
          </div>

          {/* QR Verification Code */}
          <div className="flex flex-col items-center pt-1">
            <div className="p-2.5 bg-white rounded-xl shadow-inner">
              <QRCode value={qrPayload} size={80} level="M" />
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 font-mono">Scan for Campus Verification</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-center">
          <p className="text-[10px] text-slate-500 font-medium">Gyanoday Niketan Higher Secondary School • Darjeeling</p>
        </div>
      </div>
    </div>
  );
}
