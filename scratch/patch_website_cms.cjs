const fs = require('fs');
const file = '/home/nodiappu/GN/src/components/WebsiteCMS.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state variables
content = content.replace(
  "const [leadershipMessage, setLeadershipMessage]",
  "const [leadershipFile, setLeadershipFile] = useState(null);\n  const leadershipFileRef = useRef(null);\n  const [leadershipMessage, setLeadershipMessage]"
);

// 2. Modify saveLeadershipMessage
const saveLeadershipMsgOld = `  const saveLeadershipMessage = async (e) => {
    if(e) e.preventDefault(); setSavingLeadership(true);
    await supabase.from('site_settings').upsert({ key: 'leadership_message', value: JSON.stringify(leadershipMessage) }, { onConflict: 'key,school_id' });
    setSavingLeadership(false); alert("Leadership message saved!");
  };`;

const saveLeadershipMsgNew = `  const saveLeadershipMessage = async (e) => {
    if(e) e.preventDefault(); setSavingLeadership(true);
    try {
      let currentImageUrl = leadershipMessage.imageUrl;
      if (leadershipFile) {
        // Upload new file
        const fileExt = leadershipFile.name.split('.').pop();
        const fileName = \`\${Math.random().toString(36).substring(2, 15)}_\${Date.now()}.\${fileExt}\`;
        const filePath = \`leadership/\${fileName}\`;
        const { error: uploadError } = await supabase.storage.from('public-assets').upload(filePath, leadershipFile, { cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('public-assets').getPublicUrl(filePath);
        
        // Delete old file if exists and starts with our storage URL
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
      alert("Leadership message saved!");
    } catch (err) {
      alert("Error saving: " + err.message);
    } finally {
      setSavingLeadership(false);
    }
  };`;

content = content.replace(saveLeadershipMsgOld, saveLeadershipMsgNew);

// 3. Replace the UI for the image
const imageInputOld = `<label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Image URL: <input type="url" className="input-field" style={{ width: '100%', marginTop: '0.25rem', background: '#f8fafc', color: '#0f172a' }} value={leadershipMessage.imageUrl} onChange={e => setLeadershipMessage({...leadershipMessage, imageUrl: e.target.value})} /></label>`;

const imageInputNew = `
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
`;

content = content.replace(imageInputOld, imageInputNew);

fs.writeFileSync(file, content);
console.log("Patched WebsiteCMS.jsx");
