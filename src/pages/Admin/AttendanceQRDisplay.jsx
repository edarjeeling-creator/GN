import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '../../lib/supabase';
import { AttendanceVerificationService } from '../../services/AttendanceVerificationService';
import { 
  QrCode, 
  Clock, 
  ShieldCheck, 
  RefreshCw, 
  Maximize, 
  Minimize, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Sun,
  Moon,
  School
} from 'lucide-react';

const AttendanceQRDisplay = () => {
  // Action type: CHECK_IN or CHECK_OUT (auto-detect based on hour by default: before 12:30 PM is CHECK_IN, else CHECK_OUT)
  const [actionType, setActionType] = useState(() => {
    const currentHour = new Date().getHours();
    return currentHour < 13 ? 'CHECK_IN' : 'CHECK_OUT';
  });

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(45);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayStats, setTodayStats] = useState({ checkedIn: 0, checkedOut: 0, totalStaff: 0 });
  const [sessionCount, setSessionCount] = useState(0);

  const containerRef = useRef(null);
  const timerRef = useRef(null);
  const expiryDuration = 45; // 45 seconds dynamic lifespan

  // Clock updater
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Fetch today's live check-in stats
  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [{ count: totalStaff }, { data: attendanceToday }] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'teacher').eq('status', 'Active'),
        supabase.from('teacher_attendance').select('id, check_in_time, check_out_time').eq('attendance_date', today)
      ]);

      const checkedIn = (attendanceToday || []).filter(a => a.check_in_time).length;
      const checkedOut = (attendanceToday || []).filter(a => a.check_out_time).length;

      setTodayStats({
        totalStaff: totalStaff || 0,
        checkedIn,
        checkedOut
      });
    } catch (err) {
      console.warn('Could not fetch attendance stats:', err);
    }
  };

  // Generate a new dynamic QR session
  const generateNewSession = async (type = actionType) => {
    try {
      setLoading(true);
      setError(null);

      const result = await AttendanceVerificationService.generateQRSession(type, expiryDuration);
      if (!result.success) {
        throw new Error(result.error || 'Failed to generate attendance QR');
      }

      setSession(result.session);
      setSecondsRemaining(expiryDuration);
      setSessionCount(prev => prev + 1);
      fetchStats();
    } catch (err) {
      console.error('QR Session generation error:', err);
      setError(err.message || 'Error generating dynamic QR session');
    } finally {
      setLoading(false);
    }
  };

  // Switch action type manually
  const handleActionChange = (newType) => {
    if (newType === actionType) return;
    setActionType(newType);
    generateNewSession(newType);
  };

  // Cycle session when action type changes
  useEffect(() => {
    generateNewSession(actionType);
  }, [actionType]);

  // Countdown timer for rotating QR
  useEffect(() => {
    if (!session) return;

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          generateNewSession(actionType);
          return expiryDuration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.token, actionType]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const progressPercent = Math.max(0, Math.min(100, (secondsRemaining / expiryDuration) * 100));
  const isCheckIn = actionType === 'CHECK_IN';

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between p-4 md:p-8 font-sans select-none"
    >
      {/* Top Header Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
            <School size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2 text-white">
              Gyanoday Niketan
              <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Verified Portal
              </span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
              <MapPin size={13} className="text-emerald-400" />
              Campus Geofence Active (Darjeeling) • Dynamic Anti-Spoofing Enabled
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Action Toggle Switch */}
          <div className="bg-slate-900/90 border border-slate-700/80 p-1 rounded-xl flex items-center gap-1 shadow-inner">
            <button
              onClick={() => handleActionChange('CHECK_IN')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                isCheckIn 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Sun size={15} /> Check-In (Morning)
            </button>
            <button
              onClick={() => handleActionChange('CHECK_OUT')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                !isCheckIn 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Moon size={15} /> Check-Out (Departure)
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-slate-300 hover:text-white rounded-xl transition-colors shadow-sm"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {/* Main Center Area: Large Rotating Dynamic QR */}
      <main className="my-auto py-6 flex flex-col items-center justify-center">
        <div className="text-center max-w-xl mb-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-2 border backdrop-blur-md bg-slate-800/60 text-slate-300 border-slate-700/80">
            <ShieldCheck size={14} className={isCheckIn ? "text-emerald-400" : "text-blue-400"} />
            Authorized Official Attendance Kiosk
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            {isCheckIn ? (
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200">
                Teacher Morning Check-In
              </span>
            ) : (
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-sky-200">
                Teacher Afternoon Check-Out
              </span>
            )}
          </h2>
          <p className="text-slate-400 text-sm md:text-base mt-1">
            Open the ERP on your phone and tap <strong className="text-slate-200">{isCheckIn ? 'Check In' : 'Check Out'}</strong> to scan this live code.
          </p>
        </div>

        {/* QR Card with glowing dynamic borders */}
        <div className="relative group">
          {/* Subtle Ambient Glow */}
          <div className={`absolute -inset-1 rounded-3xl blur-2xl opacity-40 transition-all duration-700 ${
            isCheckIn ? 'bg-emerald-500/30' : 'bg-blue-500/30'
          }`} />

          <div className="relative bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center">
            {/* Action Badge */}
            <div className={`mb-5 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm ${
              isCheckIn 
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
            }`}>
              {isCheckIn ? 'LIVE CHECK-IN TOKEN' : 'LIVE CHECK-OUT TOKEN'}
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-5 rounded-2xl shadow-inner flex items-center justify-center min-w-[260px] min-h-[260px] md:min-w-[300px] md:min-h-[300px]">
              {loading && !session ? (
                <div className="flex flex-col items-center gap-3 text-slate-700">
                  <RefreshCw className="animate-spin text-emerald-600" size={36} />
                  <span className="text-xs font-semibold">Generating live token...</span>
                </div>
              ) : error ? (
                <div className="text-center p-4 max-w-[240px]">
                  <AlertCircle className="text-rose-500 mx-auto mb-2" size={36} />
                  <p className="text-xs font-semibold text-rose-700 mb-3">{error}</p>
                  <button 
                    onClick={() => generateNewSession(actionType)}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
                  >
                    Retry
                  </button>
                </div>
              ) : session?.payloadString ? (
                <QRCode
                  value={session.payloadString}
                  size={280}
                  level="H"
                  fgColor="#0f172a"
                  bgColor="#ffffff"
                />
              ) : null}
            </div>

            {/* Live Expiration Countdown Ring / Bar */}
            <div className="w-full mt-6">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className={secondsRemaining <= 10 ? 'text-amber-400 animate-pulse' : 'text-slate-400'} />
                  Auto-rotates in:
                </span>
                <span className={`font-bold ${secondsRemaining <= 10 ? 'text-rose-400 font-black text-sm' : 'text-slate-200'}`}>
                  {secondsRemaining}s
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                    secondsRemaining <= 10 
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500' 
                      : isCheckIn 
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-400' 
                        : 'bg-gradient-to-r from-indigo-500 to-blue-400'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Session Token Preview & Anti-Replay Guard Info */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 w-full flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-mono truncate max-w-[170px]" title={session?.token}>
                Token: {session?.token ? session.token.slice(0, 10) + '...' + session.token.slice(-6) : '-------'}
              </span>
              <span className="font-medium text-slate-400">
                Cycle #{sessionCount}
              </span>
            </div>
          </div>
        </div>

        {/* Live Attendance Stats Counter */}
        <div className="grid grid-cols-3 gap-3 md:gap-6 mt-8 max-w-lg w-full">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 text-center">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Active Staff</div>
            <div className="text-xl md:text-2xl font-black text-white mt-0.5">{todayStats.totalStaff}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 text-center">
            <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold">Checked In</div>
            <div className="text-xl md:text-2xl font-black text-emerald-400 mt-0.5">{todayStats.checkedIn}</div>
          </div>
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3 text-center">
            <div className="text-[11px] uppercase tracking-wider text-blue-400 font-bold">Checked Out</div>
            <div className="text-xl md:text-2xl font-black text-blue-400 mt-0.5">{todayStats.checkedOut}</div>
          </div>
        </div>
      </main>

      {/* Bottom Footer Bar */}
      <footer className="border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>System Secure • Anti-Replay Active • Server-Authoritative Timestamp</span>
        </div>
        <div className="flex items-center gap-4 font-mono text-slate-400 text-sm">
          <span>{currentTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span className="font-bold text-white bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </footer>
    </div>
  );
};

export default AttendanceQRDisplay;
