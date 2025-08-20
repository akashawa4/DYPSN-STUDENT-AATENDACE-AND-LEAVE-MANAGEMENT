import React, { useState, useEffect } from 'react';
import { Calendar, Clock, TrendingUp, MapPin, Download, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { userService, attendanceService } from '../../firebase/firestore';
import { AttendanceRecord } from '../../types';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

const YEARS = ['1st', '2nd', '3rd', '4th'];
const SEMS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const DIVS = ['A', 'B', 'C', 'D'];

const MyAttendance: React.FC = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewType, setViewType] = useState<'calendar' | 'list'>('calendar');
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [customRange, setCustomRange] = useState<{from: string, to: string}>({from: '', to: ''});

  // Load user's attendance data from Firestore
  useEffect(() => {
    const loadAttendanceData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const records = await attendanceService.getAttendanceByUser(user.id);

        // Convert AttendanceLog[] to AttendanceRecord[]
        const attendanceRecords: AttendanceRecord[] = records.map((log: any) => ({
          id: log.id,
          userId: log.userId,
          date: typeof log.date === 'string' ? log.date : (log.date?.toISOString?.() || ''),
          status: log.status,
          location: log.location || '',
          subject: log.subject || '',
          notes: log.notes || '',
          createdAt: log.createdAt || null,
        }));
        setAttendanceData(attendanceRecords);
      } catch (error) {
        console.error('Error loading attendance data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAttendanceData();
  }, [user]);

  // Calculate month stats from real data
  const calculateMonthStats = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    
    const monthRecords = attendanceData.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getFullYear() === year && recordDate.getMonth() === month;
    });

    const presentDays = monthRecords.filter(r => r.status === 'present').length;
    const leaveDays = monthRecords.filter(r => r.status === 'leave').length;
    const lateDays = monthRecords.filter(r => r.status === 'late').length;
    const totalDays = monthRecords.length;

    // Calculate average working hours
    // No workingHours in AttendanceRecord, so skip average working hours calculation
    return {
      totalDays,
      presentDays,
      leaveDays,
      lateDays,
      avgWorkingHours: '',
      totalOvertime: ''
  };
  };

  const monthStats = calculateMonthStats();

  // Helper to get unique subjects for the month
  const getSubjectsForMonth = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const monthRecords = attendanceData.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getFullYear() === year && recordDate.getMonth() === month;
    });
    return Array.from(new Set(monthRecords.map(r => r.subject).filter(Boolean)));
  };

  // Helper to filter attendance by subject
  const getAttendanceBySubject = (subject: string) => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    return attendanceData.filter(record => {
      const recordDate = new Date(record.date);
      return record.subject === subject && recordDate.getFullYear() === year && recordDate.getMonth() === month;
    });
  };

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const subjects = getSubjectsForMonth();

  const FIXED_SUBJECTS = [
    'Software Engineering',
    'Microprocessor',
    'Operating System',
    'Automata',
    'CN-1'
  ];

  // Add state for export filters
  const [exportYear, setExportYear] = useState('2nd');
  const [exportSem, setExportSem] = useState('3');
  const [exportDiv, setExportDiv] = useState('A');
  const [exportSubject, setExportSubject] = useState<string>('');

  // Download helpers
  const downloadCSV = (records: AttendanceRecord[], filename: string) => {
    // Get all days in the selected month
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Format each day as DD/MM/YYYY
    const dayColumns = Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dd = d.toString().padStart(2, '0');
      const mm = (month + 1).toString().padStart(2, '0');
      return `${dd}/${mm}/${year}`;
    });
    const header = ['Sr No', 'Name', 'Roll No', 'Subject', ...dayColumns, 'Present %', 'Absent %'];

    // Get all subjects for the month, plus fixed subjects
    const monthRecords = records.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getFullYear() === year && recordDate.getMonth() === month;
    });
    const monthSubjects = Array.from(new Set(monthRecords.map(r => r.subject).filter(Boolean)));
    const subjects = Array.from(new Set([...FIXED_SUBJECTS, ...monthSubjects]));

    // Filter subjects if exportSubject is set
    const filteredSubjects = exportSubject ? subjects.filter(s => s === exportSubject) : subjects;

    // Build rows: one per subject
    const rows = filteredSubjects.map((subject, idx) => {
      const row = [
        idx + 1,
        user?.name || '',
        user?.rollNumber || '',
        subject
      ];
      // For each day, find the attendance status for this subject
      let presentCount = 0;
      let absentCount = 0;
      let totalCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = new Date(year, month, d).toISOString().split('T')[0];
        const rec = monthRecords.find(r => r.subject === subject && r.date === dateStr);
        if (rec) {
          row.push(rec.status);
          totalCount++;
          if (rec.status === 'present') presentCount++;
          if (rec.status === 'absent') absentCount++;
        } else {
          row.push('');
        }
      }
      // Calculate percentages
      const presentPercent = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
      const absentPercent = totalCount > 0 ? Math.round((absentCount / totalCount) * 100) : 0;
      row.push(`${presentPercent}%`, `${absentPercent}%`);
      return row;
    });

    const csv = [header, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename);
  };

  // Filter attendance data for export
  const getFilteredAttendance = () => {
    return attendanceData.filter(record => {
      const userYear = user?.year || '';
      const userSem = user?.sem || '';
      const userDiv = user?.div || '';
      const matchYear = exportYear ? userYear === exportYear : true;
      const matchSem = exportSem ? userSem === exportSem : true;
      const matchDiv = exportDiv ? userDiv === exportDiv : true;
      const matchSubject = exportSubject ? record.subject === exportSubject : true;
      return matchYear && matchSem && matchDiv && matchSubject;
    });
  };

  // Helper to get YYYY-MM-DD from possible Firestore Timestamp/Date/string
  function getDateString(dateVal: any) {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') return dateVal;
    if (dateVal.toDate) return dateVal.toDate().toISOString().split('T')[0];
    if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];
    return '';
  }

  const handleDownloadMonth = async () => {
    if (!exportSubject) {
      alert('Please select a subject to export attendance.');
      return;
    }
    setExporting(true);
    try {
      let allRows = [];
      let srNo = 1;
      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      const today = new Date();
      const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const dayColumns = Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        const dd = d.toString().padStart(2, '0');
        const mm = (month + 1).toString().padStart(2, '0');
        return `${dd}/${mm}/${year}`;
      });
      const lastDay = isCurrentMonth ? today.getDate() : daysInMonth;
      const allDateStrs = Array.from({ length: lastDay }, (_, i) => new Date(year, month, i + 1).toISOString().split('T')[0]);
      if (user?.role === 'student') {
        // Only export the logged-in student's data
        const logs = attendanceData.filter(r => r.subject === exportSubject && allDateStrs.includes(r.date));
        const row = [
          1,
          user?.name || '',
          user?.rollNumber || '',
          exportSubject || '-',
        ];
        let presentCount = 0;
        let absentCount = 0;
        for (const dateStr of allDateStrs) {
          const rec = logs.find(r => r.date === dateStr && r.status === 'present');
          if (rec) {
            row.push('present');
            presentCount++;
          } else {
            row.push('absent');
            absentCount++;
          }
        }
        const totalDays = allDateStrs.length;
        const presentPercent = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;
        const absentPercent = totalDays > 0 ? Math.round((absentCount / totalDays) * 100) : 0;
        row.push(`${presentPercent}%`, `${absentPercent}%`);
        allRows.push(row);
      } else {
        // Teacher/HOD: export all students as before
        const students = await userService.getStudentsByYearSemDiv(exportYear, exportSem, exportDiv);
        const allLogs = await Promise.all(
          students
            .filter(student => !!student.rollNumber && String(student.rollNumber).trim() !== '')
            .map(student =>
              attendanceService.getOrganizedAttendanceByUserAndDateRange(
                String(student.rollNumber), exportYear, exportSem, exportDiv, exportSubject, startDate, endDate
              ).then(logs => ({ student, logs }))
            )
        );
        for (const { student, logs } of allLogs) {
          const row = [
            srNo++,
            student.name,
            student.rollNumber,
            exportSubject || '-',
          ];
          let presentCount = 0;
          let absentCount = 0;
          for (const dateStr of allDateStrs) {
            const rec = logs.find(r => getDateString(r.date) === dateStr && r.status === 'present');
            if (rec) {
              row.push('present');
              presentCount++;
            } else {
              row.push('absent');
              absentCount++;
            }
          }
          const totalDays = allDateStrs.length;
          const presentPercent = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;
          const absentPercent = totalDays > 0 ? Math.round((absentCount / totalDays) * 100) : 0;
          row.push(`${presentPercent}%`, `${absentPercent}%`);
          allRows.push(row);
        }
        // Remove duplicate students (by roll number and subject)
        const uniqueRows = [];
        const seen = new Set();
        for (const row of allRows) {
          const key = row[2] + '_' + row[3]; // rollNumber + subject
          if (!seen.has(key)) {
            uniqueRows.push(row);
            seen.add(key);
          }
        }
        // Fix Sr No sequencing
        uniqueRows.forEach((row, idx) => {
          row[0] = idx + 1;
        });
        allRows = uniqueRows;
      }
      const header = ['Sr No', 'Name', 'Roll No', 'Subject', ...dayColumns.slice(0, lastDay), 'Present %', 'Absent %'];
      const csv = [header, ...allRows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `attendance_${user?.role === 'student' ? (user?.rollNumber || user?.id || 'student') : 'students'}_${exportYear}_${exportSem}_${exportDiv}_${year}_${month + 1}.csv`);
    } catch (err) {
      console.error(err);
      alert('Failed to export attendance.');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadCustom = async () => {
    if (!customRange.from || !customRange.to) return;
    if (!exportSubject) {
      alert('Please select a subject to export attendance.');
      return;
    }
    setExporting(true);
    try {
      let allRows = [];
      let srNo = 1;
      const fromDate = new Date(customRange.from);
      const toDate = new Date(customRange.to);
      const today = new Date();
      let lastDate = toDate;
      if (toDate > today) lastDate = today;
      const days: string[] = [];
      let current = new Date(fromDate);
      while (current <= lastDate) {
        days.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
      if (user?.role === 'student') {
        // Only export the logged-in student's data
        const logs = attendanceData.filter(r => r.subject === exportSubject && days.includes(r.date));
        const row = [
          1,
          user?.name || '',
          user?.rollNumber || '',
          exportSubject || '-',
        ];
        let presentCount = 0;
        let absentCount = 0;
        for (const dateStr of days) {
          const rec = logs.find(r => r.date === dateStr && r.status === 'present');
          if (rec) {
            row.push('present');
            presentCount++;
          } else {
            row.push('absent');
            absentCount++;
          }
        }
        const totalDays = days.length;
        const presentPercent = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;
        const absentPercent = totalDays > 0 ? Math.round((absentCount / totalDays) * 100) : 0;
        row.push(`${presentPercent}%`, `${absentPercent}%`);
        allRows.push(row);
      } else {
        // Teacher/HOD: export all students as before
        const students = await userService.getStudentsByYearSemDiv(exportYear, exportSem, exportDiv);
        const allLogs = await Promise.all(
          students
            .filter(student => !!student.rollNumber && String(student.rollNumber).trim() !== '')
            .map(student =>
              attendanceService.getOrganizedAttendanceByUserAndDateRange(
                String(student.rollNumber), exportYear, exportSem, exportDiv, exportSubject, fromDate, toDate
              ).then(logs => ({ student, logs }))
            )
        );
        for (const { student, logs } of allLogs) {
          const row = [
            srNo++,
            student.name,
            student.rollNumber,
            exportSubject || '-',
          ];
          let presentCount = 0;
          let absentCount = 0;
          for (const dateStr of days) {
            const rec = logs.find(r => getDateString(r.date) === dateStr && r.status === 'present');
            if (rec) {
              row.push('present');
              presentCount++;
            } else {
              row.push('absent');
              absentCount++;
            }
          }
          const totalDays = days.length;
          const presentPercent = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;
          const absentPercent = totalDays > 0 ? Math.round((absentCount / totalDays) * 100) : 0;
          row.push(`${presentPercent}%`, `${absentPercent}%`);
          allRows.push(row);
        }
        // Remove duplicate students (by roll number and subject)
        const uniqueRows = [];
        const seen = new Set();
        for (const row of allRows) {
          const key = row[2] + '_' + row[3]; // rollNumber + subject
          if (!seen.has(key)) {
            uniqueRows.push(row);
            seen.add(key);
          }
        }
        // Fix Sr No sequencing
        uniqueRows.forEach((row, idx) => {
          row[0] = idx + 1;
        });
        allRows = uniqueRows;
      }
      const headerDays = days.map(dateStr => {
        const d = dateStr.split('-')[2];
        const m = dateStr.split('-')[1];
        const y = dateStr.split('-')[0];
        return `${d}/${m}/${y}`;
      });
      const header = ['Sr No', 'Name', 'Roll No', 'Subject', ...headerDays, 'Present %', 'Absent %'];
      const csv = [header, ...allRows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `attendance_${user?.role === 'student' ? (user?.rollNumber || user?.id || 'student') : 'students'}_${exportYear}_${exportSem}_${exportDiv}_${customRange.from}_to_${customRange.to}.csv`);
    } catch (err) {
      console.error(err);
      alert('Failed to export attendance.');
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!attendanceData.length) return;
    // Get unique dates in the selected month
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const monthRecords = getFilteredAttendance().filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getFullYear() === year && recordDate.getMonth() === month;
    });
    const dates = Array.from(new Set(monthRecords.map(r => r.date))).sort();
    const subjects = Array.from(new Set(monthRecords.map(r => r.subject).filter(Boolean)));

    // Build table: first columns are Name, Roll No, Subject, then one column per date
    const header = ['Name', 'Roll No', 'Subject', ...dates, 'Status', 'Location'];
    const rows: any[] = [];
    subjects.forEach(subject => {
      const row: any = {};
      row['Name'] = user?.name || '';
      row['Roll No'] = user?.rollNumber || '';
      row['Subject'] = subject;
      dates.forEach(date => {
        const rec = monthRecords.find(r => r.subject === subject && r.date === date);
        row[date] = rec ? rec.status : '';
      });
      row['Status'] = '';
      row['Location'] = 'Classroom';
      rows.push(row);
    });
    // Add overall percentage row for each subject
    subjects.forEach(subject => {
      const subjectRecords = monthRecords.filter(r => r.subject === subject);
      const presentCount = subjectRecords.filter(r => r.status === 'present').length;
      const total = subjectRecords.length;
      const percent = total > 0 ? Math.round((presentCount / total) * 100) : 0;
      const row: any = {};
      row['Name'] = user?.name || '';
      row['Roll No'] = user?.rollNumber || '';
      row['Subject'] = `${subject} %`;
      dates.forEach(date => {
        row[date] = '';
      });
      row[dates[0]] = `Overall: ${percent}%`;
      row['Status'] = '';
      row['Location'] = 'Classroom';
      rows.push(row);
    });
    const ws = XLSX.utils.json_to_sheet(rows, { header });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance_${user?.rollNumber || 'student'}_${year}_${month + 1}.xlsx`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'late': return 'bg-amber-100 text-amber-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'leave': return 'bg-blue-100 text-blue-800';
      case 'holiday': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCalendarDays = () => {
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDate = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const attendance = attendanceData.find(a => a.date === dateStr);
      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      
      days.push({
        date: new Date(currentDate),
        dateStr,
        attendance,
        isCurrentMonth,
        isToday
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newMonth);
  };

  const calendarDays = getCalendarDays();

  return (
    <div className="space-y-2">
      {/* Improved Filter & Export Controls Row */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-2 bg-white rounded-lg border border-gray-200">
        <div>
          <label className="text-xs font-semibold text-gray-700 mr-1">Year:</label>
          <select value={exportYear} onChange={e => setExportYear(e.target.value)} className="border rounded px-2 py-1 text-sm h-9 min-w-[80px]">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 mr-1">Semester:</label>
          <select value={exportSem} onChange={e => setExportSem(e.target.value)} className="border rounded px-2 py-1 text-sm h-9 min-w-[80px]">
            {SEMS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 mr-1">Division:</label>
          <select value={exportDiv} onChange={e => setExportDiv(e.target.value)} className="border rounded px-2 py-1 text-sm h-9 min-w-[80px]">
            {DIVS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700 mr-1">Subject:</label>
          <select value={exportSubject} onChange={e => setExportSubject(e.target.value)} className="border rounded px-2 py-1 text-sm h-9 min-w-[120px]">
            <option value="">All</option>
            {FIXED_SUBJECTS.map(subj => <option key={subj} value={subj}>{subj}</option>)}
          </select>
        </div>
        {/* Export/Download Controls */}
        <button onClick={handleDownloadMonth} disabled={exporting} className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 h-9 disabled:opacity-50">
          <Download className="w-4 h-4" />
          <span>{exporting ? 'Exporting...' : 'Export Month'}</span>
        </button>
        <div className="flex items-center space-x-1">
          <input type="date" value={customRange.from} onChange={e => setCustomRange(r => ({...r, from: e.target.value}))} className="border rounded px-1 text-xs h-9" />
          <span>-</span>
          <input type="date" value={customRange.to} onChange={e => setCustomRange(r => ({...r, to: e.target.value}))} className="border rounded px-1 text-xs h-9" />
          <button onClick={handleDownloadCustom} disabled={exporting} className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs h-9 disabled:opacity-50">{exporting ? 'Exporting...' : 'Export Custom'}</button>
        </div>
      </div>
      {/* Page Title and rest of the content */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {user?.role === 'teacher' || user?.role === 'hod' ? 'Student Attendance' : 'My Attendance'}
          </h1>
          <p className="text-gray-600">
            {user?.role === 'teacher' || user?.role === 'hod'
              ? 'Track student daily attendance and working hours'
              : 'Track your daily attendance and working hours'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
            <button
              onClick={() => setViewType('calendar')}
              className={`px-2 py-1 rounded-md text-sm font-medium transition-colors w-full sm:w-auto ${
                viewType === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              Calendar
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading attendance data...</p>
        </div>
      ) : (
        <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        <div className="bg-white p-2 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Present Days</p>
              <p className="text-2xl font-bold text-green-600">{monthStats.presentDays}</p>
            </div>
            <Calendar className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Leave Days</p>
              <p className="text-2xl font-bold text-blue-600">{monthStats.leaveDays}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Attendance %</p>
              <p className="text-2xl font-bold text-purple-600">
                {isNaN(monthStats.presentDays / monthStats.totalDays) ? '0%' : Math.round((monthStats.presentDays / monthStats.totalDays) * 100) + '%'}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-2">
        <div className="xl:col-span-3">
          {viewType === 'calendar' ? (
            <div className="bg-white rounded-lg border border-gray-200 p-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="p-1 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="p-1 hover:bg-gray-100 rounded-lg"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="grid grid-cols-7 gap-1 min-w-[600px]">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                      {day}
                    </div>
                  ))}
                  
                  {calendarDays.map((day, index) => (
                    <div
                      key={index}
                      className={`p-1 min-h-[60px] border border-gray-100 rounded-lg transition-colors duration-200
                        ${!day.isCurrentMonth ? 'bg-gray-50' : day.attendance ? getStatusColor(day.attendance.status).split(' ')[0] : 'bg-white'}
                        ${day.isToday ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${!day.isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}`}>
                        {day.date.getDate()}
                      </div>
                      {day.attendance && day.isCurrentMonth && (
                        <div className="space-y-1">
                          <div className={`text-xs px-1 py-0.5 rounded-full text-center ${getStatusColor(day.attendance.status)}`}> 
                            {day.attendance.status.charAt(0).toUpperCase() + day.attendance.status.slice(1)}
                          </div>
                          {day.attendance.subject && (
                            <div className="text-xs text-blue-700 text-center font-semibold">{day.attendance.subject}</div>
                          )}
                          {(day.attendance.status === 'present' || day.attendance.status === 'late') ? (
                            <div className="text-xs text-gray-600 text-center">
                              {/* No clockIn/clockOut fields in AttendanceRecord */}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-center space-x-2 mt-2 text-xs">
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-100 rounded"></div>
                  <span className="text-gray-600">Present</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-amber-100 rounded"></div>
                  <span className="text-gray-600">Late</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-100 rounded"></div>
                  <span className="text-gray-600">Leave</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-red-100 rounded"></div>
                  <span className="text-gray-600">Absent</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock In</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clock Out</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Working Hours</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {subjects.length > 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <strong>Subject: {selectedSubject || 'All'}</strong>
                        </td>
                      </tr>
                    )}
                    {(selectedSubject ? attendanceData.filter(r => r.subject === selectedSubject) : attendanceData).slice(0, 10).map((record, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(record.date).toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.subject || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {/* No clockIn field in AttendanceRecord */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {/* No clockOut field in AttendanceRecord */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {/* No workingHours or overtime fields in AttendanceRecord */}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {/* No location field in AttendanceRecord */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Today's Status - Sidebar */}
        {/* Removed the sidebar with today's status */}
      </div>
        </>
      )}
    </div>
  );
};

export default MyAttendance;