import React from 'react';
import { WORKING_DAYS } from '../../services/RoutineService';

export default function RoutinePrintablePDF({
  type = 'teacher', // 'teacher' | 'class' | 'master'
  data,             // routine data object from RoutineService
  periods = [],
  branding = {
    schoolName: 'GYANODAY NIKETAN',
    subTitle: 'Higher Secondary School | Kurseong, Darjeeling',
    academicYear: '2026–27',
    affiliation: 'ICSE / ISC Affiliated'
  },
  innerRef = null
}) {
  if (!data) return null;

  return (
    <div ref={innerRef} className="bg-white text-slate-900 font-sans p-6 max-w-4xl mx-auto print:p-0 print:max-w-none">
      {/* Header */}
      <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
        <h1 className="text-2xl font-black tracking-tight text-slate-950 uppercase">{branding.schoolName}</h1>
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">{branding.subTitle}</p>
        <div className="flex justify-between items-center mt-2 px-2 text-xs font-bold text-slate-800 border-t border-slate-300 pt-1">
          <span>ACADEMIC YEAR: {branding.academicYear}</span>
          <span className="uppercase text-amber-700">
            {type === 'teacher' ? 'WEEKLY TEACHER ROUTINE' : type === 'class' ? 'WEEKLY CLASS TIMETABLE' : 'MASTER SCHOOL TIMETABLE'}
          </span>
          <span>CAMPUS: SENIOR SCHOOL</span>
        </div>
      </div>

      {/* TEACHER ROUTINE VIEW - REPLICATES AUTHENTIC HANDWRITTEN SLIP */}
      {type === 'teacher' && (
        <div>
          {/* Teacher Info Box */}
          <div className="bg-slate-50 border border-slate-300 rounded p-3 mb-4 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 font-medium">TEACHER NAME:</span>{' '}
                <strong className="text-sm font-black text-slate-900">{data.teacherName}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">ASSIGNED CLASSES:</span>{' '}
                <strong className="text-slate-800">{data.classesHandled?.join(', ') || 'General'}</strong>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 font-medium">SUBJECTS / RESPONSIBILITIES:</span>{' '}
                <strong className="text-slate-800">{data.subjectsHandled?.join(', ') || 'All Assigned Periods'}</strong>
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full border-collapse border border-slate-400 text-center text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400">
                <th className="border border-slate-400 p-2 font-bold w-20">Days</th>
                {periods.map(p => (
                  <th key={p.period_num} className="border border-slate-400 p-1.5 font-bold">
                    <div>{p.period_name}</div>
                    <div className="text-[9px] font-normal text-slate-500">{p.start_time}–{p.end_time}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORKING_DAYS.map(day => {
                const daySchedule = data.scheduleByDay?.[day.id];
                return (
                  <tr key={day.id} className="border-b border-slate-300">
                    <td className="border border-slate-400 font-bold bg-slate-50 p-2 text-left">{day.name}</td>
                    {periods.map(p => {
                      const periodCell = daySchedule?.periods?.find(pr => pr.period_num === p.period_num);
                      const entry = periodCell?.entry;
                      return (
                        <td key={p.period_num} className="border border-slate-400 p-1.5 h-14 align-middle">
                          {entry ? (
                            <div className="flex flex-col justify-center items-center">
                              <span className="font-extrabold text-[11px] text-slate-900">
                                {entry.class_name ? `Class ${entry.class_name} ${entry.section || ''}` : entry.entry_type}
                              </span>
                              <span className="text-[10px] font-semibold text-emerald-800">
                                {entry.subject_name || entry.entry_type}
                              </span>
                              {entry.room && <span className="text-[8px] text-slate-500">[{entry.room}]</span>}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[10px] font-mono">Free</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* CLASS ROUTINE VIEW */}
      {type === 'class' && (
        <div>
          {/* Class Info Box */}
          <div className="bg-slate-50 border border-slate-300 rounded p-3 mb-4 text-xs flex justify-between items-center">
            <div>
              <span className="text-slate-500 font-medium">CLASS:</span>{' '}
              <strong className="text-sm font-black text-slate-900">{data.fullClassName}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium">PERIOD DURATION:</span>{' '}
              <strong className="text-slate-800">40 Minutes</strong>
            </div>
          </div>

          {/* Table */}
          <table className="w-full border-collapse border border-slate-400 text-center text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400">
                <th className="border border-slate-400 p-2 font-bold w-20">Days</th>
                {periods.map(p => (
                  <th key={p.period_num} className="border border-slate-400 p-1.5 font-bold">
                    <div>{p.period_name}</div>
                    <div className="text-[9px] font-normal text-slate-500">{p.start_time}–{p.end_time}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WORKING_DAYS.map(day => {
                const daySchedule = data.scheduleByDay?.[day.id];
                return (
                  <tr key={day.id} className="border-b border-slate-300">
                    <td className="border border-slate-400 font-bold bg-slate-50 p-2 text-left">{day.name}</td>
                    {periods.map(p => {
                      const periodCell = daySchedule?.periods?.find(pr => pr.period_num === p.period_num);
                      const entry = periodCell?.entry;
                      return (
                        <td key={p.period_num} className="border border-slate-400 p-1.5 h-14 align-middle">
                          {entry ? (
                            <div className="flex flex-col justify-center items-center">
                              <span className="font-extrabold text-[11px] text-slate-900">
                                {entry.subject_name || entry.entry_type}
                              </span>
                              <span className="text-[10px] text-slate-700">
                                {entry.teacher_name}
                              </span>
                              {entry.room && <span className="text-[8px] text-slate-500">[{entry.room}]</span>}
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[10px] font-mono">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer Notes & Signatures */}
      <div className="mt-8 pt-4 border-t border-slate-300 flex justify-between items-end text-xs text-slate-700">
        <div>
          <p className="font-semibold text-slate-800">Rules & Instructions:</p>
          <ul className="text-[10px] text-slate-600 list-disc list-inside">
            <li>Teachers must arrive in class before the bell rings.</li>
            <li>Any routine adjustments must be pre-approved by the Principal.</li>
            <li>Free periods should be utilized in the Library or Staff Room for academic preparation.</li>
          </ul>
        </div>
        <div className="text-right">
          <div className="h-10 border-b border-slate-900 w-36 mb-1"></div>
          <span className="font-extrabold text-slate-900 uppercase">Principal's Signature</span>
          <p className="text-[9px] text-slate-500">Gyanoday Niketan</p>
        </div>
      </div>
    </div>
  );
}
