import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeProvider';
import ProtectedRoute from './components/ProtectedRoute';
import { AdminRoute, TeacherRoute, StudentRoute, PrincipalRoute, FeatureRoute } from './components/RouteGuards';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import SubjectMarks from './pages/SubjectMarks';
import Flowsheet from './pages/Flowsheet';
import ReportCards from './pages/ReportCards';
import ResultPortal from './pages/ResultPortal';
import PrincipalPortal from './pages/PrincipalPortal';
import StudentPortal from './pages/StudentPortal';
import ParentPortal from './pages/ParentPortal';
import StudyMaterials from './pages/StudyMaterials';
import Assignments from './pages/Assignments';
import Admin from './pages/Admin';
import StudentSearch from './pages/StudentSearch';
import Attendance from './pages/Attendance';
import AttendanceReports from './pages/AttendanceReports';
import PythonTeacher from './pages/PythonTeacher';
import PythonStudent from './pages/PythonStudent';
import PublicLayout from './components/PublicLayout';
import Home from './pages/Home';
import { About, Academics, Admissions, Faculty, Contact, Gallery } from './pages/PublicPages';
import MandatoryDisclosures from './pages/MandatoryDisclosures';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public Routes with PublicLayout */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
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
          <Route path="/result" element={<ResultPortal />} />
          
          {/* Protected Dashboard Routes */}
          <Route element={<ProtectedRoute />}>
            {/* Common Authenticated Routes */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/study-materials" element={<StudyMaterials />} />
            <Route path="/assignments" element={<Assignments />} />
            
            {/* Student Only Routes */}
            <Route path="/student-portal" element={<StudentRoute><StudentPortal /></StudentRoute>} />
            <Route path="/python-student" element={<FeatureRoute featureName="python_portal" userType="class"><PythonStudent /></FeatureRoute>} />

            {/* Parent Only Routes */}
            <Route path="/parent-portal" element={<ParentRoute><ParentPortal /></ParentRoute>} />

            {/* Teacher & Admin Routes */}
            <Route path="/classes" element={<TeacherRoute><Classes /></TeacherRoute>} />
            <Route path="/python-teacher" element={<FeatureRoute featureName="python_portal" userType="teacher"><PythonTeacher /></FeatureRoute>} />
            <Route path="/classes/:classId/subjects/:subjectId" element={<TeacherRoute><SubjectMarks /></TeacherRoute>} />
            <Route path="/classes/:classId/flowsheet" element={<TeacherRoute><Flowsheet /></TeacherRoute>} />
            <Route path="/classes/:classId/reports" element={<TeacherRoute><ReportCards /></TeacherRoute>} />
            <Route path="/attendance" element={<TeacherRoute><Attendance /></TeacherRoute>} />

            {/* Principal & Admin Routes */}
            <Route path="/principal" element={<PrincipalRoute><PrincipalPortal /></PrincipalRoute>} />
            <Route path="/analytics" element={<PrincipalRoute><AttendanceReports /></PrincipalRoute>} />
            <Route path="/search" element={<PrincipalRoute><StudentSearch /></PrincipalRoute>} />
            
            {/* Admin Only Routes */}
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
