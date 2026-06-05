import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { findBestMatch } from '../../utils/matchingEngine';
import { CheckCircle, AlertTriangle, Upload, X, RefreshCw } from 'lucide-react';

import { processPdfFile } from '../../utils/pdfProcessor';

const BatchPhotoImport = ({ students, classes, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]); // Array of { extracted, match, status: 'pending'|'uploaded'|'skipped'|'error', photoUrl }

  const processResults = async (extractedDataList) => {
    // Match each extracted data to a student
    const matchedResults = extractedDataList.map(extracted => {
      const match = findBestMatch(extracted, students);
      
      // Check for duplicate
      let status = 'pending';
      if (match.student && match.student.picture_url) {
        status = 'duplicate';
      } else if (match.score >= 90) {
        status = 'auto_ready';
      }

      return {
        extracted,
        match,
        status,
        photoUrl: URL.createObjectURL(extracted.photoBlob)
      };
    });

    setResults(matchedResults);
    setProcessing(false);
    
    // Auto-upload the auto_ready ones
    const perfectMatches = matchedResults.filter(r => r.status === 'auto_ready');
    
    // Auto-process perfect matches immediately (sequentially, once)
    if (perfectMatches.length > 0) {
      setTimeout(async () => {
        for (const item of perfectMatches) {
          // Re-fetch the item to get the latest status if needed, or just upload
          await handleUpload(item, false);
        }
      }, 500);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer?.files[0] || e.target.files?.[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
    } else {
      alert("Please upload a valid PDF file.");
    }
  };

  const handleStartProcessing = async () => {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setResults([]);
    
    try {
      const buffer = await file.arrayBuffer();
      const extractedResults = await processPdfFile(buffer, (p) => {
        setProgress(p);
      });
      
      if (extractedResults.length === 0) {
        alert("No photos could be extracted from this PDF. The text or image formatting might not match the expected structure.");
        setProcessing(false);
        return;
      }
      
      processResults(extractedResults);
    } catch (error) {
      alert("Error processing PDF: " + error.message);
      setProcessing(false);
    }
  };

  const handleUpload = async (item, isManual) => {
    try {
      const { extracted, match } = item;
      const student = match.student;
      
      if (!student) return;

      const fileExt = extracted.photoBlob.type === 'image/png' ? 'png' : 'jpg';
      const fileName = `${student.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('student-profiles')
        .upload(fileName, extracted.photoBlob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('student-profiles')
        .getPublicUrl(fileName);

      const pictureUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase
        .from('students')
        .update({ picture_url: pictureUrl })
        .eq('id', student.id);

      if (dbError) throw dbError;

      // Log Audit
      await supabase.from('photo_audit_logs').insert([{
        student_id: student.id,
        extracted_name: extracted.name,
        extracted_uid: extracted.uid,
        confidence_score: match.score,
        match_type: match.type,
        action_taken: isManual ? 'Manual-Approved' : 'Auto-Uploaded'
      }]);

      setResults(prev => prev.map(r => r === item ? { ...r, status: 'uploaded' } : r));
      
      if (onUploadSuccess) {
        onUploadSuccess(student.id, pictureUrl);
      }

    } catch (err) {
      console.error(err);
      setResults(prev => prev.map(r => r === item ? { ...r, status: 'error' } : r));
    }
  };

  return (
    <div className="bento-card" style={{ padding: '2rem' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
        Batch Photo Import (Intelligent Match)
      </h3>
      
      {!file && (
        <div 
          onDragOver={e => e.preventDefault()}
          onDrop={handleFileDrop}
          style={{ 
            border: '2px dashed var(--border-color)', 
            padding: '3rem', 
            textAlign: 'center',
            borderRadius: '0.5rem',
            background: '#f8fafc',
            cursor: 'pointer'
          }}
          onClick={() => document.getElementById('pdf-upload').click()}
        >
          <Upload size={48} style={{ margin: '0 auto 1rem', color: '#94a3b8' }} />
          <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Drag and drop ID Card PDF here</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>or click to browse</p>
          <input type="file" id="pdf-upload" accept=".pdf" style={{ display: 'none' }} onChange={handleFileDrop} />
        </div>
      )}

      {file && !processing && results.length === 0 && (
        <div className="flex flex-col items-center gap-4 p-6 bg-blue-50 rounded-lg">
          <p style={{ fontWeight: 500 }}>Selected: {file.name}</p>
          <div className="flex gap-4">
            <button className="btn-hero-primary" onClick={handleStartProcessing}>Start Processing</button>
            <button className="btn-hero-outline" onClick={() => setFile(null)}>Cancel</button>
          </div>
        </div>
      )}

      {processing && (
        <div className="p-6 text-center">
          <RefreshCw className="animate-spin mb-4" size={32} style={{ margin: '0 auto', color: 'var(--primary-color)' }} />
          <p>Analyzing PDF and Matching Students... {progress}%</p>
          <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', marginTop: '1rem' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary-color)', borderRadius: '4px', transition: 'width 0.3s' }}></div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h4 style={{ fontWeight: 700 }}>Review Queue</h4>
            <div className="flex gap-4 text-sm font-medium">
              <span className="text-success">{results.filter(r => r.status === 'uploaded' || r.status === 'auto_ready').length} Uploaded</span>
              <span className="text-warning">{results.filter(r => r.status === 'pending' || r.status === 'duplicate').length} Needs Review</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {results.map((item, idx) => (
              <div key={idx} style={{ 
                border: '1px solid #e2e8f0', 
                borderRadius: '0.5rem', 
                overflow: 'hidden',
                background: item.status === 'uploaded' ? '#f0fdf4' : 'white'
              }}>
                <div style={{ padding: '1rem', display: 'flex', gap: '1rem' }}>
                  <img src={item.photoUrl} alt="Extracted" style={{ width: '80px', height: '100px', objectFit: 'cover', borderRadius: '0.25rem' }} />
                  <div style={{ flex: 1, fontSize: '0.9rem' }}>
                    <p style={{ fontWeight: 700, color: 'var(--primary-color)' }}>PDF Data:</p>
                    <p>{item.extracted.name || 'No Name'}</p>
                    <p>UID: {item.extracted.uid || 'N/A'}</p>
                    <p>Class: {item.extracted.className} {item.extracted.sec}</p>
                  </div>
                </div>
                
                <div style={{ background: '#f8fafc', padding: '1rem', borderTop: '1px solid #e2e8f0' }}>
                  {item.match.student ? (
                    <>
                      <div className="flex justify-between items-center mb-2">
                        <p style={{ fontWeight: 700 }}>Match: {item.match.student.name}</p>
                        <span style={{ 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '1rem', 
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          background: item.match.score >= 90 ? '#dcfce7' : '#fef08a',
                          color: item.match.score >= 90 ? '#166534' : '#854d0e'
                        }}>
                          {item.match.score}% ({item.match.type})
                        </span>
                      </div>
                      
                      {item.status === 'duplicate' && (
                        <div className="mb-4 p-2 bg-yellow-50 text-yellow-800 text-sm rounded border border-yellow-200">
                          <AlertTriangle size={14} className="inline mr-1" />
                          Student already has a photo.
                        </div>
                      )}

                      {item.status === 'uploaded' && (
                        <p className="text-success font-bold flex items-center gap-1"><CheckCircle size={16}/> Uploaded</p>
                      )}

                      {(item.status === 'pending' || item.status === 'duplicate') && (
                        <div className="flex gap-2 mt-3">
                          <button 
                            className="btn-hero-primary" 
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                            onClick={() => handleUpload(item, true)}
                          >
                            {item.status === 'duplicate' ? 'Overwrite' : 'Approve'}
                          </button>
                          <button 
                            className="btn-hero-outline" 
                            style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                            onClick={() => setResults(prev => prev.map(r => r === item ? { ...r, status: 'skipped' } : r))}
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-2">
                      <p className="text-danger font-bold text-sm mb-2">No Match Found</p>
                      <select 
                        className="input-field" 
                        style={{ padding: '0.4rem', fontSize: '0.8rem', width: '100%', marginBottom: '0.5rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                        onChange={(e) => {
                          const student = students.find(s => s.id === e.target.value);
                          if (student) {
                            setResults(prev => prev.map(r => r === item ? { ...r, match: { score: 100, type: 'Manual Selection', student }, status: student.picture_url ? 'duplicate' : 'pending' } : r));
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Manually assign to student...</option>
                        {students.filter(s => {
                          // Try to filter by the class found in the PDF if possible
                          if (!item.extracted.className) return true;
                          const sCls = classes.find(c => c.id === s.class_id);
                          return sCls && sCls.name.includes(item.extracted.className);
                        }).sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                          <option key={s.id} value={s.id}>{s.name} (Roll: {s.roll_no})</option>
                        ))}
                      </select>
                      
                      <button 
                        className="btn-hero-outline w-full" 
                        style={{ padding: '0.4rem', fontSize: '0.85rem' }}
                        onClick={() => setResults(prev => prev.map(r => r === item ? { ...r, status: 'skipped' } : r))}
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-8 text-center">
             <button className="btn-hero-outline" onClick={() => { setFile(null); setResults([]); }}>Process Another File</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchPhotoImport;
