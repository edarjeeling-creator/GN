const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src/components/WebsiteCMS.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

const uiCode = `
      {/* ---------------- NEW REDESIGN SECTIONS ---------------- */}
      {cmsSection === 'redesign' && (
        <>
          {/* Welcome Section */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Welcome Section</h3>
            <form onSubmit={saveWelcomeSection} style={{ display: 'grid', gap: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Badge: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={welcomeSection.badge} onChange={e => setWelcomeSection({...welcomeSection, badge: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={welcomeSection.title} onChange={e => setWelcomeSection({...welcomeSection, title: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Description: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={welcomeSection.description} onChange={e => setWelcomeSection({...welcomeSection, description: e.target.value})} rows="4" /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Link Text: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={welcomeSection.linkText} onChange={e => setWelcomeSection({...welcomeSection, linkText: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Link URL: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={welcomeSection.linkUrl} onChange={e => setWelcomeSection({...welcomeSection, linkUrl: e.target.value})} /></label>
              <button className="btn-hero-primary" type="submit" style={{ background: '#3b82f6', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem' }} disabled={savingWelcome}>{savingWelcome ? 'Saving...' : 'Save Welcome Section'}</button>
            </form>
          </div>

          {/* Leadership Message */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Leadership Message</h3>
            <form onSubmit={saveLeadershipMessage} style={{ display: 'grid', gap: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Badge: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={leadershipMessage.badge} onChange={e => setLeadershipMessage({...leadershipMessage, badge: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={leadershipMessage.title} onChange={e => setLeadershipMessage({...leadershipMessage, title: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Message: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={leadershipMessage.message} onChange={e => setLeadershipMessage({...leadershipMessage, message: e.target.value})} rows="4" /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Name: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={leadershipMessage.name} onChange={e => setLeadershipMessage({...leadershipMessage, name: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Image URL: <input type="url" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={leadershipMessage.imageUrl} onChange={e => setLeadershipMessage({...leadershipMessage, imageUrl: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button Text: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={leadershipMessage.btnText} onChange={e => setLeadershipMessage({...leadershipMessage, btnText: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button URL: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={leadershipMessage.btnUrl} onChange={e => setLeadershipMessage({...leadershipMessage, btnUrl: e.target.value})} /></label>
              <button className="btn-hero-primary" type="submit" style={{ background: '#3b82f6', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem' }} disabled={savingLeadership}>{savingLeadership ? 'Saving...' : 'Save Leadership Message'}</button>
            </form>
          </div>

          {/* CTA Section */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Call To Action (CTA) Section</h3>
            <form onSubmit={saveCtaSection} style={{ display: 'grid', gap: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={ctaSection.title} onChange={e => setCtaSection({...ctaSection, title: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Description: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={ctaSection.description} onChange={e => setCtaSection({...ctaSection, description: e.target.value})} rows="3" /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button 1 Text: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={ctaSection.btn1Text} onChange={e => setCtaSection({...ctaSection, btn1Text: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button 1 URL: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={ctaSection.btn1Url} onChange={e => setCtaSection({...ctaSection, btn1Url: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button 2 Text: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={ctaSection.btn2Text} onChange={e => setCtaSection({...ctaSection, btn2Text: e.target.value})} /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button 2 URL: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={ctaSection.btn2Url} onChange={e => setCtaSection({...ctaSection, btn2Url: e.target.value})} /></label>
              <button className="btn-hero-primary" type="submit" style={{ background: '#3b82f6', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem' }} disabled={savingCta}>{savingCta ? 'Saving...' : 'Save CTA Section'}</button>
            </form>
          </div>

          {/* Events Manager */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Events Manager</h3>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              {events.map(ev => (
                <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <strong style={{ display: 'block', color: '#0f172a' }}>{ev.title}</strong>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{new Date(ev.date).toLocaleDateString()} - {ev.location}</p>
                  </div>
                  <button onClick={() => handleDeleteEvent(ev.id)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                </div>
              ))}
              {events.length === 0 && <p style={{ color: '#64748b', fontSize: '0.875rem', textAlign: 'center' }}>No events found.</p>}
            </div>
            <form onSubmit={handleAddEvent} style={{ display: 'grid', gap: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ fontWeight: 600, color: '#334155' }}>Add New Event</h4>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} required /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Date: <input type="date" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} required /></label>
              <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Location: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem' }} value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} /></label>
              <button className="btn-hero-primary" type="submit" style={{ background: '#10b981', color: 'white', padding: '0.75rem', border: 'none', borderRadius: '0.5rem' }}>Add Event</button>
            </form>
          </div>
        </>
      )}`;

if (!content.includes('cmsSection === \'redesign\'')) {
  const targetStr = '    </div>\n    </div>\n  );\n}';
  content = content.replace(targetStr, uiCode + '\n' + targetStr);
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log("Successfully injected JSX components.");
} else {
  console.log("Already injected.");
}
