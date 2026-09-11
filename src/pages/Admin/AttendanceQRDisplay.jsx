import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { supabase } from '../../lib/supabase';
import { AttendanceVerificationService } from '../../services/AttendanceVerificationService';
import { KioskSecurityService } from '../../services/KioskSecurityService';
import { 
  School, 
  MapPin, 
  RefreshCw, 
  Sun, 
  Moon, 
  Maximize, 
  Minimize, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Lock, 
  Tablet, 
  KeyRound, 
  Users, 
  Wifi, 
  WifiOff, 
  XCircle,
  Building2,
  Settings,
  Plus,
  Edit2,
  Trash2,
  UserCheck
} from 'lucide-react';

const AttendanceQRDisplay = () => {
  // Detect if running under dedicated kiosk route (/kiosk/teacher-qr)
  const isKioskMode = window.location.pathname.startsWith('/kiosk');

  // Core Display State
  const [actionType, setActionType] = useState('CHECK_IN'); // 'CHECK_IN' | 'CHECK_OUT'
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(45);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isRevoked, setIsRevoked] = useState(false);
  const [todayStats, setTodayStats] = useState({
    totalStaff: 0,
    checkedIn: 0,
    checkedOut: 0
  });

  // Kiosk specific state
  const [kioskCreds, setKioskCreds] = useState(null);
  const [checkingKioskAuth, setCheckingKioskAuth] = useState(true);
  const [showPairingModal, setShowPairingModal] = useState(false);
  const [pairingForm, setPairingForm] = useState({
    deviceId: 'GN-SENIOR-001',
    locationName: 'Senior School Main Entrance',
    secretKey: '',
    adminPin: '8254'
  });
  const [pairingError, setPairingError] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);

  // Admin Exit PIN modal
  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPin, setExitPin] = useState('');
  const [exitError, setExitError] = useState('');

  // Admin ERP Tabs: 'display' | 'kiosks' | 'campuses' | 'teachers'
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && ['display', 'kiosks', 'campuses', 'teachers'].includes(tabFromUrl) ? tabFromUrl : 'display'
  );

  useEffect(() => {
    if (tabFromUrl && ['display', 'kiosks', 'campuses', 'teachers'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'display' ? {} : { tab });
  };

  // Multi-Campus Management State
  const [campuses, setCampuses] = useState([]);
  const [loadingCampuses, setLoadingCampuses] = useState(false);
  const [editingCampus, setEditingCampus] = useState(null);
  const [campusForm, setCampusForm] = useState({
    campus_id: '',
    campus_name: '',
    latitude: '',
    longitude: '',
    geofence_radius_meters: 150,
    max_gps_accuracy_meters: 50,
    status: 'ACTIVE'
  });

  // Kiosk Management State
  const [registeredKiosks, setRegisteredKiosks] = useState([]);
  const [loadingKiosks, setLoadingKiosks] = useState(false);
  const [showNewKioskModal, setShowNewKioskModal] = useState(false);
  const [newKioskForm, setNewKioskForm] = useState({
    deviceId: '',
    deviceName: '',
    locationName: '',
    campusId: '',
    secretKey: ''
  });

  // Teacher Campus Assignments State
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [teachersList, setTeachersList] = useState([]);
  const [assignmentForm, setAssignmentForm] = useState({
    teacherId: '',
    campusId: '',
    isPrimary: true
  });

  const containerRef = useRef(null);
  const timerRef = useRef(null);
  const expiryDuration = 45;

  // Real-time Clock
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setError(null);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setError('CONNECTION LOST: Reconnecting to campus server...');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize Kiosk Credentials if in Kiosk Mode
  useEffect(() => {
    async function loadKioskAuth() {
      setCheckingKioskAuth(true);
      try {
        const creds = await KioskSecurityService.getKioskCredentials();
        if (creds && creds.deviceId) {
          setKioskCreds(creds);
          setShowPairingModal(false);
        } else if (isKioskMode) {
          setShowPairingModal(true);
        }
      } catch (err) {
        console.warn('Error reading kiosk security credentials:', err);
        if (isKioskMode) setShowPairingModal(true);
      } finally {
        setCheckingKioskAuth(false);
      }
    }

    loadKioskAuth();
  }, [isKioskMode]);

  // Load Admin Tab Data
  useEffect(() => {
    if (!isKioskMode) {
      if (activeTab === 'campuses') loadCampuses();
      if (activeTab === 'kiosks') {
        loadKiosks();
        loadCampuses();
      }
      if (activeTab === 'teachers') {
        loadAssignments();
        loadTeachers();
        loadCampuses();
      }
    }
  }, [activeTab, isKioskMode]);

  const loadCampuses = async () => {
    setLoadingCampuses(true);
    try {
      const data = await AttendanceVerificationService.getCampuses();
      setCampuses(data);
      if (data.length > 0 && !newKioskForm.campusId) {
        setNewKioskForm(prev => ({ ...prev, campusId: data[0].id }));
        setAssignmentForm(prev => ({ ...prev, campusId: data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load campuses:', err);
    } finally {
      setLoadingCampuses(false);
    }
  };

  const loadKiosks = async () => {
    setLoadingKiosks(true);
    try {
      const data = await AttendanceVerificationService.getKiosks();
      setRegisteredKiosks(data);
    } catch (err) {
      console.error('Failed to load kiosks:', err);
    } finally {
      setLoadingKiosks(false);
    }
  };

  const loadAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const data = await AttendanceVerificationService.getTeacherAssignments();
      setAssignments(data);
    } catch (err) {
      console.error('Failed to load teacher assignments:', err);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const loadTeachers = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, name, email').eq('role', 'teacher').eq('status', 'Active').order('name');
      setTeachersList(data || []);
      if (data && data.length > 0 && !assignmentForm.teacherId) {
        setAssignmentForm(prev => ({ ...prev, teacherId: data[0].id }));
      }
    } catch (err) {
      console.error('Failed to load teachers:', err);
    }
  };

  // Generate dynamic QR session
  const generateNewSession = async (type = actionType) => {
    if (isRevoked) return;
    if (!navigator.onLine) {
      setIsOffline(true);
      setError('CONNECTION LOST: Reconnecting to campus server...');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isKioskMode && kioskCreds?.deviceId) {
        // Dedicated Kiosk Device RPC
        const result = await AttendanceVerificationService.generateKioskQRSession({
          deviceId: kioskCreds.deviceId,
          secretKey: kioskCreds.secretKey,
          actionType: type,
          expirySeconds: expiryDuration
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to generate attendance QR');
        }

        setSession(result.session);
        setSecondsRemaining(expiryDuration);
        setSessionCount(prev => prev + 1);

        if (result.session.checkedInCount !== undefined) {
          setTodayStats(prev => ({
            ...prev,
            checkedIn: result.session.checkedInCount,
            checkedOut: result.session.checkedOutCount
          }));
        }
      } else {
        // Admin ERP Mode
        const result = await AttendanceVerificationService.generateQRSession(type, expiryDuration);
        if (!result.success) {
          throw new Error(result.error || 'Failed to generate attendance QR');
        }

        setSession(result.session);
        setSecondsRemaining(expiryDuration);
        setSessionCount(prev => prev + 1);
      }
    } catch (err) {
      console.error('QR Session generation error:', err);
      const errMsg = err.message || '';
      
      if (errMsg.includes('UNAUTHORIZED_KIOSK') || errMsg.includes('REVOKED') || errMsg.includes('not registered')) {
        setIsRevoked(true);
        setError('KIOSK AUTHORIZATION REVOKED: This physical tablet has been revoked or decommissioned by the school administration.');
      } else {
        setError(errMsg || 'Error generating dynamic QR session');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle device pairing form submit
  const handlePairDevice = async (e) => {
    e.preventDefault();
    setPairingError('');
    setPairingLoading(true);

    try {
      if (!pairingForm.deviceId.trim() || !pairingForm.secretKey.trim()) {
        throw new Error('Please enter both Device ID and Device Secret Key.');
      }

      await KioskSecurityService.saveKioskCredentials({
        deviceId: pairingForm.deviceId.trim(),
        secretKey: pairingForm.secretKey.trim(),
        locationName: pairingForm.locationName.trim() || 'School Campus Entrance',
        adminPin: pairingForm.adminPin.trim() || '8254'
      });

      const creds = await KioskSecurityService.getKioskCredentials();
      setKioskCreds(creds);
      setShowPairingModal(false);
      setIsRevoked(false);
      generateNewSession(actionType);
    } catch (err) {
      setPairingError(err.message || 'Failed to securely pair kiosk device.');
    } finally {
      setPairingLoading(false);
    }
  };

  // Handle Admin PIN verification for unlocking/exiting kiosk
  const handleVerifyExitPin = async (e) => {
    e.preventDefault();
    setExitError('');

    const isValid = await KioskSecurityService.verifyExitPin(exitPin);
    if (!isValid) {
      setExitError('Incorrect Admin PIN. Access denied.');
      return;
    }

    setShowExitModal(false);
    setExitPin('');
    window.location.href = '/login';
  };

  const handleUnpairKiosk = async () => {
    if (!window.confirm('Are you sure you want to unpair this physical tablet? Re-pairing will require the device secret key.')) {
      return;
    }
    await KioskSecurityService.wipeKioskCredentials();
    setKioskCreds(null);
    setShowExitModal(false);
    setShowPairingModal(true);
  };

  const handleActionChange = (newType) => {
    if (newType === actionType) return;
    setActionType(newType);
    generateNewSession(newType);
  };

  // Trigger initial session
  useEffect(() => {
    if (!checkingKioskAuth && (!isKioskMode || kioskCreds?.deviceId)) {
      generateNewSession(actionType);
    }
  }, [actionType, kioskCreds?.deviceId, checkingKioskAuth]);

  // Countdown timer for rotating QR
  useEffect(() => {
    if (!session || isRevoked || isOffline || activeTab !== 'display') return;

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
  }, [session?.token, actionType, isRevoked, isOffline, activeTab]);

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

  // Loading state
  if (checkingKioskAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3">
        <RefreshCw className="animate-spin text-emerald-400" size={32} />
        <p className="text-sm font-medium text-slate-400">Initializing Gyanoday Attendance System...</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between p-4 md:p-8 font-sans select-none relative overflow-hidden"
    >
      {/* Top Header Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-4 z-10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 shadow-inner">
            <School size={28} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2 text-white">
              Gyanoday Niketan
              <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {isKioskMode ? 'Attendance Tablet Kiosk' : 'Admin Portal'}
              </span>
            </h1>
            <p className="text-xs md:text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
              <MapPin size={13} className="text-emerald-400" />
              {session?.campusName ? (
                <span>Campus: <strong className="text-emerald-300 font-bold">{session.campusName}</strong> {session.deviceName ? `(${session.deviceName})` : ''}</span>
              ) : isKioskMode && kioskCreds ? (
                <span>Device: <strong className="text-slate-200">{kioskCreds.deviceId}</strong></span>
              ) : (
                <span>Multi-Campus Geofenced Attendance (Senior & Junior School)</span>
              )}
            </p>
          </div>
        </div>

        {/* Navigation / Mode Controls */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {!isKioskMode && (
            <div className="bg-slate-900/90 border border-slate-700/80 p-1 rounded-xl flex items-center gap-1 shadow-inner text-xs font-semibold">
              <button
                onClick={() => handleTabChange('display')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'display' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Live QR Display
              </button>
              <button
                onClick={() => handleTabChange('kiosks')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'kiosks' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Kiosk Devices
              </button>
              <button
                onClick={() => handleTabChange('campuses')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'campuses' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Campuses
              </button>
              <button
                onClick={() => handleTabChange('teachers')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'teachers' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                Staff Assignments
              </button>
            </div>
          )}

          {activeTab === 'display' && (
            <div className="bg-slate-900/90 border border-slate-700/80 p-1 rounded-xl flex items-center gap-1 shadow-inner">
              <button
                onClick={() => handleActionChange('CHECK_IN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${
                  isCheckIn 
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Sun size={14} /> Morning In
              </button>
              <button
                onClick={() => handleActionChange('CHECK_OUT')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold transition-all ${
                  !isCheckIn 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Moon size={14} /> Departure
              </button>
            </div>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-slate-300 hover:text-white rounded-xl transition-colors shadow-sm"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>

          {isKioskMode && (
            <button
              onClick={() => setShowExitModal(true)}
              className="p-2.5 bg-slate-800/80 hover:bg-rose-950/40 border border-slate-700/70 text-slate-400 hover:text-rose-300 rounded-xl transition-colors"
              title="Kiosk Security Lock / Exit"
            >
              <Lock size={18} />
            </button>
          )}
        </div>
      </header>

      {/* ==================================================================== */}
      {/* TAB 1: LIVE QR DISPLAY                                               */}
      {/* ==================================================================== */}
      {activeTab === 'display' && (
        <main className="my-auto py-6 flex flex-col items-center justify-center z-10">
          <div className="text-center max-w-xl mb-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-2 border backdrop-blur-md bg-slate-800/60 text-slate-300 border-slate-700/80">
              <ShieldCheck size={14} className={isCheckIn ? "text-emerald-400" : "text-blue-400"} />
              {session?.campusName ? `${session.campusName.toUpperCase()} • 150m GEOFENCE` : 'GYANODAY ATTENDANCE'}
            </div>

            <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase">
              {session?.campusName ? `${session.campusName} Kiosk` : 'Attendance Kiosk'}
            </h2>

            <p className="text-emerald-400 font-bold text-base md:text-lg mt-1">
              {isCheckIn ? 'TEACHER MORNING CHECK-IN' : 'TEACHER AFTERNOON CHECK-OUT'}
            </p>
            <p className="text-slate-400 text-xs md:text-sm mt-0.5">
              Open the Gyanoday app on your phone to scan this live dynamic code.
            </p>
          </div>

          {/* QR Container */}
          <div className="relative group">
            <div className={`absolute -inset-1 rounded-3xl blur-2xl opacity-40 transition-all duration-700 ${
              isRevoked ? 'bg-rose-600/40' : isOffline ? 'bg-amber-600/30' : isCheckIn ? 'bg-emerald-500/30' : 'bg-blue-500/30'
            }`} />

            <div className="relative bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center">
              <div className={`mb-4 px-5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border shadow-sm ${
                isRevoked
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : isOffline
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : isCheckIn 
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                      : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              }`}>
                {isRevoked ? 'DEVICE REVOKED' : isOffline ? 'CONNECTION LOST' : isCheckIn ? 'LIVE CHECK-IN TOKEN' : 'LIVE CHECK-OUT TOKEN'}
              </div>

              {/* QR Render */}
              <div className="bg-white p-5 rounded-2xl shadow-inner flex items-center justify-center min-w-[260px] min-h-[260px] md:min-w-[300px] md:min-h-[300px] relative">
                {isRevoked ? (
                  <div className="text-center p-4 max-w-[260px]">
                    <XCircle className="text-rose-600 mx-auto mb-2" size={44} />
                    <h3 className="text-sm font-black text-rose-950 uppercase tracking-wide">Device Revoked</h3>
                    <p className="text-xs text-rose-800 mt-1">
                      This tablet has been revoked by school administration. QR generation is permanently halted.
                    </p>
                  </div>
                ) : isOffline ? (
                  <div className="text-center p-4 max-w-[260px]">
                    <WifiOff className="text-amber-600 mx-auto mb-2 animate-bounce" size={44} />
                    <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">Connection Lost</h3>
                    <p className="text-xs text-amber-800 mt-1">
                      Reconnecting to school server... Dynamic QR sessions are paused to prevent invalid attendance.
                    </p>
                  </div>
                ) : loading && !session ? (
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

              {/* Countdown Ring */}
              <div className="w-full mt-5 flex items-center justify-between gap-4 text-xs font-semibold">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock size={15} className="text-emerald-400" />
                  <span>Auto-rotates in:</span>
                  <span className="font-mono text-white text-sm font-bold bg-slate-800 px-2 py-0.5 rounded-md">
                    {secondsRemaining}s
                  </span>
                </div>

                <div className="flex-1 max-w-[140px] h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div 
                    className={`h-full transition-all duration-1000 ${
                      secondsRemaining <= 10 ? 'bg-rose-500' : isCheckIn ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Anonymous Counters */}
          <div className="mt-6 flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-xl backdrop-blur-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="text-slate-400">Checked In:</span>
              <strong className="text-white font-bold">{todayStats.checkedIn}</strong>
            </div>
            <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-xl backdrop-blur-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
              <span className="text-slate-400">Checked Out:</span>
              <strong className="text-white font-bold">{todayStats.checkedOut}</strong>
            </div>
          </div>
        </main>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: KIOSK DEVICES MANAGEMENT                                      */}
      {/* ==================================================================== */}
      {activeTab === 'kiosks' && !isKioskMode && (
        <main className="my-auto py-4 max-w-5xl w-full mx-auto z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Tablet className="text-emerald-400" /> Attendance Kiosks
              </h2>
              <p className="text-sm text-slate-400">Physical tablet devices permanently bound to school campuses</p>
            </div>
            <button
              onClick={() => setShowNewKioskModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition-colors"
            >
              <Plus size={16} /> Register New Tablet
            </button>
          </div>

          {loadingKiosks ? (
            <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="animate-spin" size={20} /> Loading kiosks...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {registeredKiosks.map((kiosk) => (
                <div key={kiosk.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                          {kiosk.device_id}
                        </span>
                        <h3 className="text-lg font-bold text-white mt-1">{kiosk.device_name}</h3>
                        <p className="text-xs text-slate-400">{kiosk.location_name}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                        kiosk.status === 'ACTIVE' 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}>
                        {kiosk.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1 mt-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Bound Campus:</span>
                        <strong className="text-white">{kiosk.campus_name || 'Unassigned'}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Last Heartbeat:</span>
                        <span>{kiosk.last_heartbeat ? new Date(kiosk.last_heartbeat).toLocaleString() : 'Never'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2">
                    {kiosk.status === 'ACTIVE' ? (
                      <button
                        onClick={async () => {
                          if (window.confirm(`Revoke authorization for tablet ${kiosk.device_id}? It will stop generating QRs immediately.`)) {
                            await AttendanceVerificationService.revokeKiosk(kiosk.device_id);
                            loadKiosks();
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-bold rounded-lg transition-colors"
                      >
                        Revoke Kiosk
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          await AttendanceVerificationService.activateKiosk(kiosk.device_id);
                          loadKiosks();
                        }}
                        className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-300 text-xs font-bold rounded-lg transition-colors"
                      >
                        Activate Kiosk
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: CAMPUSES MANAGEMENT                                           */}
      {/* ==================================================================== */}
      {activeTab === 'campuses' && !isKioskMode && (
        <main className="my-auto py-4 max-w-5xl w-full mx-auto z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Building2 className="text-emerald-400" /> Campus Geofence Management
              </h2>
              <p className="text-sm text-slate-400">Configure separate GPS coordinates and radii for Senior & Junior Campuses</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {campuses.map((camp) => (
              <div key={camp.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2.5 py-1 rounded-md">
                      {camp.campus_id}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                      camp.status === 'ACTIVE' 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                        : 'bg-slate-700 text-slate-300 border-slate-600'
                    }`}>
                      {camp.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white">{camp.campus_name}</h3>

                  <div className="mt-4 space-y-2 text-xs bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Latitude:</span>
                      <strong className="font-mono text-slate-200">{camp.latitude}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Longitude:</span>
                      <strong className="font-mono text-slate-200">{camp.longitude}</strong>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Geofence Radius:</span>
                      <strong className="font-mono text-emerald-400">{camp.geofence_radius_meters} METRES</strong>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Max GPS Accuracy:</span>
                      <strong className="font-mono text-slate-300">{camp.max_gps_accuracy_meters}m</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex justify-end">
                  <button
                    onClick={() => {
                      setEditingCampus(camp);
                      setCampusForm({
                        campus_id: camp.campus_id,
                        campus_name: camp.campus_name,
                        latitude: camp.latitude.toString(),
                        longitude: camp.longitude.toString(),
                        geofence_radius_meters: camp.geofence_radius_meters,
                        max_gps_accuracy_meters: camp.max_gps_accuracy_meters,
                        status: camp.status
                      });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    <Edit2 size={13} /> Edit Coordinates & Radius
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Edit Campus Modal */}
          {editingCampus && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Building2 className="text-emerald-400" /> Edit {editingCampus.campus_name}
                </h3>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await AttendanceVerificationService.updateCampus({
                      campusId: campusForm.campus_id,
                      campusName: campusForm.campus_name,
                      latitude: parseFloat(campusForm.latitude),
                      longitude: parseFloat(campusForm.longitude),
                      radiusMeters: parseFloat(campusForm.geofence_radius_meters),
                      maxAccuracy: parseFloat(campusForm.max_gps_accuracy_meters),
                      status: campusForm.status
                    });
                    setEditingCampus(null);
                    loadCampuses();
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="text-xs text-slate-400">Campus Name</label>
                    <input 
                      type="text" 
                      value={campusForm.campus_name} 
                      onChange={e => setCampusForm({ ...campusForm, campus_name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Latitude</label>
                      <input 
                        type="number" 
                        step="any" 
                        value={campusForm.latitude} 
                        onChange={e => setCampusForm({ ...campusForm, latitude: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Longitude</label>
                      <input 
                        type="number" 
                        step="any" 
                        value={campusForm.longitude} 
                        onChange={e => setCampusForm({ ...campusForm, longitude: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400">Radius (METRES)</label>
                      <input 
                        type="number" 
                        value={campusForm.geofence_radius_meters} 
                        onChange={e => setCampusForm({ ...campusForm, geofence_radius_meters: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Status</label>
                      <select
                        value={campusForm.status}
                        onChange={e => setCampusForm({ ...campusForm, status: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCampus(null)}
                      className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                    >
                      Save Campus
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: TEACHER CAMPUS ASSIGNMENTS                                    */}
      {/* ==================================================================== */}
      {activeTab === 'teachers' && !isKioskMode && (
        <main className="my-auto py-4 max-w-5xl w-full mx-auto z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <UserCheck className="text-emerald-400" /> Staff Campus Assignments
              </h2>
              <p className="text-sm text-slate-400">Control which campus each teacher is authorized to scan attendance at</p>
            </div>
          </div>

          {/* Assignment Creator Form */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Assign Teacher to Campus</h4>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                await AttendanceVerificationService.assignTeacherCampus({
                  teacherId: assignmentForm.teacherId,
                  campusId: assignmentForm.campusId,
                  isPrimary: assignmentForm.isPrimary
                });
                loadAssignments();
              }}
              className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
            >
              <div>
                <label className="text-xs text-slate-400">Teacher</label>
                <select
                  value={assignmentForm.teacherId}
                  onChange={e => setAssignmentForm({ ...assignmentForm, teacherId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  required
                >
                  {teachersList.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Campus</label>
                <select
                  value={assignmentForm.campusId}
                  onChange={e => setAssignmentForm({ ...assignmentForm, campusId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  required
                >
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.campus_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pb-2">
                <input 
                  type="checkbox" 
                  id="isPrimaryCheck"
                  checked={assignmentForm.isPrimary} 
                  onChange={e => setAssignmentForm({ ...assignmentForm, isPrimary: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-800 text-emerald-500"
                />
                <label htmlFor="isPrimaryCheck" className="text-xs text-slate-300">Primary Campus</label>
              </div>

              <div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-colors"
                >
                  Assign Campus
                </button>
              </div>
            </form>
          </div>

          {/* Assignments Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Teacher</th>
                    <th className="p-3">Assigned Campus</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Primary</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {assignments.map(a => (
                    <tr key={a.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-semibold text-white">{a.teacher_name}</td>
                      <td className="p-3">
                        <span className="font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {a.campus_name}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                          {a.active ? 'ACTIVE' : 'REVOKED'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{a.is_primary ? 'Yes' : 'Secondary'}</td>
                      <td className="p-3 text-right">
                        {a.active && (
                          <button
                            onClick={async () => {
                              if (window.confirm(`Revoke campus assignment for ${a.teacher_name} at ${a.campus_name}?`)) {
                                await AttendanceVerificationService.revokeTeacherCampus({ teacherId: a.teacher_id, campusId: a.campus_id });
                                loadAssignments();
                              }
                            }}
                            className="text-rose-400 hover:text-rose-300 font-semibold"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {assignments.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-slate-500">
                        No custom assignments found. Teachers default to Senior School.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* Footer info */}
      <footer className="border-t border-slate-800/80 pt-4 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-2 z-10">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isRevoked ? 'bg-rose-500' : isOffline ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
          <span>
            {isRevoked 
              ? 'Tablet Decommissioned • Authorization Revoked' 
              : isOffline 
                ? 'Network Disconnected • Failing Closed' 
                : 'Multi-Campus Geofenced Anti-Spoofing Active'}
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-slate-400 text-sm">
          <span>{currentTime.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          <span className="font-bold text-white bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </footer>

      {/* Modal: Pair Kiosk Device */}
      {showPairingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Tablet size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Pair Attendance Kiosk</h3>
                <p className="text-xs text-slate-400">Configure dedicated school tablet</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              This tablet runs under a scoped device identity. The school server will automatically determine the campus from the registered device record.
            </p>

            {pairingError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                {pairingError}
              </div>
            )}

            <form onSubmit={handlePairDevice} className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Device ID</label>
                <input 
                  type="text"
                  value={pairingForm.deviceId}
                  onChange={(e) => setPairingForm({ ...pairingForm, deviceId: e.target.value })}
                  placeholder="e.g. GN-SENIOR-001 or GN-JUNIOR-001"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Location Description</label>
                <input 
                  type="text"
                  value={pairingForm.locationName}
                  onChange={(e) => setPairingForm({ ...pairingForm, locationName: e.target.value })}
                  placeholder="e.g. Senior Gate Entrance"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Device Secret Key</label>
                <input 
                  type="password"
                  value={pairingForm.secretKey}
                  onChange={(e) => setPairingForm({ ...pairingForm, secretKey: e.target.value })}
                  placeholder="Enter kiosk pairing secret"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider font-bold text-slate-400">Supervisor Exit PIN</label>
                <input 
                  type="password"
                  value={pairingForm.adminPin}
                  onChange={(e) => setPairingForm({ ...pairingForm, adminPin: e.target.value })}
                  placeholder="PIN to unlock/exit kiosk (e.g. 8254)"
                  maxLength={6}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={pairingLoading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-emerald-950 flex items-center justify-center gap-2"
                >
                  {pairingLoading ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <>
                      <KeyRound size={16} />
                      Pair & Activate Kiosk
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Exit PIN Verification */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock size={18} className="text-amber-400" />
                Supervisor Exit
              </h3>
              <button 
                onClick={() => { setShowExitModal(false); setExitError(''); setExitPin(''); }}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Enter the Supervisor Exit PIN to unlock this tablet and return to the login screen.
            </p>

            {exitError && (
              <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {exitError}
              </div>
            )}

            <form onSubmit={handleVerifyExitPin} className="space-y-4">
              <input 
                type="password"
                value={exitPin}
                onChange={(e) => setExitPin(e.target.value)}
                placeholder="Enter PIN"
                maxLength={6}
                autoFocus
                className="w-full px-3 py-2.5 text-center tracking-widest text-lg font-mono bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-amber-500"
              />

              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-sm transition-colors"
                >
                  Unlock Device
                </button>
                <button
                  type="button"
                  onClick={handleUnpairKiosk}
                  className="w-full py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 rounded-xl text-xs font-bold transition-colors"
                >
                  Unpair This Tablet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Register New Kiosk in Admin Portal */}
      {showNewKioskModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Tablet className="text-emerald-400" /> Register Tablet Kiosk
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await AttendanceVerificationService.registerKiosk({
                  deviceId: newKioskForm.deviceId,
                  deviceName: newKioskForm.deviceName,
                  locationName: newKioskForm.locationName,
                  campusId: newKioskForm.campusId,
                  secretKey: newKioskForm.secretKey
                });
                setShowNewKioskModal(false);
                loadKiosks();
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs text-slate-400">Device ID</label>
                <input 
                  type="text" 
                  value={newKioskForm.deviceId} 
                  onChange={e => setNewKioskForm({ ...newKioskForm, deviceId: e.target.value })}
                  placeholder="e.g. GN-SENIOR-002"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Device Name</label>
                <input 
                  type="text" 
                  value={newKioskForm.deviceName} 
                  onChange={e => setNewKioskForm({ ...newKioskForm, deviceName: e.target.value })}
                  placeholder="e.g. Senior Staff Room Tablet"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Location Description</label>
                <input 
                  type="text" 
                  value={newKioskForm.locationName} 
                  onChange={e => setNewKioskForm({ ...newKioskForm, locationName: e.target.value })}
                  placeholder="e.g. Senior Block Floor 1"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Campus Assignment</label>
                <select
                  value={newKioskForm.campusId}
                  onChange={e => setNewKioskForm({ ...newKioskForm, campusId: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  required
                >
                  {campuses.map(c => (
                    <option key={c.id} value={c.id}>{c.campus_name} ({c.campus_id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Secret Key</label>
                <input 
                  type="password" 
                  value={newKioskForm.secretKey} 
                  onChange={e => setNewKioskForm({ ...newKioskForm, secretKey: e.target.value })}
                  placeholder="Set secret for pairing"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewKioskModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceQRDisplay;
