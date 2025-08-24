import React, { useState, useEffect } from 'react';
import { userService, attendanceService } from '../../firebase/firestore';
import { User } from '../../types';

const YEARS = ['2nd', '3rd', '4th'];
const SEMS = ['3', '4', '5', '6', '7', '8'];
const DIVS = ['A', 'B', 'C'];
const SUBJECTS = [
  'Software Engineering',
  'Microprocessor',
  'Operating System',
  'Automata',
  'CN-1'
];

// Add prop type for addNotification
interface TakeAttendancePanelProps {
  addNotification?: (message: string) => void;
}

const TakeAttendancePanel: React.FC<TakeAttendancePanelProps> = ({ addNotification }) => {
  const [year, setYear] = useState('2nd');
  const [sem, setSem] = useState('3');
  const [div, setDiv] = useState('A');
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [presentRolls, setPresentRolls] = useState('');
  const [absentRolls, setAbsentRolls] = useState('');
  const [attendanceMode, setAttendanceMode] = useState<'present' | 'absent' | 'both'>('both');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [present, setPresent] = useState<User[]>([]);
  const [absent, setAbsent] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');

  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0];

  useEffect(() => {
    // Fetch students from Firestore by year, sem, div
    const fetchStudents = async () => {
      setLoading(true);
      const all = await userService.getAllUsers();
      const filtered = all.filter(u =>
        u.role === 'student' &&
        u.year === year &&
        u.sem === sem &&
        u.div === div
      );
      setStudents(filtered);
      setLoading(false);
    };
    fetchStudents();
    // Fetch teachers for dropdown
    const fetchTeachers = async () => {
      const teacherList = await userService.getUsersByRole('teacher');
      setTeachers(teacherList);
      if (teacherList.length > 0) setSelectedTeacher(teacherList[0].id);
    };
    fetchTeachers();
  }, [year, sem, div]);

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
        let status = 'present';
        if (attendanceMode === 'present') {
          status = isPresent ? 'present' : 'absent';
        } else if (attendanceMode === 'absent') {
          status = isAbsent ? 'absent' : 'present';
        } else {
          // Both mode - use explicit marking
          status = isPresent ? 'present' : 'absent';
        }

        return attendanceService.markAttendance({
          userId: s.id,
          userName: s.name,
          rollNumber: s.rollNumber,
          date: todayStr,
          status,
          subject,
          notes: note,
          createdAt: new Date(),
          year,
          sem,
          div,
        });
      })
    );

    // Trigger notifications for present and absent students
    if (addNotification) {
      presentStudents.forEach(s => {
        addNotification(`${s.name} (${s.rollNumber || s.id}) was marked present for ${subject}`);
      });
      absentStudents.forEach(s => {
        addNotification(`${s.name} (${s.rollNumber || s.id}) was marked absent for ${subject}`);
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
        {/* Teacher Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Teacher</label>
          <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)} className="mt-1 block w-full border rounded p-2">
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Year</label>
          <select value={year} onChange={e => setYear(e.target.value)} className="mt-1 block w-full border rounded p-2">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Semester</label>
          <select value={sem} onChange={e => setSem(e.target.value)} className="mt-1 block w-full border rounded p-2">
            {SEMS.map(s => <option key={s} value={s}>{s}</option>)}
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
          <select value={subject} onChange={e => setSubject(e.target.value)} className="mt-1 block w-full border rounded p-2">
            {SUBJECTS.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
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