import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { uploadFile, deleteFile } from '../lib/storage';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Upload, Trash2, Link as LinkIcon, Loader2 } from 'lucide-react';
import { useData } from '../context/DataContext';

const StudyMaterials = () => {
  const { profile } = useAuth();
  const { classes } = useData();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    class: '',
    section: '',
    subject: '',
    title: '',
    description: '',
    file: null
  });

  useEffect(() => {
    fetchMaterials();
  }, [profile]);

  const fetchMaterials = async () => {
    if (!profile) return;
    setLoading(true);
    let query = supabase.from('study_materials').select('*').order('created_at', { ascending: false });
    
    if (profile.role === 'teacher') {
      query = query.eq('teacher_uid', profile.id);
    } else if (profile.role === 'student') {
      query = query.eq('class', profile.class || '').eq('section', profile.section || '');
    }

    const { data } = await query;
    if (data) setMaterials(data);
    setLoading(false);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!formData.file) return alert('Please select a file');

    setUploading(true);
    const { url, error } = await uploadFile(formData.file, `study-materials/${profile.id}`);
    
    if (error) {
      alert('Upload failed: ' + error.message);
      setUploading(false);
      return;
    }

    const { error: dbError } = await supabase.from('study_materials').insert([{
      teacher_uid: profile.id,
      class: formData.class,
      section: formData.section,
      subject: formData.subject,
      title: formData.title,
      description: formData.description,
      file_url: url
    }]);

    if (!dbError) {
      alert('Material uploaded successfully!');
      setFormData({ ...formData, title: '', description: '', file: null });
      fetchMaterials();
    }
    setUploading(false);
  };

  const handleDelete = async (id, fileUrl) => {
    if (!confirm('Are you sure you want to delete this material?')) return;
    
    // Attempt to delete file from storage
    const filePath = fileUrl.split('portal-files/')[1];
    if (filePath) await deleteFile(filePath);

    // Delete from DB
    await supabase.from('study_materials').delete().eq('id', id);
    fetchMaterials();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <BookOpen size={32} className="text-primary" />
        <h1 className="text-2xl font-bold">Study Materials</h1>
      </div>

      {profile?.role === 'teacher' && (
        <div className="card p-6 bg-white shadow-sm rounded-lg mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Upload size={20} /> Upload New Material</h2>
          <form onSubmit={handleUpload} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1">Class</label>
              <input required type="text" placeholder="e.g. 10" className="input-field w-full" value={formData.class} onChange={e => setFormData({...formData, class: e.target.value})} />
            </div>
            <div>
              <label className="block font-bold mb-1">Section</label>
              <input required type="text" placeholder="e.g. A" className="input-field w-full" value={formData.section} onChange={e => setFormData({...formData, section: e.target.value})} />
            </div>
            <div>
              <label className="block font-bold mb-1">Subject</label>
              <input required type="text" placeholder="e.g. Mathematics" className="input-field w-full" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
            </div>
            <div>
              <label className="block font-bold mb-1">Title</label>
              <input required type="text" placeholder="e.g. Chapter 1 Notes" className="input-field w-full" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block font-bold mb-1">Description (Optional)</label>
              <textarea className="input-field w-full" rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
            </div>
            <div className="md:col-span-2">
              <label className="block font-bold mb-1">Select File</label>
              <input required type="file" className="w-full p-2 border rounded" onChange={e => setFormData({...formData, file: e.target.files[0]})} />
            </div>
            <div className="md:col-span-2 mt-2">
              <button type="submit" className="btn btn-primary w-full" disabled={uploading}>
                {uploading ? <Loader2 className="animate-spin inline mr-2" size={18} /> : null}
                {uploading ? 'Uploading...' : 'Upload Material'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-6 bg-white shadow-sm rounded-lg">
        <h2 className="text-xl font-bold mb-4">Available Materials</h2>
        {loading ? <Loader2 className="animate-spin mx-auto text-primary" /> : materials.length === 0 ? <p className="text-gray-500">No materials found.</p> : (
          <div className="grid md:grid-cols-2 gap-4">
            {materials.map(mat => (
              <div key={mat.id} className="border p-4 rounded-lg bg-gray-50 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-primary">{mat.title}</h3>
                  {profile?.role === 'teacher' && (
                    <button onClick={() => handleDelete(mat.id, mat.file_url)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-500 mb-2">{mat.subject} | Class {mat.class}-{mat.section}</p>
                <p className="text-sm text-gray-600 mb-4 flex-1">{mat.description}</p>
                <a href={mat.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm flex items-center justify-center gap-2 mt-auto">
                  <LinkIcon size={16} /> View/Download File
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyMaterials;
