import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import QRCode from 'react-qr-code';
import html2pdf from 'html2pdf.js';
import { Users, Printer, Loader2, Save } from 'lucide-react';

const IDCardGenerator = ({ classes, students: globalStudents, fetchStats }) => {
  const [selectedClass, setSelectedClass] = useState('all');
  const [sessionText, setSessionText] = useState('2026-2027');
  const [studentsList, setStudentsList] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  
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

  const generatePDF = async () => {
    const selectedStudents = studentsList.filter(s => selectedStudentIds.has(s.id));
    if (selectedStudents.length === 0) return alert("Please select at least one student!");
    
    setIsGenerating(true);
    
    const element = document.getElementById('id-card-print-container');
    element.style.display = 'block';
    
    const opt = {
      margin:       [10, 10, 10, 10], 
      filename:     `ID_Cards_${selectedClass === 'all' ? 'All' : 'Class'}.pdf`,
      image:        { type: 'jpeg', quality: 1.0 },
      html2canvas:  { scale: 4, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: 'css', after: '.page-break-after' }
    };

    try {
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error(error);
      alert("Error generating PDF!");
    } finally {
      element.style.display = 'none';
      setIsGenerating(false);
    }
  };

  const selectedStudents = studentsList.filter(s => selectedStudentIds.has(s.id));
  const cardsPerPage = 9;
  const pages = [];
  for (let i = 0; i < selectedStudents.length; i += cardsPerPage) {
    pages.push(selectedStudents.slice(i, i + cardsPerPage));
  }

  const getClassName = (classId) => {
    const c = classes.find(c => c.id === classId);
    return c ? `${c.name} ${c.section}`.trim() : 'Unknown';
  };

  return (
    <div className="bento-card" style={{ padding: '2rem' }}>
      <div className="flex justify-between items-center mb-6" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Student ID Card Generator</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Design, preview, and generate print-ready vertical ID Cards.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            className="btn-hero-primary flex items-center gap-2" 
            style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1.5rem' }}
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
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '0.5rem' }}
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
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '0.5rem' }}
            value={sessionText}
            onChange={(e) => setSessionText(e.target.value)}
            placeholder="e.g. 2026-2027 or 31/03/2027"
          />
        </div>
      </div>

      <div style={{ maxHeight: '400px', overflowY: 'auto', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
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
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>Student</th>
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
                <td style={{ padding: '1rem' }}>
                  <div className="flex items-center gap-3">
                    <img 
                      src={s.picture_url ? `${s.picture_url}?t=${Date.now()}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=random`} 
                      alt={s.name} 
                      style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                    />
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
        <Save size={14} /> Note: Edits made in this table are automatically saved to the database when you click outside the box.
      </div>

      <div id="id-card-print-container" style={{ display: 'none', background: 'white' }}>
        {pages.map((pageStudents, pageIndex) => (
          <div key={pageIndex} className="page-break-after" style={{ width: '210mm', height: '297mm', padding: '10mm', boxSizing: 'border-box', pageBreakAfter: 'always', background: 'white' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 54mm)', gridAutoRows: '85.6mm', gap: '10mm', justifyContent: 'center', alignContent: 'start' }}>
              {pageStudents.map(student => (
                <div key={student.id} style={{ 
                  width: '54mm', 
                  height: '85.6mm', 
                  border: '1px solid #cbd5e1', 
                  borderRadius: '3mm', 
                  boxSizing: 'border-box', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  overflow: 'hidden',
                  position: 'relative',
                  backgroundColor: '#ffffff'
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '30mm', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', zIndex: 0 }}></div>
                  
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2mm 2mm 0 2mm' }}>
                    <div style={{ background: 'white', padding: '1mm', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '1mm' }}>
                      <img src="/logo.png" alt="Logo" style={{ width: '8mm', height: '8mm', objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none'; }} />
                    </div>
                    <h1 style={{ fontSize: '7.5pt', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '0.2px', textAlign: 'center' }}>GYANODAY NIKETAN</h1>
                    
                    <div style={{ fontSize: '3.5pt', color: 'white', textAlign: 'center', marginTop: '0.5mm', lineHeight: '1.2' }}>
                      Shyam Cottage, P.O. Rose Bank, Darjeeling-734101<br/>
                      Ph: (0354) 2258311 | gyanodayniketan.edu.in
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5mm 1.5mm', borderRadius: '2mm', marginTop: '1.5mm' }}>
                      <p style={{ fontSize: '4pt', color: '#ffffff', margin: 0, textAlign: 'center', fontWeight: 600 }}>STUDENT IDENTITY CARD</p>
                    </div>
                  </div>

                  <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', marginTop: '0.5mm' }}>
                    <div style={{ padding: '0.5mm', background: 'white', borderRadius: '1mm', boxShadow: '0 2px 5px rgba(0,0,0,0.15)' }}>
                      <img 
                        src={student.picture_url ? `${student.picture_url}?t=${Date.now()}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=random`} 
                        alt="Photo" 
                        style={{ width: '16mm', height: '20mm', objectFit: 'cover', borderRadius: '0.5mm' }}
                      />
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5mm 3mm', alignItems: 'center', zIndex: 1, marginTop: '0.5mm' }}>
                    <h2 style={{ fontSize: '8pt', fontWeight: 800, color: '#0f172a', margin: '0 0 1.5mm 0', textAlign: 'center', lineHeight: '1.1' }}>
                      {student.name}
                    </h2>

                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.7mm' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '17mm 1fr', fontSize: '4.5pt', lineHeight: '1' }}>
                        <span style={{ color: '#475569', fontWeight: 600 }}>Class & Sec :</span>
                        <span style={{ color: '#0f172a', fontWeight: 700 }}>{getClassName(student.class_id)}</span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '17mm 1fr', fontSize: '4.5pt', lineHeight: '1' }}>
                        <span style={{ color: '#475569', fontWeight: 600 }}>Admission No :</span>
                        <span style={{ color: '#0f172a', fontWeight: 700 }}>{student.uid || 'N/A'}</span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '17mm 1fr', fontSize: '4.5pt', lineHeight: '1' }}>
                        <span style={{ color: '#475569', fontWeight: 600 }}>D.O.B :</span>
                        <span style={{ color: '#0f172a', fontWeight: 700 }}>{student.dob || 'N/A'}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '17mm 1fr', fontSize: '4.5pt', lineHeight: '1' }}>
                        <span style={{ color: '#475569', fontWeight: 600 }}>Blood Group :</span>
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>{student.blood_group || 'N/A'}</span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '17mm 1fr', fontSize: '4.5pt', lineHeight: '1' }}>
                        <span style={{ color: '#475569', fontWeight: 600 }}>Guardian :</span>
                        <span style={{ color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.father_name || 'N/A'}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '17mm 1fr', fontSize: '4.5pt', lineHeight: '1' }}>
                        <span style={{ color: '#475569', fontWeight: 600 }}>Contact :</span>
                        <span style={{ color: '#0f172a', fontWeight: 700 }}>{student.contact_number || 'N/A'}</span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '17mm 1fr', fontSize: '4.5pt', lineHeight: '1' }}>
                        <span style={{ color: '#475569', fontWeight: 600 }}>Address :</span>
                        <span style={{ color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.address || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '1mm 3mm', marginTop: 'auto', borderTop: '0.5px solid #e2e8f0', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ padding: '0.5mm', background: 'white', borderRadius: '0.5mm', border: '0.5px solid #cbd5e1', display: 'flex' }}>
                        <QRCode value={student.id} size={32} level="M" />
                      </div>
                      <span style={{ fontSize: '3pt', color: '#64748b', marginTop: '0.5mm' }}>Scan ID</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '15mm', borderBottom: '0.5px dotted #64748b', marginBottom: '1mm', height: '6mm', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                        <span style={{ fontFamily: 'cursive', fontSize: '4pt', color: '#0f172a' }}>Director</span>
                      </div>
                      <span style={{ fontSize: '4pt', color: '#64748b', fontWeight: 600 }}>Director's Signature</span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#1e3a8a', height: '4mm' }}>
                     <span style={{ fontSize: '3.5pt', color: 'white', fontWeight: 500, letterSpacing: '0.5px' }}>Session: {sessionText}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IDCardGenerator;
