import React, { useState, useEffect } from 'react';
import { Download, Calendar, TrendingUp, FileText, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { attendanceService } from '../../firebase/firestore';
import { saveAs } from 'file-saver';
import { getDepartmentCode } from '../../utils/departmentMapping';

interface StudentAttendanceData {
  date: string;
  subject: string;
  status: string;
  presentCount: number;
  absentCount: number;
  totalDays: number;
  attendancePercentage: number;
}

const StudentMyAttendance: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [studentAttendanceData, setStudentAttendanceData] = useState<StudentAttendanceData[]>([]);
  const [error, setError] = useState<string>('');
  
  // Filter states
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Custom range states
  const [customRangeFrom, setCustomRangeFrom] = useState<string>('');
  const [customRangeTo, setCustomRangeTo] = useState<string>('');
  const [showCustomRangeInputs, setShowCustomRangeInputs] = useState(false);
  
  // Dynamic subjects based on student's year and semester
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Load subjects based on student's year and semester
  const loadSubjects = async () => {
    if (!user || user.role !== 'student') return;
    
    try {
      setSubjectsLoading(true);
      // Get department code for subject query
      const deptCode = getDepartmentCode(user.department);
      
      // Query subjects directly from Firestore using the new path structure
      // New Path: /subjects/2025/CSE/year/4th/sems/7
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('../../firebase/firebase');
      
      const batchYear = '2025'; // Default batch year
      const collectionPath = `subjects/${batchYear}/${deptCode}/year/${user.year}/sems/${user.sem}`;
      
      const subjectsRef = collection(db, collectionPath);
      const querySnapshot = await getDocs(subjectsRef);
      
      // Extract subject names from document data
      const subjectNames: string[] = [];
      querySnapshot.docs.forEach(doc => {
        const docId = doc.id;
        
        // Get subject data to find the actual subject name
        const subjectData = doc.data();
        const subjectName = subjectData.subjectName || subjectData.name || docId;
        
        if (!subjectNames.includes(subjectName)) {
          subjectNames.push(subjectName);
        }
      });
      setAvailableSubjects(subjectNames);
      
      // Set first subject as default if none selected
      if (subjectNames.length > 0 && !selectedSubject) {
        setSelectedSubject(subjectNames[0]);
      } else if (subjectNames.length === 0) {
        setError(`No subjects found for ${user.year} year, ${user.sem} semester. Please contact your administrator.`);
      }
      
    } catch (error) {
      setError('Failed to load subjects. Please try again.');
    } finally {
      setSubjectsLoading(false);
    }
  };

  // Set default date to today when component mounts
  useEffect(() => {
    setSelectedDate(getTodayDate());
  }, []);

  // Load subjects when user data is available
  useEffect(() => {
    if (user && user.role === 'student') {
      loadSubjects();
    }
  }, [user]);

  // Load student's own attendance data
  useEffect(() => {
    const loadStudentAttendance = async () => {
      if (!user || user.role !== 'student' || !selectedSubject) return;
      
      try {
        setLoading(true);
        setError('');
        
        // Load attendance data for selected date
        if (selectedDate) {
          await loadAttendanceData();
        }
        
      } catch (error) {
        setError('Failed to load attendance data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadStudentAttendance();
  }, [user, selectedSubject, selectedDate]);

  const loadAttendanceData = async () => {
    if (!selectedDate || !user) return;
    
    setLoading(true);
    
    try {
      // Get student's own attendance for the selected subject and date
      const studentAttendance = await attendanceService.getOrganizedAttendanceByUserAndDateRange(
        user.rollNumber!,
        user.year || '2nd',
        user.sem || '3',
        user.div || 'A',
        selectedSubject,
        new Date(selectedDate),
        new Date(selectedDate)
      );
      
      // Calculate attendance statistics for selected date only
      const presentCount = studentAttendance.filter(a => a.status === 'present').length;
      const absentCount = studentAttendance.filter(a => a.status === 'absent').length;
      const totalDays = studentAttendance.length;
      const attendancePercentage = totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0;
      
      const attendanceData: StudentAttendanceData = {
        date: selectedDate,
        subject: selectedSubject,
        status: presentCount > 0 ? 'present' : absentCount > 0 ? 'absent' : 'not_marked',
        presentCount,
        absentCount,
        totalDays,
        attendancePercentage
      };
      
      setStudentAttendanceData([attendanceData]);
      
    } catch (error) {
      // Set default data if there's an error
      const defaultData: StudentAttendanceData = {
        date: selectedDate,
        subject: selectedSubject,
        status: 'not_marked',
        presentCount: 0,
        absentCount: 0,
        totalDays: 0,
        attendancePercentage: 0
      };
      setStudentAttendanceData([defaultData]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectChange = (newSubject: string) => {
    setSelectedSubject(newSubject);
    // Reload attendance data when subject changes
    if (selectedDate) {
      loadAttendanceData();
    }
  };

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    // Reload attendance data when date changes
    loadAttendanceData();
  };

  const handleExportDailyReport = async () => {
    if (!selectedSubject || !selectedDate) {
      alert('Please select a subject and date to export attendance data.');
      return;
    }
    
    setExporting(true);
    try {
      const header = ['Sr No', 'Name', 'Division', 'Roll No', 'Subject', 'Selected Date', 'Present Percentage', 'Absent Percentage'];
      
      const rows: any[] = [];
      let srNo = 1;
      
      for (const data of studentAttendanceData) {
        const row = [
          srNo++,
          user?.name || '',
          user?.div || '',
          user?.rollNumber || '',
          selectedSubject,
          selectedDate,
          `${data.attendancePercentage}%`,
          `${data.totalDays > 0 ? Math.round((data.absentCount / data.totalDays) * 100) : 0}%`
        ];
        
        rows.push(row);
      }
      
      const csv = [header, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `my_attendance_${user?.year || '2nd'}_${user?.sem || '3'}_${user?.div || 'A'}_${selectedSubject}_${selectedDate}.csv`);
      
    } catch (error) {
      alert('Failed to export attendance data.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportMonthReport = async () => {
    if (!selectedSubject) {
      alert('Please select a subject to export month report.');
      return;
    }
    
    setExporting(true);
    try {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const startDate = firstDayOfMonth.toISOString().split('T')[0];
      const endDate = lastDayOfMonth.toISOString().split('T')[0];
      
      // Generate all dates in the month
      const dates: string[] = [];
      const currentDate = new Date(firstDayOfMonth);
      while (currentDate <= lastDayOfMonth) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      const header = ['Sr No', 'Name', 'Division', 'Roll No', 'Subject', ...dates, 'Total Present Days', 'Total Absent Days', 'Present Percentage'];
      
      // Get student's month attendance data
      const monthAttendance = await attendanceService.getOrganizedAttendanceByUserAndDateRange(
        user!.rollNumber!,
        user!.year || '2nd',
        user!.sem || '3',
        user!.div || 'A',
        selectedSubject,
        firstDayOfMonth,
        lastDayOfMonth
      );
      
      // Create a map of date to attendance status
      const attendanceByDate = new Map<string, string>();
      monthAttendance.forEach(att => {
        const dateStr = att.date instanceof Date ? att.date.toISOString().split('T')[0] : 
                       (att.date as any)?.toDate?.()?.toISOString().split('T')[0] || att.date;
        attendanceByDate.set(dateStr, att.status);
      });
      
      // Generate daily attendance status for each date
      const dailyStatus = dates.map(date => {
        const status = attendanceByDate.get(date);
        return status === 'present' ? 'P' : status === 'absent' ? 'A' : '-';
      });
      
      // Calculate totals
      const totalPresentDays = monthAttendance.filter(a => a.status === 'present').length;
      const totalAbsentDays = monthAttendance.filter(a => a.status === 'absent').length;
      const totalDays = monthAttendance.length;
      const presentPercentage = totalDays > 0 ? Math.round((totalPresentDays / totalDays) * 100) : 0;
      
      const row = [
        1,
        user?.name || '',
        user?.div || '',
        user?.rollNumber || '',
        selectedSubject,
        ...dailyStatus,
        totalPresentDays,
        totalAbsentDays,
        `${presentPercentage}%`
      ];
      
      const csv = [header, row].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `my_month_report_${user?.year || '2nd'}_${user?.sem || '3'}_${user?.div || 'A'}_${selectedSubject}_${startDate}_to_${endDate}.csv`);
      
    } catch (error) {
      alert('Failed to export month report.');
    } finally {
      setExporting(false);
    }
  };


  const handleCustomRangeConfirm = async () => {
    if (!customRangeFrom || !customRangeTo) {
      alert('Please select both start and end dates for the custom range.');
      return;
    }

    setExporting(true);
    try {
      // Generate all dates in the range
      const dates: string[] = [];
      const startDate = new Date(customRangeFrom);
      const endDate = new Date(customRangeTo);
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      const header = ['Sr No', 'Name', 'Division', 'Roll No', 'Subject', ...dates, 'Total Present Days', 'Total Absent Days', 'Present Percentage'];
      
      // Get student's custom range attendance data
      const rangeAttendance = await attendanceService.getOrganizedAttendanceByUserAndDateRange(
        user!.rollNumber!,
        user!.year || '2nd',
        user!.sem || '3',
        user!.div || 'A',
        selectedSubject,
        startDate,
        endDate
      );
      
      // Create a map of date to attendance status
      const attendanceByDate = new Map<string, string>();
      rangeAttendance.forEach(att => {
        const dateStr = att.date instanceof Date ? att.date.toISOString().split('T')[0] : 
                       (att.date as any)?.toDate?.()?.toISOString().split('T')[0] || att.date;
        attendanceByDate.set(dateStr, att.status);
      });
      
      // Generate daily attendance status for each date
      const dailyStatus = dates.map(date => {
        const status = attendanceByDate.get(date);
        return status === 'present' ? 'P' : status === 'absent' ? 'A' : '-';
      });
      
      // Calculate totals
      const totalPresentDays = rangeAttendance.filter(a => a.status === 'present').length;
      const totalAbsentDays = rangeAttendance.filter(a => a.status === 'absent').length;
      const totalDays = rangeAttendance.length;
      const presentPercentage = totalDays > 0 ? Math.round((totalPresentDays / totalDays) * 100) : 0;
      
      const row = [
        1,
        user?.name || '',
        user?.div || '',
        user?.rollNumber || '',
        selectedSubject,
        ...dailyStatus,
        totalPresentDays,
        totalAbsentDays,
        `${presentPercentage}%`
      ];
      
      const csv = [header, row].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `my_custom_range_${user?.year || '2nd'}_${user?.sem || '3'}_${user?.div || 'A'}_${selectedSubject}_${customRangeFrom}_to_${customRangeTo}.csv`);
      
    } catch (error) {
      alert('Failed to export custom range report.');
    } finally {
      setExporting(false);
      setShowCustomRangeInputs(false);
    }
  };

  if (!user || user.role !== 'student') {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-600">Access denied. Only students can view this panel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Page Title - Mobile Optimized */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Attendance</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Track your personal attendance data</p>
        <div className="mt-2 text-xs sm:text-sm text-gray-500 bg-gray-50 p-2 rounded-lg">
          <div className="flex flex-wrap gap-2">
            <span className="font-medium text-gray-700">Student:</span>
            <span className="text-gray-600">{user.name}</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1">
            <span><span className="font-medium">Year:</span> {user.year}</span>
            <span><span className="font-medium">Sem:</span> {user.sem}</span>
            <span><span className="font-medium">Div:</span> {user.div}</span>
            <span><span className="font-medium">Dept:</span> {user.department}</span>
          </div>
        </div>
      </div>

      {/* Filters and Controls - Mobile Optimized */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select 
              value={selectedSubject} 
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
              required
              disabled={subjectsLoading}
            >
              {subjectsLoading ? (
                <option value="">Loading subjects...</option>
              ) : availableSubjects.length === 0 ? (
                <option value="">No subjects available for {user?.year} year, {user?.sem} semester</option>
              ) : (
                availableSubjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))
              )}
            </select>
            {subjectsLoading && (
              <div className="mt-2 text-xs sm:text-sm text-blue-600 flex items-center">
                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-b-2 border-blue-600 mr-2"></div>
                Loading subjects for {user?.year} year, {user?.sem} semester...
              </div>
            )}
            {!subjectsLoading && availableSubjects.length > 0 && (
              <div className="mt-2 text-xs sm:text-sm text-green-600">
                Found {availableSubjects.length} subjects for {user?.year} year, {user?.sem} semester
              </div>
            )}
            {!subjectsLoading && availableSubjects.length === 0 && (
              <div className="mt-2">
                <div className="text-xs sm:text-sm text-red-600 mb-2">
                  No subjects found for {user?.year} year, {user?.sem} semester
                </div>
                <button
                  onClick={loadSubjects}
                  className="text-xs sm:text-sm bg-blue-100 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-200 touch-manipulation"
                >
                  Retry Loading Subjects
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-manipulation"
            />
          </div>
        </div>
        
        <div className="mt-4 space-y-3">
          <div className="text-xs sm:text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
            <strong>Selected Date:</strong> {selectedDate || getTodayDate()}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button 
              onClick={handleExportDailyReport}
              disabled={exporting || !selectedSubject || !selectedDate}
              className="flex items-center justify-center space-x-2 px-3 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm touch-manipulation transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Daily'}</span>
            </button>
            
            <button 
              onClick={handleExportMonthReport}
              disabled={exporting || !selectedSubject}
              className="flex items-center justify-center space-x-2 px-3 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm touch-manipulation transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Month Report'}</span>
            </button>
            
            <button 
              onClick={() => setShowCustomRangeInputs(!showCustomRangeInputs)}
              disabled={exporting || !selectedSubject}
              className="flex items-center justify-center space-x-2 px-3 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm touch-manipulation transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{showCustomRangeInputs ? 'Hide Custom' : 'Custom Range'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Custom Range Inputs - Mobile Optimized */}
      {showCustomRangeInputs && (
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 mt-4 shadow-sm">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Export Custom Date Range</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="customRangeFrom" className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                id="customRangeFrom"
                value={customRangeFrom}
                onChange={(e) => setCustomRangeFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 touch-manipulation"
                placeholder="Select start date"
              />
            </div>
            <div>
              <label htmlFor="customRangeTo" className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                id="customRangeTo"
                value={customRangeTo}
                onChange={(e) => setCustomRangeTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 touch-manipulation"
                placeholder="Select end date"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-4">
            <button
              onClick={() => {
                setShowCustomRangeInputs(false);
                setCustomRangeFrom('');
                setCustomRangeTo('');
              }}
              className="w-full sm:w-auto px-4 py-3 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors touch-manipulation"
            >
              Cancel
            </button>
            <button
              onClick={handleCustomRangeConfirm}
              disabled={exporting || !customRangeFrom || !customRangeTo}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors touch-manipulation"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Custom Range'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Summary Stats - Mobile Optimized */}
      {!loading && !error && studentAttendanceData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-600 mb-1">Today's Status</p>
                <p className="text-lg font-bold text-blue-600">
                  {studentAttendanceData[0]?.status === 'present' ? 'Present' : 
                   studentAttendanceData[0]?.status === 'absent' ? 'Absent' : 'Not Marked'}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-600 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-600 mb-1">Subject</p>
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {selectedSubject}
                </p>
              </div>
              <FileText className="w-8 h-8 text-green-600 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-600 mb-1">Date</p>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedDate || getTodayDate()}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-600 flex-shrink-0" />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs text-gray-600 mb-1">Attendance %</p>
                <p className="text-lg font-bold text-amber-600">
                  {studentAttendanceData[0]?.attendancePercentage || 0}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-600 flex-shrink-0" />
            </div>
          </div>
        </div>
      )}

      {/* Loading State - Mobile Optimized */}
      {loading && (
        <div className="text-center py-8 sm:py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading attendance data...</p>
        </div>
      )}

      {/* Error State - Mobile Optimized */}
      {error && (
        <div className="text-center py-8 sm:py-12 bg-white rounded-lg border border-red-200 bg-red-50 shadow-sm">
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <p className="text-xs text-red-500 mt-2">Please check your selection and try again.</p>
        </div>
      )}

      {/* Student Attendance Table - Mobile Optimized */}
      {!loading && !error && studentAttendanceData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          {/* Mobile Card View */}
          <div className="block sm:hidden">
            {studentAttendanceData.map((data, index) => (
              <div key={index} className="p-4 border-b border-gray-200 last:border-b-0">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{user?.name}</h3>
                      <p className="text-xs text-gray-600">Roll No: {user?.rollNumber}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      data.status === 'present' ? 'bg-green-100 text-green-800' :
                      data.status === 'absent' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {data.status === 'present' ? 'Present' :
                       data.status === 'absent' ? 'Absent' : 'Not Marked'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <p className="text-xs text-gray-600">Subject</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{selectedSubject}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <p className="text-xs text-gray-600">Date</p>
                      <p className="text-sm font-medium text-gray-900">{selectedDate || getTodayDate()}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Present</p>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {data.presentCount}
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Absent</p>
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {data.absentCount}
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-600">Attendance %</p>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        data.attendancePercentage >= 75 ? 'bg-green-100 text-green-800' :
                        data.attendancePercentage >= 60 ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {data.attendancePercentage}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sr No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {studentAttendanceData.map((data, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user?.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user?.rollNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{selectedSubject}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        data.status === 'present' ? 'bg-green-100 text-green-800' :
                        data.status === 'absent' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {data.status === 'present' ? 'Present' :
                         data.status === 'absent' ? 'Absent' : 'Not Marked'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {data.presentCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {data.absentCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        data.attendancePercentage >= 75 ? 'bg-green-100 text-green-800' :
                        data.attendancePercentage >= 60 ? 'bg-amber-100 text-amber-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {data.attendancePercentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Data State - Mobile Optimized */}
      {!loading && !error && studentAttendanceData.length === 0 && (
        <div className="text-center py-8 sm:py-12 bg-white rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-600">No attendance data found for the selected date.</p>
          <p className="text-xs text-gray-500 mt-2">Please check if attendance has been marked for the selected subject and date.</p>
        </div>
      )}
    </div>
  );
};

export default StudentMyAttendance;
