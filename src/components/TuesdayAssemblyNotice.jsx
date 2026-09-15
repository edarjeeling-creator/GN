import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, Award, Bell, ArrowLeft, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAssemblyDate, getTimeUntilAssembly } from '../utils/tuesdayAssemblySchedule';
import { formatStudentDisplayName } from '../utils/studentUtils';

const TuesdayAssemblyNotice = ({ student, cls, academicYear, releaseDate, term = 'Finalterm', onSearchAnother }) => {
  const [timeLeft, setTimeLeft] = useState(() => getTimeUntilAssembly(releaseDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilAssembly(releaseDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [releaseDate]);

  const formattedDate = formatAssemblyDate(releaseDate);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(to bottom right, #090d16, #111827)' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        transition={{ duration: 0.4 }}
        className="w-full max-w-xl"
      >
        <div className="bento-card border border-indigo-500/30 shadow-2xl p-6 sm:p-8 bg-slate-900/90 backdrop-blur-xl text-white">
          
          {/* Top Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-700/50 mb-3 shadow-inner">
              <Sparkles size={14} className="text-amber-400" />
              <span>Tuesday Morning Assembly Protocol</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <Award className="text-amber-400 shrink-0" size={28} />
              <span>Final Term Results</span>
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Academic Session {academicYear} • Gyanoday Niketan
            </p>
          </div>

          {/* Student Identification Banner */}
          {student && (
            <div className="mb-6 p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Student Name</p>
                <p className="font-bold text-base text-white">{formatStudentDisplayName(student.name)}</p>
              </div>
              <div className="flex items-center gap-4 text-xs sm:text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Class</p>
                  <p className="font-semibold text-slate-200">{cls?.name || '—'} {cls?.section || ''}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Roll No</p>
                  <p className="font-semibold text-slate-200">{student.roll_no || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">PIN</p>
                  <p className="font-mono font-bold text-indigo-300">{student.uid || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Release Schedule Box */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/50 to-purple-950/30 border border-indigo-500/40 mb-6 text-center">
            <div className="flex items-center justify-center gap-2 text-indigo-300 text-xs uppercase tracking-widest font-bold mb-2">
              <Calendar size={15} />
              <span>Scheduled Reflection Time</span>
            </div>

            <p className="text-lg sm:text-xl font-black text-amber-300 mb-4">
              {formattedDate}
            </p>

            {/* Countdown Box */}
            <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
              <div className="p-2 bg-slate-900/80 rounded-xl border border-indigo-500/30 text-center">
                <span className="block text-xl sm:text-2xl font-black text-white">{timeLeft.days}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Days</span>
              </div>
              <div className="p-2 bg-slate-900/80 rounded-xl border border-indigo-500/30 text-center">
                <span className="block text-xl sm:text-2xl font-black text-white">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Hours</span>
              </div>
              <div className="p-2 bg-slate-900/80 rounded-xl border border-indigo-500/30 text-center">
                <span className="block text-xl sm:text-2xl font-black text-white">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Mins</span>
              </div>
              <div className="p-2 bg-slate-900/80 rounded-xl border border-indigo-500/30 text-center">
                <span className="block text-xl sm:text-2xl font-black text-amber-400">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Secs</span>
              </div>
            </div>
          </div>

          {/* School Policy Explanation */}
          <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 mb-6">
            <div className="flex items-start gap-2.5">
              <Bell size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <p>
                <strong>Assembly Announcement:</strong> In accordance with school tradition, Final Term honors and scores are officially announced in front of the school body during <strong>Tuesday Morning Assembly</strong>.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Clock size={16} className="text-indigo-400 shrink-0 mt-0.5" />
              <p>
                <strong>Teacher Posting Cycle:</strong> Marks reflect on the Principal and Teacher Portals as soon as teachers submit them. For students, marks reflect on Tuesday during assembly. Any marks posted after Tuesday will reflect on the following Tuesday.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
              <p>
                Your academic evaluations are securely stored in the system. Attend Tuesday Morning Assembly to celebrate your results with teachers and fellow students!
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <Link 
              to="/" 
              className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>Campus Home</span>
            </Link>

            <button
              onClick={onSearchAnother}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={14} />
              <span>Search Another PIN</span>
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
};

export default TuesdayAssemblyNotice;
