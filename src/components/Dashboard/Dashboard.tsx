import React, { useState } from 'react';
import DashboardStats from './DashboardStats';
import RecentActivity from './RecentActivity';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, Users, TrendingUp, Clock, Plus, Eye, Bell, FileText } from 'lucide-react';
import LeaveApprovalPanel from '../Leave/LeaveApprovalPanel';
import TakeAttendancePanel from '../Attendance/TakeAttendancePanel';
import StudentManagementPanel from '../StudentManagement/StudentManagementPanel';
import TeacherStudentPanel from '../StudentManagement/TeacherStudentPanel';

interface DashboardProps {
  onPageChange?: (page: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onPageChange }) => {
  const { user } = useAuth();
  const [showStudentManagement, setShowStudentManagement] = useState(false);

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

      {/* Teacher/HOD Quick Actions */}
      {(user?.role === 'teacher' || user?.role === 'hod') && (
        <>
          <TakeAttendancePanel />
          
          <div className="flex justify-center lg:justify-end mb-4">
            <button
              onClick={() => setShowStudentManagement(!showStudentManagement)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 active:scale-95 shadow-mobile flex items-center gap-2"
            >
              <Users size={18} />
              {showStudentManagement ? 'Hide Students' : 'Student Management'}
            </button>
          </div>
          
          {showStudentManagement && (
            user?.role === 'teacher'
              ? <TeacherStudentPanel user={user} />
              : <StudentManagementPanel user={user} />
          )}
          
          {/* Quick Action Cards */}
          <div className="bg-white rounded-2xl shadow-mobile border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button 
                onClick={() => onPageChange?.('student-leaves')}
                className="flex flex-col items-center p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors active:scale-95 border border-blue-100"
              >
                <FileText className="w-8 h-8 text-blue-600 mb-2" />
                <span className="text-blue-700 font-medium text-sm text-center">View Student Leaves</span>
              </button>
              <button 
                onClick={() => onPageChange?.('student-attendance')}
                className="flex flex-col items-center p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors active:scale-95 border border-green-100"
              >
                <Calendar className="w-8 h-8 text-green-600 mb-2" />
                <span className="text-green-700 font-medium text-sm text-center">View Student Attendance</span>
              </button>
              <button 
                onClick={() => onPageChange?.('notifications')}
                className="flex flex-col items-center p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors active:scale-95 border border-amber-100"
              >
                <Bell className="w-8 h-8 text-amber-600 mb-2" />
                <span className="text-amber-700 font-medium text-sm text-center">Check Notifications</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Dashboard Stats */}
      <DashboardStats />

      {/* Admin Section */}
      {(user?.accessLevel === 'full' || user?.role === 'hod') ? (
        <>
          <div className="flex justify-center lg:justify-end mb-4">
            <button
              onClick={() => setShowStudentManagement(!showStudentManagement)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 active:scale-95 shadow-mobile flex items-center gap-2"
            >
              <Users size={18} />
              {showStudentManagement ? 'Hide Students' : 'Student Management'}
            </button>
          </div>
          
          {showStudentManagement && (
            <StudentManagementPanel user={user} />
          )}
          
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
              <span className="text-green-700 font-medium text-sm text-center">View Attendance</span>
            </button>
            <button 
              onClick={() => onPageChange?.('notifications')}
              className="flex flex-col items-center p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors active:scale-95 border border-amber-100"
            >
              <Bell className="w-8 h-8 text-amber-600 mb-2" />
              <span className="text-amber-700 font-medium text-sm text-center">Check Notifications</span>
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
                <span className="text-blue-600 font-semibold">12 days</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Pending Requests</span>
                <span className="text-amber-600 font-semibold">2</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;