import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  CheckCircle, XCircle, Clock, AlertTriangle, WifiOff, Wifi, 
  Settings, Search, RefreshCw, X, Camera, RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';

const DEFAULT_SETTINGS = {
  gate: 'Main Gate',
  deviceName: 'Reception Tablet',
  duplicateWindow: 3, // Changed from 720 to 3 minutes for testing/standard usage
  soundOn: true
};

const QRAttendanceScanner = () => {
  const { profile } = useAuth();
  
  // States
  const [attendanceStatus, setAttendanceStatus] = useState('Present');
  const [stats, setStats] = useState({ students: 0, teachers: 0, late: 0, total: 0 });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [offlineQueue, setOfflineQueue] = useState(() => JSON.parse(localStorage.getItem('qr_offline_queue') || '[]'));
  const [settings, setSettings] = useState(() => JSON.parse(localStorage.getItem('qr_settings')) || DEFAULT_SETTINGS);
  
  const [scanHistory, setScanHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null); 
  
  const [facingMode, setFacingMode] = useState('environment'); // environment = rear camera
  
  // Refs
  const audioCtxRef = useRef(null);
  const lastScannedRef = useRef({ code: null, time: 0 });

  // --- Sound & Audio Context ---
  useEffect(() => {
    const handleInteraction = () => {
      if (!audioCtxRef.current && settings.soundOn) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
    };
    window.addEventListener('click', handleInteraction);
    return () => window.removeEventListener('click', handleInteraction);
  }, [settings.soundOn]);

  const playTone = useCallback((type) => {
    if (!settings.soundOn) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'duplicate') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.setValueAtTime(400, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(600, ctx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) { console.error("Audio error", e); }
  }, [settings.soundOn]);

  // --- Network Listeners & Sync ---
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (offlineQueue.length > 0) processOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineQueue]);

  useEffect(() => {
    localStorage.setItem('qr_settings', JSON.stringify(settings));
  }, [settings]);

  // Initial Load
  useEffect(() => {
    fetchStats();
    fetchRecentHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Core Attendance Logic (Optimized) ---
  const fetchStats = async () => {
    if (!navigator.onLine) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance_logs')
      .select('person_type, status')
      .gte('scan_time', `${today}T00:00:00Z`)
      .neq('status', 'Cancelled');
      
    if (data) {
      const statsObj = { students: 0, teachers: 0, late: 0, total: data.length };
      data.forEach(log => {
        if (log.person_type === 'student') statsObj.students++;
        if (log.person_type === 'teacher') statsObj.teachers++;
        if (log.status === 'Late') statsObj.late++;
      });
      setStats(statsObj);
    }
  };

  const fetchRecentHistory = async () => {
    if (!navigator.onLine) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance_logs')
      .select('id, scan_time, status, person_id, person_type, remarks')
      .gte('scan_time', `${today}T00:00:00Z`)
      .order('scan_time', { ascending: false })
      .limit(10);
      
    if (data) {
      // Manual enrichment optimization for history
      const studentIds = data.filter(d => d.person_type === 'student').map(d => d.person_id);
      const teacherIds = data.filter(d => d.person_type === 'teacher').map(d => d.person_id);
      
      const [studentsRes, teachersRes] = await Promise.all([
        studentIds.length > 0 ? supabase.from('students').select('id, name, class_id, classes(name, section)').in('id', studentIds) : { data: [] },
        teacherIds.length > 0 ? supabase.from('profiles').select('id, name').in('id', teacherIds) : { data: [] }
      ]);
      
      const enriched = data.map(item => {
        let name = "Unknown";
        let className = "";
        if (item.person_type === 'student') {
          const s = studentsRes.data?.find(x => x.id === item.person_id);
          if (s) {
            name = s.name;
            if (s.classes) className = `${s.classes.name} ${s.classes.section}`;
          }
        } else {
          const t = teachersRes.data?.find(x => x.id === item.person_id);
          if (t) name = t.name;
        }
        return { ...item, name, className };
      });
      setScanHistory(enriched);
    }
  };

  const logAttendance = async (payload, status, timeStr, isBackgroundSync = false) => {
    const today = new Date().toISOString().split('T')[0];
    const personId = payload.id;
    let personName = '';
    let personClass = '';
    let classId = null;
    let isTeacher = payload.type === 'teacher';

    // 1. Parallel Lookups
    const dupCheckPromise = supabase
      .from('attendance_logs')
      .select('id, scan_time')
      .eq('person_id', personId)
      .gte('scan_time', `${today}T00:00:00Z`)
      .neq('status', 'Cancelled')
      .order('scan_time', { ascending: false })
      .limit(1);

    let profilePromise;
    if (isTeacher) {
      profilePromise = supabase.from('profiles').select('name').eq('id', personId).single();
    } else {
      profilePromise = supabase.from('students').select('name, class_id, classes(name, section)').eq('id', personId).single();
    }

    const [dupRes, profileRes] = await Promise.all([dupCheckPromise, profilePromise]);

    // Validation
    if (profileRes.error || !profileRes.data) {
      throw new Error(isTeacher ? "Teacher not found" : "Student not found");
    }

    if (isTeacher) {
      personName = profileRes.data.name;
    } else {
      personName = profileRes.data.name;
      classId = profileRes.data.class_id;
      if (profileRes.data.classes) {
        personClass = `${profileRes.data.classes.name} ${profileRes.data.classes.section}`;
      }
    }

    // 2. Duplicate Check
    if (dupRes.data && dupRes.data.length > 0) {
      const existingTime = new Date(dupRes.data[0].scan_time);
      const diffMins = (new Date(timeStr) - existingTime) / (1000 * 60);
      
      if (diffMins < parseInt(settings.duplicateWindow || 3)) {
        return {
          status: 'duplicate',
          message: 'Already Marked',
          name: personName,
          className: personClass,
          time: existingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
      }
    }

    // 3. Parallel Inserts
    const insertLogPromise = supabase.from('attendance_logs').insert({
      person_type: payload.type,
      person_id: personId,
      status: status,
      device_name: settings.deviceName,
      gate: settings.gate,
      scanner_user: profile?.id,
      operator_name: profile?.name,
      scan_time: timeStr
    }).select().single();

    let legacyInsertPromise;
    if (isTeacher) {
      // Ensure we just upsert or handle teacher check-in
      legacyInsertPromise = supabase.rpc('process_teacher_attendance', { 
         p_teacher_id: personId, p_status: status, p_time: timeStr 
      }).catch(e => {
         // Fallback if RPC doesn't exist, not failing the main transaction
         return supabase.from('teacher_attendance').insert({
           teacher_id: personId, attendance_date: today, status: status, check_in_time: timeStr
         });
      });
    } else {
      // Backward compatibility for students
      legacyInsertPromise = supabase.from('attendance').select('id').eq('student_id', personId).eq('date', today).single()
        .then(res => {
          if (!res.data) {
            return supabase.from('attendance').insert({
              student_id: personId, class_id: classId, date: today, status: status, academic_year: '2026'
            });
          }
        });
    }

    const [logRes] = await Promise.all([insertLogPromise, legacyInsertPromise]);

    if (!isTeacher) {
      const formattedTime = new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const formattedDate = new Date(timeStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
      const gateName = settings.gate || 'Main Gate';
      const notificationType = `gate_entry_${Date.now()}`;
      
      supabase.from('student_notifications').insert({
        student_id: personId,
        attendance_date: today,
        title: 'Gate Scan Alert',
        message: `Student ID was scanned at ${gateName} on ${formattedDate} at ${formattedTime}. Status: <strong>${status}</strong>.`,
        type: notificationType,
        channel: 'portal'
      }).then(({error}) => {
        if (error) console.error("Failed to send portal notification:", error);
      });
    }

    if (logRes.error) throw logRes.error;

    if (!isBackgroundSync && logRes.data) {
      setScanHistory(prev => [{ ...logRes.data, name: personName, className: personClass }, ...prev].slice(0, 10));
    }

    return {
      status: 'success',
      message: 'Attendance Marked',
      name: personName,
      className: personClass,
      time: new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const processOfflineQueue = async () => {
    const queue = [...offlineQueue];
    const newQueue = [];
    
    for (const item of queue) {
      try {
        await logAttendance(item.payload, item.status, item.scanTime, true);
      } catch (e) {
        newQueue.push(item); // Keep failed items
      }
    }
    
    setOfflineQueue(newQueue);
    localStorage.setItem('qr_offline_queue', JSON.stringify(newQueue));
    fetchStats();
    fetchRecentHistory();
  };

  // --- Scanner Callbacks ---
  const showToast = (result) => {
    setToast(result);
    // Auto-hide toast after 3.5 seconds
    setTimeout(() => {
      setToast(current => current?.time === result.time ? null : current);
    }, 3500);
  };

  const handleScan = async (detectedCodes) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    const rawValue = detectedCodes[0].rawValue;
    
    // Client-side debounce (3 seconds)
    const now = Date.now();
    if (lastScannedRef.current.code === rawValue && (now - lastScannedRef.current.time) < 3000) {
      return; 
    }
    
    lastScannedRef.current = { code: rawValue, time: now };
    
    // Parse Payload
    let payload;
    try {
      if (rawValue.startsWith('{')) {
        payload = JSON.parse(rawValue);
        if (!payload.id || !payload.type) throw new Error("Missing format");
      } else {
        // Fallback for legacy raw IDs - we assume student for speed, or we can't reliably scan them instantly.
        // For rapid scans, legacy IDs without JSON are dangerous. We will pass it as student.
        payload = { type: 'student', id: rawValue, signature: 'legacy' };
      }
    } catch (e) {
      playTone('error');
      showToast({ status: 'error', message: 'Invalid Format', name: 'Unknown QR' });
      return;
    }

    const scanTime = new Date().toISOString();
    const currentStatus = attendanceStatus;

    if (!navigator.onLine) {
      const newQueue = [...offlineQueue, { payload, status: currentStatus, scanTime }];
      setOfflineQueue(newQueue);
      localStorage.setItem('qr_offline_queue', JSON.stringify(newQueue));
      playTone('success');
      showToast({
        status: 'offline', message: 'Saved Offline',
        name: payload.uid || payload.id, time: new Date().toLocaleTimeString()
      });
      return;
    }

    try {
      const result = await logAttendance(payload, currentStatus, scanTime);
      playTone(result.status);
      showToast(result);
      // Fetch stats asynchronously in background so it doesn't block UI
      fetchStats(); 
    } catch (error) {
      console.error(error);
      playTone('error');
      showToast({
        status: 'error',
        message: 'Student Not Found',
        name: 'Invalid Scan',
        time: new Date().toLocaleTimeString()
      });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'bg-emerald-500';
      case 'Late': return 'bg-amber-500';
      case 'Half Day': return 'bg-orange-500';
      case 'Leave': return 'bg-blue-500';
      case 'Duplicate': return 'bg-amber-500';
      case 'Cancelled': return 'bg-slate-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="h-screen w-full bg-slate-900 text-white flex flex-col font-sans overflow-hidden">
      
      {/* Header Bar */}
      <div className="h-16 bg-slate-800 flex items-center justify-between px-6 border-b border-slate-700 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="text-slate-400 hover:text-white transition-colors" title="Back to Admin">
            <X size={24} />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">QR Scanner <span className="text-xs font-normal text-slate-400 bg-slate-700 px-2 py-0.5 rounded ml-2">{settings.gate}</span></h1>
            <p className="text-xs text-slate-400">{settings.deviceName} • Operator: {profile?.name || 'System'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Switch Camera">
            <RotateCcw size={20} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Settings">
            <Settings size={20} />
          </button>

          <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {isOnline ? (offlineQueue.length > 0 ? <RefreshCw size={16} className="animate-spin" /> : <Wifi size={16} />) : <WifiOff size={16} />}
            {isOnline ? (offlineQueue.length > 0 ? `Syncing ${offlineQueue.length}...` : 'Online') : `Offline (${offlineQueue.length})`}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden relative">
        
        {/* Left Side: Scanner */}
        <div className="w-full lg:w-[65%] flex flex-col gap-4 relative">
          
          {/* Status Selector */}
          <div className="bg-slate-800 rounded-2xl p-2 flex gap-2 overflow-x-auto shrink-0 shadow-lg border border-slate-700 z-20">
            {['Present', 'Late', 'Half Day', 'Leave'].map(status => (
              <button
                key={status}
                onClick={() => setAttendanceStatus(status)}
                className={`flex-1 min-w-[100px] py-3 px-4 rounded-xl font-semibold transition-all duration-200 ${
                  attendanceStatus === status 
                    ? status === 'Late' ? 'bg-amber-500 text-white shadow-md'
                    : status === 'Half Day' ? 'bg-orange-500 text-white shadow-md'
                    : status === 'Leave' ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-emerald-500 text-white shadow-md'
                  : 'bg-transparent text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Camera Viewport */}
          <div className="flex-1 relative bg-black rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[400px]">
             
             {/* The New React QR Scanner */}
             <div className="absolute inset-0 z-0">
               <Scanner 
                 onScan={handleScan}
                 onError={(err) => console.error(err)}
                 components={{
                    audio: false,
                    finder: true
                 }}
                 constraints={{
                    facingMode: facingMode
                 }}
                 styles={{
                    container: { width: '100%', height: '100%' },
                    video: { objectFit: 'cover' }
                 }}
               />
             </div>
             
             {/* Reticle / Overlays are handled by yudiel/react-qr-scanner's finder, but we add custom styling overlay */}
             <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-between py-8">
               <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full text-white/80 font-medium tracking-wide">
                 Point camera at ID Card
               </div>
             </div>

             {/* Non-Blocking Toast Notification */}
             {toast && (
               <div className="absolute bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
                 <div className={`animate-in slide-in-from-bottom-5 fade-in duration-200 flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-md max-w-md w-full
                   ${toast.status === 'success' ? 'bg-emerald-500/90 border-emerald-400/50' : 
                     toast.status === 'duplicate' ? 'bg-amber-500/90 border-amber-400/50' : 
                     toast.status === 'offline' ? 'bg-blue-500/90 border-blue-400/50' :
                     'bg-red-500/90 border-red-400/50'}`}>
                   
                   <div className="shrink-0 text-white drop-shadow-md">
                     {toast.status === 'success' && <CheckCircle size={36} />}
                     {toast.status === 'duplicate' && <AlertTriangle size={36} />}
                     {toast.status === 'offline' && <WifiOff size={36} />}
                     {toast.status === 'error' && <XCircle size={36} />}
                   </div>
                   
                   <div className="flex-1 min-w-0">
                     <p className="text-white/90 text-sm font-bold uppercase tracking-wider">{toast.message}</p>
                     <h3 className="text-white text-xl font-extrabold truncate drop-shadow-sm leading-tight">{toast.name}</h3>
                     {toast.className && <p className="text-white/80 text-sm font-medium">{toast.className}</p>}
                   </div>
                   
                   <div className="shrink-0 text-white/70 text-sm font-medium text-right">
                     {toast.time}
                   </div>
                 </div>
               </div>
             )}
          </div>
          
          {/* Live Stats Row */}
          <div className="grid grid-cols-4 gap-3 shrink-0 z-20">
             <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center shadow-md">
               <div className="text-xs text-slate-400 mb-1">Students</div>
               <div className="text-2xl font-bold text-emerald-400">{stats.students}</div>
             </div>
             <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center shadow-md">
               <div className="text-xs text-slate-400 mb-1">Teachers</div>
               <div className="text-2xl font-bold text-blue-400">{stats.teachers}</div>
             </div>
             <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center shadow-md">
               <div className="text-xs text-slate-400 mb-1">Late</div>
               <div className="text-2xl font-bold text-amber-400">{stats.late}</div>
             </div>
             <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center shadow-md">
               <div className="text-xs text-slate-400 mb-1">Total Scans</div>
               <div className="text-2xl font-bold text-white">{stats.total}</div>
             </div>
          </div>
        </div>

        {/* Right Side: History */}
        <div className="w-full lg:w-[35%] bg-slate-800 rounded-3xl border border-slate-700 flex flex-col overflow-hidden shadow-lg z-20">
          <div className="p-4 border-b border-slate-700 bg-slate-800/80 shrink-0">
             <h3 className="font-bold text-slate-200 flex items-center justify-between">
               <span>Recent Scans</span>
               <span className="text-xs font-normal text-slate-400">Live updating</span>
             </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {scanHistory.map((scan, idx) => (
              <div key={scan.id || idx} className="bg-slate-900/50 rounded-xl p-3 mb-2 flex flex-col group animate-in slide-in-from-left-2 fade-in">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full shadow-sm shrink-0 ${getStatusColor(scan.status)}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{scan.name}</div>
                    <div className="text-xs text-slate-400 flex items-center justify-between mt-0.5">
                       <span>{scan.className || 'Staff'}</span>
                       <span className="flex items-center gap-1">
                          {new Date(scan.scan_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {scanHistory.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
                <Clock size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No recent scans</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-md border border-slate-700 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Scanner Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Gate / Location</label>
                <select 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500"
                  value={settings.gate}
                  onChange={(e) => setSettings({...settings, gate: e.target.value})}
                >
                  <option value="Main Gate">Main Gate</option>
                  <option value="North Gate">North Gate</option>
                  <option value="Hostel">Hostel</option>
                  <option value="Bus Entrance">Bus Entrance</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Device Name</label>
                <input 
                  type="text"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500"
                  value={settings.deviceName}
                  onChange={(e) => setSettings({...settings, deviceName: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Duplicate Scan Window (minutes)</label>
                <input 
                  type="number"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500"
                  value={settings.duplicateWindow}
                  onChange={(e) => setSettings({...settings, duplicateWindow: e.target.value})}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-700">
                <span className="text-sm font-medium text-slate-300">Audio Feedback</span>
                <button 
                  onClick={() => setSettings({...settings, soundOn: !settings.soundOn})}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.soundOn ? 'bg-emerald-500' : 'bg-slate-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings.soundOn ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            
            <button onClick={() => setShowSettings(false)} className="w-full mt-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors">
              Save & Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default QRAttendanceScanner;
