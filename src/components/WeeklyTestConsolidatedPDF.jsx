/**
 * WeeklyTestConsolidatedPDF.jsx
 * Authoritative Printable & PDF Component for Senior School Weekly Test Report
 * 
 * Architectural Rule:
 * Renders ONLY the immutable server-provided snapshot data.
 * Does NOT perform independent client-side ranking or calculations.
 */
export default function WeeklyTestConsolidatedPDF({ report, branding = null, innerRef = null }) {
  if (!report) return null;

  const summary = report.summary_data || {};
  const honours = report.honours_data || [];
  const requiresAttention = report.requires_attention_data || [];
  const classDetails = report.class_details_data || [];
  const config = report.config_snapshot || {};
  const schoolName = branding?.school_name || config.school_branding?.school_name || 'Gyanoday Niketan';
  const sectionName = branding?.section_name || config.school_branding?.section_name || 'Senior School';
  const reportTitle = branding?.report_title || config.school_branding?.report_title || 'WEEKLY TEST REPORT';

  return (
    <div 
      ref={innerRef}
      className="bg-white text-slate-900 font-sans p-6 sm:p-10 max-w-[210mm] mx-auto text-xs leading-normal print:p-4 print:text-[10px]"
      style={{ minHeight: '297mm' }}
    >
      {/* PAGE 1: EXECUTIVE SUMMARY & ASSEMBLY HONOURS DOSSIER */}
      <div className="min-h-[270mm] flex flex-col justify-between pb-8">
        <div>
          {/* Header */}
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-5">
            <h1 className="text-2xl font-black uppercase tracking-wider text-slate-950 font-serif">
              {schoolName}
            </h1>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-700 mt-0.5">
              {sectionName} (Classes 5–12)
            </h2>
            <div className="inline-block mt-2 px-4 py-1 bg-slate-950 text-white font-extrabold text-sm tracking-wide rounded">
              {reportTitle}
            </div>

            {/* Test Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-600 font-medium">
              <div>
                <span className="text-slate-400 block uppercase text-[9px] font-bold">Week</span>
                <strong className="text-slate-900">{report.week_identifier}</strong>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px] font-bold">Test Date</span>
                <strong className="text-slate-900">{report.test_date}</strong>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px] font-bold">Report Version</span>
                <strong className="text-slate-900">
                  V{report.version} {report.version > 1 ? '(Revised)' : '(Official)'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block uppercase text-[9px] font-bold">Status</span>
                <span className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                  report.status === 'FINAL' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {report.status}
                </span>
              </div>
            </div>
          </div>

          {/* Executive Metrics Bar */}
          <div className="grid grid-cols-5 gap-2 bg-slate-100 p-3 rounded-lg mb-6 border border-slate-200 text-center">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase">Classes</div>
              <div className="text-base font-black text-slate-900">
                {summary.completedClasses || 0} / {summary.totalClasses || 0}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase">Subjects</div>
              <div className="text-base font-black text-slate-900">
                {summary.completedSubjects || 0} / {summary.totalSubjects || 0}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase">Evaluated</div>
              <div className="text-base font-black text-emerald-700">
                {summary.studentsEvaluated || 0}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase">Absentees</div>
              <div className="text-base font-black text-amber-600">
                {summary.studentsAbsent || 0}
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase">Attention</div>
              <div className="text-base font-black text-rose-600">
                {summary.studentsRequiringAttention || 0}
              </div>
            </div>
          </div>

          {/* ASSEMBLY HONOURS SECTION (Crucial Page 1 Focus) */}
          <div className="mb-6">
            <div className="flex items-center justify-between border-b-2 border-amber-500 pb-1.5 mb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <span>🏆</span> Tuesday Morning Assembly Honours
              </h3>
              <span className="text-[10px] font-bold text-amber-800 uppercase bg-amber-100 px-2 py-0.5 rounded">
                Official Podium Summary
              </span>
            </div>

            {honours.length === 0 ? (
              <p className="text-slate-500 italic p-3 text-center border border-dashed rounded">
                No marks evaluated yet for honours.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {honours.map(clsHonour => (
                  <div 
                    key={clsHonour.classId} 
                    className="border border-slate-200 rounded-md p-2.5 bg-slate-50/60 break-inside-avoid"
                  >
                    <div className="font-extrabold text-xs text-slate-900 border-b border-slate-200 pb-1 mb-1.5 flex justify-between">
                      <span>{clsHonour.fullClassName}</span>
                      <span className="text-[10px] text-slate-500 font-medium">Class Honours</span>
                    </div>

                    {clsHonour.topScorers.length === 0 ? (
                      <span className="text-slate-400 italic text-[11px] block">No top marks recorded</span>
                    ) : (
                      <ul className="space-y-1">
                        {clsHonour.topScorers.map(s => {
                          const medal = s.rank === 1 ? '🥇' : s.rank === 2 ? '🥈' : '🥉';
                          return (
                            <li key={s.studentId} className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1">
                                <span>{medal}</span>
                                <strong className="text-slate-900">{s.rankDisplay}:</strong>
                                <span className="text-slate-800 font-semibold">{s.name}</span>
                                {s.house && <span className="text-slate-500 text-[10px]">({s.house})</span>}
                              </span>
                              <span className="font-mono font-bold text-slate-900">
                                {s.total} / {s.maxMarks} ({s.percentage}%)
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PAGE 1: REQUIRES ATTENTION EXECUTIVE SUMMARY */}
          {requiresAttention.length > 0 && (
            <div className="mt-4 break-inside-avoid">
              <div className="flex items-center justify-between border-b border-rose-400 pb-1 mb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-rose-900 flex items-center gap-1.5">
                  <span>⚠️</span> Students Requiring Academic Attention
                </h3>
                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.2 rounded">
                  Below Threshold ({config.requires_attention_threshold || 10})
                </span>
              </div>
              <div className="bg-rose-50/50 border border-rose-200 rounded p-2 text-[11px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  {requiresAttention.flatMap(c => c.students.map(s => (
                    <div key={`${c.classId}_${s.studentId}`} className="flex justify-between border-b border-rose-100 py-0.5">
                      <span className="text-slate-800">
                        <strong>{c.fullClassName}:</strong> {s.name} {s.house && `(${s.house})`}
                      </span>
                      <span className="font-mono font-bold text-rose-700">
                        {s.total} / {s.maxMarks} ({s.percentage}%)
                      </span>
                    </div>
                  )))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Page 1 Footer */}
        <div className="pt-4 border-t border-slate-300 flex justify-between items-end text-[10px] text-slate-500">
          <div>
            <span>Generated: {new Date(report.generated_at).toLocaleString()}</span>
            <span className="mx-2">•</span>
            <span>Version: V{report.version}</span>
            {report.revision_reason && (
              <span className="block text-amber-700 font-semibold mt-0.5">
                Note: {report.revision_reason}
              </span>
            )}
          </div>
          <div className="text-right">
            <div className="w-32 border-b border-slate-400 mb-1"></div>
            <span className="font-bold uppercase tracking-wider text-slate-700">Principal Signature</span>
          </div>
        </div>
      </div>

      {/* SUBSEQUENT PAGES: DETAILED CLASS-WISE ROSTERS */}
      {classDetails.map((cls, idx) => (
        <div 
          key={cls.classId} 
          className="pt-8 border-t-2 border-slate-400 print:break-before-page min-h-[270mm] flex flex-col justify-between mb-8"
        >
          <div>
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-4">
              <div>
                <h3 className="text-base font-black uppercase text-slate-950">
                  {cls.fullClassName} — Detailed Marksheet
                </h3>
                <span className="text-xs text-slate-600 font-medium">
                  {schoolName} • {report.week_identifier} ({report.test_date})
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-1 rounded border">
                Section Details ({cls.roster?.length || 0} Students)
              </span>
            </div>

            <table className="w-full text-left border-collapse border border-slate-300 text-[10px]">
              <thead className="bg-slate-100 uppercase font-bold text-slate-700 border-b border-slate-300">
                <tr>
                  <th className="p-1.5 border border-slate-300 w-12 text-center">Roll</th>
                  <th className="p-1.5 border border-slate-300">Student Name</th>
                  <th className="p-1.5 border border-slate-300 w-16 text-center">House</th>
                  <th className="p-1.5 border border-slate-300 w-20 text-center">Marks</th>
                  <th className="p-1.5 border border-slate-300 w-16 text-center">%</th>
                  <th className="p-1.5 border border-slate-300 w-24 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(cls.roster || []).map(st => {
                  const isBelowThreshold = !st.isAbsent && st.total < (config.requires_attention_threshold || 10);
                  return (
                    <tr 
                      key={st.studentId}
                      className={st.isAbsent ? 'bg-amber-50/50' : (isBelowThreshold ? 'bg-rose-50/40' : '')}
                    >
                      <td className="p-1.5 border border-slate-300 text-center font-bold text-slate-800">
                        {st.rollNo}
                      </td>
                      <td className="p-1.5 border border-slate-300 font-semibold text-slate-900">
                        {st.name}
                      </td>
                      <td className="p-1.5 border border-slate-300 text-center text-slate-600">
                        {st.house || '—'}
                      </td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono font-bold">
                        {st.isAbsent ? 'ABSENT' : `${st.total} / ${st.maxMarks}`}
                      </td>
                      <td className="p-1.5 border border-slate-300 text-center font-mono font-bold">
                        {st.isAbsent ? '—' : `${st.percentage}%`}
                      </td>
                      <td className="p-1.5 border border-slate-300 text-center font-bold text-[9px]">
                        {st.isAbsent ? (
                          <span className="text-amber-700 bg-amber-100 px-1 py-0.2 rounded">ABSENT</span>
                        ) : isBelowThreshold ? (
                          <span className="text-rose-700 bg-rose-100 px-1 py-0.2 rounded">REQUIRES ATTENTION</span>
                        ) : (
                          <span className="text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded">PASS</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Section Footer */}
          <div className="pt-4 border-t border-slate-200 flex justify-between text-[9px] text-slate-400">
            <span>{cls.fullClassName} • Page {idx + 2} of {classDetails.length + 1}</span>
            <span>Gyanoday Niketan ERP Official Document</span>
          </div>
        </div>
      ))}
    </div>
  );
}
