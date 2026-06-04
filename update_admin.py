import re

with open('src/pages/Admin.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace news state with managementSection
content = re.sub(
    r"const \[news, setNews\] = useState\(\[\]\);\s*const \[newNewsContent, setNewNewsContent\] = useState\(''\);",
    r"const [managementSection, setManagementSection] = useState('overview');",
    content
)

# 2. Remove fetchNews from useEffect
content = re.sub(
    r"fetchStats\(\);\s*fetchNews\(\);",
    r"fetchStats();",
    content
)

# 3. Remove the 4 news functions
start_idx = content.find("const fetchNews = async () => {")
end_idx = content.find("const handleAddClass = async (e) => {")
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + content[end_idx:]

# 4. Restructure the JSX
dashboard_start = content.find("{activeTab === 'dashboard' && (")
dashboard_after_grid = content.find('<div className="grid md:grid-cols-2 gap-6">')

select_html = """{activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
            <label style={{ fontWeight: 'bold', color: '#475569' }}>Select Section:</label>
            <select 
              className="input-field" 
              value={managementSection} 
              onChange={e => setManagementSection(e.target.value)}
              style={{ minWidth: '250px', background: 'white' }}
            >
              <option value="overview">Overview & Analytics</option>
              <option value="users">Manage Users & Teachers</option>
              <option value="academics">Manage Classes & Subjects</option>
              <option value="data">Data Import & Export</option>
            </select>
          </div>

          {managementSection === 'overview' && (
            <>"""

content = content.replace("{activeTab === 'dashboard' && (\n        <>", select_html)

# End overview section after Class Performance Analytics
analytics_end = content.find('</ResponsiveContainer>\n            </div>\n          </div>') + len('</ResponsiveContainer>\n            </div>\n          </div>')
content = content[:analytics_end] + "\n            </>\n          )}\n          {managementSection === 'data' && (\n            <div className=\"flex\" style={{ flexDirection: 'column', gap: '1.5rem' }}>\n" + content[analytics_end:]

# Data section ends before Manage Students
manage_students_start = content.find('<div className="bento-card" style={{ padding: \'2rem\' }}>\n            <h3 style={{ fontSize: \'1.25rem\', fontWeight: 700, marginBottom: \'1.5rem\', color: \'var(--text-primary)\' }}>Manage Students</h3>')
content = content[:manage_students_start] + "\n            </div>\n          )}\n          {managementSection === 'users' && (\n            <div className=\"flex\" style={{ flexDirection: 'column', gap: '2rem' }}>\n" + content[manage_students_start:]

# Academics section starts before Manage Classes
manage_classes_start = content.find('<div className="bento-card" style={{ padding: \'2rem\' }}>\n            <h3 style={{ fontSize: \'1.25rem\', fontWeight: 700, marginBottom: \'1.5rem\', color: \'var(--text-primary)\' }}>Manage Classes</h3>')
content = content[:manage_classes_start] + "\n            </div>\n          )}\n          {managementSection === 'academics' && (\n            <div className=\"flex\" style={{ flexDirection: 'column', gap: '2rem' }}>\n" + content[manage_classes_start:]

# Users section resumes before Assign Teacher (Actually users shouldn't resume, wait)
assign_teacher_start = content.find('<div className="bento-card" style={{ padding: \'2rem\' }}>\n            <h3 style={{ fontSize: \'1.25rem\', fontWeight: 700, marginBottom: \'1.5rem\', color: \'var(--text-primary)\' }}>Assign Teacher</h3>')
content = content[:assign_teacher_start] + "\n            </div>\n          )}\n          {managementSection === 'users' && (\n            <div className=\"flex\" style={{ flexDirection: 'column', gap: '2rem' }}>\n" + content[assign_teacher_start:]

# Remove News & Announcements UI block
news_ui_start = content.find('<div className="bento-card" style={{ padding: \'2rem\' }}>\n            <h3 style={{ fontSize: \'1.25rem\', fontWeight: 700, marginBottom: \'1.5rem\', color: \'var(--text-primary)\' }}>Manage News & Announcements</h3>')
news_ui_end = content.find('</div>\n\n        </div>\n      </div>\n      </>\n      )}')
if news_ui_start != -1 and news_ui_end != -1:
    content = content[:news_ui_start] + "\n            </div>\n          )}\n" + content[news_ui_end:]
    
# Remove grid divs
content = content.replace('<div className="grid md:grid-cols-2 gap-6">', '')
content = content.replace('<div className="flex" style={{ flexDirection: \'column\', gap: \'1.5rem\' }}>\n', '')
content = content.replace('<div className="flex" style={{ flexDirection: \'column\', gap: \'2rem\' }}>\n', '')

# Replace remaining artifacts of the dashboard wrapper
content = content.replace('</div>\n\n        </div>\n      </div>\n      </>\n      )}', '</div>\n      )}')
content = content.replace('</div>\n      </>\n      )}', '</div>\n      )}')
content = content.replace('</div>\n          )}\n\n        </div>\n      </div>\n      </>\n      )}', '</div>\n      )}')

with open('src/pages/Admin.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
