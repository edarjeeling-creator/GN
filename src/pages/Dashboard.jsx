import { useData } from '../context/DataContext';
import { motion } from 'framer-motion';
import { BookOpen, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { classes, teacherSubjects, marks, students, academicYear } = useData();
  const { profile } = useAuth();

  // Calculate real stats based on filtered classes
  const assignedActiveClasses = Object.keys(teacherSubjects).filter(classId => classes.some(c => c.id === classId));
  const totalAssignedClasses = assignedActiveClasses.length;
  
  // Pending entries: For every assigned subject in every assigned class, every student should have 4 marks.
  let pendingEntries = 0;
  assignedActiveClasses.forEach(classId => {
    const classStudents = students.filter(s => s.class_id === classId);
    const subjectIds = teacherSubjects[classId] || [];
    
    // Only count classes that belong to the active year!
    const cls = classes.find(c => c.id === classId);
    if (!cls) return;

    classStudents.forEach(student => {
      subjectIds.forEach(subId => {
        ['Midterm_Exam', 'Midterm_Test', 'Finalterm_Exam', 'Finalterm_Test'].forEach(term => {
          const fullTerm = `${academicYear}_${term}`;
          const key = `${student.id}_${subId}_${fullTerm}`;
          if (marks[key] === undefined || marks[key] === null || marks[key] === '') {
            pendingEntries++;
          }
        });
      });
    });
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <div className="page-header" style={{ borderBottom: 'none', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Welcome back, <strong style={{ color: 'var(--primary-color)' }}>{profile?.name || 'Teacher'}</strong>. Here's your overview for {academicYear}.</p>
        </div>
      </div>
      
      <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        
        <motion.div whileHover={{ y: -5 }} className="bento-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>My Classes</h3>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={24} />
            </div>
          </div>
          <p style={{ fontSize: '3rem', fontWeight: 900, color: '#3b82f6', lineHeight: 1 }}>{totalAssignedClasses}</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Active classes assigned to you</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bento-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Pending Entries</h3>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={24} />
            </div>
          </div>
          <p style={{ fontSize: '3rem', fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>{pendingEntries}</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Marks requiring input this term</p>
        </motion.div>

        <motion.div whileHover={{ y: -5 }} className="bento-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: `4px solid ${pendingEntries === 0 ? '#10b981' : '#ef4444'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Report Status</h3>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: pendingEntries === 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: pendingEntries === 0 ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pendingEntries === 0 ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
            </div>
          </div>
          <p style={{ fontSize: '2rem', fontWeight: 800, color: pendingEntries === 0 ? '#10b981' : '#ef4444', lineHeight: 1.2, marginTop: 'auto' }}>
            {totalAssignedClasses === 0 ? 'No Classes' : (pendingEntries === 0 ? 'Ready to Print' : 'Awaiting Data')}
          </p>
        </motion.div>

      </div>
      
      {/* Interactive Quick Actions (Placeholder) */}
      <div style={{ marginTop: '3rem' }}>
         <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Quick Actions</h3>
         <div className="bento-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="bento-card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.5rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'border 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-color)'}>
               <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '1rem', color: '#3b82f6' }}><Users size={28} /></div>
               <div>
                 <strong style={{ display: 'block', fontSize: '1.1rem' }}>Enter Marks</strong>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Navigate to classes to input marks</span>
               </div>
            </div>
            <div className="bento-card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', padding: '1.5rem', cursor: 'pointer', border: '1px solid var(--border-color)', transition: 'border 0.2s' }} onMouseOver={e=>e.currentTarget.style.borderColor='var(--primary-color)'} onMouseOut={e=>e.currentTarget.style.borderColor='var(--border-color)'}>
               <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '1rem', color: '#10b981' }}><CheckCircle size={28} /></div>
               <div>
                 <strong style={{ display: 'block', fontSize: '1.1rem' }}>Generate Reports</strong>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Review flowsheet and print cards</span>
               </div>
            </div>
         </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
