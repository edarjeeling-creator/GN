import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import SubjectMarks from './pages/SubjectMarks';
import Flowsheet from './pages/Flowsheet';
import ReportCards from './pages/ReportCards';
import ResultPortal from './pages/ResultPortal';
import PrincipalPortal from './pages/PrincipalPortal';
import Admin from './pages/Admin';
import StudentSearch from './pages/StudentSearch';
import Attendance from './pages/Attendance';
import AttendanceReports from './pages/AttendanceReports';
import PublicLayout from './components/PublicLayout';
import Home from './pages/Home';
import { About, Academics, Admissions, Faculty, Contact } from './pages/PublicPages';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes with PublicLayout */}
        <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
        <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
        <Route path="/academics" element={<PublicLayout><Academics /></PublicLayout>} />
        <Route path="/admissions" element={<PublicLayout><Admissions /></PublicLayout>} />
        <Route path="/faculty" element={<PublicLayout><Faculty /></PublicLayout>} />
        <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
        
        {/* Standalone Public Pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/result" element={<ResultPortal />} />
        <Route path="/principal" element={<PrincipalPortal />} />
        
        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/classes/:classId/subjects/:subjectId" element={<SubjectMarks />} />
          <Route path="/classes/:classId/flowsheet" element={<Flowsheet />} />
          <Route path="/classes/:classId/reports" element={<ReportCards />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/analytics" element={<AttendanceReports />} />
          <Route path="/search" element={<StudentSearch />} />
          <Route path="/admin" element={<Admin />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
