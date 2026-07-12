import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Lock, Unlock, CheckCircle2, Eye, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useData } from '../../context/DataContext';

const ResultStatusManager = ({ classes, academicYear, profile }) => {
  const { students, marks, teacherSubjects, subjects } = useData();
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  const TERMS = [
    { id: 'Midterm_Exam', name: 'Mid-Term Exam' },
    { id: 'Finalterm_Exam', name: 'Final-Term Exam' }
  ];

  const fetchStatuses = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('marks_status').select('*');
    if (!error && data) {
      setStatuses(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const updateStatus = async (classId, term, newStatus) => {
    const fullTerm = `${academicYear}_${term}`;
    
    // Transition rules:
    // Draft -> Verified -> Locked -> Published
    if (newStatus === 'Verified' && currentStatus !== 'Draft') {
      alert('Only Draft results can be Verified.');
      return;
    }

    if (newStatus === 'Locked' && profile?.role !== 'admin') {
      alert('Only administrators can lock results.');
      return;
    }

    if (newStatus === 'Draft' && profile?.role !== 'admin') { 
      alert('Only Super Administrators can unlock results back to Draft.');
      return;
    }
    
    // Check missing marks before Verified or Locked
    if (newStatus === 'Verified' || newStatus === 'Locked') {
      const missing = getMissingMarks(classId, term);
      if (missing > 0) {
        const confirmMsg = `There are ${missing} missing marks for this class. Are you sure you want to proceed?`;
        if (!window.confirm(confirmMsg)) return;
      }
    }

    const { error } = await supabase.from('marks_status').upsert({
      class_id: classId,
      term: fullTerm,
      status: newStatus,
      updated_by: profile?.id
    }, { onConflict: 'class_id,term' });

    if (error) {
      console.error(error);
      alert('Failed to update status.');
    } else {
      if (newStatus === 'Published') {
        // Freeze the template
        const { data: activeTemplate } = await supabase
          .from('report_templates')
          .select('settings, type, name')
          .eq('is_active', true)
          .eq('type', term.includes('Midterm') ? 'Mid-Term' : 'Final-Term') // basic mapping
          .limit(1)
          .single();
          
        if (activeTemplate) {
           await supabase.from('generated_reports').upsert({
             academic_year: academicYear,
             term: fullTerm,
             class_id: classId,
             template_snapshot: activeTemplate.settings,
             generated_by: profile?.id
           }, { onConflict: 'class_id,term,academic_year' });
        }
      }
      
      fetchStatuses();
    }
  };

  const getStatus = (classId, term) => {
    const fullTerm = `${academicYear}_${term}`;
    const status = statuses.find(s => s.class_id === classId && s.term === fullTerm);
    return status ? status.status : 'Draft';
  };

  const getMissingMarks = (classId, term) => {
    const classStudents = students.filter(s => s.class_id === classId);
    if (classStudents.length === 0) return 0;
    
    const assignedSubjects = teacherSubjects[classId] || [];
    if (assignedSubjects.length === 0) return 0; // If no subjects assigned, we can't check properly, assume 0
    
    const fullTerm = `${academicYear}_${term}`;
    let missingCount = 0;
    
    classStudents.forEach(stu => {
      assignedSubjects.forEach(subId => {
        // We only check the main Exam term score to simplify
        const key = `${stu.id}_${subId}_${fullTerm}`;
        if (marks[key] === undefined || marks[key] === null) {
          missingCount++;
        }
      });
    });
    
    return missingCount;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Lock size={20} className="text-primary" />
          Result Publishing Workflow
        </CardTitle>
        <Button variant="outline" size="sm" onClick={fetchStatuses} disabled={loading}>
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Class</th>
                {TERMS.map(term => <th key={term.id} className="text-center">{term.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {classes.map(cls => (
                <tr key={cls.id}>
                  <td className="font-semibold text-slate-800">{cls.name} {cls.section}</td>
                  {TERMS.map(term => {
                    const currentStatus = getStatus(cls.id, term.id);
                    return (
                      <td key={term.id} className="text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            currentStatus === 'Draft' ? 'bg-slate-100 text-slate-600' :
                            currentStatus === 'Verified' ? 'bg-blue-100 text-blue-600' :
                            currentStatus === 'Locked' ? 'bg-orange-100 text-orange-600' :
                            'bg-green-100 text-green-600'
                          }`}>
                            {currentStatus}
                          </span>
                          
                          <div className="flex gap-1 mt-1">
                            {currentStatus === 'Draft' && (
                              <button onClick={() => updateStatus(cls.id, term.id, 'Verified', currentStatus)} className="btn btn-outline btn-sm p-1" title="Verify Results">
                                <CheckCircle2 size={14} className="text-blue-500" />
                              </button>
                            )}
                            {(currentStatus === 'Draft' || currentStatus === 'Verified') && (
                              <button onClick={() => updateStatus(cls.id, term.id, 'Locked', currentStatus)} className="btn btn-outline btn-sm p-1" title="Lock Results (Admin)">
                                <Lock size={14} className="text-orange-500" />
                              </button>
                            )}
                            {currentStatus === 'Locked' && (
                              <>
                                <button onClick={() => updateStatus(cls.id, term.id, 'Draft', currentStatus)} className="btn btn-outline btn-sm p-1" title="Unlock (Super Admin)">
                                  <Unlock size={14} className="text-red-500" />
                                </button>
                                <button onClick={() => updateStatus(cls.id, term.id, 'Published', currentStatus)} className="btn btn-primary btn-sm p-1" title="Publish to Portal">
                                  <Eye size={14} />
                                </button>
                              </>
                            )}
                            {currentStatus === 'Published' && (
                              <button onClick={() => updateStatus(cls.id, term.id, 'Locked', currentStatus)} className="btn btn-outline btn-sm p-1" title="Unpublish">
                                <Lock size={14} className="text-orange-500" />
                              </button>
                            )}
                          </div>
                          
                          {/* Missing Marks Indicator */}
                          {(() => {
                            const missing = getMissingMarks(cls.id, term.id);
                            if (missing > 0 && currentStatus !== 'Published') {
                              return (
                                <div className="text-[10px] flex items-center gap-1 text-red-500 mt-1 font-semibold" title={`${missing} missing marks based on assigned subjects`}>
                                  <AlertTriangle size={10} /> {missing} missing
                                </div>
                              );
                            }
                            if (missing === 0 && currentStatus !== 'Published') {
                               return (
                                <div className="text-[10px] flex items-center gap-1 text-green-600 mt-1 font-semibold">
                                  <CheckCircle2 size={10} /> Complete
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResultStatusManager;
