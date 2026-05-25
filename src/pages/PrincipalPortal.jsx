import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Users, BookOpen, Bell, Send, Shield, User } from 'lucide-react';
import Editor, { 
  Toolbar,
  BtnUndo, BtnRedo, BtnBold, BtnItalic, BtnUnderline, BtnStrikeThrough,
  BtnNumberedList, BtnBulletList, BtnLink, BtnClearFormatting, HtmlButton, Separator,
  BtnStyles
} from 'react-simple-wysiwyg';

const PrincipalPortal = () => {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Dashboard state
  const [metrics, setMetrics] = useState({ students: 0, teachers: 0, assignments: 0 });
  const [recentNotices, setRecentNotices] = useState([]);
  
  // Notice state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeAudience, setNoticeAudience] = useState('all');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchMetrics();
    fetchNotices();
  }, []);

  const fetchMetrics = async () => {
    // In a real app, these would be robust COUNT queries
    const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
    const { count: teacherCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
    const { count: assignmentCount } = await supabase.from('assignments').select('*', { count: 'exact', head: true }).eq('status', 'submitted');
    
    setMetrics({
      students: studentCount || 0,
      teachers: teacherCount || 0,
      assignments: assignmentCount || 0
    });
  };

  const fetchNotices = async () => {
    const { data } = await supabase.from('notices').select('*').order('publish_date', { ascending: false }).limit(5);
    if (data) setRecentNotices(data);
  };

  const handleSendNotice = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('notices').insert([{
      sender_uid: user.id,
      title: noticeTitle,
      message: noticeMessage,
      audience: noticeAudience
    }]);

    if (!error) {
      setNoticeTitle('');
      setNoticeMessage('');
      fetchNotices();
      alert('Notice sent successfully!');
    } else {
      alert('Failed to send notice: ' + error.message);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setSearching(true);
    
    // Search profiles by name or UID
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`name.ilike.%${searchQuery}%,id.eq.${searchQuery}`);

    if (data) setSearchResults(data);
    setSearching(false);
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield size={32} className="text-primary" />
        <h1 className="text-2xl font-bold">Principal Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b pb-2">
        <button onClick={() => setActiveTab('overview')} className={`font-bold pb-2 ${activeTab === 'overview' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>Overview</button>
        <button onClick={() => setActiveTab('search')} className={`font-bold pb-2 ${activeTab === 'search' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>User Search</button>
        <button onClick={() => setActiveTab('notices')} className={`font-bold pb-2 ${activeTab === 'notices' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>Notices & Announcements</button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card p-6 bg-white shadow-sm rounded-lg flex items-center gap-4">
            <div className="bg-blue-100 p-4 rounded-full text-blue-600"><Users size={24} /></div>
            <div>
              <p className="text-gray-500 text-sm font-bold uppercase">Total Students</p>
              <h2 className="text-3xl font-black">{metrics.students}</h2>
            </div>
          </div>
          <div className="card p-6 bg-white shadow-sm rounded-lg flex items-center gap-4">
            <div className="bg-green-100 p-4 rounded-full text-green-600"><User size={24} /></div>
            <div>
              <p className="text-gray-500 text-sm font-bold uppercase">Total Teachers</p>
              <h2 className="text-3xl font-black">{metrics.teachers}</h2>
            </div>
          </div>
          <div className="card p-6 bg-white shadow-sm rounded-lg flex items-center gap-4">
            <div className="bg-orange-100 p-4 rounded-full text-orange-600"><BookOpen size={24} /></div>
            <div>
              <p className="text-gray-500 text-sm font-bold uppercase">Pending Assignments</p>
              <h2 className="text-3xl font-black">{metrics.assignments}</h2>
            </div>
          </div>
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="card p-6 bg-white shadow-sm rounded-lg">
          <h2 className="text-xl font-bold mb-4">Global User Search</h2>
          <form onSubmit={handleSearch} className="flex gap-4 mb-6">
            <input 
              type="text" 
              placeholder="Search by Name or UID..." 
              className="input-field flex-1 p-2 border rounded"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary px-6" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchResults.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">Name</th>
                    <th className="p-2">Role</th>
                    <th className="p-2">Class/Subject</th>
                    <th className="p-2">UID</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map(user => (
                    <tr key={user.id} className="border-b">
                      <td className="p-2 font-bold">{user.name}</td>
                      <td className="p-2 uppercase text-sm text-gray-500">{user.role}</td>
                      <td className="p-2">{user.class ? `${user.class} ${user.section || ''}` : (user.subject || 'N/A')}</td>
                      <td className="p-2 text-xs text-gray-400">{user.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Notices Tab */}
      {activeTab === 'notices' && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card p-6 bg-white shadow-sm rounded-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Send size={20} /> Create Notice</h2>
            <form onSubmit={handleSendNotice} className="flex flex-col gap-4">
              <div>
                <label className="block font-bold mb-1">Notice Title</label>
                <input required type="text" className="input-field w-full p-2 border rounded" value={noticeTitle} onChange={e => setNoticeTitle(e.target.value)} />
              </div>
              <div className="mb-8">
                <label className="block font-bold mb-1">Message</label>
                <div style={{ marginBottom: '10px' }}>
                  <Editor value={noticeMessage} onChange={e => setNoticeMessage(e.target.value)} style={{ minHeight: '150px' }}>
                    <Toolbar>
                      <BtnUndo />
                      <BtnRedo />
                      <Separator />
                      <BtnBold />
                      <BtnItalic />
                      <BtnUnderline />
                      <BtnStrikeThrough />
                      <Separator />
                      <BtnNumberedList />
                      <BtnBulletList />
                      <Separator />
                      <BtnLink />
                      <BtnClearFormatting />
                      <HtmlButton />
                      <BtnStyles />
                      <Separator />
                      <div className="flex items-center" style={{ padding: '0 4px' }}>
                        <input 
                          type="color" 
                          title="Text Color"
                          className="cursor-pointer" 
                          style={{ padding: 0, width: '22px', height: '22px', border: 'none', background: 'transparent' }}
                          onChange={(e) => {
                            e.preventDefault();
                            document.execCommand('foreColor', false, e.target.value);
                          }} 
                        />
                      </div>
                    </Toolbar>
                  </Editor>
                </div>
              </div>
              <div>
                <label className="block font-bold mb-1">Target Audience</label>
                <select className="input-field w-full p-2 border rounded" value={noticeAudience} onChange={e => setNoticeAudience(e.target.value)}>
                  <option value="all">Entire School</option>
                  <option value="students">Just the students</option>
                  <option value="teachers">Just the teachers</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary mt-2">Publish Notice</button>
            </form>
          </div>

          <div className="card p-6 bg-white shadow-sm rounded-lg">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Bell size={20} /> Recent Notices</h2>
            {recentNotices.length === 0 ? <p className="text-gray-500">No recent notices.</p> : (
              <div className="flex flex-col gap-4">
                {recentNotices.map(notice => (
                  <div key={notice.id} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-lg">{notice.title}</h3>
                      <span className="text-xs font-bold uppercase bg-gray-200 px-2 py-1 rounded text-gray-600">{notice.audience}</span>
                    </div>
                    <div className="text-gray-600 text-sm" dangerouslySetInnerHTML={{ __html: notice.message }}></div>
                    <p className="text-xs text-gray-400 mt-2">{new Date(notice.publish_date).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PrincipalPortal;
