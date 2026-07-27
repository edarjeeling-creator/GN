import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle, AlertTriangle, Upload, User, Phone, Image as ImageIcon, ArrowRight, ArrowLeft } from 'lucide-react';
import '../index.css';

const PublicIDForm = () => {
  const { role, id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [validationData, setValidationData] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    father_name: '',
    dob: '',
    blood_group: '',
    contact_number: '',
    address: ''
  });

  // Photo State
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoMeta, setPhotoMeta] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError("No secure token provided.");
      setLoading(false);
      return;
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('validate_form_token', { p_token: token });
      
      if (rpcError) throw rpcError;
      
      if (!data.valid) {
        if (data.outcome === 'EXPIRED_TOKEN') setError("This secure link has expired. Please request a new one.");
        else if (data.outcome === 'DUPLICATE_SUBMISSION') setError("Your ID details have already been submitted successfully.");
        else setError("This secure link is invalid or tampered with.");
      } else {
        if (role === 'student' && data.class_id) {
           try {
             const { data: classData, error: classError } = await supabase.from('classes').select('name, section').eq('id', data.class_id).single();
             if (classData && !classError) {
               data.class_name = `${classData.name} ${classData.section || ''}`.trim();
             }
           } catch (e) {
             console.error("Failed to fetch class details", e);
           }
        }
        setValidationData(data);
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while validating your link. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const processImage = (file) => {
    setPhotoError('');
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPhotoError("Please upload a valid JPG or PNG image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("File is too large. Maximum allowed size is 10MB before compression.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Validation of image integrity
        if (img.width === 0 || img.height === 0) {
          setPhotoError("Invalid image file.");
          return;
        }

        const TARGET_WIDTH = 600;
        const TARGET_HEIGHT = 800;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Calculate crop to fill 600x800 ratio
        const imgRatio = img.width / img.height;
        const targetRatio = TARGET_WIDTH / TARGET_HEIGHT;
        
        let drawWidth = img.width;
        let drawHeight = img.height;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > targetRatio) {
          drawWidth = img.height * targetRatio;
          offsetX = (img.width - drawWidth) / 2;
        } else {
          drawHeight = img.width / targetRatio;
          offsetY = (img.height - drawHeight) / 2;
        }

        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        
        // Fill white background for transparent PNGs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
        
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);
        
        // Export to JPEG 85%
        canvas.toBlob((blob) => {
          if (!blob) {
            setPhotoError("Error compressing image.");
            return;
          }
          
          setPhotoFile(blob);
          setPhotoPreview(URL.createObjectURL(blob));
          setPhotoMeta({
            width: TARGET_WIDTH,
            height: TARGET_HEIGHT,
            size: blob.size,
            mimeType: 'image/jpeg'
          });
        }, 'image/jpeg', 0.85);
      };
      
      img.onerror = () => {
        setPhotoError("The file appears to be corrupted or not a valid image.");
      };
      
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (role === 'student' && !formData.father_name.trim()) return alert("Father's Name is required.");
      if (!formData.dob) return alert("Date of Birth is required.");
      if (!formData.blood_group) return alert("Blood Group is required.");
    }
    if (currentStep === 2) {
      if (!formData.contact_number.trim() || formData.contact_number.length < 10) return alert("Valid Contact Number is required.");
      if (!formData.address.trim()) return alert("Address is required.");
    }
    if (currentStep === 3 && role !== 'student') {
      if (!photoFile) return alert("Please upload a passport size photograph.");
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let picturePath = null;
      let photoMetaPayload = {};

      if (role !== 'student') {
        if (!photoFile) throw new Error("Photo is required for teachers");
        const bucket = 'teacher-profiles';
        const fileExt = 'jpg';
        const fileName = `${token}.${fileExt}`;
        const filePath = `${id}/${fileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, photoFile, {
            cacheControl: '3600',
            upsert: true
          });
          
        if (uploadError) throw uploadError;

        picturePath = supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
        photoMetaPayload = {
          photo_width: photoMeta?.width,
          photo_height: photoMeta?.height,
          photo_size_bytes: photoMeta?.size,
          photo_mime_type: photoMeta?.mimeType
        };
      }

      // 2. Submit Data via RPC
      const payload = {
        ...formData,
        ...(picturePath && { picture_path: picturePath }),
        ...photoMetaPayload
      };

      const { data: rpcData, error: submitError } = await supabase.rpc('submit_id_form', {
        p_token: token,
        p_data: payload
      });

      if (submitError) throw submitError;

      if (!rpcData.success) {
        throw new Error(`Submission rejected: ${rpcData.outcome}`);
      }

      setSubmitSuccess(true);
    } catch (err) {
      console.error(err);
      alert("Error submitting form: " + err.message + "\nPlease try again or contact the administrator.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Thank You!</h2>
          <p className="text-slate-400 mb-6">Your ID card details have been submitted successfully.</p>
          <div className="p-4 bg-slate-900/50 rounded-lg text-sm text-slate-300">
            You may now safely close this page.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:items-center md:justify-center p-4">
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full md:h-auto">
        <div className="bg-slate-800/50 p-6 border-b border-slate-800 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
          <img src="/gnlogo.png" alt="Logo" className="h-12 w-12 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white">ID Card Information</h1>
          <p className="text-sm text-slate-400 mt-1">Gyanoday Niketan School</p>
        </div>

        <div className="flex px-6 pt-6 gap-2">
          {Array.from({ length: role === 'student' ? 3 : 4 }).map((_, idx) => {
            const step = idx + 1;
            return (
              <div key={step} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                currentStep >= step ? 'bg-blue-500' : 'bg-slate-800'
              }`} />
            );
          })}
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6 flex gap-4 items-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="text-white font-semibold">{validationData.name}</div>
              <div className="text-sm text-blue-300 font-medium">
                {role === 'student' 
                  ? `Class: ${validationData.class_name || 'N/A'} • Adm No: ${validationData.admission_no}`
                  : `${validationData.designation} • ID: ${validationData.employee_id}`
                }
              </div>
            </div>
          </div>

          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-bold text-white mb-4">① Personal Details</h2>
              
              {role === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Father's Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="father_name"
                    value={formData.father_name}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Enter full name"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors style-date-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Blood Group <span className="text-red-500">*</span></label>
                <select
                  name="blood_group"
                  value={formData.blood_group}
                  onChange={handleInputChange}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">Select Blood Group</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-bold text-white mb-4">② Contact Details</h2>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Mobile Number <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="tel"
                    name="contact_number"
                    value={formData.contact_number}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="10-digit mobile number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Residential Address <span className="text-red-500">*</span></label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                  placeholder="Enter full address"
                />
              </div>
            </div>
          )}

          {currentStep === 3 && role !== 'student' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-bold text-white mb-2">③ Photograph</h2>
              
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4 mb-4">
                <ul className="text-sm text-blue-200/80 space-y-2 list-disc pl-4">
                  <li>Upload a recent passport-size photograph</li>
                  <li>Plain, light-colored background</li>
                  <li>Face must be clearly visible</li>
                  <li>No sunglasses or caps</li>
                </ul>
              </div>

              <input 
                type="file" 
                accept="image/jpeg, image/png"
                capture="environment"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => processImage(e.target.files[0])}
              />

              {!photoPreview ? (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-48 border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950 rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors group"
                >
                  <div className="w-12 h-12 bg-slate-800 group-hover:bg-blue-500/20 rounded-full flex items-center justify-center transition-colors">
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <div className="text-center">
                    <div className="text-white font-medium">Tap to Upload Photo</div>
                    <div className="text-xs text-slate-500 mt-1">or take a picture with camera</div>
                  </div>
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="relative group rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-lg">
                      <img src={photoPreview} alt="Preview" className="w-[180px] h-[240px] object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-white/20 hover:bg-white/30 backdrop-blur text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Change Photo
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-medium bg-green-400/10 py-2 px-4 rounded-lg mx-auto w-fit">
                    <CheckCircle className="w-4 h-4" />
                    This photo will appear on your ID card
                  </div>
                </div>
              )}

              {photoError && (
                <div className="text-red-400 text-sm flex items-start gap-2 bg-red-400/10 p-3 rounded-lg">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {photoError}
                </div>
              )}
            </div>
          )}

          {currentStep === (role === 'student' ? 3 : 4) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <h2 className="text-lg font-bold text-white mb-2">
                {role === 'student' ? '③ Review Details' : '④ Review Details'}
              </h2>
              <p className="text-slate-400 text-sm mb-4">Please verify your information before submitting.</p>
              
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800/50">
                {role === 'student' && (
                  <div className="p-4 flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Father's Name</span>
                    <span className="text-white">{formData.father_name}</span>
                  </div>
                )}
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Date of Birth</span>
                  <span className="text-white">{formData.dob}</span>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Blood Group</span>
                  <span className="text-white">{formData.blood_group}</span>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Contact Number</span>
                  <span className="text-white">{formData.contact_number}</span>
                </div>
                <div className="p-4 flex flex-col gap-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Address</span>
                  <span className="text-white">{formData.address}</span>
                </div>
                {role !== 'student' && (
                  <div className="p-4 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Photograph</span>
                    <img src={photoPreview} alt="Preview thumbnail" className="w-12 h-16 object-cover rounded border border-slate-700" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-900 flex gap-4 mt-auto">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={isSubmitting}
              className="flex-1 py-3.5 px-4 rounded-xl border border-slate-700 text-white font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          )}
          
          {currentStep < (role === 'student' ? 3 : 4) ? (
            <button
              onClick={handleNext}
              className="flex-[2] py-3.5 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
            >
              Next
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-[2] py-3.5 px-4 rounded-xl bg-green-600 text-white font-medium hover:bg-green-500 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirm & Submit
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .style-date-input::-webkit-calendar-picker-indicator {
          filter: invert(1);
          opacity: 0.5;
          cursor: pointer;
        }
      `}} />
    </div>
  );
};

export default PublicIDForm;
