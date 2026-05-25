import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadFile, deleteFile } from '../lib/storage';
import { useAuth } from '../context/AuthContext';
import { FileText, Upload, CheckCircle, Clock, Loader2, Link as LinkIcon } from 'lucide-react';
import { useData } from '../context/DataContext';

const Assignments = () => {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Student Upload State
  const [uploading, setUploading] = useState(false);
  const [studentForm, setStudentForm] = useState({
    subject: '',
    title: '',
    message: '',
    file: null
  });

  // Teacher Review State
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    remarks: '',
    marks: '',
    correctedFile: null
  });
  const [reviewUploading, setReviewUploading] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, [profile]);

  const fetchAssignments = async () => {
    if (!profile) return;
    setLoading(true);
    let query = supabase.from('assignments').select('*, profiles!student_uid(name, class, section, roll_no)').order('submitted_at', { ascending: false });
    
    if (profile.role === 'teacher') {
      // Teachers see all assignments submitted to them OR we can just show all assignments for subjects they teach
      // For simplicity in this demo, teachers see all assignments since there isn't a direct mapping in the DB schema for teacher_uid initially.
      // Wait, schema has teacher_uid which can be null initially, let's just fetch all assignments for teachers for now, or match by subject.
      // We will just fetch all for now and they can filter.
    } else if (profile.role === 'student') {
      query = query.eq('student_uid', profile.id);
    }

    const { data } = await query;
    if (data) setAssignments(data);
    setLoading(false);
  };

  const handleStudentUpload = async (e) => {
    e.preventDefault();
    if (!studentForm.file) return alert('Please select a file');

    setUploading(true);
    const { url, error } = await uploadFile(studentForm.file, `assignments/student_${profile.id}`);
    
    if (error) {
      alert('Upload failed: ' + error.message);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('assignments').insert([{
      student_uid: profile.id,
      subject: studentForm.subject,
      title: studentForm.title,
      message: studentForm.message,
      file_url: url
    }]);

    if (!dbError) {
      alert('Assignment submitted successfully!');
      setStudentForm({ subject: '', title: '', message: '', file: null });
      fetchAssignments();
    } else {
      alert('Error submitting to database: ' + dbError.message);
    }
    setUploading(false);
  };

  const handleTeacherReview = async (e, id) => {
    e.preventDefault();
    setReviewUploading(true);
    
    let correctedUrl = null;
    if (reviewForm.correctedFile) {
       const { url, error } = await uploadFile(reviewForm.correctedFile, `assignments/teacher_reviews/${id}`);
       if (!error) correctedUrl = url;
    }

    const updateData = {
      status: 'reviewed',
      teacher_remarks: reviewForm.remarks,
      marks: reviewForm.marks ? parseFloat(reviewForm.marks) : null,
      reviewed_at: new Date().toISOString(),
      teacher_uid: profile.id
    };

    if (correctedUrl) updateData.corrected_file_url = correctedUrl;

    const { error } = await supabase.from('assignments').update(updateData).eq('id', id);

    if (!error) {
      alert('Review submitted successfully!');
      setReviewingId(null);
      setReviewForm({ remarks: '', marks: '', correctedFile: null });
      fetchAssignments();
    } else {
      alert('Error saving review: ' + error.message);
    }
    
    setReviewUploading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <FileText size={32} className="text-primary" />
        <h1 className="text-2xl font-bold">Assignments</h1>
      </div>

      {profile?.role === 'student' && (
        <div className="card p-6 bg-white shadow-sm rounded-lg mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Upload size={20} /> Submit Assignment</h2>
          <form onSubmit={handleStudentUpload} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1">Subject</label>
              <input required type="text" placeholder="e.g. Science" className="input-field w-full" value={studentForm.subject} onChange={e => setStudentForm({...studentForm, subject: e.target.value})} />
            </div>
            <div>
              <label className="block font-bold mb-1">Assignment Title</label>
              <input required type="text" placeholder="e.g. Lab Report 1" className="input-field w-full" value={studentForm.title} onChange={e => setStudentForm({...studentForm, title: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block font-bold mb-1">Message (Optional)</label>
              <textarea className="input-field w-full" rows="2" value={studentForm.message} onChange={e => setStudentForm({...studentForm, message: e.target.value})}></textarea>
            </div>
            <div className="md:col-span-2">
              <label className="block font-bold mb-1">Select File (PDF, DOCX, etc)</label>
              <input required type="file" className="w-full p-2 border rounded" onChange={e => setStudentForm({...studentForm, file: e.target.files[0]})} />
            </div>
            <div className="md:col-span-2 mt-2">
              <button type="submit" className="btn btn-primary w-full" disabled={uploading}>
                {uploading ? <Loader2 className="animate-spin inline mr-2" size={18} /> : null}
                {uploading ? 'Uploading...' : 'Submit Assignment'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-6 bg-white shadow-sm rounded-lg">
        <h2 className="text-xl font-bold mb-4">Assignment History</h2>
        {loading ? <Loader2 className="animate-spin mx-auto text-primary" /> : assignments.length === 0 ? <p className="text-gray-500">No assignments found.</p> : (
          <div className="flex flex-col gap-4">
            {assignments.map(assign => (
              <div key={assign.id} className="border p-4 rounded-lg bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-primary">{assign.title}</h3>
                    <p className="text-sm font-bold text-gray-500">{assign.subject}</p>
                    {profile?.role === 'teacher' && assign.profiles && (
                       <p className="text-sm mt-1 text-gray-700">
                         <strong>Student:</strong> {assign.profiles.name} ({assign.profiles.class}-{assign.profiles.section}, Roll {assign.profiles.roll_no})
                       </p>
                    )}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1 ${assign.status === 'reviewed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {assign.status === 'reviewed' ? <CheckCircle size={14} /> : <Clock size={14} />}
                    {assign.status}
                  </div>
                </div>
                
                {assign.message && <p className="text-sm text-gray-600 mb-3 bg-white p-2 border rounded"><strong>Message:</strong> {assign.message}</p>}
                
                <a href={assign.file_url} target="_blank" rel="noopener noreferrer" className="text-primary font-bold text-sm flex items-center gap-1 hover:underline mb-4">
                  <LinkIcon size={14} /> View Student Submission
                </a>

                {/* Feedback Section */}
                {assign.status === 'reviewed' ? (
                  <div className="bg-green-50 p-3 rounded border border-green-200 text-sm">
                    <p className="font-bold text-green-800 mb-1">Teacher Feedback:</p>
                    <p className="text-green-900 mb-2">{assign.teacher_remarks || 'No remarks provided.'}</p>
                    {assign.marks !== null && <p className="font-bold text-green-800 mb-2">Marks: {assign.marks}</p>}
                    {assign.corrected_file_url && (
                      <a href={assign.corrected_file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        <LinkIcon size={14} /> View Corrected File
                      </a>
                    )}
                  </div>
                ) : profile?.role === 'teacher' ? (
                  <div className="mt-4 pt-4 border-t">
                    {reviewingId === assign.id ? (
                      <form onSubmit={(e) => handleTeacherReview(e, assign.id)} className="bg-white p-4 rounded border shadow-sm">
                        <h4 className="font-bold mb-3">Submit Review</h4>
                        <div className="grid gap-3 mb-3">
                          <div>
                            <label className="text-sm font-bold block mb-1">Marks (Optional)</label>
                            <input type="number" step="0.1" className="input-field w-full p-2 border rounded" value={reviewForm.marks} onChange={e => setReviewForm({...reviewForm, marks: e.target.value})} />
                          </div>
                          <div>
                            <label className="text-sm font-bold block mb-1">Remarks</label>
                            <textarea required className="input-field w-full p-2 border rounded" rows="2" value={reviewForm.remarks} onChange={e => setReviewForm({...reviewForm, remarks: e.target.value})}></textarea>
                          </div>
                          <div>
                            <label className="text-sm font-bold block mb-1">Upload Corrected File (Optional)</label>
                            <input type="file" className="w-full p-2 border rounded text-sm" onChange={e => setReviewForm({...reviewForm, correctedFile: e.target.files[0]})} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="btn btn-primary text-sm px-4 py-2" disabled={reviewUploading}>
                            {reviewUploading ? 'Saving...' : 'Save Review'}
                          </button>
                          <button type="button" onClick={() => setReviewingId(null)} className="btn text-sm px-4 py-2 border rounded hover:bg-gray-100" disabled={reviewUploading}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button onClick={() => setReviewingId(assign.id)} className="btn btn-primary btn-sm">
                        Review & Grade
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Assignments;
