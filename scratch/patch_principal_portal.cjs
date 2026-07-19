const fs = require('fs');
const file = '/home/nodiappu/GN/src/pages/PrincipalPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add states
const stateInjection = `  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [showAbsentees, setShowAbsentees] = useState(false);
  
  // Leadership Message Editor State
  const [leadershipMessage, setLeadershipMessage] = useState({ badge: 'LEADERSHIP', title: 'Message from the Principal', message: '', name: 'Dr. John Doe', imageUrl: '', btnText: 'Read Full Message', btnUrl: '/principal-desk' });
  const [leadershipFile, setLeadershipFile] = useState(null);
  const leadershipFileRef = React.useRef(null);
  const [savingLeadership, setSavingLeadership] = useState(false);
`;
content = content.replace(
  "  const [loadingAttendance, setLoadingAttendance] = useState(false);\n  const [showAbsentees, setShowAbsentees] = useState(false);", 
  stateInjection
);

// 2. Add fetch logic and save logic
const saveLogic = `
  useEffect(() => {
    fetchLeadershipMessage();
  }, []);

  const fetchLeadershipMessage = async () => {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'leadership_message').single();
    if (data && data.value) setLeadershipMessage(JSON.parse(data.value));
  };

  const saveLeadershipMessage = async (e) => {
    if(e) e.preventDefault(); setSavingLeadership(true);
    try {
      let currentImageUrl = leadershipMessage.imageUrl;
      if (leadershipFile) {
        const fileExt = leadershipFile.name.split('.').pop();
        const fileName = \`\${Math.random().toString(36).substring(2, 15)}_\${Date.now()}.\${fileExt}\`;
        const filePath = \`leadership/\${fileName}\`;
        const { error: uploadError } = await supabase.storage.from('public-assets').upload(filePath, leadershipFile, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('public-assets').getPublicUrl(filePath);
        
        if (currentImageUrl && currentImageUrl.includes('/public-assets/leadership/')) {
          const oldFilePath = currentImageUrl.split('/public-assets/')[1];
          if (oldFilePath) {
            await supabase.storage.from('public-assets').remove([oldFilePath]).catch(console.error);
          }
        }
        currentImageUrl = data.publicUrl;
      }
      
      const newMsg = { ...leadershipMessage, imageUrl: currentImageUrl };
      await supabase.from('site_settings').upsert({ key: 'leadership_message', value: JSON.stringify(newMsg) }, { onConflict: 'key,school_id' });
      setLeadershipMessage(newMsg);
      setLeadershipFile(null);
      if (leadershipFileRef.current) leadershipFileRef.current.value = '';
      alert("Leadership message saved successfully!");
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setSavingLeadership(false);
    }
  };

  const fetchClassesAndStudents = async () => {`;

content = content.replace("  const fetchClassesAndStudents = async () => {", saveLogic);


// 3. Add Tab to Nav
content = content.replace(
  "{ id: 'notices', label: 'Notices & Announcements' },",
  "{ id: 'notices', label: 'Notices & Announcements' },\n            { id: 'leadership_message', label: 'Leadership Message' },"
);


// 4. Add UI Component
const uiComponent = `
        {activeTab === 'leadership_message' && (
          <motion.div key="leadership_message" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><User size={20} className="text-brand-500" /> Leadership Message Editor</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={saveLeadershipMessage} style={{ display: 'grid', gap: '1rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Badge: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.badge} onChange={e => setLeadershipMessage({...leadershipMessage, badge: e.target.value})} /></label>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Title: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.title} onChange={e => setLeadershipMessage({...leadershipMessage, title: e.target.value})} /></label>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Message: <textarea className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.message} onChange={e => setLeadershipMessage({...leadershipMessage, message: e.target.value})} rows="4" /></label>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Name: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.name} onChange={e => setLeadershipMessage({...leadershipMessage, name: e.target.value})} /></label>
                  
                  <div style={{ padding: '1rem', background: '#f1f5f9', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '0.875rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Principal Photo</label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      {(leadershipFile || leadershipMessage.imageUrl) && (
                        <img 
                          src={leadershipFile ? URL.createObjectURL(leadershipFile) : leadershipMessage.imageUrl} 
                          alt="Preview" 
                          style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '0.5rem', border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }} 
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <input 
                          type="file" 
                          accept=".jpg,.jpeg,.png,.webp"
                          ref={leadershipFileRef}
                          onChange={e => {
                            const file = e.target.files[0];
                            if (file && file.size > 5 * 1024 * 1024) {
                              alert('File size exceeds 5MB limit.');
                              e.target.value = '';
                              return;
                            }
                            setLeadershipFile(file || null);
                          }}
                          style={{ width: '100%', padding: '0.5rem', background: '#fff', border: '1px border #cbd5e1', borderRadius: '0.25rem' }} 
                        />
                        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>JPG, PNG, WebP up to 5MB. {(leadershipMessage.imageUrl && !leadershipFile) && "Upload a new file to replace the existing image."}</p>
                        
                        {leadershipMessage.imageUrl && !leadershipFile && (
                          <button 
                            type="button" 
                            onClick={() => {
                              if(confirm('Are you sure you want to remove the current image?')) {
                                 setLeadershipMessage({...leadershipMessage, imageUrl: ''});
                              }
                            }}
                            style={{ marginTop: '0.5rem', background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Remove Existing Image
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button Text: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.btnText} onChange={e => setLeadershipMessage({...leadershipMessage, btnText: e.target.value})} /></label>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Button URL: <input type="text" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.btnUrl} onChange={e => setLeadershipMessage({...leadershipMessage, btnUrl: e.target.value})} /></label>
                  
                  <Button type="submit" disabled={savingLeadership} className="w-full mt-4 h-12 shadow-lg shadow-brand-500/20 text-white font-bold bg-brand-600 hover:bg-brand-700">
                    {savingLeadership ? 'Saving...' : 'Save Leadership Message'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'settings' && (`;

content = content.replace("        {activeTab === 'settings' && (", uiComponent);

fs.writeFileSync(file, content);
console.log("Patched PrincipalPortal.jsx");
