const fs = require('fs');
const file = '/home/nodiappu/GN/src/components/WebsiteCMS.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add IconPicker import
if (!content.includes('import IconPicker')) {
  content = content.replace(
    "import React, { useState, useEffect, useRef } from 'react';",
    "import React, { useState, useEffect, useRef } from 'react';\nimport IconPicker from './IconPicker';"
  );
}

// 2. Add whyChooseUs fields
content = content.replace(
  "  const [whyChooseUs, setWhyChooseUs] = useState([]);",
  `  const [whyChooseUs, setWhyChooseUs] = useState([]);
  const [whyChooseUsTitle, setWhyChooseUsTitle] = useState("Why Choose Us");
  const [whyChooseUsSubtitle, setWhyChooseUsSubtitle] = useState("A holistic approach to education that prepares your child for the future.");
  const [whyChooseUsEnabled, setWhyChooseUsEnabled] = useState(true);`
);

content = content.replace(
  "const [divisionsTitle, setDivisionsTitle] = useState(\"OUR DIVISIONS\");",
  `const [divisionsTitle, setDivisionsTitle] = useState("Academic Journey");
  const [divisionsSubtitle, setDivisionsSubtitle] = useState("Nurturing growth through every phase of your child's education.");
  const [divisionsEnabled, setDivisionsEnabled] = useState(true);`
);

// 3. Update fetchWhyChooseUs & saveWhyChooseUs
const fetchWhyOld = `  const fetchWhyChooseUs = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'why_choose_us').single();
    if (data && data.value) setWhyChooseUs(JSON.parse(data.value));
  };
  const saveWhyChooseUs = async (e) => {
    if(e) e.preventDefault(); setSavingWhyChooseUs(true);
    await supabase.from('site_settings').upsert({ key: 'why_choose_us', value: JSON.stringify(whyChooseUs) }, { onConflict: 'key,school_id' });
    setSavingWhyChooseUs(false); alert("Why Choose Us saved!");
  };`;

const fetchWhyNew = `  const fetchWhyChooseUs = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'why_choose_us').single();
    if (data && data.value) {
      const parsed = JSON.parse(data.value);
      if (parsed.cards) {
        setWhyChooseUs(parsed.cards);
        setWhyChooseUsTitle(parsed.title || "Why Choose Us");
        setWhyChooseUsSubtitle(parsed.subtitle || "A holistic approach to education that prepares your child for the future.");
        setWhyChooseUsEnabled(parsed.enabled !== false);
      } else if (Array.isArray(parsed)) {
        setWhyChooseUs(parsed);
      }
    } else {
      setWhyChooseUs([
        { title: 'Holistic Education', description: 'Focusing on academic, physical, and emotional development.', icon: 'Award', color: '#3b82f6', isActive: true },
        { title: 'Modern Infrastructure', description: 'State-of-the-art labs, libraries, and sports facilities.', icon: 'Shield', color: '#10b981', isActive: true },
        { title: 'Global Curriculum', description: 'Internationally recognized ICSE framework for future readiness.', icon: 'Globe', color: '#8b5cf6', isActive: true }
      ]);
    }
  };
  
  const saveWhyChooseUs = async (e) => {
    if(e) e.preventDefault(); setSavingWhyChooseUs(true);
    const payload = {
      title: whyChooseUsTitle,
      subtitle: whyChooseUsSubtitle,
      enabled: whyChooseUsEnabled,
      cards: whyChooseUs
    };
    await supabase.from('site_settings').upsert({ key: 'why_choose_us', value: JSON.stringify(payload) }, { onConflict: 'key,school_id' });
    setSavingWhyChooseUs(false); alert("Why Choose Us saved!");
  };`;

content = content.replace(fetchWhyOld, fetchWhyNew);

// 4. Update fetchDivisions & saveDivisions
const fetchDivisionsOld = `  const fetchDivisions = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'our_divisions').single();
    if (data && data.value) {
      const parsed = JSON.parse(data.value);
      if (parsed && parsed.cards && Array.isArray(parsed.cards)) {
        setDivisions(parsed.cards);
        setDivisionsTitle(parsed.divisionsTitle || "OUR DIVISIONS");
        setPillarsTitle(parsed.pillarsTitle || "OUR PILLARS");
      } else if (Array.isArray(parsed)) {
        setDivisions(parsed);
        setDivisionsTitle("OUR DIVISIONS");
        setPillarsTitle("OUR PILLARS");
      }
    } else {
      setDivisions([
        { id: '1', title: 'Kindergarten', description: 'Sensory and foundational learning.', icon: 'Users', color: '#d97706', bgColor: '#fef3c7', message: '', isPillar: false },
        { id: '2', title: 'Primary', description: 'Building strong core academic skills.', icon: 'BookOpen', color: '#ea580c', bgColor: '#ffedd5', message: '', isPillar: false },
        { id: '3', title: 'Middle', description: 'Exploration and critical thinking.', icon: 'Users', color: '#16a34a', bgColor: '#dcfce7', message: '', isPillar: false },
        { id: '4', title: 'Senior School', description: 'Career readiness and leadership.', icon: 'Award', color: '#2563eb', bgColor: '#dbeafe', message: '', isPillar: false }
      ]);
      setDivisionsTitle("OUR DIVISIONS");
      setPillarsTitle("OUR PILLARS");
    }
  };

  const saveDivisions = async (e) => {
    if (e) e.preventDefault();
    setSavingDivisions(true);
    try {
      const payload = {
        divisionsTitle,
        pillarsTitle,
        cards: divisions
      };
      const { error } = await supabase.from('site_settings').upsert({ key: 'our_divisions', value: JSON.stringify(payload) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      alert("Our Divisions and Message Desks saved successfully!");
    } catch (err) {
      alert("Failed to save divisions: " + err.message);
    } finally {
      setSavingDivisions(false);
    }
  };`;

const fetchDivisionsNew = `  const fetchDivisions = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'our_divisions').single();
    if (data && data.value) {
      const parsed = JSON.parse(data.value);
      if (parsed && parsed.cards && Array.isArray(parsed.cards)) {
        setDivisions(parsed.cards);
        setDivisionsTitle(parsed.divisionsTitle || "Academic Journey");
        setDivisionsSubtitle(parsed.divisionsSubtitle || "Nurturing growth through every phase of your child's education.");
        setDivisionsEnabled(parsed.enabled !== false);
      } else if (Array.isArray(parsed)) {
        setDivisions(parsed);
        setDivisionsTitle("Academic Journey");
        setDivisionsSubtitle("Nurturing growth through every phase of your child's education.");
      }
    } else {
      setDivisions([
        { id: '1', title: 'Pre-Primary', description: 'Sensory and foundational learning.', icon: 'Users', link: '/academics', isActive: true },
        { id: '2', title: 'Primary', description: 'Building strong core academic skills.', icon: 'BookOpen', link: '/academics', isActive: true },
        { id: '3', title: 'Middle', description: 'Exploration and critical thinking.', icon: 'Compass', link: '/academics', isActive: true },
        { id: '4', title: 'Secondary', description: 'Career readiness and leadership.', icon: 'Award', link: '/academics', isActive: true }
      ]);
      setDivisionsTitle("Academic Journey");
      setDivisionsSubtitle("Nurturing growth through every phase of your child's education.");
    }
  };

  const saveDivisions = async (e) => {
    if (e) e.preventDefault();
    setSavingDivisions(true);
    try {
      const payload = {
        divisionsTitle,
        divisionsSubtitle,
        enabled: divisionsEnabled,
        cards: divisions
      };
      const { error } = await supabase.from('site_settings').upsert({ key: 'our_divisions', value: JSON.stringify(payload) }, { onConflict: 'key,school_id' });
      if (error) throw error;
      alert("Academic Journey saved successfully!");
    } catch (err) {
      alert("Failed to save: " + err.message);
    } finally {
      setSavingDivisions(false);
    }
  };`;

content = content.replace(fetchDivisionsOld, fetchDivisionsNew);

// 5. Add UI inside redesign section
const targetMarker = `{/* Leadership Message */}`;

const newEditors = `
          {/* Academic Journey Editor */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Academic Journey</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={divisionsEnabled} onChange={e => setDivisionsEnabled(e.target.checked)} />
                Enable Section
              </label>
            </div>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Main Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={divisionsTitle} onChange={e => setDivisionsTitle(e.target.value)} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Subtitle: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={divisionsSubtitle} onChange={e => setDivisionsSubtitle(e.target.value)} /></label>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <h4 style={{ fontWeight: 600, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Cards</h4>
              {divisions.map((card, idx) => (
                <div key={idx} style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => {
                        if(idx === 0) return;
                        const newDivs = [...divisions];
                        const temp = newDivs[idx-1];
                        newDivs[idx-1] = newDivs[idx];
                        newDivs[idx] = temp;
                        setDivisions(newDivs);
                      }} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0', border: 'none', borderRadius: '0.25rem', cursor: idx===0?'not-allowed':'pointer' }}>↑</button>
                      <button type="button" onClick={() => {
                        if(idx === divisions.length-1) return;
                        const newDivs = [...divisions];
                        const temp = newDivs[idx+1];
                        newDivs[idx+1] = newDivs[idx];
                        newDivs[idx] = temp;
                        setDivisions(newDivs);
                      }} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0', border: 'none', borderRadius: '0.25rem', cursor: idx===divisions.length-1?'not-allowed':'pointer' }}>↓</button>
                    </div>
                    <button type="button" onClick={() => {
                      if(confirm('Delete card?')) setDivisions(divisions.filter((_, i) => i !== idx));
                    }} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={card.title || ''} onChange={e => { const n = [...divisions]; n[idx].title = e.target.value; setDivisions(n); }} /></label>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Icon: 
                      <div style={{ marginTop: '0.25rem' }}>
                        <IconPicker value={card.icon} onChange={icon => { const n = [...divisions]; n[idx].icon = icon; setDivisions(n); }} />
                      </div>
                    </label>
                  </div>
                  
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Description: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} rows="2" value={card.description || ''} onChange={e => { const n = [...divisions]; n[idx].description = e.target.value; setDivisions(n); }} /></label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button Link: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={card.link || ''} onChange={e => { const n = [...divisions]; n[idx].link = e.target.value; setDivisions(n); }} /></label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginTop: '1.5rem' }}>
                      <input type="checkbox" checked={card.isActive !== false} onChange={e => { const n = [...divisions]; n[idx].isActive = e.target.checked; setDivisions(n); }} />
                      Card Active
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setDivisions([...divisions, { title: 'New Card', description: '', icon: 'BookOpen', link: '/academics', isActive: true }])} className="btn-hero-outline" style={{ justifySelf: 'start', marginTop: '0.5rem' }}>+ Add Card</button>
            </div>
            <button className="btn-hero-primary" onClick={saveDivisions} style={{ background: '#3b82f6', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem', width: '100%', marginTop: '2rem' }} disabled={savingDivisions}>{savingDivisions ? 'Saving...' : 'Save Academic Journey'}</button>
          </div>

          {/* Why Choose Us Editor */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Why Choose Us</h3>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={whyChooseUsEnabled} onChange={e => setWhyChooseUsEnabled(e.target.checked)} />
                Enable Section
              </label>
            </div>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Main Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={whyChooseUsTitle} onChange={e => setWhyChooseUsTitle(e.target.value)} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Subtitle: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={whyChooseUsSubtitle} onChange={e => setWhyChooseUsSubtitle(e.target.value)} /></label>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              <h4 style={{ fontWeight: 600, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Features</h4>
              {whyChooseUs.map((card, idx) => (
                <div key={idx} style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => {
                        if(idx === 0) return;
                        const newCards = [...whyChooseUs];
                        const temp = newCards[idx-1];
                        newCards[idx-1] = newCards[idx];
                        newCards[idx] = temp;
                        setWhyChooseUs(newCards);
                      }} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0', border: 'none', borderRadius: '0.25rem', cursor: idx===0?'not-allowed':'pointer' }}>↑</button>
                      <button type="button" onClick={() => {
                        if(idx === whyChooseUs.length-1) return;
                        const newCards = [...whyChooseUs];
                        const temp = newCards[idx+1];
                        newCards[idx+1] = newCards[idx];
                        newCards[idx] = temp;
                        setWhyChooseUs(newCards);
                      }} style={{ padding: '0.25rem 0.5rem', background: '#e2e8f0', border: 'none', borderRadius: '0.25rem', cursor: idx===whyChooseUs.length-1?'not-allowed':'pointer' }}>↓</button>
                    </div>
                    <button type="button" onClick={() => {
                      if(confirm('Delete feature?')) setWhyChooseUs(whyChooseUs.filter((_, i) => i !== idx));
                    }} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={card.title || ''} onChange={e => { const n = [...whyChooseUs]; n[idx].title = e.target.value; setWhyChooseUs(n); }} /></label>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Icon: 
                      <div style={{ marginTop: '0.25rem' }}>
                        <IconPicker value={card.icon} onChange={icon => { const n = [...whyChooseUs]; n[idx].icon = icon; setWhyChooseUs(n); }} />
                      </div>
                    </label>
                  </div>
                  
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Description: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} rows="2" value={card.description || ''} onChange={e => { const n = [...whyChooseUs]; n[idx].description = e.target.value; setWhyChooseUs(n); }} /></label>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <input type="checkbox" checked={card.isActive !== false} onChange={e => { const n = [...whyChooseUs]; n[idx].isActive = e.target.checked; setWhyChooseUs(n); }} />
                      Feature Active
                    </label>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => setWhyChooseUs([...whyChooseUs, { title: 'New Feature', description: '', icon: 'Award', isActive: true }])} className="btn-hero-outline" style={{ justifySelf: 'start', marginTop: '0.5rem' }}>+ Add Feature</button>
            </div>
            <button className="btn-hero-primary" onClick={saveWhyChooseUs} style={{ background: '#3b82f6', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem', width: '100%', marginTop: '2rem' }} disabled={savingWhyChooseUs}>{savingWhyChooseUs ? 'Saving...' : 'Save Why Choose Us'}</button>
          </div>

          {/* Leadership Message */}
`;

content = content.replace(targetMarker, newEditors);

fs.writeFileSync(file, content);
console.log("Patched WebsiteCMS.jsx");
