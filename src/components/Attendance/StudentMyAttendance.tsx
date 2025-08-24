import React, { useState, useEffect } from 'react';
import { Download, Calendar, Users, TrendingUp, Clock, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { attendanceService } from '../../firebase/firestore';
import { AttendanceLog } from '../../types';
import { saveAs } from 'file-saver';

const FIXED_SUBJECTS = [
  'Software Engineering',
  'Microprocessor',
  'Operating System',
  'Automata',
  'CN-1'
];

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
  const [selectedSubject, setSelectedSubject] = useState<string>('Software Engineering');
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  // Custom range states
  const [customRangeFrom, setCustomRangeFrom] = useState<string>('');
  const [customRangeTo, setCustomRangeTo] = useState<string>('');
  const [showCustomRangeInputs, setShowCustomRangeInputs] = useState(false);
  
  const [availableSubjects] = useState<string[]>(FIXED_SUBJECTS);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Set default date to today when component mounts
  useEffect(() => {
    setSelectedDate(getTodayDate());
  }, []);

  // Load student's own attendance data
  useEffect(() => {
    const loadStudentAttendance = async () => {
      if (!user || user.role !== 'student') return;
      
      try {
        setLoading(true);
        setError('');
        
        // Load attendance data for selected date
        if (selectedDate) {
          await loadAttendanceData();
        }
        
      } catch (error) {
        console.error('Error loading student attendance data:', error);
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
      console.error('Error loading attendance data:', error);
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
      console.error('Error exporting attendance:', error);
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
      console.error('Error exporting month report:', error);
      alert('Failed to export month report.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCustomRange = async () => {
    if (!selectedSubject) {
      alert('Please select a subject to export custom range report.');
      return;
    }
    
    setShowCustomRangeInputs(true);
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
      console.error('Error exporting custom range report:', error);
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
    <div className="space-y-4">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Attendance</h1>
        <p className="text-gray-600">Track your personal attendance data</p>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select 
              value={selectedSubject} 
              onChange={(e) => handleSubjectChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              {availableSubjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 space-y-3 sm:space-y-0">
          <div className="text-sm text-gray-600 w-full sm:w-auto">
            <strong>Selected Date:</strong> {selectedDate || getTodayDate()}
          </div>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button 
              onClick={handleExportDailyReport}
              disabled={exporting || !selectedSubject || !selectedDate}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-w-[120px]"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export Daily'}</span>
              <span className="sm:hidden">{exporting ? '...' : 'Daily'}</span>
            </button>
            
            <button 
              onClick={handleExportMonthReport}
              disabled={exporting || !selectedSubject}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-w-[120px]"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Month Report'}</span>
              <span className="sm:hidden">{exporting ? '...' : 'Month'}</span>
            </button>
            
            <button 
              onClick={() => setShowCustomRangeInputs(!showCustomRangeInputs)}
              disabled={exporting || !selectedSubject}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm min-w-[120px]"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{showCustomRangeInputs ? 'Hide Custom Range' : 'Custom Range'}</span>
              <span className="sm:hidden">{showCustomRangeInputs ? 'Hide' : 'Custom'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Custom Range Inputs */}
      {showCustomRangeInputs && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mt-4 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Export Custom Date Range</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="customRangeFrom" className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                id="customRangeFrom"
                value={customRangeFrom}
                onChange={(e) => setCustomRangeFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
              className="w-full sm:w-auto px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCustomRangeConfirm}
              disabled={exporting || !customRangeFrom || !customRangeTo}
              className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'Exporting...' : 'Export Custom Range'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {!loading && !error && studentAttendanceData.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Today's Status</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600">
                  {studentAttendanceData[0]?.status === 'present' ? 'Present' : 
                   studentAttendanceData[0]?.status === 'absent' ? 'Absent' : 'Not Marked'}
                </p>
              </div>
              <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Subject</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-900">
                  {selectedSubject}
                </p>
              </div>
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Date</p>
                <p className="text-sm sm:text-lg font-semibold text-gray-900">
                  {selectedDate || getTodayDate()}
                </p>
              </div>
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
            </div>
          </div>
          
          <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Attendance %</p>
                <p className="text-lg sm:text-2xl font-bold text-amber-600">
                  {studentAttendanceData[0]?.attendancePercentage || 0}%
                </p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 sm:py-12 bg-white rounded-lg border border-gray-200">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4"></div>
          <p className="text-sm sm:text-base text-gray-600">Loading attendance data...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-8 sm:py-12 bg-white rounded-lg border border-red-200 bg-red-50">
          <p className="text-sm sm:text-base text-red-600 font-medium">{error}</p>
          <p className="text-xs sm:text-sm text-red-500 mt-2">Please check your selection and try again.</p>
        </div>
      )}

      {/* Student Attendance Table */}
      {!loading && !error && studentAttendanceData.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sr No</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Present</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Absent</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attendance %</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {studentAttendanceData.map((data, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">{index + 1}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">{user?.name}</div>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">{user?.rollNumber}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">{selectedSubject}</td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        data.status === 'present' ? 'bg-green-100 text-green-800' :
                        data.status === 'absent' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {data.status === 'present' ? 'Present' :
                         data.status === 'absent' ? 'Absent' : 'Not Marked'}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        {data.presentCount}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        {data.absentCount}
                      </span>
                    </td>
                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
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

      {/* No Data State */}
      {!loading && !error && studentAttendanceData.length === 0 && (
        <div className="text-center py-8 sm:py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-sm sm:text-base text-gray-600">No attendance data found for the selected date.</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">Please check if attendance has been marked for the selected subject and date.</p>
        </div>
      )}
    </div>
  );
};

export default StudentMyAttendance;
