const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src/components/WebsiteCMS.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// Add option to dropdown
const dropdownInjectionPoint = `<option value="homepage">Home Page (Hero, Popup, Academic Excellence, Divisions)</option>`;
if (!content.includes('<option value="redesign">')) {
  content = content.replace(dropdownInjectionPoint, dropdownInjectionPoint + '\n          <option value="redesign">Homepage V2 Sections (New Design)</option>');
}

// Add the new UI blocks
const uiCode = `
      {cmsSection === 'redesign' && (
        <>
          {/* Welcome Section */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3>Welcome Section</h3>
            <form onSubmit={saveWelcomeSection} style={{ display: 'grid', gap: '1rem' }}>
              <label>Badge: <input className="input-field" value={welcomeSection.badge} onChange={e => setWelcomeSection({...welcomeSection, badge: e.target.value})} /></label>
              <label>Title: <input className="input-field" value={welcomeSection.title} onChange={e => setWelcomeSection({...welcomeSection, title: e.target.value})} /></label>
              <label>Description: <textarea className="input-field" value={welcomeSection.description} onChange={e => setWelcomeSection({...welcomeSection, description: e.target.value})} rows="4" /></label>
              <label>Link Text: <input className="input-field" value={welcomeSection.linkText} onChange={e => setWelcomeSection({...welcomeSection, linkText: e.target.value})} /></label>
              <label>Link URL: <input className="input-field" value={welcomeSection.linkUrl} onChange={e => setWelcomeSection({...welcomeSection, linkUrl: e.target.value})} /></label>
              <button className="primary-button" type="submit">{savingWelcome ? 'Saving...' : 'Save Welcome Section'}</button>
            </form>
          </div>

          {/* Leadership Message */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3>Leadership Message</h3>
            <form onSubmit={saveLeadershipMessage} style={{ display: 'grid', gap: '1rem' }}>
              <label>Badge: <input className="input-field" value={leadershipMessage.badge} onChange={e => setLeadershipMessage({...leadershipMessage, badge: e.target.value})} /></label>
              <label>Title: <input className="input-field" value={leadershipMessage.title} onChange={e => setLeadershipMessage({...leadershipMessage, title: e.target.value})} /></label>
              <label>Message: <textarea className="input-field" value={leadershipMessage.message} onChange={e => setLeadershipMessage({...leadershipMessage, message: e.target.value})} rows="4" /></label>
              <label>Name: <input className="input-field" value={leadershipMessage.name} onChange={e => setLeadershipMessage({...leadershipMessage, name: e.target.value})} /></label>
              <label>Image URL: <input className="input-field" value={leadershipMessage.imageUrl} onChange={e => setLeadershipMessage({...leadershipMessage, imageUrl: e.target.value})} /></label>
              <label>Button Text: <input className="input-field" value={leadershipMessage.btnText} onChange={e => setLeadershipMessage({...leadershipMessage, btnText: e.target.value})} /></label>
              <label>Button URL: <input className="input-field" value={leadershipMessage.btnUrl} onChange={e => setLeadershipMessage({...leadershipMessage, btnUrl: e.target.value})} /></label>
              <button className="primary-button" type="submit">{savingLeadership ? 'Saving...' : 'Save Leadership Message'}</button>
            </form>
          </div>

          {/* CTA Section */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3>Call To Action (CTA) Section</h3>
            <form onSubmit={saveCtaSection} style={{ display: 'grid', gap: '1rem' }}>
              <label>Title: <input className="input-field" value={ctaSection.title} onChange={e => setCtaSection({...ctaSection, title: e.target.value})} /></label>
              <label>Description: <textarea className="input-field" value={ctaSection.description} onChange={e => setCtaSection({...ctaSection, description: e.target.value})} rows="3" /></label>
              <label>Button 1 Text: <input className="input-field" value={ctaSection.btn1Text} onChange={e => setCtaSection({...ctaSection, btn1Text: e.target.value})} /></label>
              <label>Button 1 URL: <input className="input-field" value={ctaSection.btn1Url} onChange={e => setCtaSection({...ctaSection, btn1Url: e.target.value})} /></label>
              <label>Button 2 Text: <input className="input-field" value={ctaSection.btn2Text} onChange={e => setCtaSection({...ctaSection, btn2Text: e.target.value})} /></label>
              <label>Button 2 URL: <input className="input-field" value={ctaSection.btn2Url} onChange={e => setCtaSection({...ctaSection, btn2Url: e.target.value})} /></label>
              <button className="primary-button" type="submit">{savingCta ? 'Saving...' : 'Save CTA Section'}</button>
            </form>
          </div>

          {/* Events Manager */}
          <div className="bento-card" style={{ padding: '2rem', gridColumn: '1 / -1' }}>
            <h3>Events Manager</h3>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              {events.map(ev => (
                <div key={ev.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
                  <div>
                    <strong>{ev.title}</strong>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{ev.date} - {ev.location}</p>
                  </div>
                  <button onClick={() => handleDeleteEvent(ev.id)} style={{ color: 'red', background: 'transparent', border: 'none', cursor: 'pointer' }}>Delete</button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddEvent} style={{ display: 'grid', gap: '1rem', background: '#f1f5f9', padding: '1rem', borderRadius: '8px' }}>
              <h4>Add New Event</h4>
              <label>Title: <input className="input-field" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} required /></label>
              <label>Date: <input type="date" className="input-field" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} required /></label>
              <label>Location: <input className="input-field" value={newEvent.location} onChange={e => setNewEvent({...newEvent, location: e.target.value})} /></label>
              <button className="primary-button" type="submit">Add Event</button>
            </form>
          </div>
        </>
      )}
`;

// Insert the new section at the very end of the main grid
const lastGridInjectionPoint = `    </div>
      <SchoolPopup />
    </div>
  );
}`;

if (!content.includes('cmsSection === \'redesign\'')) {
  // It's safer to just inject it right before the last closing tags
  content = content.replace("    </div>\n      <SchoolPopup />", uiCode + "\n    </div>\n      <SchoolPopup />");
}

fs.writeFileSync(filePath, content, 'utf-8');
console.log("Successfully injected JSX components.");
