import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  CheckCircle, XCircle, Clock, AlertTriangle, WifiOff, Wifi, 
  User, Users, Settings, Search, RefreshCw, X, Edit2, Trash2, Camera 
} from 'lucide-react';
import { Link } from 'react-router-dom';

const DEFAULT_SETTINGS = {
  gate: 'Main Gate',
  deviceName: 'Reception Tablet',
  duplicateWindow: 720,
  soundOn: true,
  preferredCameraId: ''
};

const QRAttendanceScanner = () => {
  const { profile } = useAuth();
  
  // States
  const [scanResult, setScanResult] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState('Present');
  const [stats, setStats] = useState({ students: 0, teachers: 0, late: 0, total: 0 });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [offlineQueue, setOfflineQueue] = useState(() => JSON.parse(localStorage.getItem('qr_offline_queue') || '[]'));
  const [settings, setSettings] = useState(() => JSON.parse(localStorage.getItem('qr_settings')) || DEFAULT_SETTINGS);
  
  const [cameras, setCameras] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  
  const [scanHistory, setScanHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showManualSearch, setShowManualSearch] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState([]);
  
  const [editScan, setEditScan] = useState(null); // Scan object being edited
  const [editRemarks, setEditRemarks] = useState('');
  
  // Refs
  const html5QrCodeRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processingRef = useRef(false);

  // Initialize Audio
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
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if(ctx.state === 'suspended') ctx.resume();
    
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
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  }, [settings.soundOn]);

  // Online / Offline Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Process Offline Queue when back online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      processOfflineQueue();
    }
  }, [isOnline]);

  // Save Settings to Local Storage
  useEffect(() => {
    localStorage.setItem('qr_settings', JSON.stringify(settings));
  }, [settings]);

  // Initialize Cameras
  useEffect(() => {
    fetchStats();
    fetchRecentHistory();

    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        setCameras(devices);
        let camToUse = settings.preferredCameraId;
        if (!camToUse || !devices.find(d => d.id === camToUse)) {
           // Default to back camera if possible
           const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
           camToUse = backCam ? backCam.id : devices[0].id;
           setSettings(s => ({ ...s, preferredCameraId: camToUse }));
        }
        startScanner(camToUse);
      }
    }).catch(err => {
      console.error("Error getting cameras", err);
    });

    return () => {
      stopScanner();
    };
  }, []); // Run once on mount

  const startScanner = (cameraId) => {
    if (!cameraId) return;
    stopScanner();
    
    setTimeout(() => {
      html5QrCodeRef.current = new Html5Qrcode("qr-reader-video");
      const config = {
        fps: 10,
        qrbox: { width: 300, height: 300 },
        aspectRatio: 1.0,
        videoConstraints: { 
          deviceId: { exact: cameraId },
          advanced: [{ focusMode: "continuous" }] 
        }
      };

      html5QrCodeRef.current.start(cameraId, config, onScanSuccess, onScanFailure)
        .then(() => setIsScanning(true))
        .catch(err => {
           console.log("Error starting scanner with autofocus, trying without advanced constraints", err);
           // Fallback without advanced constraints
           const fallbackConfig = { fps: 10, qrbox: { width: 300, height: 300 } };
           html5QrCodeRef.current.start(cameraId, fallbackConfig, onScanSuccess, onScanFailure)
             .then(() => setIsScanning(true))
             .catch(e => console.error("Scanner fallback failed", e));
        });
    }, 100);
  };

  const stopScanner = () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      html5QrCodeRef.current.stop().then(() => setIsScanning(false)).catch(console.error);
    }
  };

  const handleCameraChange = (e) => {
    const camId = e.target.value;
    setSettings(s => ({ ...s, preferredCameraId: camId }));
    startScanner(camId);
  };

  const fetchStats = async () => {
    if(!isOnline) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance_logs')
      .select('person_type, status')
      .gte('scan_time', `${today}T00:00:00Z`)
      .lte('scan_time', `${today}T23:59:59Z`)
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
    if(!isOnline) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('attendance_logs')
      .select('id, scan_time, status, person_id, person_type, remarks')
      .gte('scan_time', `${today}T00:00:00Z`)
      .order('scan_time', { ascending: false })
      .limit(10);
      
    if(data) {
      // Need names, doing manual lookups. (In a real app, use a DB view or join).
      const enriched = await Promise.all(data.map(async (item) => {
        let name = "Unknown";
        if(item.person_type === 'student') {
          const {data: s} = await supabase.from('students').select('name').eq('id', item.person_id).single();
          if(s) name = s.name;
        } else {
          const {data: p} = await supabase.from('profiles').select('name').eq('id', item.person_id).single();
          if(p) name = p.name;
        }
        return { ...item, name };
      }));
      setScanHistory(enriched);
    }
  };

  const processOfflineQueue = async () => {
    const queue = [...offlineQueue];
    const newQueue = [];
    
    for (const item of queue) {
      try {
        await logAttendance(item.payload, item.status, item.scanTime, true);
      } catch (e) {
        newQueue.push(item);
      }
    }
    
    setOfflineQueue(newQueue);
    localStorage.setItem('qr_offline_queue', JSON.stringify(newQueue));
    fetchStats();
    fetchRecentHistory();
  };

  const logAttendance = async (payload, status, timeStr, isBackgroundSync = false) => {
    let personId = payload.id;
    let personName = '';
    let personClass = '';
    
    // Duplicate Check
    const today = new Date().toISOString().split('T')[0];
    const { data: existingLog } = await supabase
      .from('attendance_logs')
      .select('id, scan_time')
      .eq('person_id', personId)
      .gte('scan_time', `${today}T00:00:00Z`)
      .neq('status', 'Cancelled')
      .order('scan_time', { ascending: false })
      .limit(1);

    if (existingLog && existingLog.length > 0) {
      const existingTime = new Date(existingLog[0].scan_time);
      const diffMins = (new Date(timeStr) - existingTime) / (1000 * 60);
      
      if (diffMins < parseInt(settings.duplicateWindow)) {
         if (payload.type === 'student') {
             const { data: student } = await supabase.from('students').select('name, class_id').eq('id', personId).single();
             if (student) {
                personName = student.name;
                const { data: cls } = await supabase.from('classes').select('name, section').eq('id', student.class_id).single();
                if (cls) personClass = `${cls.name} ${cls.section}`;
             }
         } else {
             const { data: teacher } = await supabase.from('profiles').select('name').eq('id', personId).single();
             if (teacher) personName = teacher.name;
         }
         
         const timeFormatted = existingTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
         
         if(!isBackgroundSync) {
           updateHistoryLocal({ id: 'dup-'+Date.now(), name: personName, status: 'Duplicate', scan_time: timeStr });
         }

         return {
           status: 'duplicate',
           message: `Already marked at ${timeFormatted}`,
           name: personName,
           class: personClass
         };
      }
    }

    // Validation & Name fetch
    if (payload.type === 'student') {
      const { data: student, error: stuError } = await supabase.from('students').select('name, class_id').eq('id', personId).single();
      if (stuError || !student) throw new Error("Student not found");
      personName = student.name;
      const { data: cls } = await supabase.from('classes').select('name, section').eq('id', student.class_id).single();
      if (cls) personClass = `${cls.name} ${cls.section}`;
      
      // Backward Compatibility
      const { data: existingOldAtt } = await supabase.from('attendance').select('id').eq('student_id', personId).eq('date', today).single();
      if (!existingOldAtt) {
         await supabase.from('attendance').insert({
            student_id: personId, class_id: student.class_id, date: today, status: status, academic_year: '2026'
         });
      }
    } else if (payload.type === 'teacher') {
      const { data: teacher, error: tchError } = await supabase.from('profiles').select('name').eq('id', personId).single();
      if (tchError || !teacher) throw new Error("Teacher not found");
      personName = teacher.name;
    } else {
      throw new Error("Invalid Person Type");
    }

    // Insert
    const insertData = {
      person_type: payload.type,
      person_id: personId,
      status: status,
      device_name: settings.deviceName,
      gate: settings.gate,
      scanner_user: profile?.id,
      operator_name: profile?.name,
      scan_time: timeStr
    };

    const { data: logRow, error: logError } = await supabase.from('attendance_logs').insert(insertData).select().single();
    if (logError) throw logError;

    if(!isBackgroundSync && logRow) {
      updateHistoryLocal({ ...logRow, name: personName });
    }

    return {
      status: 'success',
      message: 'Attendance marked',
      name: personName,
      class: personClass,
      time: new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const updateHistoryLocal = (newItem) => {
    setScanHistory(prev => [newItem, ...prev].slice(0, 10));
  };

  const onScanSuccess = async (decodedText) => {
    if (processingRef.current) return;
    processingRef.current = true;

    try {
      let payload;
      try {
        payload = JSON.parse(decodedText);
      } catch (e) {
        throw new Error("Invalid JSON Payload");
      }
      
      if (!payload.signature || !payload.id || !payload.type) {
        throw new Error("Invalid QR Code Format");
      }

      const scanTime = new Date().toISOString();
      const currentStatus = attendanceStatus;

      if (!isOnline) {
        const newQueue = [...offlineQueue, { payload, status: currentStatus, scanTime }];
        setOfflineQueue(newQueue);
        localStorage.setItem('qr_offline_queue', JSON.stringify(newQueue));
        playTone('success');
        setScanResult({
          status: 'success', message: 'Saved to Offline Queue',
          name: payload.uid || payload.employee_id || 'ID Scanned',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      } else {
        const result = await logAttendance(payload, currentStatus, scanTime);
        playTone(result.status);
        setScanResult(result);
        fetchStats();
      }
    } catch (error) {
      console.error(error);
      playTone('error');
      setScanResult({
        status: 'error',
        message: error.message || 'Invalid QR or Processing Error',
        name: 'Invalid Scan',
      });
    }

    setTimeout(() => {
      setScanResult(null);
      processingRef.current = false;
    }, 3000);
  };

  const onScanFailure = () => { /* Ignore constant background failures */ };

  const handleManualSearch = async () => {
    if (!manualQuery || manualQuery.length < 3) return;
    
    // Search Students
    const { data: students } = await supabase
      .from('students')
      .select('id, name, uid, class_id')
      .or(`name.ilike.%${manualQuery}%,uid.ilike.%${manualQuery}%`)
      .limit(5);
      
    // Search Teachers
    const { data: teachers } = await supabase
      .from('profiles')
      .select('id, name, role')
      .eq('role', 'teacher')
      .ilike('name', `%${manualQuery}%`)
      .limit(5);

    const formatted = [];
    if (students) {
      for (const s of students) {
         const { data: c } = await supabase.from('classes').select('name, section').eq('id', s.class_id).single();
         formatted.push({ type: 'student', id: s.id, name: s.name, uid: s.uid, subtitle: c ? `${c.name} ${c.section}` : '' });
      }
    }
    if (teachers) {
      for (const t of teachers) {
         formatted.push({ type: 'teacher', id: t.id, name: t.name, uid: 'Teacher', subtitle: 'Faculty' });
      }
    }
    setManualResults(formatted);
  };

  const handleManualMark = async (person) => {
    if(processingRef.current) return;
    processingRef.current = true;
    
    try {
      const payload = { type: person.type, id: person.id };
      const scanTime = new Date().toISOString();
      const result = await logAttendance(payload, attendanceStatus, scanTime);
      playTone(result.status);
      setScanResult(result);
      fetchStats();
      setShowManualSearch(false);
      setManualQuery('');
      setManualResults([]);
    } catch (error) {
      playTone('error');
    }
    setTimeout(() => { setScanResult(null); processingRef.current = false; }, 3000);
  };

  const handleUndo = async (scan) => {
    if (!scan.id || scan.id.startsWith('dup')) return;
    const reason = prompt("Enter cancellation reason:", "Accidental scan");
    if (reason === null) return;
    
    const { error } = await supabase.from('attendance_logs')
      .update({ status: 'Cancelled', cancelled_at: new Date().toISOString(), cancelled_by: profile?.id, cancel_reason: reason })
      .eq('id', scan.id);
      
    if (!error) {
      setScanHistory(prev => prev.map(s => s.id === scan.id ? { ...s, status: 'Cancelled' } : s));
      fetchStats();
    }
  };

  const handleSaveEdit = async () => {
    if (!editScan) return;
    const { error } = await supabase.from('attendance_logs')
      .update({ status: editScan.status, remarks: editRemarks })
      .eq('id', editScan.id);
      
    if (!error) {
      setScanHistory(prev => prev.map(s => s.id === editScan.id ? { ...s, status: editScan.status, remarks: editRemarks } : s));
      setEditScan(null);
      fetchStats();
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'bg-emerald-500';
      case 'Late': return 'bg-amber-500';
      case 'Half Day': return 'bg-orange-500';
      case 'Leave': return 'bg-blue-500';
      case 'Duplicate': return 'bg-red-500';
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
            <h1 className="text-xl font-bold tracking-tight">Attendance Kiosk <span className="text-xs font-normal text-slate-400 bg-slate-700 px-2 py-0.5 rounded ml-2">{settings.gate}</span></h1>
            <p className="text-xs text-slate-400">{settings.deviceName} • Operator: {profile?.name || 'System'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={() => setShowManualSearch(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Manual Search">
            <Search size={20} />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors" title="Settings">
            <Settings size={20} />
          </button>

          <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {isOnline ? (offlineQueue.length > 0 ? <RefreshCw size={16} className="animate-spin" /> : <Wifi size={16} />) : <WifiOff size={16} />}
            {isOnline ? (offlineQueue.length > 0 ? `Syncing ${offlineQueue.length}...` : 'Online') : `Offline (${offlineQueue.length})`}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-hidden">
        
        {/* Left Side: Scanner & Controls */}
        <div className="w-full lg:w-[65%] flex flex-col gap-4">
          
          {/* Status Selector */}
          <div className="bg-slate-800 rounded-2xl p-2 flex gap-2 overflow-x-auto shrink-0 shadow-lg border border-slate-700">
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
             
             {/* HTML5 Qrcode Mount Point */}
             <div id="qr-reader-video" className="w-full h-full object-cover"></div>
             
             {/* Camera Selector Overlay */}
             {cameras.length > 1 && (
               <div className="absolute top-4 right-4 z-40">
                 <div className="bg-black/50 backdrop-blur px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-2">
                   <Camera size={16} className="text-white" />
                   <select 
                     className="bg-transparent text-white text-sm outline-none cursor-pointer"
                     value={settings.preferredCameraId}
                     onChange={handleCameraChange}
                   >
                     {cameras.map(c => <option key={c.id} value={c.id} className="text-black">{c.label || 'Camera'}</option>)}
                   </select>
                 </div>
               </div>
             )}

             {/* Result Overlay */}
             {scanResult && (
               <div className={`absolute inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200 z-50 ${
                 scanResult.status === 'success' ? 'bg-emerald-500/95' 
                 : scanResult.status === 'duplicate' ? 'bg-amber-500/95'
                 : 'bg-red-500/95'
               }`}>
                 {scanResult.status === 'success' && <CheckCircle size={80} className="text-white mb-4 drop-shadow-lg" />}
                 {scanResult.status === 'duplicate' && <AlertTriangle size={80} className="text-white mb-4 drop-shadow-lg" />}
                 {scanResult.status === 'error' && <XCircle size={80} className="text-white mb-4 drop-shadow-lg" />}
                 
                 <h2 className="text-5xl font-extrabold text-white text-center tracking-tight drop-shadow-lg px-4">
                   {scanResult.name}
                 </h2>
                 
                 {scanResult.class && (
                   <p className="text-2xl text-white/90 mt-2 font-medium drop-shadow-md">{scanResult.class}</p>
                 )}
                 
                 <div className="mt-6 flex items-center gap-3 bg-black/20 px-6 py-3 rounded-2xl backdrop-blur-sm border border-white/10">
                   {scanResult.status === 'duplicate' ? <AlertTriangle size={24} className="text-white" /> : <Clock size={24} className="text-white" />}
                   <span className="text-2xl font-bold text-white tracking-wide">
                     {scanResult.status === 'duplicate' ? scanResult.message : `${attendanceStatus} at ${scanResult.time || new Date().toLocaleTimeString()}`}
                   </span>
                 </div>
               </div>
             )}
          </div>
          
          {/* Live Stats Row */}
          <div className="grid grid-cols-4 gap-3 shrink-0">
             <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
               <div className="text-xs text-slate-400 mb-1">Students</div>
               <div className="text-2xl font-bold text-emerald-400">{stats.students}</div>
             </div>
             <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
               <div className="text-xs text-slate-400 mb-1">Teachers</div>
               <div className="text-2xl font-bold text-blue-400">{stats.teachers}</div>
             </div>
             <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
               <div className="text-xs text-slate-400 mb-1">Late</div>
               <div className="text-2xl font-bold text-amber-400">{stats.late}</div>
             </div>
             <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
               <div className="text-xs text-slate-400 mb-1">Total Scans</div>
               <div className="text-2xl font-bold text-white">{stats.total}</div>
             </div>
          </div>
        </div>

        {/* Right Side: History */}
        <div className="w-full lg:w-[35%] bg-slate-800 rounded-3xl border border-slate-700 flex flex-col overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-700 bg-slate-800/80 shrink-0">
             <h3 className="font-bold text-slate-200 flex items-center justify-between">
               <span>Recent Scans</span>
               <span className="text-xs font-normal text-slate-400">{scanHistory.length} items</span>
             </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {scanHistory.map((scan, idx) => (
              <div key={idx} className="bg-slate-900/50 rounded-xl p-3 mb-2 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full shadow-sm ${getStatusColor(scan.status)}`}></div>
                  <div>
                    <div className="text-sm font-semibold text-white">{scan.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      {new Date(scan.scan_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      <span className="px-1 text-slate-500">•</span>
                      <span className={`${scan.status === 'Cancelled' ? 'line-through text-slate-500' : ''}`}>{scan.status}</span>
                    </div>
                  </div>
                </div>
                {!scan.id.startsWith('dup') && scan.status !== 'Cancelled' && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditScan(scan); setEditRemarks(scan.remarks || ''); }} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleUndo(scan)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
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
            
            <button onClick={() => setShowSettings(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl mt-6 transition-colors">
              Save & Close
            </button>
          </div>
        </div>
      )}

      {/* Manual Search Modal */}
      {showManualSearch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-lg border border-slate-700 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="text-xl font-bold">Manual Entry</h2>
              <button onClick={() => setShowManualSearch(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>
            
            <div className="shrink-0 mb-4">
              <input 
                type="text"
                placeholder="Search by Name, UID, or Employee ID..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white outline-none focus:border-indigo-500"
                value={manualQuery}
                onChange={(e) => { setManualQuery(e.target.value); handleManualSearch(); }}
                onKeyUp={(e) => { if(e.key==='Enter') handleManualSearch(); }}
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {manualResults.map(p => (
                <div key={p.id} className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.uid} • {p.subtitle}</div>
                  </div>
                  <button 
                    onClick={() => handleManualMark(p)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    Mark {attendanceStatus}
                  </button>
                </div>
              ))}
              {manualQuery && manualResults.length === 0 && (
                <div className="text-center text-slate-500 p-4">No matches found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Scan Modal */}
      {editScan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-3xl p-6 w-full max-w-sm border border-slate-700 shadow-2xl">
            <h2 className="text-xl font-bold mb-4">Edit Record</h2>
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1">Status</label>
              <select 
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white"
                value={editScan.status}
                onChange={(e) => setEditScan({...editScan, status: e.target.value})}
              >
                <option value="Present">Present</option>
                <option value="Late">Late</option>
                <option value="Half Day">Half Day</option>
                <option value="Leave">Leave</option>
              </select>
            </div>
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-1">Remarks</label>
              <input 
                type="text"
                placeholder="e.g. Bus breakdown"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white"
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditScan(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 p-3 rounded-xl font-bold">Cancel</button>
              <button onClick={handleSaveEdit} className="flex-1 bg-indigo-600 hover:bg-indigo-500 p-3 rounded-xl font-bold">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for Scanner Object Fit */}
      <style dangerouslySetInnerHTML={{__html: `
        #qr-reader-video video { object-fit: cover !important; width: 100% !important; height: 100% !important; }
      `}} />
    </div>
  );
};

export default QRAttendanceScanner;
