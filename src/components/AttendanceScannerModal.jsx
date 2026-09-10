import React, { useState, useEffect } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { 
  X, MapPin, QrCode, CheckCircle2, AlertCircle, 
  RotateCcw, ShieldCheck, Loader2, Navigation, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  attendanceVerificationService, 
  getCurrentDevicePosition, 
  calculateHaversineDistance 
} from '../services/AttendanceVerificationService';

const AttendanceScannerModal = ({ isOpen, onClose, actionType = 'CHECK_IN', onSuccess }) => {
  const [step, setStep] = useState('LOCATING'); // LOCATING -> SCANNING -> VERIFYING -> SUCCESS -> ERROR
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('Acquiring high-precision GPS...');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorHint, setErrorHint] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [schoolConfig, setSchoolConfig] = useState(null);
  const [distanceMeters, setDistanceMeters] = useState(null);
  const [isProcessingScan, setIsProcessingScan] = useState(false);

  // Initialize and request GPS
  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setStep('LOCATING');
      setUserLocation(null);
      setErrorMessage('');
      setSuccessData(null);
      setIsProcessingScan(false);
      return;
    }

    let isMounted = true;

    async function initLocation() {
      setStep('LOCATING');
      setLocationStatus('Connecting to GPS satellites & campus geofence...');

      try {
        const config = await attendanceVerificationService.getSettings();
        if (!isMounted) return;
        setSchoolConfig(config);

        const pos = await getCurrentDevicePosition();
        if (!isMounted) return;

        setUserLocation(pos);

        // Calculate distance
        if (config.location?.latitude && config.location?.longitude) {
          const dist = calculateHaversineDistance(
            pos.latitude,
            pos.longitude,
            config.location.latitude,
            config.location.longitude
          );
          setDistanceMeters(dist);

          const maxRadius = config.location.allowed_radius_meters || 150;
          if (dist > maxRadius) {
            setStep('ERROR');
            setErrorMessage(`Outside School Geofence`);
            setErrorHint(`You are approximately ${Math.round(dist)}m away. Attendance must be marked within ${maxRadius}m of ${config.location.name || 'the school campus'}.`);
            return;
          }
        }

        setStep('SCANNING');
      } catch (err) {
        if (!isMounted) return;
        console.warn('Location detection issue:', err);

        if (err.message === 'LOCATION_PERMISSION_DENIED') {
          setStep('ERROR');
          setErrorMessage('Location Permission Denied');
          setErrorHint('Physical presence verification requires GPS permission. Please enable Location Services in your browser/device settings and reload.');
        } else if (err.message === 'LOCATION_TIMEOUT') {
          setStep('ERROR');
          setErrorMessage('GPS Acquisition Timeout');
          setErrorHint('Could not acquire your GPS location in time. Please move near a window or check your phone location settings, then retry.');
        } else {
          // Allow proceeding to scan if device has no GPS hardware, but inform user that server verification will check
          setLocationStatus('GPS unavailable. Proceeding with network verification...');
          setStep('SCANNING');
        }
      }
    }

    initLocation();

    return () => {
      isMounted = false;
    };
  }, [isOpen, actionType]);

  // Handle successful QR scan
  const handleScan = async (detectedCodes) => {
    if (isProcessingScan || step !== 'SCANNING') return;
    if (!detectedCodes || detectedCodes.length === 0) return;

    const rawValue = detectedCodes[0]?.rawValue || detectedCodes[0]?.value || '';
    if (!rawValue) return;

    setIsProcessingScan(true);
    setStep('VERIFYING');

    try {
      // Parse QR code payload
      let sessionToken = rawValue;
      try {
        const parsed = JSON.parse(rawValue);
        if (parsed.sessionToken) sessionToken = parsed.sessionToken;
        else if (parsed.token) sessionToken = parsed.token;
      } catch (e) {
        // Raw string token
      }

      const result = await attendanceVerificationService.verifyAndRecordAttendance({
        sessionToken,
        actionType,
        latitude: userLocation?.latitude || null,
        longitude: userLocation?.longitude || null,
        deviceInfo: navigator.userAgent
      });

      setSuccessData(result);
      setStep('SUCCESS');

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Attendance Verification Error:', err);
      setStep('ERROR');

      const msg = err.message || '';
      if (msg.includes('ALREADY_CHECKED_IN')) {
        setErrorMessage('Already Checked In Today');
        setErrorHint('Your attendance has already been recorded for today. You cannot check in twice.');
      } else if (msg.includes('ALREADY_CHECKED_OUT')) {
        setErrorMessage('Already Checked Out Today');
        setErrorHint('You have already completed your shift checkout for today.');
      } else if (msg.includes('NO_CHECK_IN_FOUND')) {
        setErrorMessage('No Morning Check-In Found');
        setErrorHint('You must have a verified Check-In before you can Check Out.');
      } else if (msg.includes('QR_EXPIRED')) {
        setErrorMessage('QR Code Expired');
        setErrorHint('The displayed school QR has expired. Please scan the current live QR code on the office screen.');
      } else if (msg.includes('QR_ACTION_MISMATCH')) {
        setErrorMessage('Wrong QR Code Type');
        setErrorHint(actionType === 'CHECK_IN' 
          ? 'You scanned a Check-Out QR code. Please scan the designated CHECK-IN QR.' 
          : 'You scanned a Check-In QR code. Please scan the designated CHECK-OUT QR.');
      } else if (msg.includes('GEOFENCE_EXCEEDED')) {
        setErrorMessage('Location Verification Failed');
        setErrorHint('Your device is detected outside the official school perimeter. Please scan the QR while physically inside the school.');
      } else if (msg.includes('CHECK_IN_WINDOW_CLOSED')) {
        setErrorMessage('Check-In Window Closed');
        setErrorHint('The morning check-in window has passed for today. Please contact the coordinator if you need an attendance correction.');
      } else if (msg.includes('CHECK_OUT_WINDOW_CLOSED')) {
        setErrorMessage('Check-Out Window Closed');
        setErrorHint('The afternoon check-out window is not open at this time.');
      } else {
        setErrorMessage('Verification Rejected');
        setErrorHint(err.message || 'The attendance record could not be verified. Please ensure you are scanning the official live QR screen.');
      }
    } finally {
      setIsProcessingScan(false);
    }
  };

  const handleRetry = () => {
    setErrorMessage('');
    setErrorHint('');
    setIsProcessingScan(false);
    setStep('LOCATING');
    // Trigger location re-detection
    getCurrentDevicePosition()
      .then((pos) => {
        setUserLocation(pos);
        setStep('SCANNING');
      })
      .catch((err) => {
        setStep('ERROR');
        setErrorMessage('Location Access Required');
        setErrorHint('Please allow location permission to verify your physical presence on campus.');
      });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 text-white">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${actionType === 'CHECK_IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <QrCode size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">
                {actionType === 'CHECK_IN' ? 'Teacher Check-In' : 'Teacher Check-Out'}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck size={13} className="text-emerald-400" />
                Verified Dynamic QR System
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 flex flex-col justify-center items-center overflow-y-auto">
          {/* STEP 1: LOCATING */}
          {step === 'LOCATING' && (
            <div className="flex flex-col items-center text-center py-8 space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin flex items-center justify-center"></div>
                <MapPin className="absolute inset-0 m-auto text-emerald-400 animate-pulse" size={32} />
              </div>
              <div className="space-y-1 max-w-xs">
                <h4 className="text-lg font-bold text-white">Verifying Location</h4>
                <p className="text-sm text-slate-400">{locationStatus}</p>
              </div>
              <div className="text-xs text-slate-500 px-4 py-2 bg-slate-800/60 rounded-full border border-slate-700/50 flex items-center gap-2">
                <Navigation size={12} className="text-brand-400" />
                Campus geofence: {schoolConfig?.location?.name || 'Gyanoday Niketan'} (150m)
              </div>
            </div>
          )}

          {/* STEP 2: SCANNING */}
          {step === 'SCANNING' && (
            <div className="w-full flex flex-col items-center space-y-4">
              <div className="w-full relative rounded-2xl overflow-hidden border-2 border-slate-700 bg-black shadow-inner aspect-square max-h-[300px]">
                <Scanner 
                  onScan={handleScan}
                  allowMultiple={false}
                  scanDelay={400}
                  styles={{
                    container: { width: '100%', height: '100%' },
                    video: { width: '100%', height: '100%', objectFit: 'cover' }
                  }}
                />
                {/* Target Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-emerald-400/80 rounded-2xl relative animate-pulse">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -mt-1 -ml-1 rounded-tl"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 -mt-1 -mr-1 rounded-tr"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -mb-1 -ml-1 rounded-bl"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 -mb-1 -mr-1 rounded-br"></div>
                  </div>
                </div>
              </div>

              {/* Status bar */}
              <div className="w-full flex items-center justify-between text-xs text-slate-400 px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Camera Active
                </span>
                {distanceMeters !== null && (
                  <span className="flex items-center gap-1 text-slate-300">
                    <MapPin size={12} className="text-brand-400" />
                    {distanceMeters}m from campus center
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 text-center">
                Point your camera at the live <strong>{actionType === 'CHECK_IN' ? 'CHECK-IN' : 'CHECK-OUT'}</strong> screen at the entrance or office.
              </p>
            </div>
          )}

          {/* STEP 3: VERIFYING */}
          {step === 'VERIFYING' && (
            <div className="flex flex-col items-center text-center py-10 space-y-4">
              <Loader2 className="w-16 h-16 text-emerald-400 animate-spin" />
              <div className="space-y-1">
                <h4 className="text-xl font-bold text-white">Validating QR with Server</h4>
                <p className="text-sm text-slate-400">Verifying security token, location, and authoritative timestamp...</p>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS */}
          {step === 'SUCCESS' && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center text-center py-6 space-y-5 w-full"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 shadow-xl shadow-emerald-500/10">
                <CheckCircle2 size={46} />
              </div>

              <div className="space-y-1">
                <span className="text-xs uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/15 px-3 py-1 rounded-full border border-emerald-500/30">
                  {actionType === 'CHECK_IN' ? 'Check-In Recorded' : 'Check-Out Completed'}
                </span>
                <h4 className="text-2xl font-black text-white pt-2">
                  {actionType === 'CHECK_IN' ? 'Welcome to School!' : 'Shift Complete!'}
                </h4>
                <p className="text-sm text-slate-300">
                  Attendance verified by school security server.
                </p>
              </div>

              {/* Receipt details */}
              <div className="w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 text-sm space-y-2.5 text-left">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Method:</span>
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <ShieldCheck size={14} /> Live Dynamic QR
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-semibold text-white">
                    {successData?.status || 'Present'}
                  </span>
                </div>
                {actionType === 'CHECK_IN' && successData?.checkInTime && (
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400">Recorded Check-In:</span>
                    <span className="font-mono font-bold text-white">
                      {new Date(successData.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                {actionType === 'CHECK_OUT' && (
                  <>
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">Recorded Check-Out:</span>
                      <span className="font-mono font-bold text-white">
                        {new Date(successData?.checkOutTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {successData?.workingHours && (
                      <div className="flex justify-between items-center text-slate-300 pt-1 border-t border-slate-700">
                        <span className="text-slate-400">Total Shift Duration:</span>
                        <span className="font-mono font-black text-emerald-400 text-base">
                          {successData.workingHours}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all text-sm"
              >
                Done
              </button>
            </motion.div>
          )}

          {/* STEP 5: ERROR */}
          {step === 'ERROR' && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center text-center py-6 space-y-4 w-full"
            >
              <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <AlertCircle size={36} />
              </div>

              <div className="space-y-1 max-w-xs">
                <h4 className="text-lg font-bold text-white">{errorMessage}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">{errorHint}</p>
              </div>

              <div className="w-full flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRetry}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <RotateCcw size={14} /> Try Again
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default AttendanceScannerModal;
