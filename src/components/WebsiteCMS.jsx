import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Edit2, Image as ImageIcon, Users } from 'lucide-react';

export default function WebsiteCMS() {
  const [faculty, setFaculty] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [newFaculty, setNewFaculty] = useState({ name: '', designation: '', department: '', bio: '', image_url: '' });
  const [newPhoto, setNewPhoto] = useState({ title: '', category: '', image_url: '' });

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

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    if (!newFaculty.name || !newFaculty.designation) return alert('Name and Designation are required');
    const { error } = await supabase.from('faculty').insert([newFaculty]);
    if (!error) {
      setNewFaculty({ name: '', designation: '', department: '', bio: '', image_url: '' });
      fetchFaculty();
    } else alert(error.message);
  };

  const handleDeleteFaculty = async (id) => {
    if (!window.confirm("Delete this faculty profile?")) return;
    await supabase.from('faculty').delete().match({ id });
    fetchFaculty();
  };

  const handleAddPhoto = async (e) => {
    e.preventDefault();
    if (!newPhoto.title || !newPhoto.image_url) return alert('Title and Image URL are required');
    const { error } = await supabase.from('gallery').insert([newPhoto]);
    if (!error) {
      setNewPhoto({ title: '', category: '', image_url: '' });
      fetchGallery();
    } else alert(error.message);
  };

  const handleDeletePhoto = async (id) => {
    if (!window.confirm("Delete this photo?")) return;
    await supabase.from('gallery').delete().match({ id });
    fetchGallery();
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 mt-6">
      {/* Faculty Manager */}
      <div className="bento-card" style={{ padding: '2rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} color="#8b5cf6" /> Faculty Manager
        </h3>
        <form onSubmit={handleAddFaculty} className="flex flex-col gap-3 mb-6">
          <input type="text" placeholder="Name" className="input-field" value={newFaculty.name} onChange={e => setNewFaculty({...newFaculty, name: e.target.value})} required />
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Designation" className="input-field" value={newFaculty.designation} onChange={e => setNewFaculty({...newFaculty, designation: e.target.value})} required />
            <input type="text" placeholder="Department" className="input-field" value={newFaculty.department} onChange={e => setNewFaculty({...newFaculty, department: e.target.value})} />
          </div>
          <input type="text" placeholder="Image URL (e.g. /faculty_placeholder.png)" className="input-field" value={newFaculty.image_url} onChange={e => setNewFaculty({...newFaculty, image_url: e.target.value})} />
          <textarea placeholder="Short Bio" rows="2" className="input-field" value={newFaculty.bio} onChange={e => setNewFaculty({...newFaculty, bio: e.target.value})}></textarea>
          <button type="submit" className="btn-hero-primary" style={{ background: '#8b5cf6', color: 'white', border: 'none' }}><Plus size={16} /> Add Faculty</button>
        </form>

        <div className="overflow-y-auto" style={{ maxHeight: '300px' }}>
          {faculty.map(f => (
            <div key={f.id} className="flex justify-between items-center p-3 mb-2 bg-gray-50 rounded border border-gray-100">
              <div className="flex items-center gap-3">
                {f.image_url ? <img src={f.image_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0' }}></div>}
                <div>
                  <p className="font-bold text-sm">{f.name}</p>
                  <p className="text-xs text-gray-500">{f.designation}</p>
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
          <ImageIcon size={20} color="#10b981" /> Photo Gallery Manager
        </h3>
        <form onSubmit={handleAddPhoto} className="flex flex-col gap-3 mb-6">
          <input type="text" placeholder="Photo Title" className="input-field" value={newPhoto.title} onChange={e => setNewPhoto({...newPhoto, title: e.target.value})} required />
          <input type="text" placeholder="Category (e.g. Sports, Academics)" className="input-field" value={newPhoto.category} onChange={e => setNewPhoto({...newPhoto, category: e.target.value})} required />
          <input type="text" placeholder="Image URL (e.g. /gallery_sports.png)" className="input-field" value={newPhoto.image_url} onChange={e => setNewPhoto({...newPhoto, image_url: e.target.value})} required />
          <button type="submit" className="btn-hero-primary" style={{ background: '#10b981', color: 'white', border: 'none' }}><Plus size={16} /> Add Photo</button>
        </form>

        <div className="overflow-y-auto" style={{ maxHeight: '300px' }}>
          {gallery.map(p => (
            <div key={p.id} className="flex justify-between items-center p-3 mb-2 bg-gray-50 rounded border border-gray-100">
              <div className="flex items-center gap-3">
                <img src={p.image_url} alt="" style={{ width: '60px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                <div>
                  <p className="font-bold text-sm">{p.title}</p>
                  <p className="text-xs text-gray-500">{p.category}</p>
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
