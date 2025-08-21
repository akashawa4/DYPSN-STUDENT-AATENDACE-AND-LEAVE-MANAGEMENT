import React, { useState, useEffect } from 'react';
import DashboardStats from './DashboardStats';
import RecentActivity from './RecentActivity';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService, attendanceService, userService } from '../../firebase/firestore';
import { Calendar, Users, TrendingUp, Clock, Plus, Eye, Bell, FileText, GraduationCap } from 'lucide-react';
import LeaveApprovalPanel from '../Leave/LeaveApprovalPanel';
import TakeAttendancePanel from '../Attendance/TakeAttendancePanel';
import StudentManagementPanel from '../StudentManagement/StudentManagementPanel';
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

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        if (user.role === 'student') {
          // Load student-specific data
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
          
          // Get leave data
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
        } else if (user.role === 'teacher' || user.role === 'hod') {
          // Load CSE department student data for teachers/HODs
          try {
            console.log('Loading student data for teacher/HOD...');
            const allStudents = await userService.getAllStudents();
            console.log('All students loaded:', allStudents.length);
            
            // Log sample user data to see actual field values
            const sampleUsers = allStudents.slice(0, 3);
            console.log('Sample users:', sampleUsers.map(u => ({
              id: u.id,
              name: u.name,
              role: u.role,
              department: u.department,
              year: u.year,
              sem: u.sem,
              div: u.div
            })));
            
            const cseStudents = allStudents.filter(student => {
              console.log('Checking student:', student.name, 'Department:', student.department, 'Year:', student.year, 'Role:', student.role);
              return student.role === 'student' && 
                (student.department === 'CSE' || student.department === 'cse') &&
                student.year && ['2', '3', '4', '2nd', '3rd', '4th', 'Second', 'Third', 'Fourth'].some(year => 
                  student.year?.toString().toLowerCase().includes(year.toLowerCase())
                );
            });
            console.log('CSE students filtered:', cseStudents.length);
            console.log('Sample CSE student:', cseStudents[0]);
            
            // If no CSE students found, show all students for debugging
            if (cseStudents.length === 0) {
              console.log('No CSE students found, showing all students for debugging:');
              const allStudentsWithDetails = allStudents.map(s => ({
                name: s.name,
                department: s.department,
                year: s.year,
                sem: s.sem,
                div: s.div,
                role: s.role
              }));
              console.log('All students details:', allStudentsWithDetails);
            }
            
            // Group students by year, semester, and division
            const studentsToUse = cseStudents.length > 0 ? cseStudents : allStudents;
            console.log(`Using ${studentsToUse.length === cseStudents.length ? 'CSE students' : 'all students'} for display`);
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
            console.log('Grouped data:', groupedData);

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
            console.log('Student data array:', studentDataArray);

            // Sort by year, then semester, then division
            studentDataArray.sort((a, b) => {
              if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
              if (a.sem !== b.sem) return parseInt(a.sem) - parseInt(b.sem);
              return a.div.localeCompare(b.div);
            });

            setStudentData(studentDataArray);
            setTotalStudents(studentsToUse.length);
            console.log('Final student data set:', studentDataArray);
            console.log('Total students:', studentsToUse.length);
          } catch (error) {
            console.error('Error loading student data:', error);
          }
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
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
              Good morning, {user?.name?.split(' ')[0]}! 👋
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeaveApprovalPanel />
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