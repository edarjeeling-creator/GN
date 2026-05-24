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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/result" element={<ResultPortal />} />
        <Route path="/principal" element={<PrincipalPortal />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
