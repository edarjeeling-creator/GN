import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, 
  Calendar as CalendarIcon, 
  MessageSquare, 
  Bell, 
  Megaphone, 
  FileCheck, 
  UserCheck, 
  BookMarked, 
  AlertCircle, 
  ThumbsUp, 
  BookOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  Check
} from 'lucide-react';
import DashboardSection from '../components/DashboardSection';
import MobileCard from '../components/ui/MobileCard';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useChat } from '../../context/ChatContext';
import { supabase } from '../../lib/supabase';
import MobileCalendarWidget from '../components/MobileCalendarWidget';
import { useNavigate } from 'react-router-dom';

const OverviewCard = ({ title, value, icon, color }) => (
  <MobileCard style={{ 
    padding: '16px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '12px' 
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ 
        width: '40px', 
        height: '40px', 
        borderRadius: '12px', 
        backgroundColor: `${color}15`, 
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {icon}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '13px', color: 'var(--mobile-text-secondary)' }}>{title}</span>
        <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--mobile-text-primary)' }}>{value}</span>
      </div>
    </div>
  </MobileCard>
);

const MobileHome = () => {
  const { profile } = useAuth();
  const { students, attendance } = useData();
  const { unreadCounts } = useChat();

  const [stats, setStats] = useState({
    notices: 0,
    circulars: 0,
    assignments: 0,
    library: 0,
    infractions: 0,
    appreciations: 0,
    syllabus: 0
  });

  const [feed, setFeed] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);

  const studentData = students?.find(s => 
    s.id === profile?.id || 
    (profile?.uid && s.uid === profile.uid) || 
    (profile?.name && s.name && s.name.trim().toLowerCase() === profile.name.trim().toLowerCase())
  );

  useEffect(() => {
    // Fetch stats realistically
    const fetchStats = async () => {
      const { count: noticeCount } = await supabase.from('notices').select('*', { count: 'exact', head: true });
      let assignmentCount = 0;
      if (studentData?.class_id) {
        const { count } = await supabase.from('assignments').select('*', { count: 'exact', head: true }).eq('class_id', studentData.class_id);
        assignmentCount = count;
      }
      
      setStats(prev => ({
        ...prev,
        notices: noticeCount || 0,
        assignments: assignmentCount || 0,
        // The rest have no specific tables yet, use '-' to avoid inventing fake counts
        circulars: '-',
        library: '-',
        infractions: '-',
        appreciations: '-',
        syllabus: '-'
      }));

      // Fetch notices for feed
      const { data: recentNotices } = await supabase.from('notices').select('*').order('publish_date', { ascending: false }).limit(5);
      if (recentNotices) {
        setFeed(recentNotices);
      }

      // Fetch questionnaires if a backend endpoint becomes available, currently empty
      setQuestionnaires([]);
    };

    fetchStats();
  }, [studentData]);

  const totalChatUnread = Object.values(unreadCounts || {}).reduce((a, b) => a + b, 0);
  
  // Calculate attendance
  const studentAttendance = attendance?.filter(a => a.student_id === studentData?.id) || [];
  const totalDays = studentAttendance.length;
  const presentDays = studentAttendance.filter(r => ['Present', 'Late', 'Half Day'].includes(r.status)).length;
  const attendancePercentage = totalDays > 0 ? `${Math.round((presentDays / totalDays) * 100)}%` : '-';

  return (
    <div style={{ paddingTop: '16px' }}>
      
      {/* Overview Section */}
      <DashboardSection 
        title="Overview" 
        icon={<LayoutGrid size={20} color="#a855f7" strokeWidth={2.5} />}
      >
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '12px' 
        }}>
          <OverviewCard title="New Message" value={totalChatUnread} icon={<MessageSquare size={20} />} color="#22c55e" />
          <OverviewCard title="New Notice" value={stats.notices} icon={<Bell size={20} />} color="#d4d4d8" />
          <OverviewCard title="New Circular" value={stats.circulars} icon={<Megaphone size={20} />} color="#d4d4d8" />
          <OverviewCard title="Assignment" value={stats.assignments} icon={<FileCheck size={20} />} color="#f43f5e" />
          <OverviewCard title="My Attendance" value={attendancePercentage} icon={<UserCheck size={20} />} color="#eab308" />
          <OverviewCard title="Library Book Ov..." value={stats.library} icon={<BookMarked size={20} />} color="#a855f7" />
          <OverviewCard title="Infraction" value={stats.infractions} icon={<AlertCircle size={20} />} color="#eab308" />
          <OverviewCard title="Appreciation" value={stats.appreciations} icon={<ThumbsUp size={20} />} color="#a855f7" />
          <OverviewCard title="Syllabus" value={stats.syllabus} icon={<BookOpen size={20} />} color="#a855f7" />
        </div>
      </DashboardSection>

      {/* Calendar Section */}
      <DashboardSection 
        title="Calendar" 
        icon={<CalendarIcon size={20} color="#f97316" strokeWidth={2.5} />}
      >
        <MobileCard>
          <MobileCalendarWidget />
        </MobileCard>
      </DashboardSection>

      {/* Questionnaire Section */}
      <DashboardSection 
        title="Questionnaire" 
        icon={<MessageSquare size={20} color="#0ea5e9" strokeWidth={2.5} />}
      >
        <div className="mobile-horizontal-scroll" style={{ margin: '0 -16px', padding: '0 16px 16px 16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {questionnaires.length === 0 ? (
              <MobileCard style={{ width: '100%', flexShrink: 0 }}>
                <p style={{ color: 'var(--mobile-text-secondary)', fontSize: '14px', margin: 0, textAlign: 'center' }}>No questionnaires available yet.</p>
              </MobileCard>
            ) : (
              questionnaires.map(q => (
                <MobileCard key={q.id} style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                  <p style={{ fontSize: '15px', color: 'var(--mobile-text-primary)', flex: 1, margin: '0 0 24px 0' }}>{q.question}</p>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--mobile-text-secondary)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>{q.student}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--mobile-text-secondary)', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>❤️ <span style={{ color: 'var(--mobile-text-primary)', fontWeight: 'bold' }}>{q.likes}</span></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>💬 <span style={{ color: 'var(--mobile-text-primary)', fontWeight: 'bold' }}>{q.comments}</span></span>
                      {q.verified && <Check size={16} color="#22c55e" />}
                    </div>
                  </div>
                </MobileCard>
              ))
            )}
          </div>
        </div>
      </DashboardSection>

      {/* Feed Section */}
      <DashboardSection 
        title="Feed" 
        icon={<Bell size={20} color="#f59e0b" strokeWidth={2.5} />}
      >
        <div className="mobile-horizontal-scroll" style={{ margin: '0 -16px', padding: '0 16px 16px 16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {feed.length === 0 ? (
              <MobileCard style={{ width: '100%', flexShrink: 0 }}>
                <p style={{ color: 'var(--mobile-text-secondary)', fontSize: '14px', margin: 0, textAlign: 'center' }}>No feed updates available yet.</p>
              </MobileCard>
            ) : (
              feed.map(item => (
                <MobileCard key={item.id} style={{ width: '240px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#3b82f6', backgroundColor: '#eff6ff', padding: '4px 12px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}>
                    <Megaphone size={16} />
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Notice</span>
                  </div>
                  <h3 style={{ fontSize: '15px', margin: '0 0 16px 0', lineHeight: 1.4, color: 'var(--mobile-text-primary)' }}>
                    {item.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--mobile-text-secondary)', fontSize: '12px' }}>
                    <CalendarIcon size={14} /> {new Date(item.publish_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                </MobileCard>
              ))
            )}
          </div>
        </div>
      </DashboardSection>

    </div>
  );
};

export default MobileHome;
