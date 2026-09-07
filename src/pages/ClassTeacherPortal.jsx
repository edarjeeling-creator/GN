import React, { useMemo, useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { 
  Trophy, AlertCircle, Printer, Users, Phone, MessageSquare, 
  Edit2, Check, X, ExternalLink, Search, CheckCircle2 
} from 'lucide-react';
import { getConversionConstants } from './SubjectMarks';
import { getGrade, getGradeColor } from '../utils/reportUtils';
import { formatStudentDisplayName } from '../utils/studentUtils';
import WhatsAppComposerModal from '../components/WhatsAppComposerModal';
import TeacherMessageCMS from '../components/TeacherMessageCMS';

const ClassTeacherPortal = () => {
  const { classId } = useParams();
  const { profile } = useAuth();
  const { classes, subjects, students, marks, academicYear, updateStudentContactNumber } = useData();

  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'marks' | 'messages'
  const [directorySearch, setDirectorySearch] = useState('');
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [savingStudentId, setSavingStudentId] = useState(null);
  const [selectedComposerStudent, setSelectedComposerStudent] = useState(null);

  const [selectedTerm, setSelectedTerm] = useState('Midterm');
  const [selectedSubject, setSelectedSubject] = useState('All');

  const cls = classes.find((c) => c.id === classId);
  const classStudents = students.filter((s) => s.class_id === classId);

  const handleStartEditPhone = (student) => {
    setEditingStudentId(student.id);
    setPhoneInput(student.contact_number || '');
  };

  const handleCancelEdit = () => {
    setEditingStudentId(null);
    setPhoneInput('');
  };

  const handleSavePhone = async (studentId) => {
    setSavingStudentId(studentId);
    try {
      const res = await updateStudentContactNumber(studentId, phoneInput);
      if (res?.success) {
        setEditingStudentId(null);
      } else {
        alert("Failed to update contact number: " + (res?.error?.message || "Please try again."));
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSavingStudentId(null);
    }
  };



  // Security: Check if user is the assigned class teacher, or an admin/principal
  const isClassTeacher = cls?.class_teacher_id === profile?.id;
  const isAdminOrPrincipal = profile?.role === 'admin' || profile?.role === 'principal';

  const { examConv } = getConversionConstants(cls?.name || '');

  // Find all subjects that are assigned/have marks for this class
  const classSubjects = subjects.filter((sub) => {
    return classStudents.some((student) => {
      return Object.keys(marks).some((k) => k.startsWith(`${student.id}_${sub.id}_`));
    });
  });

  const portalData = useMemo(() => {
    if (!cls || classStudents.length === 0) return null;

    let classTotalPercentage = 0;
    let totalMarksCounted = 0;
    let highestPercentage = 0;
    let lowestPercentage = 100;
    let studentsWithMissingMarks = [];
    let classHasAnyMarksForTerm = false;

    // Identify all optional subjects dynamically based on what students in this class have selected
    const optionalSubjectsInClass = new Set();
    classStudents.forEach(s => {
      if (s.second_language) optionalSubjectsInClass.add(s.second_language.toLowerCase().trim());
      if (s.third_language) optionalSubjectsInClass.add(s.third_language.toLowerCase().trim());
      if (s.elective_subject) optionalSubjectsInClass.add(s.elective_subject.toLowerCase().trim());
      if (s.sixth_subject) optionalSubjectsInClass.add(s.sixth_subject.toLowerCase().trim());
    });

    const isStudentEnrolledIn = (student, subjectName) => {
      const subNameLower = subjectName.toLowerCase().trim();
      
      // If the subject matches a specific optional subject chosen by ANY student in the class
      if (optionalSubjectsInClass.has(subNameLower)) {
        // The student MUST explicitly have it selected
        const matches = 
          (student.second_language?.toLowerCase().trim() === subNameLower) ||
          (student.third_language?.toLowerCase().trim() === subNameLower) ||
          (student.elective_subject?.toLowerCase().trim() === subNameLower) ||
          (student.sixth_subject?.toLowerCase().trim() === subNameLower);
          
        if (!matches) return false;
      }
      
      // Check legacy generic names like "2nd Language", "Elective", etc.
      const isSec = subNameLower.includes('2nd') || subNameLower.includes('second');
      const isThird = subNameLower.includes('3rd') || subNameLower.includes('third');
      const isElective = subNameLower.includes('elective') || subNameLower.includes('evs/math') || subNameLower.includes('maths/evs') || subNameLower.includes('math/evs');
      const isSixth = subNameLower.includes('6th') || subNameLower.includes('sixth');
      
      if (isSec) return student.second_language ? subNameLower.includes(student.second_language.toLowerCase().trim()) : true;
      if (isThird) return student.third_language ? subNameLower.includes(student.third_language.toLowerCase().trim()) : true;
      if (isElective) return student.elective_subject ? subNameLower.includes(student.elective_subject.toLowerCase().trim()) : true;
      if (isSixth) return student.sixth_subject ? subNameLower.includes(student.sixth_subject.toLowerCase().trim()) : true;
      
      return true; // Assume enrolled for core subjects
    };

    const studentScores = classStudents.map((student) => {
      let grandMtTotal = 0;
      let maxPossibleTotal = 0;
      let missingSubjects = [];
      let failingSubjects = [];

      const subjectScores = classSubjects.map((sub) => {
        const getVal = (termStr) => {
          const fullTerm = `${academicYear}_${termStr}`;
          const val = marks[`${student.id}_${sub.id}_${fullTerm}`];
          return val !== undefined && val !== '' ? Number(val) : null;
        };

        // Use dynamic term based on selectedTerm
        const termExam = getVal(`${selectedTerm}_Exam`);
        const termTest = getVal(`${selectedTerm}_Test`);

        const isEnrolled = isStudentEnrolledIn(student, sub.name);

        if (termExam !== null || termTest !== null) {
          classHasAnyMarksForTerm = true;
        }

        if (termExam === null && termTest === null) {
          if (isEnrolled) {
            missingSubjects.push(sub.name);
          }
          return { subjectId: sub.id, total: null };
        }

        const mtConv = (termExam || 0) * (examConv / 100);
        const mtTotal = Math.round(mtConv + (termTest || 0));

        grandMtTotal += mtTotal;
        maxPossibleTotal += 100;

        if (mtTotal < 40) {
          failingSubjects.push(sub.name);
        }

        return { subjectId: sub.id, total: mtTotal };
      });

      if (missingSubjects.length > 0) {
        studentsWithMissingMarks.push({ name: student.name, missing: missingSubjects });
      }

      const percentage = maxPossibleTotal > 0 ? (grandMtTotal / maxPossibleTotal) * 100 : 0;
      if (maxPossibleTotal > 0) {
        classTotalPercentage += percentage;
        totalMarksCounted++;
        if (percentage > highestPercentage) highestPercentage = percentage;
        if (percentage < lowestPercentage) lowestPercentage = percentage;
      }

      return {
        ...student,
        subjectScores,
        grandMtTotal,
        percentage: percentage.toFixed(1),
        grade: getGrade(percentage),
        missingSubjects,
        failingSubjects,
      };
    });

    if (!classHasAnyMarksForTerm) {
      studentsWithMissingMarks = [];
    }

    // Rank Calculation
    studentScores.sort((a, b) => b.grandMtTotal - a.grandMtTotal);

    let currentRank = 1;
    let currentValue = -1;
    studentScores.forEach((student, index) => {
      if (student.grandMtTotal !== currentValue) {
        currentRank = index + 1;
        currentValue = student.grandMtTotal;
      }
      student.rank = currentRank;
    });

    // Restore Roll No order for display
    studentScores.sort((a, b) => a.roll_no - b.roll_no);

    const classAverage = totalMarksCounted > 0 ? (classTotalPercentage / totalMarksCounted).toFixed(1) : 0;

    const topScorers = studentScores.filter((s) => s.rank <= 3 && s.maxPossibleTotal !== 0).slice(0, 5);

    return {
      studentScores,
      classAverage,
      highestPercentage: highestPercentage.toFixed(1),
      lowestPercentage: lowestPercentage === 100 ? 0 : lowestPercentage.toFixed(1),
      studentsWithMissingMarks,
      topScorers,
      hasMarks: classHasAnyMarksForTerm,
    };
  }, [classStudents, classSubjects, marks, academicYear, examConv, selectedTerm, cls]);

  if (!cls) {
    return <div className="p-8 text-center text-slate-500">Class not found.</div>;
  }

  if (!isClassTeacher && !isAdminOrPrincipal) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!portalData) {
    return <div className="p-8 text-center text-slate-500">No data available for this class.</div>;
  }

  const filteredDirectoryStudents = useMemo(() => {
    return classStudents
      .filter(s => {
        if (!directorySearch.trim()) return true;
        const q = directorySearch.toLowerCase().trim();
        return (
          (s.name && s.name.toLowerCase().includes(q)) ||
          String(s.roll_no).includes(q) ||
          (s.father_name && s.father_name.toLowerCase().includes(q)) ||
          (s.contact_number && s.contact_number.includes(q))
        );
      })
      .sort((a, b) => (Number(a.roll_no) || 0) - (Number(b.roll_no) || 0));
  }, [classStudents, directorySearch]);

  const studentsWithPhone = classStudents.filter(s => s.contact_number).length;
  const studentsWithoutPhone = classStudents.length - studentsWithPhone;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users size={24} className="text-brand-600" /> Class Teacher Portal
          </h1>
          <p className="text-slate-500">
            {cls.name} {cls.section} - {academicYear}
          </p>
        </div>
        <div className="flex gap-3">
          <Link to={`/classes/${classId}/reports`} className="btn btn-primary flex items-center gap-2">
            <Printer size={18} /> Print All Report Cards
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('directory')}
          className={`pb-3.5 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'directory'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Phone size={16} /> Student Directory & Parent Contacts
          <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-bold">
            {classStudents.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('marks')}
          className={`pb-3.5 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'marks'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Trophy size={16} /> Consolidated Marksheet
        </button>

        <button
          onClick={() => setActiveTab('messages')}
          className={`pb-3.5 px-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'messages'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <MessageSquare size={16} /> Message CMS
        </button>
      </div>

      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Class Strength</div>
                  <div className="text-2xl font-black text-slate-800">{classStudents.length}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                  <Users size={20} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-0.5">Phone Configured</div>
                  <div className="text-2xl font-black text-emerald-600">{studentsWithPhone}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 size={20} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-0.5">Missing Phone</div>
                  <div className="text-2xl font-black text-amber-600">{studentsWithoutPhone}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <AlertCircle size={20} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search bar & Directory Card */}
          <Card>
            <CardHeader className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg">Class Roster & Parent Contacts</CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Add or update parents' phone numbers anytime. Changes save instantly and enable direct WhatsApp alerts.
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, roll, phone..."
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-16">Roll</th>
                    <th className="px-4 py-3 font-semibold min-w-[180px]">Student Name</th>
                    <th className="px-4 py-3 font-semibold min-w-[150px]">Father / Guardian</th>
                    <th className="px-4 py-3 font-semibold min-w-[220px]">Parent Phone Number</th>
                    <th className="px-4 py-3 font-semibold text-center w-36">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDirectoryStudents.map(student => {
                    const isEditing = editingStudentId === student.id;
                    const isSaving = savingStudentId === student.id;

                    return (
                      <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-500">{student.roll_no}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 overflow-hidden border border-slate-200 shrink-0 flex items-center justify-center">
                              {student.picture_url ? (
                                <img src={student.picture_url} alt={student.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-slate-500 font-bold text-xs">
                                  {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800">{formatStudentDisplayName(student.name)}</div>
                              {student.uid && <div className="text-[11px] text-slate-400">UID: {student.uid}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {student.father_name || <span className="text-slate-400 italic text-xs">Not recorded</span>}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="tel"
                                placeholder="10-digit mobile number"
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value)}
                                className="px-2.5 py-1 text-xs border border-brand-500 rounded-md focus:outline-none w-36 text-slate-800"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSavePhone(student.id)}
                                disabled={isSaving}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1"
                              >
                                {isSaving ? '...' : <Check size={12} />}
                                <span>Save</span>
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {student.contact_number ? (
                                <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-xs">
                                  <Phone size={13} className="text-emerald-600" />
                                  <span>{student.contact_number}</span>
                                </div>
                              ) : (
                                <span className="text-amber-500 italic text-xs">No number</span>
                              )}
                              <button
                                onClick={() => handleStartEditPhone(student)}
                                className="px-2 py-0.5 text-[11px] font-semibold text-brand-600 hover:text-brand-800 hover:bg-brand-50 rounded border border-brand-200 flex items-center gap-1 transition-colors"
                                title="Change or add parent phone number"
                              >
                                <Edit2 size={10} />
                                <span>{student.contact_number ? 'Change' : '+ Add'}</span>
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {student.contact_number ? (
                            <button
                              onClick={() => setSelectedComposerStudent(student)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                              title="Compose WhatsApp Message"
                            >
                              <MessageSquare size={13} />
                              <span>WhatsApp</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartEditPhone(student)}
                              className="text-[11px] text-slate-400 hover:text-brand-600 underline"
                            >
                              + Add Phone
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDirectoryStudents.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 text-sm">
                        No students found matching "{directorySearch}".
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'marks' && (
        <div className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Class Average</div>
            <div className="text-3xl font-black text-brand-600">{portalData.classAverage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Highest Marks</div>
            <div className="text-3xl font-black text-emerald-600">{portalData.highestPercentage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Lowest Marks</div>
            <div className="text-3xl font-black text-red-500">{portalData.lowestPercentage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Students</div>
            <div className="text-3xl font-black text-slate-700">{classStudents.length}</div>
          </CardContent>
        </Card>
      </div>


      <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Term:</label>
          <select 
            value={selectedTerm} 
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="input-field py-1.5 px-3 rounded-lg text-sm bg-slate-50 border-slate-200 text-slate-900"
          >
            <option value="Midterm">Midterm</option>
            <option value="Finalterm">Finalterm</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Subject:</label>
          <select 
            value={selectedSubject} 
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="input-field py-1.5 px-3 rounded-lg text-sm bg-slate-50 border-slate-200 text-slate-900"
          >
            <option value="All">All Subjects (Consolidated)</option>
            {classSubjects.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedSubject === 'All' ? `Consolidated Marksheet (${selectedTerm})` : `${classSubjects.find(s => s.id === selectedSubject)?.name} Marksheet (${selectedTerm})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {!portalData.hasMarks ? (
            <div className="p-8 text-center text-slate-500 font-medium">
              No marks have been entered for {selectedTerm} yet.
            </div>
          ) : (
            <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold w-16">Roll</th>
                <th className="px-4 py-3 font-semibold min-w-[150px]">Student Name</th>
                {classSubjects
                  .filter(sub => selectedSubject === 'All' || sub.id === selectedSubject)
                  .map((sub) => (
                  <th key={sub.id} className="px-4 py-3 font-semibold text-center whitespace-nowrap">
                    {sub.name}
                  </th>
                ))}
                {selectedSubject === 'All' && (
                  <>
                    <th className="px-4 py-3 font-semibold text-center bg-brand-50/50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400">Total</th>
                    <th className="px-4 py-3 font-semibold text-center bg-brand-50/50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400">%</th>
                    <th className="px-4 py-3 font-semibold text-center bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">Rank</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {portalData.studentScores.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-medium">{student.roll_no}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                    {formatStudentDisplayName(student.name)}
                  </td>
                  {classSubjects
                    .filter(sub => selectedSubject === 'All' || sub.id === selectedSubject)
                    .map((sub) => {
                    const scoreObj = student.subjectScores.find((s) => s.subjectId === sub.id);
                    const isFailing = scoreObj && scoreObj.total !== null && scoreObj.total < 40; // Assuming 40 is pass mark
                    return (
                      <td
                        key={sub.id}
                        className={`px-4 py-3 text-center ${
                          scoreObj?.total === null
                            ? 'text-slate-300 dark:text-slate-600 font-normal'
                            : isFailing
                            ? 'text-red-500 font-bold bg-red-50/30 dark:bg-red-900/30'
                            : 'text-slate-700 dark:text-slate-200 font-medium'
                        }`}
                      >
                        {scoreObj?.total !== null ? scoreObj.total : '-'}
                      </td>
                    );
                  })}
                  {selectedSubject === 'All' && (
                    <>
                      <td className="px-4 py-3 text-center font-bold text-brand-700 dark:text-brand-400 bg-brand-50/20">{student.grandMtTotal}</td>
                      <td className="px-4 py-3 text-center font-bold text-brand-700 dark:text-brand-400 bg-brand-50/20">{student.percentage}%</td>
                      <td className="px-4 py-3 text-center font-bold text-amber-600 dark:text-amber-400 bg-amber-50/20">
                        {student.rank}
                        {student.rank === 1 ? 'st' : student.rank === 2 ? 'nd' : student.rank === 3 ? 'rd' : 'th'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
            </table>
          )}
        </CardContent>
      </Card>
        </div>
      )}

      {activeTab === 'messages' && (
        <TeacherMessageCMS
          teacherId={profile?.id}
          teacherName={profile?.name || 'Class Teacher'}
          cls={cls}
          sampleStudent={classStudents[0]}
        />
      )}

      {/* WhatsApp Composer Modal */}
      {selectedComposerStudent && (
        <WhatsAppComposerModal
          isOpen={!!selectedComposerStudent}
          onClose={() => setSelectedComposerStudent(null)}
          student={selectedComposerStudent}
          cls={cls}
          teacherName={profile?.name || 'Class Teacher'}
          teacherId={profile?.id}
          initialTemplateKey="absentee_alert"
        />
      )}
    </div>
  );
};

export default ClassTeacherPortal;
