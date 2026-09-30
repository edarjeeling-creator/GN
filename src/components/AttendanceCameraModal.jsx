import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, CameraOff, X, RefreshCw, Zap, ZapOff, Upload, 
  Check, AlertTriangle, Loader2, Sparkles, FileText, Calendar
} from 'lucide-react';
import { Button } from './ui/Button';

export default function AttendanceCameraModal({
  isOpen,
  onClose,
  onPhotoCaptured,
  selectedClassName = '',
  selectedDate = '',
  defaultScanMode = 'month'
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const nativeCameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [scanMode, setScanMode] = useState(defaultScanMode);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' = rear camera
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [capturedFile, setCapturedFile] = useState(null);

  // Stop camera stream safely
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          if (track.readyState === 'live') {
            track.stop();
          }
        } catch (e) {
          console.warn('Error stopping camera track:', e);
        }
      });
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchOn(false);
    setHasTorch(false);
  }, []);

  // Start live camera stream
  const startCamera = useCallback(async (mode = facingMode) => {
    stopStream();
    setCameraError(null);

    // If mediaDevices not supported (e.g. non-HTTPS or very old browser)
    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('Live camera preview is not supported on this browser. Please use your device camera or upload a photo.');
      return;
    }

    try {
      const constraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 3840, min: 1280 },
          height: { ideal: 2160, min: 720 },
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(e => console.warn('Video play interrupted:', e));
      }

      setCameraActive(true);

      // Check for torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }
    } catch (err) {
      console.warn('Could not start live camera:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access was denied. Please enable camera permissions in your browser or use the Device Camera button below.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera hardware was detected on this device. Please choose an image file.');
      } else {
        setCameraError('Could not start live camera. You can still snap a photo with your device camera using the button below.');
      }
    }
  }, [facingMode, stopStream]);

  // When modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(null);
      setCapturedFile(null);
      startCamera(facingMode);
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, startCamera, stopStream, facingMode]);

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current || !hasTorch) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchOn(nextState);
      } catch (e) {
        console.warn('Torch toggle failed:', e);
      }
    }
  };

  // Flip camera between rear and front
  const flipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Capture photo from live video feed
  const capturePhotoFromStream = async () => {
    if (!videoRef.current || !streamRef.current) return;
    setIsCapturing(true);

    try {
      const track = streamRef.current.getVideoTracks()[0];
      let imageBlob = null;

      // Try modern ImageCapture API for highest hardware resolution
      if (typeof window !== 'undefined' && 'ImageCapture' in window && track) {
        try {
          const imageCapture = new window.ImageCapture(track);
          imageBlob = await imageCapture.takePhoto();
        } catch (e) {
          console.warn('ImageCapture failed, falling back to canvas grab:', e);
        }
      }

      // Fallback: Grab from video frame onto canvas
      if (!imageBlob) {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      }

      if (imageBlob) {
        const file = new File([imageBlob], `attendance_${selectedDate || 'scan'}_${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });

        const url = URL.createObjectURL(imageBlob);
        setPreviewUrl(url);
        setCapturedFile(file);
        stopStream();
      }
    } catch (err) {
      console.error('Error capturing photo:', err);
      alert('Failed to capture photo from video. Please use the Device Camera button instead.');
    } finally {
      setIsCapturing(false);
    }
  };

  // Handle file from native camera or gallery
  const handleNativeFileInput = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCapturedFile(file);
    stopStream();

    // Reset input
    e.target.value = '';
  };

  // Confirm photo and send to AI
  const confirmAndAnalyze = () => {
    if (capturedFile) {
      onPhotoCaptured(capturedFile, scanMode);
      onClose();
    }
  };

  // Retake photo
  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setCapturedFile(null);
    startCamera(facingMode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] text-white"
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400">
              <Camera size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base leading-tight flex items-center gap-1.5">
                Scan Attendance Register
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-brand-600/30 text-brand-300 px-2 py-0.5 rounded-full border border-brand-500/20">
                  <Sparkles size={10} /> AI Vision
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedClassName ? `${selectedClassName} • ` : ''}{scanMode === 'month' ? 'Full Month Register Scan' : (selectedDate ? `Date: ${selectedDate}` : 'Take a photo of paper register')}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close camera"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scan Mode Selector */}
        <div className="px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="font-semibold text-slate-400">Scan Mode:</span>
            <span className="text-[11px] text-brand-300 font-medium">
              {scanMode === 'month' 
                ? 'Extracts all active dates across the monthly register page' 
                : `Extracts selected single date (${selectedDate || 'Today'})`}
            </span>
          </div>
          <div className="flex bg-slate-900 p-0.5 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setScanMode('month')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                scanMode === 'month'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar size={13} />
              <span>Full Month</span>
            </button>
            <button
              type="button"
              onClick={() => setScanMode('day')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                scanMode === 'day'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText size={13} />
              <span>Single Day</span>
            </button>
          </div>
        </div>

        {/* Viewport Area */}
        <div className="relative flex-1 min-h-[320px] sm:min-h-[420px] bg-black flex items-center justify-center overflow-hidden">
          {previewUrl ? (
            /* Captured Photo Preview */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-2 bg-black">
              <img 
                src={previewUrl} 
                alt="Captured attendance register" 
                className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-lg border border-slate-800" 
              />
              <div className="absolute top-4 left-4 bg-slate-900/85 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-emerald-400 flex items-center gap-1.5">
                <Check size={14} /> 
                <span>{scanMode === 'month' ? 'Photo Ready • Full Month Register' : `Photo Ready • Single Day (${selectedDate})`}</span>
              </div>
            </div>
          ) : cameraActive ? (
            /* Live Camera Stream */
            <div className="relative w-full h-full min-h-[320px] sm:min-h-[420px] flex items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full min-h-[320px] sm:min-h-[420px] object-cover" 
              />

              {/* Document Alignment Overlay Box */}
              <div className="absolute inset-4 sm:inset-8 border-2 border-dashed border-brand-400/70 rounded-2xl pointer-events-none flex flex-col justify-between p-3 sm:p-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                {/* Corner guide accents */}
                <div className="flex justify-between">
                  <div className="w-5 h-5 border-t-2 border-l-2 border-brand-400 -mt-1 -ml-1"></div>
                  <div className="w-5 h-5 border-t-2 border-r-2 border-brand-400 -mt-1 -mr-1"></div>
                </div>
                <div className="text-center bg-black/60 backdrop-blur-sm mx-auto px-3 py-1.5 rounded-full text-xs text-slate-200 border border-white/10">
                  {scanMode === 'month'
                    ? 'Align the entire register page (students & all date columns) inside frame'
                    : 'Align the register column & student list inside this frame'}
                </div>
                <div className="flex justify-between">
                  <div className="w-5 h-5 border-b-2 border-l-2 border-brand-400 -mb-1 -ml-1"></div>
                  <div className="w-5 h-5 border-b-2 border-r-2 border-brand-400 -mb-1 -mr-1"></div>
                </div>
              </div>

              {/* Live Overlay Quick Action Buttons */}
              <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2.5 rounded-full backdrop-blur transition-all ${
                      torchOn ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/50' : 'bg-slate-900/80 text-white hover:bg-slate-800'
                    }`}
                    title={torchOn ? 'Turn off flash' : 'Turn on flash'}
                  >
                    {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
                  </button>
                )}
                <button
                  onClick={flipCamera}
                  className="p-2.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 backdrop-blur transition-colors"
                  title="Flip camera (front / rear)"
                >
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>
          ) : cameraError ? (
            /* Camera Error / Permission Fallback View */
            <div className="p-6 text-center max-w-sm flex flex-col items-center">
              <div className="p-3.5 rounded-2xl bg-amber-500/10 text-amber-400 mb-3 border border-amber-500/20">
                <AlertTriangle size={32} />
              </div>
              <h4 className="text-base font-bold text-white mb-1.5">Camera Preview Unavailable</h4>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                {cameraError}
              </p>
              <div className="w-full space-y-2.5">
                <Button
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white font-semibold py-2.5 shadow-md flex items-center justify-center gap-2"
                >
                  <Camera size={16} /> Open Phone Camera App
                </Button>
                <Button
                  onClick={() => galleryInputRef.current?.click()}
                  variant="secondary"
                  className="w-full border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 flex items-center justify-center gap-2"
                >
                  <Upload size={16} /> Select Photo from Files
                </Button>
              </div>
            </div>
          ) : (
            /* Loading Camera */
            <div className="flex flex-col items-center gap-3 text-slate-400 p-8">
              <Loader2 size={36} className="animate-spin text-brand-400" />
              <p className="text-sm font-medium text-slate-300">Activating camera viewfinder...</p>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-col gap-3">
          {previewUrl ? (
            /* Actions when photo is captured */
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleRetake}
                className="flex-1 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 h-11"
              >
                <RefreshCw size={16} className="mr-1.5" /> Retake Photo
              </Button>
              <Button
                onClick={confirmAndAnalyze}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 shadow-lg shadow-emerald-900/30"
              >
                <Check size={18} className="mr-1.5" /> Analyze with AI
              </Button>
            </div>
          ) : (
            /* Actions when live camera is scanning */
            <div className="flex items-center justify-between gap-3">
              {/* Gallery / File Button */}
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex flex-col items-center gap-1 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors text-[11px]"
                title="Choose from gallery or files"
              >
                <Upload size={18} />
                <span>Gallery</span>
              </button>

              {/* Main Shutter Capture Button */}
              <button
                onClick={capturePhotoFromStream}
                disabled={!cameraActive || isCapturing}
                className="w-16 h-16 rounded-full border-4 border-white/80 hover:border-white bg-brand-600 hover:bg-brand-500 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center shadow-xl shadow-brand-600/30"
                title="Take photo of attendance register"
              >
                {isCapturing ? (
                  <Loader2 size={24} className="animate-spin text-white" />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center text-slate-900 shadow-inner">
                    <Camera size={20} />
                  </div>
                )}
              </button>

              {/* Device Native Camera App Shortcut */}
              <button
                onClick={() => nativeCameraInputRef.current?.click()}
                className="flex flex-col items-center gap-1 text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg transition-colors text-[11px]"
                title="Use phone native camera app"
              >
                <Camera size={18} />
                <span>Camera App</span>
              </button>
            </div>
          )}

          {/* Hidden file inputs for direct device camera & gallery fallback */}
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={nativeCameraInputRef} 
            onChange={handleNativeFileInput} 
            className="hidden" 
          />
          <input 
            type="file" 
            accept="image/*" 
            ref={galleryInputRef} 
            onChange={handleNativeFileInput} 
            className="hidden" 
          />
        </div>
      </motion.div>
    </div>
  );
}
