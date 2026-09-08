import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeProvider';
import ProtectedRoute from './components/ProtectedRoute';
import { AdminRoute, TeacherRoute, StudentRoute, PrincipalRoute, FeatureRoute, ParentRoute, AccountantRoute, LibrarianRoute } from './components/RouteGuards';
import PublicLayout from './components/PublicLayout';
import Home from './pages/Home';
import { About, Academics, Admissions, Faculty, Contact, Gallery } from './pages/PublicPages';
import MandatoryDisclosures from './pages/MandatoryDisclosures';
import { Capacitor } from '@capacitor/core';
import MobileAppShell from './mobile/layouts/MobileAppShell';
import MobileProtectedRoute from './mobile/components/MobileProtectedRoute';

// Lazy-loaded pages for optimal build performance & instant loading
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Classes = lazy(() => import('./pages/Classes'));
const SubjectMarks = lazy(() => import('./pages/SubjectMarks'));
const SubjectAcademicReport = lazy(() => import('./pages/SubjectAcademicReport'));
const Flowsheet = lazy(() => import('./pages/Flowsheet'));
const ReportCards = lazy(() => import('./pages/ReportCards'));
const ResultPortal = lazy(() => import('./pages/ResultPortal'));
const PrincipalPortal = lazy(() => import('./pages/PrincipalPortal'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const ParentPortal = lazy(() => import('./pages/ParentPortal'));
const StudyMaterials = lazy(() => import('./pages/StudyMaterials'));
const Assignments = lazy(() => import('./pages/Assignments'));
const Admin = lazy(() => import('./pages/Admin'));
const FeesDashboard = lazy(() => import('./pages/FeesDashboard'));
const LibraryDashboard = lazy(() => import('./pages/LibraryDashboard'));
const CommunicationHub = lazy(() => import('./pages/CommunicationHub'));
const StudentSearch = lazy(() => import('./pages/StudentSearch'));
const Attendance = lazy(() => import('./pages/Attendance'));
const AttendanceReports = lazy(() => import('./pages/AttendanceReports'));
const WeeklyTests = lazy(() => import('./pages/WeeklyTests'));
const QRAttendanceScanner = lazy(() => import('./pages/QRAttendanceScanner'));
const PythonTeacher = lazy(() => import('./pages/PythonTeacher'));
const PythonStudent = lazy(() => import('./pages/PythonStudent'));
const PublicIDForm = lazy(() => import('./pages/PublicIDForm'));
const ClassTeacherPortal = lazy(() => import('./pages/ClassTeacherPortal'));

// HPC Module
const HPCConfiguration = lazy(() => import('./pages/hpc/HPCConfiguration'));
const HPCAssessmentWorkspace = lazy(() => import('./pages/hpc/HPCAssessmentWorkspace'));
const HPCReview = lazy(() => import('./pages/hpc/HPCReview'));
const HPCStudentProfile = lazy(() => import('./pages/hpc/HPCStudentProfile'));

// Mobile App Shell & Pages
const MobileHome = lazy(() => import('./mobile/pages/MobileHome'));
const MobileProfile = lazy(() => import('./mobile/pages/MobileProfile'));
const MobileMessages = lazy(() => import('./mobile/pages/MobileMessages'));
const MobileSettings = lazy(() => import('./mobile/pages/MobileSettings'));
const MobileCalendar = lazy(() => import('./mobile/pages/MobileCalendar'));

const PageLoader = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
    <div style={{ width: '36px', height: '36px', border: '3px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

function App() {
  const isNative = Capacitor.isNativePlatform();

  return (
    <ThemeProvider>
      <>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Mobile Native App Entry point redirection */}
              {isNative && (
                <Route path="/" element={<Navigate to="/m/dashboard" replace />} />
              )}
            
            {/* Public Routes with PublicLayout */}
            {!isNative && <Route path="/" element={<PublicLayout><Home /></PublicLayout>} /> }
            <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
            <Route path="/academics" element={<PublicLayout><Academics /></PublicLayout>} />
            <Route path="/admissions" element={<PublicLayout><Admissions /></PublicLayout>} />
            <Route path="/faculty" element={<PublicLayout><Faculty /></PublicLayout>} />
            <Route path="/gallery" element={<PublicLayout><Gallery /></PublicLayout>} />
            <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
            <Route path="/mandatory-disclosures" element={<PublicLayout><MandatoryDisclosures /></PublicLayout>} />
            <Route path="/notices" element={<PublicLayout><MandatoryDisclosures /></PublicLayout>} />
            
            {/* Standalone Public Pages */}
            <Route path="/login" element={<Login />} />
            <Route path="/pay-fees" element={<ParentPortal />} />
            <Route path="/result" element={<ResultPortal />} />
            <Route path="/id-form/:role/:id" element={<PublicIDForm />} />
            
            {/* Standalone Protected Kiosk Routes (No Layout) */}
            <Route path="/kiosk/attendance" element={<TeacherRoute><QRAttendanceScanner /></TeacherRoute>} />

            {/* Protected Dashboard Routes */}
            <Route element={<ProtectedRoute />}>
              {/* Common Authenticated Routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/study-materials" element={<StudyMaterials />} />
              <Route path="/assignments" element={<Assignments />} />
              <Route path="/hub" element={<TeacherRoute><CommunicationHub /></TeacherRoute>} />
              
              {/* Student Only Routes */}
              <Route path="/student-portal" element={<StudentRoute><StudentPortal /></StudentRoute>} />
              <Route path="/python-student" element={<FeatureRoute featureName="python_portal" userType="class"><PythonStudent /></FeatureRoute>} />

              {/* Parent Only Routes */}
              <Route path="/parent-portal" element={<ParentRoute><ParentPortal /></ParentRoute>} />

              {/* Teacher & Admin Routes */}
              <Route path="/classes" element={<TeacherRoute><Classes /></TeacherRoute>} />
              <Route path="/class-teacher-portal/:classId" element={<TeacherRoute><ClassTeacherPortal /></TeacherRoute>} />
              <Route path="/python-teacher" element={<FeatureRoute featureName="python_portal" userType="teacher"><PythonTeacher /></FeatureRoute>} />
              <Route path="/classes/:classId/subjects/:subjectId" element={<TeacherRoute><SubjectMarks /></TeacherRoute>} />
              <Route path="/classes/:classId/subjects/:subjectId/report" element={<TeacherRoute><SubjectAcademicReport /></TeacherRoute>} />
              <Route path="/classes/:classId/flowsheet" element={<TeacherRoute><Flowsheet /></TeacherRoute>} />
              <Route path="/classes/:classId/reports" element={<TeacherRoute><ReportCards /></TeacherRoute>} />
              <Route path="/attendance" element={<TeacherRoute><Attendance /></TeacherRoute>} />
              <Route path="/weekly-tests" element={<TeacherRoute><WeeklyTests /></TeacherRoute>} />

              {/* Principal & Admin Routes */}
              <Route path="/principal" element={<PrincipalRoute><PrincipalPortal /></PrincipalRoute>} />
              <Route path="/analytics" element={<PrincipalRoute><AttendanceReports /></PrincipalRoute>} />
              <Route path="/search" element={<PrincipalRoute><StudentSearch /></PrincipalRoute>} />
              
              {/* Admin Only Routes */}
              <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
              
              {/* HPC Routes */}
              <Route path="/hpc/config" element={<AdminRoute><HPCConfiguration /></AdminRoute>} />
              <Route path="/hpc/workspace" element={<TeacherRoute><HPCAssessmentWorkspace /></TeacherRoute>} />
              <Route path="/hpc/review" element={<PrincipalRoute><HPCReview /></PrincipalRoute>} />
              <Route path="/hpc/my-card" element={<StudentRoute><HPCStudentProfile /></StudentRoute>} />
              
              {/* Accountant & Admin Routes */}
              <Route path="/fees" element={<AccountantRoute><FeesDashboard /></AccountantRoute>} />
              
              {/* Library Routes */}
              <Route path="/library" element={<LibrarianRoute><LibraryDashboard /></LibrarianRoute>} />
            </Route>

            {/* Mobile App Specific Routes */}
            <Route path="/m" element={<MobileProtectedRoute />}>
              <Route element={<MobileAppShell />}>
                <Route path="dashboard" element={<MobileHome />} />
                <Route path="profile" element={<MobileProfile />} />
                <Route path="messages" element={<MobileMessages />} />
                <Route path="settings" element={<MobileSettings />} />
                
                {/* Fallbacks for features not yet implemented in mobile */}
                <Route path="assignments" element={<div style={{padding: '24px'}}>Assignments coming soon</div>} />
                <Route path="syllabus" element={<div style={{padding: '24px'}}>Syllabus coming soon</div>} />
                <Route path="timetable" element={<div style={{padding: '24px'}}>Timetable coming soon</div>} />
                <Route path="calendar" element={<MobileCalendar />} />
              </Route>
            </Route>

          </Routes>
          </Suspense>
        </Router>
      </>
    </ThemeProvider>
  );
}

export default App;
