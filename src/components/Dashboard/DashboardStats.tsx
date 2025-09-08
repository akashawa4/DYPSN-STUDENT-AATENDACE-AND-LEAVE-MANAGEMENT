import React, { useState, useEffect } from 'react';
import { Clock, FileText, CheckCircle, AlertCircle, X, Calendar, TrendingUp, User, MapPin, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService, attendanceService, userService, getBatchYear } from '../../firebase/firestore';
import { getDepartmentCode } from '../../utils/departmentMapping';
import { LeaveRequest } from '../../types';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-mobile">
      <div className="modal-content-mobile">
        <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-200">
          <h3 className="text-lg lg:text-xl font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors active:scale-95"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

interface DashboardStatsProps {
  dashboardData?: {
    attendance: { present: number; total: number; percentage: number };
    leaveBalance: { total: number; casual: number; sick: number };
    pendingRequests: number;
    approvedLeaves: number;
  };
  loading?: boolean;
  studentData?: Array<{
    year: string;
    sem: string;
    div: string;
    count: number;
    students: any[];
  }>;
  totalStudents?: number;
  userRole?: string;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({ dashboardData, loading, studentData, totalStudents, userRole }) => {
  const { user } = useAuth();
  const [selectedModal, setSelectedModal] = useState<string | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [navigationState, setNavigationState] = useState<'year' | 'semester' | 'division' | 'students'>('year');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedDivision, setSelectedDivision] = useState<string>('');
  // Local student aggregates for Teacher/HOD when props are not passed
  const [localStudentData, setLocalStudentData] = useState<Array<{ year: string; sem: string; div: string; count: number; students: any[] }>>([]);
  const [localTotalStudents, setLocalTotalStudents] = useState<number>(0);


  // Load user's leave requests for stats
  useEffect(() => {
    const loadLeaveRequests = async () => {
      if (!user) return;
      try {
        setStatsLoading(true);
        const requests = await leaveService.getLeaveRequestsByUser(user.id);
        setLeaveRequests(requests);
      } catch (error) {
        // Handle error silently
      } finally {
        setStatsLoading(false);
      }
    };
    loadLeaveRequests();
  }, [user]);

  // Load students for Teacher/HOD directly from batch structure
  useEffect(() => {
    const loadStudentsForStaff = async () => {
      if (!user || (user.role !== 'teacher' && user.role !== 'hod')) return;
      try {
        // Determine batch/year/sem/div scope
        const dept = getDepartmentCode(user.department);
        // Current batch based on user year (falls back to current year)
        const batch = getBatchYear(user.year || '4th');
        const years = ['2nd', '3rd', '4th'];
        const semsByYear: Record<string, string[]> = { '2nd': ['3','4'], '3rd': ['5','6'], '4th': ['7','8'] };
        const divs = ['A','B','C','D'];
        const aggregates: Array<{ year: string; sem: string; div: string; count: number; students: any[] }> = [];
        let total = 0;

        for (const y of years) {
          const sems = semsByYear[y] || [];
          for (const s of sems) {
            for (const d of divs) {
              try {
                const students = await userService.getStudentsByBatchDeptYearSemDiv(batch, dept, y, s, d);
                if (students.length > 0) {
                  aggregates.push({ year: y, sem: s, div: d, count: students.length, students });
                  total += students.length;
                }
              } catch {
                // ignore missing collections
              }
            }
          }
        }

        setLocalStudentData(aggregates);
        setLocalTotalStudents(total);
      } catch (e) {
        setLocalStudentData([]);
        setLocalTotalStudents(0);
      }
    };
    loadStudentsForStaff();
  }, [user?.id]);

  // Calculate stats from real data
  const calculateStats = () => {
    if (!user) return [];
    
    
    if (user.role === 'student' && dashboardData) {
      // Student stats with real data - only show their own information
      return [
        {
          id: 'attendance',
          title: 'This Month Attendance',
          value: `${dashboardData.attendance.present}/${dashboardData.attendance.total}`,
          change: `+${dashboardData.attendance.percentage}%`,
          changeType: 'positive' as const,
          icon: Clock,
          color: 'blue'
        },
        {
          id: 'leaveBalance',
          title: 'Leave Balance',
          value: `${dashboardData.leaveBalance.total} days`,
          change: `CL: ${dashboardData.leaveBalance.casual}, SL: ${dashboardData.leaveBalance.sick}`,
          changeType: 'positive' as const,
          icon: FileText,
          color: 'green'
        },
        {
          id: 'pendingRequests',
          title: 'Pending Requests',
          value: dashboardData.pendingRequests.toString(),
          change: 'Awaiting approval',
          changeType: 'warning' as const,
          icon: AlertCircle,
          color: 'amber'
        },
        {
          id: 'approvedLeaves',
          title: 'Approved Leaves',
          value: dashboardData.approvedLeaves.toString(),
          change: 'This month',
          changeType: 'positive' as const,
          icon: CheckCircle,
          color: 'green'
        }
      ];
    }

    const pendingRequests = leaveRequests.filter(req => req.status === 'pending').length;
    const approvedRequests = leaveRequests.filter(req => req.status === 'approved').length;
    const totalRequests = leaveRequests.length;

    // Only show admin stats for users with full access who are NOT HODs
    if (user.accessLevel === 'full' && user.role !== 'hod') {
      // Admin stats (unchanged)
      return [
        {
          id: 'staff',
          title: 'Total Staff',
          value: '156',
          change: '+5 this month',
          changeType: 'positive' as const,
          icon: Clock,
          color: 'blue'
        },
        {
          id: 'approvals',
          title: 'Pending Approvals',
          value: pendingRequests.toString(),
          change: 'Requires attention',
          changeType: 'warning' as const,
          icon: AlertCircle,
          color: 'amber'
        },
        {
          id: 'present',
          title: 'Today Present',
          value: '142/156',
          change: '91% attendance',
          changeType: 'positive' as const,
          icon: CheckCircle,
          color: 'green'
        },
        {
          id: 'leaves',
          title: 'Monthly Leaves',
          value: totalRequests.toString(),
          change: 'This month',
          changeType: 'positive' as const,
          icon: FileText,
          color: 'purple'
        }
      ];
    }

    // Teacher/HOD stats with real student data - only for teachers/HODs
    const effectiveStudentData = (studentData && studentData.length > 0) ? studentData : localStudentData;
    // Always compute total from the aggregated buckets to avoid stale state
    const effectiveTotalStudents = (studentData && studentData.length > 0)
      ? studentData.reduce((sum, d) => sum + (d.count || 0), 0)
      : localStudentData.reduce((sum, d) => sum + (d.count || 0), 0);
    if ((user.role === 'teacher' || user.role === 'hod') && effectiveStudentData && effectiveStudentData.length >= 0) {
      
      const year2Count = effectiveStudentData.filter(d => {
        const year = d.year?.toString().toLowerCase();
        return year === '2' || year?.includes('2') || year?.includes('2nd') || year?.includes('second');
      }).reduce((sum, d) => sum + d.count, 0);
      
      const year3Count = effectiveStudentData.filter(d => {
        const year = d.year?.toString().toLowerCase();
        return year === '3' || year?.includes('3') || year?.includes('3rd') || year?.includes('third');
      }).reduce((sum, d) => sum + d.count, 0);
      
      const year4Count = effectiveStudentData.filter(d => {
        const year = d.year?.toString().toLowerCase();
        return year === '4' || year?.includes('4') || year?.includes('4th') || year?.includes('fourth');
      }).reduce((sum, d) => sum + d.count, 0);
      
      
      return [
        {
          id: 'students',
          title: 'Total Students',
          value: (effectiveTotalStudents || 0).toString(),
          change: 'CSE Department',
          changeType: 'positive' as const,
          icon: User,
          color: 'blue'
        },
        {
          id: 'year2',
          title: '2nd Year',
          value: year2Count.toString(),
          change: 'Students',
          changeType: 'positive' as const,
          icon: Users,
          color: 'green'
        },
        {
          id: 'year3',
          title: '3rd Year',
          value: year3Count.toString(),
          change: 'Students',
          changeType: 'positive' as const,
          icon: Users,
          color: 'purple'
        },
        {
          id: 'year4',
          title: '4th Year',
          value: year4Count.toString(),
          change: 'Students',
          changeType: 'positive' as const,
          icon: Users,
          color: 'indigo'
        }
      ];
    }

    // Fallback Teacher/HOD stats - only show when no student data is available
    if (user.role === 'teacher' || user.role === 'hod') {
      return [
        {
          id: 'students',
          title: 'Total Students',
          value: '0',
          change: 'No data available',
          changeType: 'neutral' as const,
          icon: User,
          color: 'gray'
        },
        {
          id: 'year2',
          title: '2nd Year',
          value: '0',
          change: 'Students',
          changeType: 'neutral' as const,
          icon: Users,
          color: 'gray'
        },
        {
          id: 'year3',
          title: '3rd Year',
          value: '0',
          change: 'Students',
          changeType: 'neutral' as const,
          icon: Users,
          color: 'purple'
        },
        {
          id: 'year4',
          title: '4th Year',
          value: '0',
          change: 'Students',
          changeType: 'neutral' as const,
          icon: Users,
          color: 'indigo'
        }
      ];
    }
    
    // Default fallback for other roles
    return [
      {
        id: 'students',
        title: 'Total Students',
        value: '0',
        change: 'No data available',
        changeType: 'neutral' as const,
        icon: User,
        color: 'gray'
      }
    ];
  };

  const handleModalOpen = (modalId: string) => {
    setSelectedModal(modalId);
    setNavigationState('year');
    setSelectedYear('');
    setSelectedSemester('');
    setSelectedDivision('');
  };

  const handleYearSelect = (year: string) => {
    setSelectedYear(year);
    setNavigationState('semester');
  };

  const handleSemesterSelect = (semester: string) => {
    setSelectedSemester(semester);
    setNavigationState('division');
  };

  const handleDivisionSelect = (division: string) => {
    setSelectedDivision(division);
    setNavigationState('students');
  };

  const handleBack = () => {
    if (navigationState === 'students') {
      setNavigationState('division');
      setSelectedDivision('');
    } else if (navigationState === 'division') {
      setNavigationState('semester');
      setSelectedSemester('');
    } else if (navigationState === 'semester') {
      setNavigationState('year');
      setSelectedYear('');
    }
  };

  const renderStudentNavigation = () => {
    if (!studentData) {
      console.log('No student data available in modal');
      return <div className="text-gray-500">No student data available</div>;
    }

    console.log('Modal student data:', studentData);
    console.log('Navigation state:', navigationState);

    switch (navigationState) {
      case 'year':
        // Get all unique years from the data
        const availableYears = [...new Set(studentData.map(d => d.year))].sort();
        console.log('Available years in data:', availableYears);
        
        return (
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Select Year</h4>
            {['2', '3', '4'].map(year => {
              // More flexible year matching
              const yearData = studentData.filter(d => {
                const studentYear = d.year?.toString().toLowerCase();
                const targetYear = year.toString().toLowerCase();
                return studentYear === targetYear || 
                       studentYear?.includes(targetYear) || 
                       (year === '2' && (studentYear?.includes('2nd') || studentYear?.includes('second'))) ||
                       (year === '3' && (studentYear?.includes('3rd') || studentYear?.includes('third'))) ||
                       (year === '4' && (studentYear?.includes('4th') || studentYear?.includes('fourth')));
              });
              const totalInYear = yearData.reduce((sum, d) => sum + d.count, 0);
              console.log(`Year ${year} data:`, yearData, 'Total:', totalInYear);
              return (
                <button
                  key={year}
                  onClick={() => handleYearSelect(year)}
                  className="w-full p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors active:scale-95 border border-blue-200 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-blue-900">{year}nd Year</span>
                    <span className="text-2xl font-bold text-blue-700">{totalInYear}</span>
                  </div>
                  <p className="text-sm text-blue-600 mt-1">Students</p>
                </button>
              );
            })}
            
            {/* Debug info */}
            <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs text-gray-600">
              <p>Debug: Available years in data: {availableYears.join(', ')}</p>
              <p>Total student records: {studentData.length}</p>
              <p>Total students: {studentData.reduce((sum, d) => sum + d.count, 0)}</p>
            </div>
            
            {/* Show all available years if standard years have no data */}
            {availableYears.length > 0 && availableYears.some(y => !['2', '3', '4'].includes(y)) && (
              <div className="mt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Other Available Years:</h5>
                {availableYears.filter(y => !['2', '3', '4'].includes(y)).map(year => {
                  const yearData = studentData.filter(d => d.year === year);
                  const totalInYear = yearData.reduce((sum, d) => sum + d.count, 0);
                  return (
                    <button
                      key={year}
                      onClick={() => handleYearSelect(year)}
                      className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors active:scale-95 border border-gray-200 text-left mb-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Year {year}</span>
                        <span className="text-lg font-bold text-gray-600">{totalInYear}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Students</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'semester':
        const yearData = studentData.filter(d => d.year === selectedYear);
        const semesters = [...new Set(yearData.map(d => d.sem))].sort();
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ← Back
              </button>
              <h4 className="text-lg font-semibold text-gray-900">{selectedYear}nd Year - Select Semester</h4>
            </div>
            {semesters.map(sem => {
              const semData = yearData.filter(d => d.sem === sem);
              const totalInSem = semData.reduce((sum, d) => sum + d.count, 0);
              return (
                <button
                  key={sem}
                  onClick={() => handleSemesterSelect(sem)}
                  className="w-full p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors active:scale-95 border border-green-200 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-green-900">Semester {sem}</span>
                    <span className="text-2xl font-bold text-green-700">{totalInSem}</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">Students</p>
                </button>
              );
            })}
          </div>
        );

      case 'division':
        const semData = studentData.filter(d => d.year === selectedYear && d.sem === selectedSemester);
        const divisions = [...new Set(semData.map(d => d.div))].sort();
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ← Back
              </button>
              <h4 className="text-lg font-semibold text-gray-900">
                {selectedYear}nd Year - Sem {selectedSemester} - Select Division
              </h4>
            </div>
            {divisions.map(div => {
              const divData = semData.filter(d => d.div === div);
              return (
                <button
                  key={div}
                  onClick={() => handleDivisionSelect(div)}
                  className="w-full p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors active:scale-95 border border-purple-200 text-left"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-purple-900">Division {div}</span>
                    <span className="text-2xl font-bold text-purple-700">{divData[0]?.count || 0}</span>
                  </div>
                  <p className="text-sm text-purple-600 mt-1">Students</p>
                </button>
              );
            })}
          </div>
        );

      case 'students':
        const divData = studentData.filter(d => 
          d.year === selectedYear && 
          d.sem === selectedSemester && 
          d.div === selectedDivision
        );
        const students = divData[0]?.students || [];
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ← Back
              </button>
              <h4 className="text-lg font-semibold text-gray-900">
                {selectedYear}nd Year - Sem {selectedSemester} - Div {selectedDivision}
              </h4>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-2">
              {students.map((student, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{student.name}</p>
                      <p className="text-sm text-gray-600">Roll: {student.rollNumber}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{student.email}</p>
                      <p className="text-xs text-gray-500">{student.phone}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return <div>No details available</div>;
    }
  };

  // Prefer props if provided; otherwise use locally loaded aggregates
  const stats = calculateStats();

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'bg-blue-50 text-blue-600',
      green: 'bg-green-50 text-green-600',
      amber: 'bg-amber-50 text-amber-600',
      purple: 'bg-purple-50 text-purple-600',
      indigo: 'bg-indigo-50 text-indigo-600',
      gray: 'bg-gray-50 text-gray-600'
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
  };

  const getChangeColor = (type: string) => {
    const typeMap = {
      positive: 'text-green-600',
      negative: 'text-red-600',
      warning: 'text-amber-600',
      neutral: 'text-gray-600'
    };
    return typeMap[type as keyof typeof typeMap] || typeMap.neutral;
  };

  const renderModalContent = (modalId: string) => {
    switch (modalId) {
      case 'attendance':
        return (
          <div className="space-mobile">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-xl">
                <div className="flex items-center space-x-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Working Days</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">24</p>
                <p className="text-sm text-blue-700">This month</p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-900">Present Days</span>
                </div>
                <p className="text-2xl font-bold text-green-900">22</p>
                <p className="text-sm text-green-700">91.7% attendance</p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Recent Attendance</h4>
              <div className="space-y-2">
                {[
                  { date: 'Today', time: '9:15 AM - 5:30 PM', status: 'Present', hours: '8h 15m' },
                  { date: 'Yesterday', time: '9:10 AM - 5:25 PM', status: 'Present', hours: '8h 15m' },
                  { date: 'Mar 20', time: '9:20 AM - 5:35 PM', status: 'Present', hours: '8h 15m' },
                  { date: 'Mar 19', time: '---', status: 'Leave', hours: '---' },
                  { date: 'Mar 18', time: '9:05 AM - 5:20 PM', status: 'Present', hours: '8h 15m' }
                ].map((record, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="font-medium text-gray-900">{record.date}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{record.time}</p>
                      <p className="text-xs text-gray-500">{record.hours}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl">
              <h4 className="font-semibold text-amber-900 mb-2">Monthly Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-lg font-bold text-amber-900">8h 12m</p>
                  <p className="text-xs text-amber-700">Avg. Daily Hours</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-900">2</p>
                  <p className="text-xs text-amber-700">Late Arrivals</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-900">0</p>
                  <p className="text-xs text-amber-700">Early Departures</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'balance':
        return (
          <div className="space-mobile">
            <div className="space-y-4">
              {[
                { type: 'Casual Leave (CL)', available: 3, used: 9, total: 12, color: 'blue' },
                { type: 'Earned Leave (EL)', available: 5, used: 7, total: 12, color: 'green' },
                { type: 'Medical Leave (ML)', available: 8, used: 4, total: 12, color: 'purple' },
                { type: 'Compensatory Off (COH)', available: 2, used: 1, total: 3, color: 'amber' }
              ].map((leave, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 text-sm">{leave.type}</h4>
                    <span className="text-sm font-bold text-gray-900">{leave.available} days left</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div 
                      className={`h-2 rounded-full ${
                        leave.color === 'blue' ? 'bg-blue-500' :
                        leave.color === 'green' ? 'bg-green-500' :
                        leave.color === 'purple' ? 'bg-purple-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${(leave.used / leave.total) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Used: {leave.used} days</span>
                    <span>Total: {leave.total} days</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-blue-50 p-4 rounded-xl">
              <h4 className="font-semibold text-blue-900 mb-3">Leave Policy Information</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• Leave balance resets every financial year (April 1st)</li>
                <li>• Maximum 3 consecutive casual leaves without prior approval</li>
                <li>• Medical leave requires doctor&apos;s certificate for &gt;2 days</li>
                <li>• Compensatory offs expire after 90 days if not used</li>
                <li>• Earned leave can be carried forward (max 30 days)</li>
              </ul>
            </div>
          </div>
        );

      case 'pending':
        return (
          <div className="space-mobile">
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-900">Casual Leave Request</h4>
                  <p className="text-sm text-amber-800 mt-1">March 25, 2024 (1 day)</p>
                  <p className="text-sm text-amber-700 mt-2">Reason: Personal work - family function</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-amber-600">Submitted: Mar 22, 2024 at 2:30 PM</span>
                    <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full">Pending with HOD</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Application Timeline</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Application Submitted</p>
                    <p className="text-xs text-gray-500">Mar 22, 2024 at 2:30 PM</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Pending HOD Approval</p>
                    <p className="text-xs text-gray-500">Dr. Michael Chen (Computer Science)</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Principal Approval</p>
                    <p className="text-xs text-gray-400">Awaiting HOD approval</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Registrar Approval</p>
                    <p className="text-xs text-gray-400">Awaiting Principal approval</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">HR Executive Final Approval</p>
                    <p className="text-xs text-gray-400">Awaiting Registrar approval</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl">
              <h4 className="font-medium text-gray-900 mb-2">Approval Flow Information</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• <strong>Step 1:</strong>Teacher(Department Level)</p>
                <p>• <strong>Step 2:</strong>  HOD(Academic Level)</p>
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mt-3">
                <button className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 active:scale-95 transition-all">
                  View Full Application
                </button>
                <button className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 active:scale-95 transition-all">
                  Withdraw Request
                </button>
              </div>
            </div>
          </div>
        );

      case 'approved':
        return (
          <div className="space-mobile">
            <div className="space-y-3">
              {[
                {
                  type: 'Medical Leave',
                  dates: 'March 15-16, 2024',
                  days: 2,
                  approver: 'Mr. Arjun Kumar (HR Executive)',
                  approvedDate: 'Mar 14, 2024',
                  status: 'Approved',
                  approvalFlow: 'HOD → Principal → Registrar → HR Executive'
                },
                {
                  type: 'Casual Leave',
                  dates: 'March 8, 2024',
                  days: 1,
                  approver: 'Mr. Arjun Kumar (HR Executive)',
                  approvedDate: 'Mar 7, 2024',
                  status: 'Approved',
                  approvalFlow: 'HOD → Principal → Registrar → HR Executive'
                }
              ].map((leave, index) => (
                <div key={index} className="border border-green-200 bg-green-50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <h4 className="font-medium text-green-900">{leave.type}</h4>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          {leave.status}
                        </span>
                      </div>
                      <p className="text-sm text-green-800">{leave.dates} ({leave.days} day{leave.days > 1 ? 's' : ''})</p>
                      <p className="text-xs text-green-700 mt-2">Final approval by: {leave.approver}</p>
                      <p className="text-xs text-green-600">Approved on: {leave.approvedDate}</p>
                      <p className="text-xs text-green-600 mt-1">Flow: {leave.approvalFlow}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-xl text-center">
                <TrendingUp className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <p className="text-lg font-bold text-blue-900">95%</p>
                <p className="text-sm text-blue-700">Approval Rate</p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl text-center">
                <Clock className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <p className="text-lg font-bold text-green-900">2.5 days</p>
                <p className="text-sm text-green-700">Avg. Processing Time</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl">
              <h4 className="font-medium text-gray-900 mb-3">Leave History Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total leaves taken this year:</span>
                  <span className="font-medium text-gray-900">21 days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Most common leave type:</span>
                  <span className="font-medium text-gray-900">Casual Leave</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Longest consecutive leave:</span>
                  <span className="font-medium text-gray-900">5 days (Medical)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Average approval time:</span>
                  <span className="font-medium text-gray-900">2.5 days</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>No details available</div>;
    }
  };

  if (loading || statsLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-white p-6 rounded-xl shadow-mobile border border-gray-200">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded mb-4"></div>
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
                     const isClickable = false; // Make all cards non-clickable
          
          return (
            <div 
              key={index} 
              className={`card-mobile transition-all duration-200 ${
                isClickable ? 'hover:shadow-mobile-lg hover:scale-105 cursor-pointer active:scale-95' : 'hover:shadow-mobile-lg'
              }`}
              onClick={() => isClickable && handleModalOpen(stat.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                  <p className={`text-xs ${getChangeColor(stat.changeType)}`}>
                    {stat.change}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${getColorClasses(stat.color)}`}>
                  <Icon className="w-5 h-5 lg:w-6 lg:h-6" />
                </div>
              </div>
                              {/* Removed tap for details text */}
            </div>
          );
        })}
      </div>

      {/* Detail Modals */}
      <DetailModal
        isOpen={selectedModal === 'attendance'}
        onClose={() => setSelectedModal(null)}
        title="Attendance Details"
      >
        {renderModalContent('attendance')}
      </DetailModal>

      <DetailModal
        isOpen={selectedModal === 'balance'}
        onClose={() => setSelectedModal(null)}
        title="Leave Balance Details"
      >
        {renderModalContent('balance')}
      </DetailModal>

      <DetailModal
        isOpen={selectedModal === 'pending'}
        onClose={() => setSelectedModal(null)}
        title="Pending Requests"
      >
        {renderModalContent('pending')}
      </DetailModal>

      <DetailModal
        isOpen={selectedModal === 'approved'}
        onClose={() => setSelectedModal(null)}
        title="Approved Leaves"
      >
        {renderModalContent('approved')}
      </DetailModal>

      {/* Student Navigation Modal */}
      <DetailModal
        isOpen={selectedModal === 'students' || selectedModal === 'year2' || selectedModal === 'year3' || selectedModal === 'year4'}
        onClose={() => setSelectedModal(null)}
        title="Student Management"
      >
        {renderStudentNavigation()}
      </DetailModal>
    </>
  );
};

export default DashboardStats;