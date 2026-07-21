import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import QRCode from 'react-qr-code';
import html2pdf from 'html2pdf.js';
import { Users, Printer, Loader2, Save, Upload, Image as ImageIcon } from 'lucide-react';

const IDCardGenerator = ({ classes, students: globalStudents, fetchStats }) => {
  const [selectedClass, setSelectedClass] = useState('all');
  const [sessionText, setSessionText] = useState('2026-2027');
  const [studentsList, setStudentsList] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(null);
  const [uploadingPhotoId, setUploadingPhotoId] = useState(null);
  const [customLogoUrl, setCustomLogoUrl] = useState(null);
  const fileInputRefs = useRef({});

  useEffect(() => {
    const fetchSignature = async () => {
      const { data } = await supabase.from('school_settings').select('setting_value').eq('setting_key', 'principal_signature_url').single();
      if (data) setSignatureUrl(data.setting_value);
    };
    fetchSignature();
  }, []);

  useEffect(() => {
    let filtered = globalStudents;
    if (selectedClass !== 'all') {
      filtered = globalStudents.filter(s => s.class_id === selectedClass);
    }
    filtered = [...filtered].sort((a,b) => {
      if (a.class_id !== b.class_id) return a.class_id.localeCompare(b.class_id);
      return a.roll_no - b.roll_no;
    });
    setStudentsList(filtered);
    setSelectedStudentIds(new Set(filtered.map(s => s.id)));
  }, [selectedClass, globalStudents]);

  const toggleSelectAll = () => {
    if (selectedStudentIds.size === studentsList.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(studentsList.map(s => s.id)));
    }
  };

  const toggleStudent = (id) => {
    const newSet = new Set(selectedStudentIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudentIds(newSet);
  };

  const handleFieldChange = (studentId, field, value) => {
    setStudentsList(prev => prev.map(s => s.id === studentId ? { ...s, [field]: value } : s));
  };

  const saveStudentDetails = async (studentId) => {
    const s = studentsList.find(st => st.id === studentId);
    if (!s) return;
    
    try {
      const { error } = await supabase.from('students').update({
        father_name: s.father_name || null,
        dob: s.dob || null,
        blood_group: s.blood_group || null,
        contact_number: s.contact_number || null,
        address: s.address || null
      }).eq('id', studentId);
      
      if (error) {
        if (error.message.includes("could not find the column")) {
          alert("Database Error: It looks like the new columns haven't been added to your database yet. Please run the SQL Migration script provided earlier in the Supabase SQL Editor!");
        } else {
          alert("Error saving: " + error.message);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCustomLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCustomLogoUrl(URL.createObjectURL(file));
      alert("Custom logo loaded successfully! Click 'Generate PDF' to see it on the ID cards.");
    }
  };

  const handlePhotoUpload = async (studentId, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhotoId(studentId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${studentId}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('student-profiles').upload(fileName, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('student-profiles').getPublicUrl(fileName);
      
      const { error: updateError } = await supabase.from('students').update({ picture_url: publicUrl }).eq('id', studentId);
      if (updateError) throw updateError;
      
      setStudentsList(prev => prev.map(s => s.id === studentId ? { ...s, picture_url: publicUrl } : s));
      alert("Student photo updated successfully! It will now appear perfectly on the ID card.");
    } catch (err) {
      alert('Error uploading photo: ' + err.message);
    } finally {
      setUploadingPhotoId(null);
    }
  };

  const generatePDF = async () => {
    const selectedStudents = studentsList.filter(s => selectedStudentIds.has(s.id));
    if (selectedStudents.length === 0) return alert("Please select at least one student!");
    
    setIsGenerating(true);
    
    const element = document.getElementById('id-card-print-container');
    element.style.display = 'block';
    
    const opt = {
      margin:       0,
      filename:     `ID_Cards_${selectedClass === 'all' ? 'All' : 'Class'}.pdf`,
      image:        { type: 'jpeg', quality: 1.0 },
      html2canvas:  { scale: 3, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: [54, 86], orientation: 'portrait' }
    };

    try {
      let worker = html2pdf().set(opt);
      
      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        const cardElement = document.getElementById(`id-card-${student.id}`);
        
        if (i === 0) {
          worker = worker.from(cardElement).toPdf();
        } else {
          worker = worker.get('pdf').then(pdf => {
            pdf.addPage();
          }).from(cardElement).toContainer().toCanvas().toPdf();
        }
      }
      
      await worker.save();
    } catch (error) {
      console.error(error);
      alert("Error generating PDF!");
    } finally {
      element.style.display = 'none';
      setIsGenerating(false);
    }
  };

  const selectedStudents = studentsList.filter(s => selectedStudentIds.has(s.id));

  const getClassName = (classId) => {
    const c = classes.find(c => c.id === classId);
    return c ? `${c.name} ${c.section}`.trim() : 'Unknown';
  };

  const generateQRData = (student) => {
    const payload = {
      type: "student",
      id: student.id,
      uid: student.uid || student.id,
      signature: btoa(student.id + "GN-SECURE").substring(0, 10)
    };
    return JSON.stringify(payload);
  };

  return (
    <div className="bento-card" style={{ padding: '2rem' }}>
      <div className="flex justify-between items-center mb-6" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Student ID Card Generator</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Design, preview, and generate print-ready vertical ID Cards.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="btn-hero-secondary flex items-center gap-2 cursor-pointer" style={{ background: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 500 }}>
            {customLogoUrl ? <img src={customLogoUrl} style={{ width: 18, height: 18, objectFit: 'contain' }} alt="Logo" /> : <ImageIcon size={18} />}
            {customLogoUrl ? 'Logo Selected' : 'Replace Logo'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCustomLogoUpload} />
          </label>
          <button 
            className="btn-hero-primary flex items-center gap-2" 
            style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600 }}
            onClick={generatePDF}
            disabled={isGenerating || selectedStudentIds.size === 0}
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Printer size={18} />}
            {isGenerating ? 'Generating...' : `Generate PDF (${selectedStudentIds.size})`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-600">Select Class</label>
          <select 
            className="input-field" 
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '0.5rem', color: '#1e293b' }}
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </select>
        </div>
        
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-600">Global Session / Valid Up To</label>
          <input 
            type="text"
            className="input-field" 
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '0.5rem', color: '#1e293b' }}
            value={sessionText}
            onChange={(e) => setSessionText(e.target.value)}
            placeholder="e.g. 2026-2027 or 31/03/2027"
          />
        </div>
      </div>

      <div style={{ maxHeight: '400px', overflowY: 'auto', overflowX: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ width: '100%', minWidth: '1000px' }}>
          <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ padding: '1rem', borderBottom: '2px solid #e2e8f0', width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={selectedStudentIds.size === studentsList.length && studentsList.length > 0} 
                  onChange={toggleSelectAll} 
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0', width: '220px' }}>Student (Upload Photo)</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Father's Name</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0', width: '120px' }}>D.O.B</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0', width: '100px' }}>Blood G.</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Contact</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Address</th>
            </tr>
          </thead>
          <tbody>
            {studentsList.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: selectedStudentIds.has(s.id) ? '#f0f9ff' : 'white' }}>
                <td style={{ padding: '1rem' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedStudentIds.has(s.id)} 
                    onChange={() => toggleStudent(s.id)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                </td>
                <td style={{ padding: '0.5rem 1rem' }}>
                  <div className="flex items-center gap-3">
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={s.picture_url ? `${s.picture_url}?t=${Date.now()}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`} 
                        alt={s.name} 
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      <button 
                        onClick={() => fileInputRefs.current[s.id]?.click()}
                        style={{ position: 'absolute', bottom: -5, right: -5, background: 'white', border: '1px solid #cbd5e1', borderRadius: '50%', padding: '2px', cursor: 'pointer', zIndex: 5 }}
                        title="Upload new photo"
                      >
                        {uploadingPhotoId === s.id ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} color="#3b82f6" />}
                      </button>
                      <input 
                        type="file" 
                        accept="image/*" 
                        ref={el => fileInputRefs.current[s.id] = el}
                        style={{ display: 'none' }}
                        onChange={(e) => handlePhotoUpload(s.id, e)}
                      />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{getClassName(s.class_id)} • R:{s.roll_no} • {s.uid}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input type="text" className="input-field" style={{ padding: '0.4rem', fontSize: '0.875rem' }} placeholder="Father's Name" value={s.father_name || ''} onChange={(e) => handleFieldChange(s.id, 'father_name', e.target.value)} onBlur={() => saveStudentDetails(s.id)} />
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input type="text" className="input-field" style={{ padding: '0.4rem', fontSize: '0.875rem' }} placeholder="DD/MM/YYYY" value={s.dob || ''} onChange={(e) => handleFieldChange(s.id, 'dob', e.target.value)} onBlur={() => saveStudentDetails(s.id)} />
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input type="text" className="input-field" style={{ padding: '0.4rem', fontSize: '0.875rem' }} placeholder="O+" value={s.blood_group || ''} onChange={(e) => handleFieldChange(s.id, 'blood_group', e.target.value)} onBlur={() => saveStudentDetails(s.id)} />
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input type="text" className="input-field" style={{ padding: '0.4rem', fontSize: '0.875rem' }} placeholder="Phone No." value={s.contact_number || ''} onChange={(e) => handleFieldChange(s.id, 'contact_number', e.target.value)} onBlur={() => saveStudentDetails(s.id)} />
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <input type="text" className="input-field" style={{ padding: '0.4rem', fontSize: '0.875rem' }} placeholder="Address" value={s.address || ''} onChange={(e) => handleFieldChange(s.id, 'address', e.target.value)} onBlur={() => saveStudentDetails(s.id)} />
                </td>
              </tr>
            ))}
            {studentsList.length === 0 && (
              <tr>
                <td colSpan="7" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>No students found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Save size={14} /> Note: Click the blue upload icon next to a student's face to quickly fix bad photos!
      </div>

      {/* Hidden Print Container for PDF Generation - Strict Absolute Positioning to guarantee NO blank pages and NO overlaps */}
      <div id="id-card-print-container" style={{ display: 'none', background: 'white' }}>
        {selectedStudents.map((student, index) => (
          <React.Fragment key={student.id}>
            <div id={`id-card-${student.id}`} style={{ 
              position: 'relative',
              width: '54mm', 
              height: '86mm',
              backgroundColor: '#ffffff',
              overflow: 'hidden'
            }}>
              {/* 1. Header (Deep Blue) */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '54mm', height: '20mm', background: 'linear-gradient(135deg, #0f172a, #1d4ed8)', zIndex: 1 }}></div>
              <div style={{ position: 'absolute', top: '20mm', left: 0, width: '54mm', height: '0.8mm', background: '#f59e0b', zIndex: 1 }}></div>

              {/* Background Watermark */}
              <div style={{ position: 'absolute', top: '30mm', left: '9mm', width: '36mm', height: '36mm', opacity: 0.06, backgroundImage: `url(${customLogoUrl || "/logo.png"})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', zIndex: 0 }}></div>

              {/* 2. Header Content Area */}
              <div style={{ position: 'absolute', top: '1.5mm', left: 0, width: '54mm', textAlign: 'center', zIndex: 2 }}>
                <img src={customLogoUrl || "/logo.png"} alt="Logo" style={{ width: '9mm', height: '9mm', objectFit: 'contain', margin: '0 auto', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }} onError={(e) => { e.target.style.display = 'none'; }} />
                <div style={{ fontSize: '6.5pt', fontFamily: "'Inter', sans-serif", fontWeight: 800, color: '#ffffff', marginTop: '0.5mm', letterSpacing: '0.2px', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}>GYANODAY NIKETAN</div>
                <div style={{ fontSize: '3.5pt', fontFamily: "'Inter', sans-serif", color: '#fbbf24', fontWeight: 700, marginTop: '0.5mm', letterSpacing: '0.5px' }}>STUDENT IDENTITY CARD</div>
              </div>

              {/* 3. Student Photo (Overlapping Header) */}
              <div style={{ position: 'absolute', top: '15mm', left: '19mm', width: '16mm', height: '19mm', padding: '0.5mm', background: 'white', borderRadius: '1.5mm', boxShadow: '0 4px 6px rgba(0,0,0,0.15)', border: '0.3mm solid #f59e0b', zIndex: 3 }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '1mm', backgroundColor: '#f1f5f9', overflow: 'hidden' }}>
                  <img 
                    src={student.picture_url ? `${student.picture_url}?t=${Date.now()}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`} 
                    alt="Photo" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </div>

              {/* 4. Student Details Section */}
              <div style={{ position: 'absolute', top: '36mm', left: '2mm', width: '50mm', zIndex: 2, fontFamily: "'Inter', sans-serif" }}>
                <div style={{ fontSize: '7.5pt', fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: '1.5mm', textTransform: 'uppercase', letterSpacing: '-0.1px' }}>
                  {student.name}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8mm', fontSize: '4.5pt', lineHeight: '1.2' }}>
                  <div style={{ display: 'flex', width: '100%' }}>
                    <div style={{ width: '16mm', color: '#475569', fontWeight: 600 }}>Class & Sec</div>
                    <div style={{ width: '2mm', color: '#475569' }}>:</div>
                    <div style={{ flex: 1, color: '#0f172a', fontWeight: 700 }}>{getClassName(student.class_id)}</div>
                  </div>
                  
                  <div style={{ display: 'flex', width: '100%' }}>
                    <div style={{ width: '16mm', color: '#475569', fontWeight: 600 }}>Admission No</div>
                    <div style={{ width: '2mm', color: '#475569' }}>:</div>
                    <div style={{ flex: 1, color: '#0f172a', fontWeight: 700 }}>{student.uid || 'N/A'}</div>
                  </div>
                  
                  <div style={{ display: 'flex', width: '100%' }}>
                    <div style={{ width: '16mm', color: '#475569', fontWeight: 600 }}>D.O.B</div>
                    <div style={{ width: '2mm', color: '#475569' }}>:</div>
                    <div style={{ flex: 1, color: '#0f172a', fontWeight: 700 }}>{student.dob || 'N/A'}</div>
                  </div>

                  <div style={{ display: 'flex', width: '100%' }}>
                    <div style={{ width: '16mm', color: '#475569', fontWeight: 600 }}>Blood Group</div>
                    <div style={{ width: '2mm', color: '#475569' }}>:</div>
                    <div style={{ flex: 1, color: '#dc2626', fontWeight: 800 }}>{student.blood_group || 'N/A'}</div>
                  </div>
                  
                  <div style={{ display: 'flex', width: '100%' }}>
                    <div style={{ width: '16mm', color: '#475569', fontWeight: 600 }}>Guardian</div>
                    <div style={{ width: '2mm', color: '#475569' }}>:</div>
                    <div style={{ flex: 1, color: '#0f172a', fontWeight: 700, whiteSpace: 'normal', wordBreak: 'break-word' }}>{student.father_name || 'N/A'}</div>
                  </div>

                  <div style={{ display: 'flex', width: '100%' }}>
                    <div style={{ width: '16mm', color: '#475569', fontWeight: 600 }}>Contact</div>
                    <div style={{ width: '2mm', color: '#475569' }}>:</div>
                    <div style={{ flex: 1, color: '#0f172a', fontWeight: 700 }}>{student.contact_number || 'N/A'}</div>
                  </div>
                  
                  <div style={{ display: 'flex', width: '100%' }}>
                    <div style={{ width: '16mm', color: '#475569', fontWeight: 600 }}>Address</div>
                    <div style={{ width: '2mm', color: '#475569' }}>:</div>
                    <div style={{ flex: 1, color: '#0f172a', fontWeight: 700, whiteSpace: 'normal', wordBreak: 'break-word' }}>{student.address || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* 5. Footer Area (QR Code & Signature) */}
              <div style={{ position: 'absolute', top: '70mm', left: '0', width: '54mm', height: '13mm', background: '#f8fafc', borderTop: '0.5px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1mm 4mm 2mm 4mm', boxSizing: 'border-box', zIndex: 2, fontFamily: "'Inter', sans-serif" }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ padding: '0.5mm', background: 'white', borderRadius: '0.5mm', border: '0.5px solid #cbd5e1', display: 'flex', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <QRCode value={generateQRData(student)} size={22} level="L" />
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <div style={{ width: '18mm', height: '7mm', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '0.5mm' }}>
                    {signatureUrl ? (
                       <img src={signatureUrl} alt="Principal Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                       <span style={{ fontFamily: "'Dancing Script', cursive", fontSize: '4pt', color: '#0f172a' }}>Principal</span>
                    )}
                  </div>
                  <span style={{ fontSize: '3.5pt', color: '#1e293b', fontWeight: 700, borderTop: '0.5px solid #94a3b8', width: '100%', textAlign: 'center', paddingTop: '0.5mm' }}>Principal</span>
                </div>
              </div>
              
              {/* 6. Bottom Session Strip */}
              <div style={{ position: 'absolute', top: '83mm', left: '0', width: '54mm', height: '3mm', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4mm', boxSizing: 'border-box', zIndex: 2, fontFamily: "'Inter', sans-serif" }}>
                 <span style={{ fontSize: '2.5pt', color: '#cbd5e1', fontWeight: 600 }}>Valid Upto: 31/03/{sessionText.includes('-') ? sessionText.split('-')[1] : '2027'}</span>
                 <span style={{ fontSize: '2.5pt', color: '#fbbf24', fontWeight: 700, letterSpacing: '0.5px' }}>SESSION: {sessionText}</span>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default IDCardGenerator;
