import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Image as ImageIcon, Users, UploadCloud, Loader2 } from 'lucide-react';

export default function WebsiteCMS() {
  const [faculty, setFaculty] = useState([]);
  const [gallery, setGallery] = useState([]);
  
  // Faculty State
  const [newFaculty, setNewFaculty] = useState({ name: '', designation: '', department: '', bio: '' });
  const [facultyFile, setFacultyFile] = useState(null);
  const [uploadingFaculty, setUploadingFaculty] = useState(false);
  const facultyFileRef = useRef(null);

  // Gallery State
  const [galleryCategory, setGalleryCategory] = useState('');
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [galleryUploadProgress, setGalleryUploadProgress] = useState({ current: 0, total: 0 });
  const galleryFileRef = useRef(null);

  useEffect(() => {
    fetchFaculty();
    fetchGallery();
  }, []);

  const fetchFaculty = async () => {
    const { data } = await supabase.from('faculty').select('*').order('name');
    if (data) setFaculty(data);
  };

  const fetchGallery = async () => {
    const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
    if (data) setGallery(data);
  };

  const uploadFileToSupabase = async (file, folder) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('public-assets')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('public-assets').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    if (!newFaculty.name || !newFaculty.designation) return alert('Name and Designation are required');
    
    setUploadingFaculty(true);
    try {
      let imageUrl = null;
      if (facultyFile) {
        imageUrl = await uploadFileToSupabase(facultyFile, 'faculty');
      }

      const { error } = await supabase.from('faculty').insert([{
        ...newFaculty,
        image_url: imageUrl
      }]);
      
      if (error) throw error;

      setNewFaculty({ name: '', designation: '', department: '', bio: '' });
      setFacultyFile(null);
      if (facultyFileRef.current) facultyFileRef.current.value = '';
      fetchFaculty();
    } catch (err) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingFaculty(false);
    }
  };

  const handleDeleteFaculty = async (id) => {
    if (!window.confirm("Delete this faculty profile?")) return;
    await supabase.from('faculty').delete().match({ id });
    fetchFaculty();
  };

  const handleAddPhotos = async (e) => {
    e.preventDefault();
    if (!galleryCategory) return alert('Category is required');
    if (!galleryFiles || galleryFiles.length === 0) return alert('Please select at least one image');

    setUploadingGallery(true);
    setGalleryUploadProgress({ current: 0, total: galleryFiles.length });

    try {
      for (let i = 0; i < galleryFiles.length; i++) {
        const file = galleryFiles[i];
        const imageUrl = await uploadFileToSupabase(file, 'gallery');
        
        // Use filename as title, minus extension
        const title = file.name.split('.').slice(0, -1).join('.');

        await supabase.from('gallery').insert([{
          title: title,
          category: galleryCategory,
          image_url: imageUrl
        }]);

        setGalleryUploadProgress({ current: i + 1, total: galleryFiles.length });
      }

      setGalleryCategory('');
      setGalleryFiles([]);
      if (galleryFileRef.current) galleryFileRef.current.value = '';
      fetchGallery();
    } catch (err) {
      alert("Bulk upload failed: " + err.message);
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleDeletePhoto = async (id) => {
    if (!window.confirm("Delete this photo?")) return;
    await supabase.from('gallery').delete().match({ id });
    fetchGallery();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
      {/* Faculty Manager */}
      <div className="bento-card" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} color="#8b5cf6" /> Faculty Manager
        </h3>
        <form onSubmit={handleAddFaculty} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <input type="text" placeholder="Name" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={newFaculty.name} onChange={e => setNewFaculty({...newFaculty, name: e.target.value})} required />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <input type="text" placeholder="Designation" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={newFaculty.designation} onChange={e => setNewFaculty({...newFaculty, designation: e.target.value})} required />
            <input type="text" placeholder="Department" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={newFaculty.department} onChange={e => setNewFaculty({...newFaculty, department: e.target.value})} />
          </div>
          
          <div style={{ border: '1px dashed var(--border-color)', padding: '1rem', borderRadius: '0.5rem', background: '#f8fafc' }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Profile Photo (Optional)</label>
            <input 
              type="file" 
              accept="image/*"
              ref={facultyFileRef}
              onChange={e => setFacultyFile(e.target.files[0])}
              style={{ width: '100%', fontSize: '0.9rem' }}
            />
          </div>

          <textarea placeholder="Short Bio" rows="2" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={newFaculty.bio} onChange={e => setNewFaculty({...newFaculty, bio: e.target.value})}></textarea>
          
          <button type="submit" className="btn-hero-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#8b5cf6', color: 'white', border: 'none', padding: '0.75rem', width: '100%' }} disabled={uploadingFaculty}>
            {uploadingFaculty ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><Plus size={16} /> Add Faculty</>}
          </button>
        </form>

        <div style={{ overflowY: 'auto', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {faculty.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {f.image_url ? <img src={f.image_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0' }}></div>}
                <div>
                  <p style={{ fontWeight: 'bold', fontSize: '0.875rem', margin: 0 }}>{f.name}</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{f.designation}</p>
                </div>
              </div>
              <button onClick={() => handleDeleteFaculty(f.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem' }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Gallery Manager */}
      <div className="bento-card" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ImageIcon size={20} color="#10b981" /> Bulk Photo Gallery Manager
        </h3>
        <form onSubmit={handleAddPhotos} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          <input type="text" placeholder="Category for these photos (e.g. Sports, Academics)" className="input-field" style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0' }} value={galleryCategory} onChange={e => setGalleryCategory(e.target.value)} required />
          
          <div style={{ border: '2px dashed #10b981', padding: '1.5rem', borderRadius: '0.5rem', background: 'rgba(16, 185, 129, 0.05)', textAlign: 'center' }}>
            <UploadCloud size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
            <label style={{ fontSize: '0.875rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Select Multiple Photos</label>
            <input 
              type="file" 
              accept="image/*"
              multiple
              ref={galleryFileRef}
              onChange={e => setGalleryFiles(Array.from(e.target.files))}
              style={{ width: '100%', fontSize: '0.9rem' }}
              required
            />
            {galleryFiles.length > 0 && <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#16a34a', fontWeight: 'bold' }}>{galleryFiles.length} files selected</p>}
          </div>

          <button type="submit" className="btn-hero-primary" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: '#10b981', color: 'white', border: 'none', padding: '0.75rem', width: '100%' }} disabled={uploadingGallery}>
            {uploadingGallery ? <><Loader2 size={16} className="animate-spin" /> Uploading {galleryUploadProgress.current} of {galleryUploadProgress.total}...</> : <><Plus size={16} /> Bulk Upload Photos</>}
          </button>
        </form>

        <div style={{ overflowY: 'auto', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {gallery.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <img src={p.image_url} alt="" style={{ width: '60px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                <div>
                  <p style={{ fontWeight: 'bold', fontSize: '0.875rem', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{p.title}</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{p.category}</p>
                </div>
              </div>
              <button onClick={() => handleDeletePhoto(p.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.5rem' }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
