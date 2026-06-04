const fs = require('fs');

let content = fs.readFileSync('src/pages/Admin.jsx', 'utf-8');

// 1. Replace news state with managementSection
content = content.replace(
    /const \[news, setNews\] = useState\(\[\]\);\s*const \[newNewsContent, setNewNewsContent\] = useState\(''\);/,
    "const [managementSection, setManagementSection] = useState('overview');"
);

// 2. Remove fetchNews from useEffect
content = content.replace(
    /fetchStats\(\);\s*fetchNews\(\);/,
    "fetchStats();"
);

// 3. Remove the 4 news functions
const startIdx = content.indexOf("const fetchNews = async () => {");
const endIdx = content.indexOf("const handleAddClass = async (e) => {");
if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + content.substring(endIdx);
}

// 4. Restructure JSX Layout
const dashboardStr = "{activeTab === 'dashboard' && (\n        <>\n          <div className=\"bento-grid\"";
const selectHtml = `{activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
            <label style={{ fontWeight: 'bold', color: '#475569' }}>Select Management Section:</label>
            <select 
              className="input-field" 
              value={managementSection} 
              onChange={e => setManagementSection(e.target.value)}
              style={{ minWidth: '250px', background: 'white', maxWidth: '400px' }}
            >
              <option value="overview">Overview & Analytics</option>
              <option value="users">Manage Students & Teachers</option>
              <option value="academics">Manage Classes & Subjects</option>
              <option value="data">Data Import & Export</option>
            </select>
          </div>

          {managementSection === 'overview' && (
          <div className="bento-grid"`;

content = content.replace(dashboardStr, selectHtml);

// Wrap Bulk Import in Data section
// find end of Class Performance Analytics which is </ResponsiveContainer>\n            </div>\n          </div>
const analyticsEnd = content.indexOf("</ResponsiveContainer>\n            </div>\n          </div>");
if (analyticsEnd !== -1) {
    const insertPos = analyticsEnd + "</ResponsiveContainer>\n            </div>\n          </div>".length;
    const toInsert = "\n          )}\n\n          {managementSection === 'data' && (\n            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>\n";
    content = content.substring(0, insertPos) + toInsert + content.substring(insertPos);
}

// Manage Students is inside <div className="flex" style={{ flexDirection: 'column', gap: '2rem' }}>
const manageStudentsStart = content.indexOf('<div className="flex" style={{ flexDirection: \'column\', gap: \'2rem\' }}>\n          \n          <div className="bento-card" style={{ padding: \'2rem\' }}>\n            <h3 style={{ fontSize: \'1.25rem\', fontWeight: 700, marginBottom: \'1.5rem\', color: \'var(--text-primary)\' }}>Manage Students</h3>');
if (manageStudentsStart !== -1) {
    const toInsert = "          </div>\n          )}\n\n          {managementSection === 'users' && (\n";
    content = content.substring(0, manageStudentsStart) + toInsert + content.substring(manageStudentsStart);
}

// Manage Classes
const manageClassesStart = content.indexOf('<div className="bento-card" style={{ padding: \'2rem\' }}>\n            <h3 style={{ fontSize: \'1.25rem\', fontWeight: 700, marginBottom: \'1.5rem\', color: \'var(--text-primary)\' }}>Manage Classes</h3>');
if (manageClassesStart !== -1) {
    const toInsert = "          </div>\n          )}\n\n          {managementSection === 'academics' && (\n            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>\n";
    content = content.substring(0, manageClassesStart) + toInsert + content.substring(manageClassesStart);
}

// Assign Teacher (Back to users, but we'll just group users together in our structure if possible, 
// wait, Assign Teacher is currently after Manage Subjects in the same column?
// Let's just wrap it. But wait, we can't open a new div without closing the previous.
// Manage Subjects ends before Assign Teacher.
const assignTeacherStart = content.indexOf('<div className="bento-card" style={{ padding: \'2rem\' }}>\n            <h3 style={{ fontSize: \'1.25rem\', fontWeight: 700, marginBottom: \'1.5rem\', color: \'var(--text-primary)\' }}>Assign Teacher</h3>');
if (assignTeacherStart !== -1) {
    const toInsert = "          </div>\n          )}\n\n          {managementSection === 'users' && (\n            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>\n";
    content = content.substring(0, assignTeacherStart) + toInsert + content.substring(assignTeacherStart);
}

// Remove Manage News & Announcements
const newsStart = content.indexOf('<div className="bento-card" style={{ padding: \'2rem\' }}>\n            <h3 style={{ fontSize: \'1.25rem\', fontWeight: 700, marginBottom: \'1.5rem\', color: \'var(--text-primary)\' }}>Manage News & Announcements</h3>');
const newsEndStr = '</div>\n\n        </div>\n      </div>\n      </>\n      )}';
const newsEnd = content.indexOf(newsEndStr);
if (newsStart !== -1 && newsEnd !== -1) {
    content = content.substring(0, newsStart) + "          </div>\n          )}\n\n        </div>\n      )}\n" + content.substring(newsEnd + newsEndStr.length);
}

// Clean up wrapping grid cols
content = content.replace('<div className="grid md:grid-cols-2 gap-6">\n        \n        <div className="flex" style={{ flexDirection: \'column\', gap: \'1.5rem\' }}>\n', '');
// The wrapper div end
content = content.replace('</div>\n\n        <div className="flex" style={{ flexDirection: \'column\', gap: \'2rem\' }}>', '');

fs.writeFileSync('src/pages/Admin.jsx', content);
console.log('Done modifying Admin.jsx');
