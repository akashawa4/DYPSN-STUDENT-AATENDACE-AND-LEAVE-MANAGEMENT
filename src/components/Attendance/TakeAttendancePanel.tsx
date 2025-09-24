import React, { useState, useEffect } from 'react';
import { userService, attendanceService, subjectService, batchService, getBatchYear } from '../../firebase/firestore';
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
  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0];
  
  const [subject, setSubject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [presentRolls, setPresentRolls] = useState('');
  const [absentRolls, setAbsentRolls] = useState('');
  const [attendanceMode, setAttendanceMode] = useState<'present' | 'absent' | 'both'>('both');
  const [attendanceType, setAttendanceType] = useState<'class' | 'batch'>('class');
  const [inputMethod, setInputMethod] = useState<'tap' | 'type'>('tap');
  const [studentAttendance, setStudentAttendance] = useState<{[key: string]: 'present' | 'absent' | 'unmarked'}>({});
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [present, setPresent] = useState<User[]>([]);
  const [absent, setAbsent] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  
  
  // Batch data for batch-wise attendance
  const [batchData, setBatchData] = useState<{ batchName: string; fromRollNo: string; toRollNo: string; totalStudents: number }[]>([]);
  const [selectedBatchForAttendance, setSelectedBatchForAttendance] = useState('');
  const [batchAttendanceLoading, setBatchAttendanceLoading] = useState(false);
  // Tap-box state for batch-wise attendance (keyed by roll number)
  const [batchCardAttendance, setBatchCardAttendance] = useState<{[roll: string]: 'present' | 'absent' | 'unmarked'}>({});

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

  // Load batch data for batch-wise attendance
  useEffect(() => {
    const fetchBatchData = async () => {
      if (attendanceType !== 'batch') return;
      
      setBatchAttendanceLoading(true);
      try {
        const dept = getDepartmentCode(user?.department);
        const batch = getBatchYear(user?.year || '4th');
        
        // Convert year format to match batch structure
        const normalizedYear = year.replace(/(st|nd|rd|th)/i, '');
        
        console.log('User department:', user?.department);
        console.log('Department code:', dept);
        console.log('User year:', user?.year);
        console.log('Batch year:', batch);
        console.log('Fetching batches with params:', { dept, batch, year: normalizedYear, sem, div });
        
        // Try to fetch batches using the same approach as the existing system
        let batches = await batchService.getBatchesForDivision(batch, dept, year, sem, div);
        
        console.log('Fetched batches:', batches);
        
        // If no batches found, create some demo batches for this division
        if (batches.length === 0) {
          console.log('No batches found, creating demo batches...');
          const demoBatches = [
            {
              batchName: `Batch A (${div})`,
              fromRollNo: '101',
              toRollNo: '120',
              year: year,
              sem: sem,
              div: div,
              department: dept
            },
            {
              batchName: `Batch B (${div})`,
              fromRollNo: '121',
              toRollNo: '140',
              year: year,
              sem: sem,
              div: div,
              department: dept
            }
          ];
          
          // Create demo batches
          for (const demoBatch of demoBatches) {
            try {
              await batchService.createBatch(demoBatch);
              console.log('Created demo batch:', demoBatch.batchName);
            } catch (error) {
              console.error('Error creating demo batch:', error);
            }
          }
          
          // Fetch batches again after creating demo ones
          batches = await batchService.getBatchesForDivision(batch, dept, year, sem, div);
          console.log('Fetched batches after creating demo:', batches);
        }
        
        const batchDataWithCount = batches.map((batch: any) => ({
          ...batch,
          totalStudents: parseInt(batch.toRollNo) - parseInt(batch.fromRollNo) + 1
        }));
        
        setBatchData(batchDataWithCount);
      } catch (error) {
        console.error('Error fetching batch data:', error);
        setBatchData([]);
      } finally {
        setBatchAttendanceLoading(false);
      }
    };
    
    fetchBatchData();
  }, [attendanceType, year, sem, div, user?.department, user?.year]);

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




  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let presentList: string[] = [];
    let absentList: string[] = [];

    // Handle batch-wise attendance
    if (attendanceType === 'batch' && selectedBatchForAttendance) {
      const batch = batchData.find(b => b.batchName === selectedBatchForAttendance);
      if (batch) {
        const fromRoll = parseInt(batch.fromRollNo);
        const toRoll = parseInt(batch.toRollNo);
        const batchRolls: string[] = [];
        for (let roll = fromRoll; roll <= toRoll; roll++) {
          batchRolls.push(roll.toString());
        }

        const hasBatchCards = Object.keys(batchCardAttendance).length > 0;
        if (hasBatchCards) {
          // Use tap-box selections
          batchRolls.forEach(roll => {
            const status = batchCardAttendance[roll] || 'unmarked';
            if (status === 'present') presentList.push(roll);
            if (status === 'absent') absentList.push(roll);
          });
          // Fill unmarked per mode
          const presentSetFromCards = new Set(presentList);
          const absentSetFromCards = new Set(absentList);
          const unmarked = batchRolls.filter(r => !presentSetFromCards.has(r) && !absentSetFromCards.has(r));
          if (attendanceMode === 'present') {
            absentList = [...absentList, ...unmarked];
          } else if (attendanceMode === 'absent') {
            presentList = [...presentList, ...unmarked];
          } else {
            // both
            absentList = [...absentList, ...unmarked];
          }
        } else {
          // No tap selections: treat all unmarked. If teacher is in type mode we'll use the textarea; otherwise nothing is auto-marked.
          if (inputMethod === 'type') {
            const absentRollsList = absentRolls
              .split(/[\s,]+/)
              .map(r => r.trim())
              .filter(r => r.length > 0);
            absentList = absentRollsList;
            presentList = batchRolls.filter(r => !absentRollsList.includes(r));
          }
        }
      }
    } else {
      // Use card-based attendance data if available, otherwise fall back to text input
      const hasCardData = Object.keys(studentAttendance).length > 0;
      
      if (hasCardData) {
        // Use card-based attendance data
        Object.entries(studentAttendance).forEach(([studentId, status]) => {
          if (status === 'present') {
            presentList.push(studentId);
          } else if (status === 'absent') {
            absentList.push(studentId);
          }
        });

        // Fill in unmarked students according to selected attendanceMode
        const presentSetFromCards = new Set(presentList);
        const absentSetFromCards = new Set(absentList);
        const unmarked = students
          .map(s => String(s.rollNumber || s.id))
          .filter(id => !presentSetFromCards.has(id) && !absentSetFromCards.has(id));

        if (attendanceMode === 'present') {
          // All unmarked are absent
          absentList = [...absentList, ...unmarked];
        } else if (attendanceMode === 'absent') {
          // All unmarked are present
          presentList = [...presentList, ...unmarked];
        } else if (attendanceMode === 'both') {
          // Treat unmarked as absent by default
          absentList = [...absentList, ...unmarked];
        }
      } else {
        // Use traditional text input method
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
      }
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
    // Restrict writes to selected batch when in batch mode
    const targetStudents = attendanceType === 'batch' && selectedBatchForAttendance
      ? (() => {
          const batch = batchData.find(b => b.batchName === selectedBatchForAttendance);
          if (!batch) return [] as User[];
          const fromRoll = parseInt(batch.fromRollNo);
          const toRoll = parseInt(batch.toRollNo);
          return students.filter(s => {
            const rollStr = String(s.rollNumber || s.id);
            const roll = parseInt(rollStr);
            return !isNaN(roll) && roll >= fromRoll && roll <= toRoll;
          });
        })()
      : students;

    await Promise.all(
      targetStudents.map(s => {
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
          date: selectedDate,
          status,
          subject,
          notes: note,
          createdAt: new Date(),
          year: s.year || year, // Use student's year if available, fallback to filter year
          sem: s.sem || sem, // Use student's sem if available, fallback to filter sem
          div: s.div || div, // Use student's div if available, fallback to filter div
          studentYear: s.year || year, // Pass student year for batch path
        };

        // Use regular attendance service
        return attendanceService.markAttendance(attendanceData);
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

  const handleMarkAllPresent = () => {
    const allRollNumbers = attendanceType === 'batch' && selectedBatchForAttendance
      ? (() => {
          const b = batchData.find(x => x.batchName === selectedBatchForAttendance);
          if (!b) return [] as string[];
          const from = parseInt(b.fromRollNo);
          const to = parseInt(b.toRollNo);
          const rolls: string[] = [];
          for (let r = from; r <= to; r++) rolls.push(r.toString());
          return rolls;
        })()
      : students.map(s => String(s.rollNumber || s.id));
    setPresentRolls(allRollNumbers.join(', '));
    setAbsentRolls('');
    
    // Also update card-based system
    const newAttendance: {[key: string]: 'present' | 'absent' | 'unmarked'} = {};
    allRollNumbers.forEach(roll => { newAttendance[roll] = 'present'; });
    if (attendanceType === 'batch') {
      setBatchCardAttendance(newAttendance);
    } else {
      setStudentAttendance(newAttendance);
    }
  };

  const handleMarkAllAbsent = () => {
    const allRollNumbers = attendanceType === 'batch' && selectedBatchForAttendance
      ? (() => {
          const b = batchData.find(x => x.batchName === selectedBatchForAttendance);
          if (!b) return [] as string[];
          const from = parseInt(b.fromRollNo);
          const to = parseInt(b.toRollNo);
          const rolls: string[] = [];
          for (let r = from; r <= to; r++) rolls.push(r.toString());
          return rolls;
        })()
      : students.map(s => String(s.rollNumber || s.id));
    setAbsentRolls(allRollNumbers.join(', '));
    setPresentRolls('');
    
    // Also update card-based system
    const newAttendance: {[key: string]: 'present' | 'absent' | 'unmarked'} = {};
    allRollNumbers.forEach(roll => { newAttendance[roll] = 'absent'; });
    if (attendanceType === 'batch') {
      setBatchCardAttendance(newAttendance);
    } else {
      setStudentAttendance(newAttendance);
    }
  };

  // Handle individual student card tap
  const handleStudentCardTap = (studentId: string, currentStatus: 'present' | 'absent' | 'unmarked') => {
    let newStatus: 'present' | 'absent' | 'unmarked' = 'unmarked';
    
    if (currentStatus === 'unmarked') {
      newStatus = 'present';
    } else if (currentStatus === 'present') {
      newStatus = 'absent';
    } else if (currentStatus === 'absent') {
      newStatus = 'unmarked';
    }
    
    if (attendanceType === 'batch') {
      setBatchCardAttendance(prev => ({
        ...prev,
        [studentId]: newStatus
      }));
    } else {
      setStudentAttendance(prev => ({
        ...prev,
        [studentId]: newStatus
      }));
    }
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
      
      {/* Attendance Type Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Attendance Type</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAttendanceType('class')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              attendanceType === 'class'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Class-wise (Individual Students)
          </button>
          <button
            type="button"
            onClick={() => {
              setAttendanceType('batch');
              setBatchCardAttendance({});
            }}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              attendanceType === 'batch'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Batch-wise (Group Attendance)
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {attendanceType === 'class' && 'Mark attendance for individual students using student cards'}
          {attendanceType === 'batch' && 'Mark attendance for entire batches at once'}
        </p>
      </div>
      
      {/* Input Method Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Input Method</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setInputMethod('tap')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              inputMethod === 'tap'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Tap Box (Student Cards)
          </button>
          <button
            type="button"
            onClick={() => setInputMethod('type')}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              inputMethod === 'type'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Type Roll No (Text Input)
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {inputMethod === 'tap' && 'Tap on individual student cards to mark attendance - more visual and user-friendly'}
          {inputMethod === 'type' && 'Type roll numbers manually in text fields - traditional method'}
        </p>
      </div>
      
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
        <div>
          <label className="block text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="mt-1 block w-full border rounded p-2"
            max={todayStr}
          />
        </div>

        {/* Batch Selection for Batch-wise Attendance */}
        {attendanceType === 'batch' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Batch</label>
            {batchAttendanceLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Loading batches...</p>
              </div>
            ) : batchData.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <p>No batches found for {year} Year, Semester {sem}, Division {div}.</p>
                <p className="text-xs mt-1">Please create batches first using the Batch Management panel.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {batchData.map((batch, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setSelectedBatchForAttendance(batch.batchName);
                      setBatchCardAttendance({});
                      setPresentRolls('');
                      setAbsentRolls('');
                    }}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedBatchForAttendance === batch.batchName
                        ? 'bg-blue-100 border-blue-500 text-blue-800'
                        : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-sm font-semibold mb-1">{batch.batchName}</div>
                      <div className="text-xs text-gray-600 mb-2">
                        Roll: {batch.fromRollNo} - {batch.toRollNo}
                      </div>
                      <div className="text-xs font-medium">
                        {batch.totalStudents} students
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedBatchForAttendance && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Selected Batch: {selectedBatchForAttendance}</p>
                    <p className="text-xs text-blue-700">
                      {(() => {
                        const batch = batchData.find(b => b.batchName === selectedBatchForAttendance);
                        return batch ? `Roll Numbers: ${batch.fromRollNo} - ${batch.toRollNo} (${batch.totalStudents} students)` : '';
                      })()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedBatchForAttendance('')}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Batch-wise Tap Box Grid */}
        {attendanceType === 'batch' && selectedBatchForAttendance && inputMethod === 'tap' && (
          <div className="md:col-span-2">
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Batch Tap Cards - Tap to toggle Present/Absent
              </label>
              <p className="text-xs text-gray-500">Default is Unmarked. Tap to cycle Present → Absent → Unmarked.</p>
            </div>
            {(() => {
              const b = batchData.find(x => x.batchName === selectedBatchForAttendance);
              if (!b) return null;
              const from = parseInt(b.fromRollNo);
              const to = parseInt(b.toRollNo);
              const rolls: string[] = [];
              for (let r = from; r <= to; r++) rolls.push(r.toString());
              return (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2 border border-gray-200 rounded-lg p-3">
                  {rolls.map(roll => {
                    const status = batchCardAttendance[roll] || 'unmarked';
                    return (
                      <div
                        key={roll}
                        onClick={() => handleStudentCardTap(roll, status)}
                        className={`p-2 rounded-lg border-2 cursor-pointer transition-all duration-200 text-center select-none ${
                          status === 'present'
                            ? 'bg-green-100 border-green-500 text-green-800'
                            : status === 'absent'
                            ? 'bg-red-100 border-red-500 text-red-800'
                            : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                        title={`Roll ${roll}`}
                      >
                        <div className="text-sm font-semibold">{roll}</div>
                        <div className="text-[10px] mt-1">{status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : 'Unmarked'}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Absent Students Input for Batch-wise Attendance (text mode) */}
        {attendanceType === 'batch' && selectedBatchForAttendance && inputMethod === 'type' && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Absent Student Roll Numbers (comma or space separated)
            </label>
            <textarea
              value={absentRolls}
              onChange={e => setAbsentRolls(e.target.value)}
              className="mt-1 block w-full border rounded p-2 border-red-300 focus:border-red-500 focus:ring-red-500"
              rows={2}
              placeholder="e.g. 101, 103, 105 (students who are absent from the selected batch)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter roll numbers of students who are absent. All other students in the batch will be marked present.
            </p>
          </div>
        )}

        {/* Quick Mark All Buttons */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Quick Actions</label>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium transition-colors"
            >
              Mark All Present
            </button>
            <button
              type="button"
              onClick={handleMarkAllAbsent}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium transition-colors"
            >
              Mark All Absent
            </button>
            <button
              type="button"
              onClick={() => {
                setPresentRolls('');
                setAbsentRolls('');
                if (attendanceType === 'batch') {
                  setBatchCardAttendance({});
                } else {
                  setStudentAttendance({});
                }
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium transition-colors"
            >
              Clear All
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Use these buttons to quickly mark all students as present or absent, then modify as needed.
          </p>
        </div>

        {/* Student Cards - Only for Class-wise Attendance and Tap Method */}
        {attendanceType === 'class' && inputMethod === 'tap' && (
          <div className="md:col-span-2">
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700">
              Student Attendance Cards - Tap to mark Present/Absent
            </label>
          </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading students...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No students found for the selected criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 border border-gray-200 rounded-lg p-3">
              {students.map((student) => {
                const studentId = String(student.rollNumber || student.id);
                const status = studentAttendance[studentId] || 'unmarked';
                
                return (
                  <div
                    key={studentId}
                    onClick={() => handleStudentCardTap(studentId, status)}
                    className={`p-2 rounded-lg border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                      status === 'present' 
                        ? 'bg-green-100 border-green-500 text-green-800' 
                        : status === 'absent'
                        ? 'bg-red-100 border-red-500 text-red-800'
                        : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-base font-bold mb-1" title={`${student.name} - Roll: ${student.rollNumber || student.id}`}>
                        {student.rollNumber || student.id}
                      </div>
                      <div className="text-xs opacity-75 truncate" title={student.name}>
                        {student.name}
                      </div>
                      <div className="text-xs mt-2 font-medium">
                        {status === 'present' ? '✓ Present' : 
                         status === 'absent' ? '✗ Absent' : 
                         '○ Unmarked'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <div className="mt-3 text-xs text-gray-500">
            <p>• Tap once: Mark Present • Tap twice: Mark Absent • Tap thrice: Unmark</p>
            <p>• Green = Present • Red = Absent • Gray = Unmarked</p>
          </div>
          </div>
        )}

        {/* Text Input Fields - Only for Type Method */}
        {inputMethod === 'type' && (
          <>
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
          </>
        )}



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
                  {uniqueStudents(present).map((s) => (
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
                  {uniqueStudents(absent).map((s) => (
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