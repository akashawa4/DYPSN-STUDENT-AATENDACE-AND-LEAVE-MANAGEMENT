import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userService, subjectService, resultService, getBatchYear } from '../../firebase/firestore';
import { User } from '../../types';
import { getDepartmentCode } from '../../utils/departmentMapping';
import { getAvailableSemesters, getDefaultSemesterForYear, isValidSemesterForYear } from '../../utils/semesterMapping';

const YEARS = ['1st', '2nd', '3rd', '4th'];
const DIVS = ['A', 'B', 'C'];
const EXAM_TYPES = ['UT1', 'UT2', 'Practical', 'Viva', 'Midterm', 'Endsem'];

const ResultEntryPanel: React.FC = () => {
  const { user } = useAuth();

  const [year, setYear] = React.useState('1st');
  const [sem, setSem] = React.useState('1');
  const [div, setDiv] = React.useState('A');
  const [availableSemesters, setAvailableSemesters] = React.useState<string[]>(getAvailableSemesters('1'));
  const [availableSubjects, setAvailableSubjects] = React.useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = React.useState(false);
  const [subject, setSubject] = React.useState<string>('');
  const [examType, setExamType] = React.useState<string>('UT1');
  const [maxMarks, setMaxMarks] = React.useState<number>(20);
  const [marksInput, setMarksInput] = React.useState<string>('');
  const [students, setStudents] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [classResults, setClassResults] = React.useState<any[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showAddModal, setShowAddModal] = React.useState<boolean>(false);
  const [newResult, setNewResult] = React.useState({
    name: '',
    rollNumber: '',
    year: year, // Initialize with current form year
    sem: sem, // Initialize with current form semester
    div: div, // Initialize with current form division
    subject: '',
    examType: 'UT1',
    marksObtained: 0,
    maxMarks: 20,
  });
  const [formAvailableSemesters, setFormAvailableSemesters] = React.useState<string[]>(getAvailableSemesters('1'));
  const [formAvailableSubjects, setFormAvailableSubjects] = React.useState<string[]>([]);
  const [formSubjectsLoading, setFormSubjectsLoading] = React.useState<boolean>(false);

  const handleYearChange = (newYear: string) => {
    setYear(newYear);
    const normalizedYear = newYear.replace(/(st|nd|rd|th)/i, '');
    const newAvailableSemesters = getAvailableSemesters(normalizedYear);
    setAvailableSemesters(newAvailableSemesters);
    if (!isValidSemesterForYear(normalizedYear, sem)) {
      const defaultSem = getDefaultSemesterForYear(normalizedYear);
      setSem(defaultSem);
    }
  };

  React.useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      const batch = '2025';
      const department = 'CSE';
      const filtered = await userService.getStudentsByBatchDeptYearSemDiv(batch, department, year, sem, div);
      setStudents(filtered);
      setLoading(false);
    };
    fetchStudents();
  }, [year, sem, div]);

  React.useEffect(() => {
    const loadSubjects = async () => {
      try {
        setSubjectsLoading(true);
        const deptCode = getDepartmentCode(user?.department);
        console.log('Loading subjects with:', { deptCode, year, sem, userDepartment: user?.department });
        let subs = await subjectService.getSubjectsByDepartment(deptCode, year, sem);
        console.log('Found subjects:', subs);
        
        // If no subjects found with year/sem filter, try without filters
        if (subs.length === 0) {
          console.log('No subjects found with year/sem filter, trying without filters...');
          subs = await subjectService.getSubjectsByDepartment(deptCode);
          console.log('Found subjects without filters:', subs);
        }
        
        // Deduplicate by subject name to avoid duplicates (e.g., theory/lab with same name)
        const unique = Array.from(new Set(subs.map(s => s.subjectName)));
        const names = unique.sort();
        setAvailableSubjects(names);
        if (names.length > 0) setSubject(prev => (prev && names.includes(prev) ? prev : names[0]));
        else setSubject('');
      } catch (error) {
        console.error('Error loading subjects:', error);
        setAvailableSubjects([]);
        setSubject('');
      } finally {
        setSubjectsLoading(false);
      }
    };
    loadSubjects();
  }, [user?.department, year, sem]);

  const computeBatch = React.useCallback(() => {
    // Map displayed year to getBatchYear input: 1st->FE, 2nd->SE, 3rd->TE, 4th->BE
    const map: Record<string, string> = { '1st': 'FE', '2nd': 'SE', '3rd': 'TE', '4th': 'BE' };
    const key = map[year] || year.replace(/(st|nd|rd|th)/i, '');
    return getBatchYear(key);
  }, [year]);

  const getDepartmentCodeSafe = React.useCallback(() => {
    return getDepartmentCode(user?.department) || 'CSE';
  }, [user?.department]);

  const fetchClassResults = React.useCallback(async () => {
    const batch = computeBatch();
    const department = getDepartmentCodeSafe();
    if (!subject || !examType) { setClassResults([]); return; }
    const data = await resultService.getClassResults(batch, department, year, sem, div, subject, examType);
    // Sort by roll number numeric if possible
    data.sort((a: any, b: any) => String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }));
    setClassResults(data);
  }, [computeBatch, getDepartmentCodeSafe, year, sem, div, subject, examType]);

  React.useEffect(() => { fetchClassResults(); }, [fetchClassResults]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !examType) return;
    const batch = computeBatch();
    const department = getDepartmentCodeSafe();

    // marksInput format: "roll=marks, roll=marks" or newlines/spaces
    const tokens = marksInput.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
    const entries: { roll: string; marks: number }[] = [];
    tokens.forEach(tok => {
      const [roll, marksStr] = tok.split(/[:=\s]+/);
      const val = Number(marksStr);
      if (roll && !Number.isNaN(val)) entries.push({ roll: roll.trim(), marks: val });
    });

    await Promise.all(entries.map(async ({ roll, marks }) => {
      const student = students.find(s => String(s.rollNumber || s.id) === roll);
      const userId = student ? student.id : roll; // fallback
      await resultService.upsertResult({
        userId,
        userName: student?.name || '',
        rollNumber: roll,
        batch,
        department,
        year,
        sem,
        div,
        subject,
        examType,
        marksObtained: marks,
        maxMarks,
      });
    }));

    setMarksInput('');
    await fetchClassResults();
  };

  const downloadTemplate = () => {
    const headers = ['name','rollNumber','year','sem','div','subject','examType','marksObtained','maxMarks'];
    const sample = ['John Doe','201',year,sem,div,subject || 'Subject',examType || 'UT1','18',String(maxMarks)];
    const csv = [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'result_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const parseCsv = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];
    
    // Parse CSV with proper handling of quoted values
    const parseCsvLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCsvLine(lines[0]).map(h => h.replace(/"/g, '').trim());
    return lines.slice(1).map(line => {
      const values = parseCsvLine(line).map(v => v.replace(/"/g, '').trim());
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      alert('Please select a file to import');
      return;
    }

    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    try {
      setLoading(true);
      const text = await file.text();
      const rows = parseCsv(text);
      
      if (rows.length === 0) {
        alert('No data found in the CSV file');
        return;
      }

      console.log('Parsed CSV rows:', rows);
      
      const batch = computeBatch();
      const department = getDepartmentCodeSafe();
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const r of rows) {
        try {
          const roll = String(r.rollNumber || r.roll || '').trim();
          if (!roll) {
            errorCount++;
            errors.push(`Row ${rows.indexOf(r) + 2}: Missing roll number`);
            continue;
          }

          const student = students.find(s => String(s.rollNumber || s.id) === roll);
          const userId = student ? student.id : roll;
          const subj = String(r.subject || subject).trim();
          const ex = String(r.examType || examType).trim();
          const yr = String(r.year || year).trim();
          const se = String(r.sem || sem).trim();
          const dv = String(r.div || div).trim();
          const mo = Number(r.marksObtained || r.obtain || r.obtained || 0);
          const mm = Number(r.maxMarks || r.total || maxMarks);

          if (isNaN(mo) || isNaN(mm) || mo < 0 || mm <= 0) {
            errorCount++;
            errors.push(`Row ${rows.indexOf(r) + 2}: Invalid marks (${mo}/${mm})`);
            continue;
          }

          await resultService.upsertResult({
            userId,
            userName: student?.name || String(r.name || ''),
            rollNumber: roll,
            batch,
            department,
            year: yr,
            sem: se,
            div: dv,
            subject: subj,
            examType: ex,
            marksObtained: mo,
            maxMarks: mm,
          });
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`Row ${rows.indexOf(r) + 2}: ${error}`);
        }
      }

      // Clear the file input
      e.target.value = '';
      
      // Refresh the class results
      await fetchClassResults();
      
      // Show results
      if (errorCount > 0) {
        alert(`Import completed with errors:\n\nSuccessfully imported: ${successCount}\nErrors: ${errorCount}\n\nFirst few errors:\n${errors.slice(0, 5).join('\n')}`);
      } else {
        alert(`Successfully imported ${successCount} results`);
      }
    } catch (error) {
      console.error('Import error:', error);
      alert(`Error importing file: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ['name','rollNumber','year','sem','div','subject','examType','marksObtained','maxMarks','percentage'];
    const rows = classResults.map((r: any) => [
      r.userName || '',
      r.rollNumber,
      year,
      sem,
      div,
      subject,
      examType,
      r.marksObtained,
      r.maxMarks,
      typeof r.percentage === 'number' ? r.percentage.toFixed(1) : ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results_${year}_${sem}_${div}_${subject}_${examType}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNewResultYearChange = (newYear: string) => {
    const normalizedYear = newYear.replace(/(st|nd|rd|th)/i, '');
    const newAvailableSemesters = getAvailableSemesters(normalizedYear);
    setFormAvailableSemesters(newAvailableSemesters);
    
    // If current semester is not valid for new year, reset to first available
    if (!isValidSemesterForYear(normalizedYear, newResult.sem)) {
      const defaultSem = getDefaultSemesterForYear(normalizedYear);
      setNewResult(prev => ({
        ...prev,
        year: newYear,
        sem: defaultSem
      }));
    } else {
      setNewResult(prev => ({
        ...prev,
        year: newYear
      }));
    }
  };

  // Load subjects for the modal form based on selected year and semester
  React.useEffect(() => {
    const loadFormSubjects = async () => {
      if (!user || !newResult.year || !newResult.sem) {
        console.log('Missing user, year, or sem:', { user: !!user, year: newResult.year, sem: newResult.sem });
        return;
      }
      try {
        setFormSubjectsLoading(true);
        const deptCode = getDepartmentCode(user.department);
        console.log('Loading subjects for:', { deptCode, year: newResult.year, sem: newResult.sem });
        let subs = await subjectService.getSubjectsByDepartment(deptCode, newResult.year, newResult.sem);
        console.log('Found subjects:', subs);
        
        // If no subjects found with year/sem filter, try without filters
        if (subs.length === 0) {
          console.log('No subjects found with year/sem filter in modal, trying without filters...');
          subs = await subjectService.getSubjectsByDepartment(deptCode);
          console.log('Found subjects without filters in modal:', subs);
        }
        
        const unique = Array.from(new Set(subs.map(s => s.subjectName)));
        const names = unique.sort();
        setFormAvailableSubjects(names);
      } catch (error) {
        console.error('Error loading form subjects:', error);
        setFormAvailableSubjects([]);
      } finally {
        setFormSubjectsLoading(false);
      }
    };
    loadFormSubjects();
  }, [user?.department, newResult.year, newResult.sem]);

  // Update form available semesters when modal opens
  React.useEffect(() => {
    if (showAddModal) {
      const normalizedYear = newResult.year.replace(/(st|nd|rd|th)/i, '');
      const newAvailableSemesters = getAvailableSemesters(normalizedYear);
      setFormAvailableSemesters(newAvailableSemesters);
    }
  }, [showAddModal, newResult.year]);

  const addSingleResult = async () => {
    const batch = computeBatch();
    const department = getDepartmentCodeSafe();
    const roll = newResult.rollNumber.trim();
    if (!roll || !newResult.subject) return;
    const student = students.find(s => String(s.rollNumber || s.id) === roll);
    const userId = student ? student.id : roll;
    await resultService.upsertResult({
      userId,
      userName: student?.name || newResult.name,
      rollNumber: roll,
      batch,
      department,
      year: newResult.year,
      sem: newResult.sem,
      div: newResult.div,
      subject: newResult.subject,
      examType: newResult.examType,
      marksObtained: Number(newResult.marksObtained),
      maxMarks: Number(newResult.maxMarks),
    });
    setShowAddModal(false);
    setNewResult({ name: '', rollNumber: '', year, sem, div, subject, examType, marksObtained: 0, maxMarks });
    await fetchClassResults();
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-blue-200 shadow mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Result Entry</h2>
          <p className="text-gray-600">Manage student results by year, semester, and division</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setNewResult({
                name: '',
                rollNumber: '',
                year: year, // Use current form values
                sem: sem,
                div: div,
                subject: '',
                examType: 'UT1',
                marksObtained: 0,
                maxMarks: maxMarks,
              });
              setShowAddModal(true);
            }}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-green-700 touch-manipulation active:scale-95 transition-transform"
          >
            <span className="text-sm font-medium">Add Result</span>
          </button>
          <button
            onClick={downloadTemplate}
            className="flex items-center justify-center gap-2 bg-gray-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-700 touch-manipulation active:scale-95 transition-transform"
          >
            <span className="text-sm font-medium">Download Template</span>
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-emerald-700 touch-manipulation active:scale-95 transition-transform"
          >
            <span className="text-sm font-medium">Import CSV</span>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-indigo-700 touch-manipulation active:scale-95 transition-transform"
          >
            <span className="text-sm font-medium">Export CSV</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onImportFile} />
        </div>
      </div>

      <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-gray-700">Year</label>
          <select value={year} onChange={e => handleYearChange(e.target.value)} className="mt-1 block w-full border rounded p-2">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Semester</label>
          <select value={sem} onChange={e => setSem(e.target.value)} className="mt-1 block w-full border rounded p-2">
            {availableSemesters.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Division</label>
          <select value={div} onChange={e => setDiv(e.target.value)} className="mt-1 block w-full border rounded p-2">
            {DIVS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Subject</label>
          <select value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 block w-full border rounded p-2" disabled={subjectsLoading}>
            {subjectsLoading ? <option value="">Loading...</option> : availableSubjects.length === 0 ? <option value="">No subjects</option> : availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} className="mt-1 block w-full border rounded p-2">
            {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Max Marks</label>
          <input type="number" value={maxMarks} onChange={e => setMaxMarks(Number(e.target.value))} className="mt-1 block w-full border rounded p-2" />
        </div>

        {/* Marks free-text input removed per requirement. Use Add Result modal instead. */}

        <div className="md:col-span-3 flex items-center gap-4 mt-2 flex-wrap">
          <span className="text-xs text-gray-500">Batch: {computeBatch()}, Department: {getDepartmentCodeSafe()}</span>
        </div>
      </form>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 sticky top-0 bg-white pb-2">Add Result</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={newResult.name} onChange={e => setNewResult({ ...newResult, name: e.target.value })} className="w-full border rounded p-2" placeholder="Student Name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                <input type="text" value={newResult.rollNumber} onChange={e => setNewResult({ ...newResult, rollNumber: e.target.value })} className="w-full border rounded p-2" placeholder="e.g. 201" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select value={newResult.year} onChange={e => handleNewResultYearChange(e.target.value)} className="w-full border rounded p-2">
                    {['1st','2nd','3rd','4th'].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select value={newResult.sem} onChange={e => setNewResult({ ...newResult, sem: e.target.value })} className="w-full border rounded p-2">
                    {formAvailableSemesters.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                  <select value={newResult.div} onChange={e => setNewResult({ ...newResult, div: e.target.value })} className="w-full border rounded p-2">
                    {['A','B','C'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select 
                  value={newResult.subject} 
                  onChange={e => setNewResult({ ...newResult, subject: e.target.value })} 
                  className="w-full border rounded p-2"
                  disabled={formSubjectsLoading}
                >
                  {formSubjectsLoading ? (
                    <option value="">Loading subjects...</option>
                  ) : formAvailableSubjects.length === 0 ? (
                    <option value="">No subjects available</option>
                  ) : (
                    <>
                      <option value="">Select subject</option>
                      {formAvailableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                <select value={newResult.examType} onChange={e => setNewResult({ ...newResult, examType: e.target.value })} className="w-full border rounded p-2">
                  {['UT1','UT2','Practical','Viva','Midterm','Endsem'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Marks Obtained</label>
                  <input type="number" value={newResult.marksObtained} onChange={e => setNewResult({ ...newResult, marksObtained: Number(e.target.value) })} className="w-full border rounded p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Marks</label>
                  <input type="number" value={newResult.maxMarks} onChange={e => setNewResult({ ...newResult, maxMarks: Number(e.target.value) })} className="w-full border rounded p-2" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sticky bottom-0 bg-white pt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400">Cancel</button>
                <button onClick={addSingleResult} className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Add Result</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Class Results Table */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-800">Class Results</h3>
          <span className="text-xs text-gray-500">{classResults.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Roll</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Marks</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {classResults.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-gray-500">No results yet.</td>
                </tr>
              ) : (
                classResults.map((r: any) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{r.rollNumber}</td>
                    <td className="px-3 py-2 text-gray-800">{r.userName || '-'}</td>
                    <td className="px-3 py-2 text-gray-800">{r.marksObtained} / {r.maxMarks}</td>
                    <td className="px-3 py-2 text-gray-700">{typeof r.percentage === 'number' ? `${r.percentage.toFixed(1)}%` : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ResultEntryPanel;


