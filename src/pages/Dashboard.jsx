import { useData } from '../context/DataContext';

const Dashboard = () => {
  const { classes, teacherSubjects, marks, students, academicYear } = useData();

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
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, Teacher!</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        <div className="card">
          <h3>My Classes</h3>
          <p className="mt-2 text-primary" style={{ fontSize: '2rem', fontWeight: 'bold' }}>{totalAssignedClasses}</p>
        </div>
        <div className="card">
          <h3>Pending Entries</h3>
          <p className="mt-2 text-warning" style={{ fontSize: '2rem', fontWeight: 'bold' }}>{pendingEntries}</p>
        </div>
        <div className="card">
          <h3>Reports Ready</h3>
          <p className="mt-2 text-success" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
            {totalAssignedClasses > 0 && pendingEntries === 0 ? 'All Complete' : 'Pending Data'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
