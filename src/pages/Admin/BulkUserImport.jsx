import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function BulkUserImport({ currentUsers, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [importType, setImportType] = useState('teachers');
  const [dryRunResults, setDryRunResults] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setDryRunResults(null);
    }
  };

  const validateRows = (rows) => {
    const results = { valid: [], invalid: [], errors: [] };
    const emailSet = new Set(currentUsers.map(u => u.email).filter(Boolean));
    const uidSet = new Set(currentUsers.map(u => u.uid).filter(Boolean));
    const empIdSet = new Set(currentUsers.map(u => u.employee_id).filter(Boolean));

    rows.forEach((row, index) => {
      const rowNum = index + 2; // +1 for header, +1 for 0-index
      let isValid = true;
      const rowErrors = [];

      if (!row.name) { isValid = false; rowErrors.push(`Row ${rowNum}: Name is required`); }
      
      if (importType === 'teachers' || importType === 'parents') {
        if (!row.email) { isValid = false; rowErrors.push(`Row ${rowNum}: Email is required`); }
        else if (emailSet.has(row.email)) { isValid = false; rowErrors.push(`Row ${rowNum}: Duplicate email ${row.email}`); }
      }

      if (importType === 'teachers' && row.employee_id) {
        if (empIdSet.has(row.employee_id)) { isValid = false; rowErrors.push(`Row ${rowNum}: Duplicate Employee ID ${row.employee_id}`); }
        else empIdSet.add(row.employee_id);
      }

      if (importType === 'students') {
        if (!row.uid) { isValid = false; rowErrors.push(`Row ${rowNum}: UID is required`); }
        else if (uidSet.has(row.uid)) { isValid = false; rowErrors.push(`Row ${rowNum}: Duplicate UID ${row.uid}`); }
        else uidSet.add(row.uid);
      }

      if (importType === 'parents' && !row.linked_student_id) {
        isValid = false; rowErrors.push(`Row ${rowNum}: Missing linked student`);
      }

      if (isValid) {
        if (row.email) emailSet.add(row.email);
        results.valid.push(row);
      } else {
        results.invalid.push(row);
        results.errors.push(...rowErrors);
      }
    });

    return results;
  };

  const handleDryRun = () => {
    if (!file) return alert('Please select a CSV file first.');
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(l => l.trim() !== '');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const parsedRows = lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, i) => {
          obj[header] = values[i]?.trim();
          return obj;
        }, {});
      });

      const validation = validateRows(parsedRows);
      setDryRunResults({
        total: parsedRows.length,
        validCount: validation.valid.length,
        invalidCount: validation.invalid.length,
        errors: validation.errors,
        validRows: validation.valid
      });
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    if (!dryRunResults || dryRunResults.validCount === 0) return;
    setIsImporting(true);

    const { data: { session } } = await supabase.auth.getSession();
    
    let successCount = 0;
    let failCount = 0;

    for (const row of dryRunResults.validRows) {
      try {
        // Construct payload for edge function
        const payload = {
           email: row.email || `${row.uid}@student.local`,
           password: row.uid || row.password || 'TempPass123!',
           name: row.name,
           role: importType.slice(0, -1), // 'teachers' -> 'teacher'
           employee_id: row.employee_id,
           uid: row.uid
        };

        const response = await fetch('https://supabase.gyanodayniketan.cloud/functions/v1/admin-users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ action: 'createUser', payload })
        });
        
        if (response.ok) {
           successCount++;
           // Note: In a real implementation, we would also insert into parent_student_map or students table here
        } else {
           failCount++;
        }
      } catch (e) {
        failCount++;
      }
    }

    setIsImporting(false);
    alert(`Import Complete. Success: ${successCount}, Failed: ${failCount}`);
    setDryRunResults(null);
    setFile(null);
    if (onImportSuccess) onImportSuccess();
  };

  return (
    <div className="bento-card p-6 bg-white">
      <h3 className="text-xl font-bold mb-4">Bulk Import Users</h3>
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <select className="input-field max-w-xs" value={importType} onChange={e => setImportType(e.target.value)}>
          <option value="teachers">Teachers</option>
          <option value="students">Students</option>
          <option value="parents">Parents</option>
        </select>
        <input type="file" accept=".csv" className="input-field" onChange={handleFileChange} />
        <button onClick={handleDryRun} className="btn-hero-outline flex items-center gap-2" disabled={!file || isImporting}>
          <FileText size={18} /> Dry Run
        </button>
      </div>

      {dryRunResults && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
          <h4 className="font-semibold mb-2">Dry Run Results</h4>
          <div className="flex gap-4 mb-4">
            <span className="text-sm font-medium">Total Rows: {dryRunResults.total}</span>
            <span className="text-sm font-medium text-green-600 flex items-center gap-1"><CheckCircle size={14}/> Valid: {dryRunResults.validCount}</span>
            <span className="text-sm font-medium text-red-600 flex items-center gap-1"><AlertCircle size={14}/> Invalid: {dryRunResults.invalidCount}</span>
          </div>

          {dryRunResults.errors.length > 0 && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded max-h-32 overflow-y-auto mb-4">
              {dryRunResults.errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          <button onClick={executeImport} disabled={dryRunResults.validCount === 0 || isImporting} className="btn-hero-primary w-full flex justify-center items-center gap-2">
            <Upload size={18} /> {isImporting ? 'Importing...' : `Execute Import (${dryRunResults.validCount} rows)`}
          </button>
        </div>
      )}
    </div>
  );
}
