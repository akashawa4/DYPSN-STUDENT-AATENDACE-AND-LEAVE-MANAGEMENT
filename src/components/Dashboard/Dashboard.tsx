import React, { useState, useEffect } from 'react';
import DashboardStats from './DashboardStats';
import RecentActivity from './RecentActivity';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService, attendanceService, userService, getBatchYear } from '../../firebase/firestore';
import { getDepartmentCode } from '../../utils/departmentMapping';
import { Calendar, Users, Plus, Eye, Bell, GraduationCap } from 'lucide-react';

// Helper function to get greeting based on time of day
const getGreeting = (): string => {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  } else if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  } else if (hour >= 17 && hour < 21) {
    return 'Good evening';
  } else {
    return 'Good night';
  }
};

import TakeAttendancePanel from '../Attendance/TakeAttendancePanel';
import TeacherStudentPanel from '../StudentManagement/TeacherStudentPanel';
import TeacherManagementPanel from '../TeacherManagement/TeacherManagementPanel';

interface DashboardProps {
  onPageChange?: (page: string) => void;
}

interface StudentData {
  year: string;
  sem: string;
  div: string;
  count: number;
  students: any[];
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const { user } = useAuth();
  const [currentGreeting, setCurrentGreeting] = useState(getGreeting());
  const [dashboardData, setDashboardData] = useState({
    attendance: { present: 0, total: 0, percentage: 0 },
    leaveBalance: { total: 0, casual: 0, sick: 0 },
    pendingRequests: 0,
    approvedLeaves: 0
  });
  const [studentData, setStudentData] = useState<StudentData[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showStudentManagement, setShowStudentManagement] = useState(false);
  const [showTeacherManagement, setShowTeacherManagement] = useState(false);

  // Update greeting periodically
  useEffect(() => {
    const updateGreeting = () => {
      setCurrentGreeting(getGreeting());
    };

    // Update greeting every minute
    const interval = setInterval(updateGreeting, 60000);
    
    // Initial update
    updateGreeting();

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        if (user.role === 'student') {
          // Load student-specific data only
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          
          // Get attendance data for current month
          const attendanceData = await attendanceService.getAttendanceByUser(user.id);
          const currentMonthAttendance = attendanceData.filter((record: any) => {
            const recordDate = new Date(record.date);
            return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
          });
          const presentDays = currentMonthAttendance.filter((record: any) => record.status === 'present').length;
          const totalDays = currentMonthAttendance.length;
          const percentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : '0';
          
          // Get leave data for this student only
          const leaveRequests = await leaveService.getLeaveRequestsByUser(user.id);
          const pendingCount = leaveRequests.filter(leave => leave.status === 'pending').length;
          const approvedCount = leaveRequests.filter(leave => leave.status === 'approved').length;
          
          // Calculate leave balance (assuming standard balances)
          const leaveBalance = {
            total: 12, // Standard annual leave balance
            casual: Math.max(0, 3 - leaveRequests.filter(leave => leave.leaveType === 'CL' && leave.status === 'approved').length),
            sick: Math.max(0, 5 - leaveRequests.filter(leave => leave.leaveType === 'SL' && leave.status === 'approved').length)
          };
          
          setDashboardData({
            attendance: { present: presentDays, total: totalDays, percentage: parseFloat(percentage) },
            leaveBalance,
            pendingRequests: pendingCount,
            approvedLeaves: approvedCount
          });
          
          // Students don't need student data
          setStudentData([]);
          setTotalStudents(0);
        } else if (user.role === 'teacher' || user.role === 'hod') {
          // Load CSE department student data for teachers/HODs only
          try {
            // Use batch structure to get students from ALL years/semesters/divisions
            const batch = getBatchYear(user.year || '4th'); // Use same logic as DashboardStats
            const department = getDepartmentCode(user.department); // Use user's department
            const years = ['2nd', '3rd', '4th'];
            const semsByYear: Record<string, string[]> = { '2nd': ['3','4'], '3rd': ['5','6'], '4th': ['7','8'] };
            const divs = ['A','B','C','D'];
            
            const allStudents: any[] = [];
            
            // Load students from all combinations
            for (const year of years) {
              const sems = semsByYear[year] || [];
              for (const sem of sems) {
                for (const div of divs) {
                  try {
                    const students = await userService.getStudentsByBatchDeptYearSemDiv(batch, department, year, sem, div);
                    allStudents.push(...students);
                  } catch (error) {
                    // Ignore missing collections
                  }
                }
              }
            }
            
            // Filter for CSE students with more flexible matching
            const cseStudents = allStudents.filter(student => {
              const isStudent = student.role === 'student';
              const isCSE = student.department && 
                (student.department === 'CSE' || 
                 student.department === 'cse' || 
                 student.department === 'Computer Science' ||
                 student.department === 'computer science');
              
              // More flexible year matching
              const year = student.year?.toString().toLowerCase();
              const isValidYear = year && (
                year === '2' || year === '3' || year === '4' ||
                year.includes('2') || year.includes('3') || year.includes('4') ||
                year.includes('2nd') || year.includes('3rd') || year.includes('4th') ||
                year.includes('second') || year.includes('third') || year.includes('fourth')
              );
              
              return isStudent && isCSE && isValidYear;
            });
            
            // If no CSE students found, try to find any students with year/sem/div data
            let studentsToUse = cseStudents;
            if (cseStudents.length === 0) {
              const studentsWithYearData = allStudents.filter(s => 
                s.role === 'student' && s.year && s.sem && s.div
              );
              if (studentsWithYearData.length > 0) {
                studentsToUse = studentsWithYearData;
              }
            }
            
            // Group students by year, semester, and division
            const groupedData: { [key: string]: any[] } = {};
            studentsToUse.forEach(student => {
              if (student.year && student.sem && student.div) {
                const key = `${student.year}-${student.sem}-${student.div}`;
                if (!groupedData[key]) {
                  groupedData[key] = [];
                }
                groupedData[key].push(student);
              }
            });

            // Convert to array format for easier processing
            const studentDataArray: StudentData[] = Object.entries(groupedData).map(([key, students]) => {
              const [year, sem, div] = key.split('-');
              return {
                year,
                sem,
                div,
                count: students.length,
                students
              };
            });

            // Sort by year, then semester, then division
            studentDataArray.sort((a, b) => {
              if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
              if (a.sem !== b.sem) return parseInt(a.sem) - parseInt(b.sem);
              return a.div.localeCompare(b.div);
            });

            setStudentData(studentDataArray);
            setTotalStudents(studentsToUse.length);
          } catch (error) {
            // Set default values to prevent showing wrong data
            setStudentData([]);
            setTotalStudents(0);
          }
        }
      } catch (error) {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  return (
    <div className="space-y-4 lg:space-y-6 px-4 lg:px-0">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 lg:p-8 border border-blue-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="mb-4 lg:mb-0">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              {currentGreeting}, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-gray-600 text-base lg:text-lg">
              {user?.accessLevel === 'full' 
                ? 'Here\'s your organization overview for today'
                : 'Here\'s your attendance and leave summary'
              }
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 bg-white/60 px-4 py-2 rounded-xl">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:block">{new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</span>
            <span className="sm:hidden">{new Date().toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })}</span>
          </div>
        </div>
      </div>

      {/* Teacher/HOD Section */}
      {(user?.role === 'teacher' || user?.role === 'hod') && (
        <>
          <TakeAttendancePanel />
        </>
      )}

      {/* HOD Management Section */}
      {user?.role === 'hod' && (
        <div className="space-y-4">
          {/* Management Toggle Buttons */}
          <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
            <button
              onClick={() => {
                setShowStudentManagement(!showStudentManagement);
                setShowTeacherManagement(false);
              }}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 shadow-mobile flex items-center gap-2 ${
                showStudentManagement 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' 
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Users size={18} />
              {showStudentManagement ? 'Hide Students' : 'Student Management'}
            </button>
            
            <button
              onClick={() => {
                setShowTeacherManagement(!showTeacherManagement);
                setShowStudentManagement(false);
              }}
              className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-95 shadow-mobile flex items-center gap-2 ${
                showTeacherManagement 
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white' 
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <GraduationCap size={18} />
              {showTeacherManagement ? 'Hide Teachers' : 'Teacher Management'}
            </button>
          </div>

          {/* Student Management Panel */}
          {showStudentManagement && (
            <TeacherStudentPanel user={user} />
          )}

          {/* Teacher Management Panel */}
          {showTeacherManagement && (
            <TeacherManagementPanel />
          )}
        </div>
      )}

      {/* Dashboard Stats */}
      <DashboardStats 
        dashboardData={dashboardData} 
        loading={loading}
        studentData={studentData}
        totalStudents={totalStudents}
        userRole={user?.role || ''}
      />

      {/* Admin Section */}
      {(user?.accessLevel === 'full' || user?.role === 'hod') ? (
        <>
          <div className="grid grid-cols-1 gap-6">
            <RecentActivity />
          </div>
        </>
      ) : (
        /* Student Quick Actions */
        <div className="bg-white rounded-2xl shadow-mobile border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <button 
              onClick={() => onPageChange?.('apply-leave')}
              className="flex flex-col items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors active:scale-95 border border-blue-100"
            >
              <Plus className="w-8 h-8 text-blue-600 mb-2" />
              <span className="text-blue-700 font-medium text-sm text-center">Apply for Leave</span>
            </button>
            <button 
              onClick={() => onPageChange?.('my-attendance')}
              className="flex flex-col items-center p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors active:scale-95 border border-green-100"
            >
              <Eye className="w-8 h-8 text-green-600 mb-2" />
              <span className="text-blue-700 font-medium text-sm text-center">View Attendance</span>
            </button>
            <button 
              onClick={() => onPageChange?.('notifications')}
              className="flex flex-col items-center p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors active:scale-95 border border-amber-100"
            >
              <Bell className="w-8 h-8 text-amber-600 mb-2" />
              <span className="text-blue-700 font-medium text-sm text-center">Check Notifications</span>
            </button>
          </div>
        </div>
      )}

      {/* Recent Activity for Students */}
      {user?.role === 'student' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivity />
          <div className="bg-white rounded-2xl shadow-mobile border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Attendance Status</span>
                <span className="text-green-600 font-semibold">Present</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Leave Balance</span>
                <span className="text-blue-600 font-semibold">{dashboardData.leaveBalance.total} days</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Pending Requests</span>
                <span className="text-amber-600 font-semibold">{dashboardData.pendingRequests}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;