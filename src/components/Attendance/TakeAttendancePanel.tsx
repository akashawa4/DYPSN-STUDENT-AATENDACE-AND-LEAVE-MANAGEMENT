import React, { useState, useEffect } from 'react';
import { userService, attendanceService, subjectService, batchAttendanceService, batchService } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types';
import { getDepartmentCode } from '../../utils/departmentMapping';
import { getAvailableSemesters, isValidSemesterForYear, getDefaultSemesterForYear } from '../../utils/semesterMapping';

const YEARS = ['1st', '2nd', '3rd', '4th'];
const DIVS = ['A', 'B', 'C'];
// Subjects are loaded dynamically from Firestore using subjectService

// Add prop type for addNotification
interface TakeAttendancePanelProps {
  addNotification?: (message: string) => void;
}

const TakeAttendancePanel: React.FC<TakeAttendancePanelProps> = ({ addNotification }) => {
  const { user } = useAuth();
  const [year, setYear] = useState('2nd');
  const [sem, setSem] = useState('3');
  const [div, setDiv] = useState('A');
  const [availableSemesters, setAvailableSemesters] = useState<string[]>(getAvailableSemesters('2'));
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subject, setSubject] = useState<string>('');
  const [presentRolls, setPresentRolls] = useState('');
  const [absentRolls, setAbsentRolls] = useState('');
  const [attendanceMode, setAttendanceMode] = useState<'present' | 'absent' | 'both'>('both');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [present, setPresent] = useState<User[]>([]);
  const [absent, setAbsent] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Batch attendance states
  const [isBatchAttendance, setIsBatchAttendance] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [availableBatches, setAvailableBatches] = useState<{ batchName: string; fromRollNo: string; toRollNo: string }[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0];

  const normalizeYear = (y: string) => {
    if (!y) return '';
    // Convert year format to match new subject structure
    const yearMapping: { [key: string]: string } = {
      '1': '1st',
      '2': '2nd', 
      '3': '3rd',
      '4': '4th'
    };
    return yearMapping[y] || y;
  };

  // Handle year change to update available semesters
  const handleYearChange = (newYear: string) => {
    setYear(newYear);
    const normalizedYear = newYear.replace(/(st|nd|rd|th)/i, '');
    const newAvailableSemesters = getAvailableSemesters(normalizedYear);
    setAvailableSemesters(newAvailableSemesters);
    
    // If current semester is not valid for new year, reset to first available
    if (!isValidSemesterForYear(normalizedYear, sem)) {
      const defaultSem = getDefaultSemesterForYear(normalizedYear);
      setSem(defaultSem);
    }
  };

  useEffect(() => {
    // Fetch students from Firestore by year, sem, div
    const fetchStudents = async () => {
      setLoading(true);
      // Use batch structure to get students
      const batch = '2025'; // Default batch year
      const department = 'CSE'; // Default department
      const filtered = await userService.getStudentsByBatchDeptYearSemDiv(batch, department, year, sem, div);
      setStudents(filtered);
      setLoading(false);
    };
    fetchStudents();
  }, [year, sem, div]);

  // Load subjects dynamically based on filters (ignore div for subjects)
  useEffect(() => {
    const loadSubjects = async () => {
      try {
        setSubjectsLoading(true);
        
        const deptCode = getDepartmentCode(user?.department);
        
        const normalizedYear = normalizeYear(year);
        const subs = await subjectService.getSubjectsByDepartment(deptCode, normalizedYear, sem);
        
        const names = subs.map(s => s.subjectName).sort();
        setAvailableSubjects(names);
        if (names.length > 0) {
          setSubject(prev => (prev && names.includes(prev) ? prev : names[0]));
        } else {
          setSubject('');
        }
      } catch (e) {
        setAvailableSubjects([]);
        setSubject('');
      } finally {
        setSubjectsLoading(false);
      }
    };
    loadSubjects();
  }, [user?.department, year, sem, div]);

  // Load available batches when filters change
  useEffect(() => {
    const loadBatches = async () => {
      if (!isBatchAttendance) return;
      
      try {
        setBatchesLoading(true);
        const batch = '2025'; // Default batch year
        const department = getDepartmentCode(user?.department || 'CSE');
        
        const batches = await batchService.getBatchesForDivision(
          batch,
          department,
          year,
          sem,
          div
        );
        
        setAvailableBatches(batches);
        if (batches.length > 0 && !selectedBatch) {
          setSelectedBatch(batches[0].batchName);
        }
      } catch (error) {
        console.error('Error loading batches:', error);
        setAvailableBatches([]);
      } finally {
        setBatchesLoading(false);
      }
    };

    loadBatches();
  }, [isBatchAttendance, year, sem, div, user?.department]);

  const handleMarkAllPresent = () => {
    setPresentRolls(students.map(s => s.rollNumber || s.id).join(','));
    setAbsentRolls('');
  };

  const handleMarkAllAbsent = () => {
    setAbsentRolls(students.map(s => s.rollNumber || s.id).join(','));
    setPresentRolls('');
  };

  const handleClearAll = () => {
    setPresentRolls('');
    setAbsentRolls('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let presentList: string[] = [];
    let absentList: string[] = [];

    if (attendanceMode === 'present') {
      // Only present students mode
      presentList = presentRolls
        .split(/[\s,]+/)
        .map(r => r.trim())
        .filter(r => r.length > 0);
      // All other students are marked absent
      const presentSet = new Set(presentList);
      absentList = students
        .filter(s => !presentSet.has(String(s.rollNumber || s.id)))
        .map(s => String(s.rollNumber || s.id));
    } else if (attendanceMode === 'absent') {
      // Only absent students mode
      absentList = absentRolls
        .split(/[\s,]+/)
        .map(r => r.trim())
        .filter(r => r.length > 0);
      // All other students are marked present
      const absentSet = new Set(absentList);
      presentList = students
        .filter(s => !absentSet.has(String(s.rollNumber || s.id)))
        .map(s => String(s.rollNumber || s.id));
    } else {
      // Both mode - use both inputs
      presentList = presentRolls
        .split(/[\s,]+/)
        .map(r => r.trim())
        .filter(r => r.length > 0);
      absentList = absentRolls
        .split(/[\s,]+/)
        .map(r => r.trim())
        .filter(r => r.length > 0);
    }

    // Ensure present and absent lists are mutually exclusive and unique
    const presentSet = new Set(presentList);
    const absentSet = new Set(absentList);
    
    // Remove any duplicates between present and absent
    const finalPresentList = presentList.filter(r => !absentSet.has(r));
    const finalAbsentList = absentList.filter(r => !presentSet.has(r));

    const presentStudents = students.filter(s => finalPresentList.includes(String(s.rollNumber || s.id)));
    const absentStudents = students.filter(s => finalAbsentList.includes(String(s.rollNumber || s.id)));

    setPresent(presentStudents);
    setAbsent(absentStudents);
    setSubmitted(true);

    // Save attendance to Firestore in parallel
    await Promise.all(
      students.map(s => {
        const isPresent = finalPresentList.includes(String(s.rollNumber || s.id));
        const isAbsent = finalAbsentList.includes(String(s.rollNumber || s.id));
        
        // If student is not explicitly marked, default to present in present mode, absent in absent mode
        let status: 'present' | 'absent' | 'late' | 'half-day' | 'leave' = 'present';
        if (attendanceMode === 'present') {
          status = isPresent ? 'present' : 'absent';
        } else if (attendanceMode === 'absent') {
          status = isAbsent ? 'absent' : 'present';
        } else {
          // Both mode - use explicit marking
          status = isPresent ? 'present' : 'absent';
        }

        const attendanceData = {
          userId: s.id,
          userName: s.name,
          rollNumber: s.rollNumber,
          date: todayStr,
          status,
          subject,
          notes: note,
          createdAt: new Date(),
          year: s.year || year, // Use student's year if available, fallback to filter year
          sem: s.sem || sem, // Use student's sem if available, fallback to filter sem
          div: s.div || div, // Use student's div if available, fallback to filter div
          studentYear: s.year || year, // Pass student year for batch path
        };

        // If batch attendance is enabled, add batch information
        if (isBatchAttendance && selectedBatch) {
          const batch = availableBatches.find(b => b.batchName === selectedBatch);
          if (batch) {
            (attendanceData as any).batchName = selectedBatch;
            (attendanceData as any).fromRollNo = batch.fromRollNo;
            (attendanceData as any).toRollNo = batch.toRollNo;
            (attendanceData as any).isBatchAttendance = true;
          }
        }

        // Use batch attendance service if batch attendance is enabled
        if (isBatchAttendance && selectedBatch) {
          return batchAttendanceService.markBatchAttendance(attendanceData);
        } else {
          return attendanceService.markAttendance(attendanceData);
        }
      })
    );

    // Trigger notifications for present and absent students
    if (addNotification) {
      const batchInfo = isBatchAttendance && selectedBatch ? ` in batch ${selectedBatch}` : '';
      presentStudents.forEach(s => {
        addNotification(`${s.name} (${s.rollNumber || s.id}) was marked present for ${subject}${batchInfo}`);
      });
      absentStudents.forEach(s => {
        addNotification(`${s.name} (${s.rollNumber || s.id}) was marked absent for ${subject}${batchInfo}`);
      });
    }
  };

  const handleCopy = (list: User[]) => {
    navigator.clipboard.writeText(list.map(s => `${s.name} (${s.rollNumber || s.id})`).join(', '));
  };

  // Helper to get unique students by rollNumber or id
  function uniqueStudents(list: User[]) {
    const seen = new Set();
    return list.filter(s => {
      const key = String(s.rollNumber || s.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-blue-200 shadow mb-6">
      <h2 className="text-lg font-bold text-blue-900 mb-2">Take Attendance</h2>
      
      {/* Attendance Mode Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Attendance Mode</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAttendanceMode('present')}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              attendanceMode === 'present'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Mark Present Only
          </button>
          <button
            type="button"
            onClick={() => setAttendanceMode('absent')}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              attendanceMode === 'absent'
                ? 'bg-red-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Mark Absent Only
          </button>
          <button
            type="button"
            onClick={() => setAttendanceMode('both')}
            className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
              attendanceMode === 'both'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Mark Both
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {attendanceMode === 'present' && 'Mark only present students - others will be marked absent automatically'}
          {attendanceMode === 'absent' && 'Mark only absent students - others will be marked present automatically'}
          {attendanceMode === 'both' && 'Mark both present and absent students manually'}
        </p>
      </div>

      <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
        {/* Teacher Name (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Teacher</label>
          <input 
            type="text" 
            value={user?.name || ''} 
            className="mt-1 block w-full border rounded p-2 bg-gray-50 text-gray-600" 
            readOnly 
          />
        </div>
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
            {subjectsLoading ? (
              <option value="">Loading subjects...</option>
            ) : availableSubjects.length === 0 ? (
              <option value="">No subjects</option>
            ) : (
              availableSubjects.map((sub, idx) => <option key={`${sub}-${idx}`} value={sub}>{sub}</option>)
            )}
          </select>
        </div>

        {/* Batch Attendance Options */}
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              id="batchAttendance"
              checked={isBatchAttendance}
              onChange={e => setIsBatchAttendance(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="batchAttendance" className="text-sm font-medium text-gray-700">
              Batch Attendance (Optional)
            </label>
          </div>
          
          {isBatchAttendance && (
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Batch</label>
                  <select 
                    value={selectedBatch} 
                    onChange={e => setSelectedBatch(e.target.value)} 
                    className="w-full border rounded p-2 text-sm"
                    disabled={batchesLoading}
                  >
                    {batchesLoading ? (
                      <option value="">Loading batches...</option>
                    ) : availableBatches.length === 0 ? (
                      <option value="">No batches available</option>
                    ) : (
                      <>
                        <option value="">Select a batch</option>
                        {availableBatches.map(batch => (
                          <option key={batch.batchName} value={batch.batchName}>
                            {batch.batchName} ({batch.fromRollNo} - {batch.toRollNo})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                {selectedBatch && availableBatches.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch Details</label>
                    <div className="bg-white border rounded p-2 text-sm">
                      {(() => {
                        const batch = availableBatches.find(b => b.batchName === selectedBatch);
                        if (batch) {
                          const fromRoll = parseInt(batch.fromRollNo);
                          const toRoll = parseInt(batch.toRollNo);
                          const totalStudents = toRoll - fromRoll + 1;
                          return (
                            <div>
                              <p><strong>Roll Numbers:</strong> {batch.fromRollNo} - {batch.toRollNo}</p>
                              <p><strong>Total Students:</strong> {totalStudents}</p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}
              </div>
              {availableBatches.length === 0 && !batchesLoading && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                  <p><strong>No batches found</strong> for {year} Year, Semester {sem}, Division {div}.</p>
                  <p className="mt-1">Please create batches first using the Batch Management panel.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Present Students Input */}
        {(attendanceMode === 'present' || attendanceMode === 'both') && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Present Student Roll Numbers (comma or space separated)
            </label>
            <textarea
              value={presentRolls}
              onChange={e => setPresentRolls(e.target.value)}
              className="mt-1 block w-full border rounded p-2 border-green-300 focus:border-green-500 focus:ring-green-500"
              rows={2}
              placeholder="e.g. 201, 202, 204"
            />
          </div>
        )}

        {/* Absent Students Input */}
        {(attendanceMode === 'absent' || attendanceMode === 'both') && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Absent Student Roll Numbers (comma or space separated)
            </label>
            <textarea
              value={absentRolls}
              onChange={e => setAbsentRolls(e.target.value)}
              className="mt-1 block w-full border rounded p-2 border-red-300 focus:border-red-500 focus:ring-red-500"
              rows={2}
              placeholder="e.g. 203, 205, 206"
            />
          </div>
        )}

        {/* Quick Action Buttons */}
        <div className="md:col-span-2 flex gap-2 flex-wrap">
          <button 
            type="button" 
            onClick={handleMarkAllPresent} 
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
          >
            Mark All Present
          </button>
          <button 
            type="button" 
            onClick={handleMarkAllAbsent} 
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
          >
            Mark All Absent
          </button>
          <button 
            type="button" 
            onClick={handleClearAll} 
            className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium"
          >
            Clear All
          </button>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">Session Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
            placeholder="Topic covered, remarks, etc."
          />
        </div>
        <div className="md:col-span-2 flex items-center gap-4 mt-2">
          <span className="text-sm text-gray-500">Date: <strong>{todayStr}</strong></span>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={loading}>Submit Attendance</button>
        </div>
      </form>
      {submitted && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 p-3 rounded">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-green-800">Present Students</h3>
              <button onClick={() => handleCopy(present)} className="text-xs text-blue-600 hover:underline">Copy</button>
            </div>
            <div className="text-sm text-green-900">
              {present.length === 0 ? 'None' : (
                <ol className="list-decimal list-inside space-y-1">
                  {uniqueStudents(present).map((s, idx) => (
                    <li key={String(s.rollNumber || s.id)}>{s.name} ({s.rollNumber || s.id})</li>
                  ))}
                </ol>
              )}
            </div>
          </div>
          <div className="bg-red-50 p-3 rounded">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-red-800">Absent Students</h3>
              <button onClick={() => handleCopy(absent)} className="text-xs text-blue-600 hover:underline">Copy</button>
            </div>
            <div className="text-sm text-red-900">
              {absent.length === 0 ? 'None' : (
                <ol className="list-decimal list-inside space-y-1">
                  {uniqueStudents(absent).map((s, idx) => (
                    <li key={String(s.rollNumber || s.id)}>{s.name} ({s.rollNumber || s.id})</li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TakeAttendancePanel; 