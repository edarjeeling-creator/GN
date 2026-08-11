import React from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import AcademicReports from '../components/AcademicReports';
import { Button } from '../components/ui/Button';
import { ArrowLeft } from 'lucide-react';

const SubjectAcademicReport = () => {
  const { classId, subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const term = searchParams.get('term') || 'Midterm';
  const navigate = useNavigate();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="no-print mb-6">
        <Button variant="outline" onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-800">
          <ArrowLeft size={16} className="mr-2" /> Back to Marks Entry
        </Button>
      </div>
      <AcademicReports 
        preselectedClassId={classId} 
        preselectedSubjectId={subjectId} 
        preselectedTerm={term}
        hideControls={true}
      />
    </div>
  );
};

export default SubjectAcademicReport;
