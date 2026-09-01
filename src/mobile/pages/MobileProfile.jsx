import React from 'react';
import { 
  User, 
  Headphones, 
  Layout, 
  Briefcase, 
  Trophy, 
  Users, 
  UserCheck, 
  PersonStanding
} from 'lucide-react';
import MobileCard from '../components/ui/MobileCard';
import AccordionSection from '../components/AccordionSection';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

const StatCard = ({ title, value, subtext, icon, color }) => (
  <MobileCard style={{ 
    width: '140px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px'
  }}>
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      backgroundColor: `${color}15`,
      color: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {icon}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--mobile-text-primary)' }}>{value}</span>
      <span style={{ fontSize: '12px', color: 'var(--mobile-text-secondary)' }}>{title}</span>
      {subtext && <span style={{ fontSize: '12px', color: 'var(--mobile-text-secondary)' }}>{subtext}</span>}
    </div>
  </MobileCard>
);

const InfoRow = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
    <span style={{ fontSize: '12px', color: 'var(--mobile-text-secondary)', marginBottom: '4px' }}>{label}</span>
    <span style={{ fontSize: '14px', color: 'var(--mobile-text-primary)', fontWeight: 500 }}>{value || 'Not provided'}</span>
  </div>
);

const MobileProfile = () => {
  const { profile } = useAuth();
  const { students, classes, attendance } = useData();

  const studentData = students?.find(s => 
    s.id === profile?.id || 
    (profile?.uid && s.uid === profile.uid) || 
    (profile?.name && s.name && s.name.trim().toLowerCase() === profile.name.trim().toLowerCase())
  );
  
  const studentClass = classes?.find(c => c.id === studentData?.class_id);
  const className = studentClass ? `${studentClass.name}-${studentClass.section || ''}` : '';
  const profileImage = profile?.picture_url || studentData?.picture_url;
  const displayName = profile?.name || studentData?.name || 'STUDENT';
  const studentId = studentData?.uid || profile?.uid || 'N/A';

  const studentAttendance = attendance?.filter(a => a.student_id === studentData?.id) || [];
  const totalDays = studentAttendance.length;
  const presentDays = studentAttendance.filter(r => ['Present', 'Late', 'Half Day'].includes(r.status)).length;
  const attendancePercentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(2) : '0';
  
  const absentDays = studentAttendance.filter(r => ['Absent', 'Leave'].includes(r.status)).length;

  return (
    <div style={{ padding: '24px 16px' }}>
      
      {/* Profile Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          overflow: 'hidden',
          backgroundColor: '#e5e7eb',
          border: '4px solid white',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--mobile-text-secondary)',
          fontSize: '32px'
        }}>
          {profileImage ? (
            <img src={profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span>{displayName.charAt(0)}</span>
          )}
        </div>
        
        <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 'bold', color: 'var(--mobile-text-primary)' }}>
          {displayName}
        </h2>
        <span style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)', marginBottom: '4px' }}>
          {className}
        </span>
        <span style={{ fontSize: '14px', color: 'var(--mobile-text-secondary)', marginBottom: '24px' }}>
          {studentId}
        </span>
        
        <button style={{
          width: '100%',
          maxWidth: '300px',
          padding: '14px 0',
          borderRadius: '30px',
          border: '2px solid var(--mobile-primary)',
          backgroundColor: 'transparent',
          color: 'var(--mobile-primary)',
          fontWeight: 'bold',
          fontSize: '16px',
          cursor: 'pointer'
        }}>
          Manage accounts
        </button>
      </div>

      {/* Stats Cards */}
      <div className="mobile-horizontal-scroll" style={{ margin: '0 -16px 24px -16px', padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: '16px' }}>
          <StatCard 
            title="Attendance" 
            value={`${attendancePercentage}%`} 
            icon={<UserCheck size={18} />} 
            color="#d97706" 
          />
          <StatCard 
            title="Leaves" 
            value={`${absentDays}/120`} 
            icon={<PersonStanding size={18} />} 
            color="#d97706" 
          />
          <StatCard 
            title="Last Exam Result" 
            value="N/A" 
            icon={<Trophy size={18} />} 
            color="#22c55e" 
          />
        </div>
      </div>

      {/* Accordions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
        
        <AccordionSection icon={<User size={20} />} title="Essentials" iconBg="#eef2ff" iconColor="#6366f1">
          <InfoRow label="Name" value={displayName} />
          <InfoRow label="Date of Birth" value={studentData?.dob} />
          <InfoRow label="Gender" value={studentData?.gender} />
        </AccordionSection>
        
        <AccordionSection icon={<Headphones size={20} />} title="Unique Ids" iconBg="#ecfdf5" iconColor="#10b981">
          <InfoRow label="Student UID" value={studentId} />
          <InfoRow label="Roll No" value={studentData?.roll_no} />
        </AccordionSection>
        
        <AccordionSection icon={<Layout size={20} />} title="Address & Communication" iconBg="#fff1f2" iconColor="#f43f5e">
          <InfoRow label="Address" value={studentData?.address} />
          <InfoRow label="Phone" value={studentData?.phone} />
          <InfoRow label="Email" value={profile?.email} />
        </AccordionSection>
        
        <AccordionSection icon={<Briefcase size={20} />} title="Academic Mapping" iconBg="#eff6ff" iconColor="#3b82f6">
          <InfoRow label="Class" value={className} />
          <InfoRow label="Second Language" value={studentData?.second_language} />
          <InfoRow label="Third Language" value={studentData?.third_language} />
        </AccordionSection>
        
        <AccordionSection icon={<Trophy size={20} />} title="Personal Details" iconBg="#f0fdf4" iconColor="#22c55e">
          <InfoRow label="Blood Group" value={studentData?.blood_group} />
          <InfoRow label="Nationality" value="Indian" />
        </AccordionSection>
        
        <AccordionSection icon={<Users size={20} />} title="Family" iconBg="#faf5ff" iconColor="#a855f7">
          <InfoRow label="Father's Name" value={studentData?.father_name} />
          <InfoRow label="Mother's Name" value={studentData?.mother_name} />
          <InfoRow label="Guardian Phone" value={studentData?.guardian_phone} />
        </AccordionSection>

        <AccordionSection icon={<Headphones size={20} />} title="Health & Medical" iconBg="#ecfdf5" iconColor="#10b981">
          <InfoRow label="Medical Conditions" value={studentData?.medical_history} />
          <InfoRow label="Emergency Contact" value={studentData?.emergency_contact} />
        </AccordionSection>
      </div>

    </div>
  );
};

export default MobileProfile;
