import React, { useState } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  FileSpreadsheet, 
  BarChart3, 
  Settings,
  Calendar,
  BookOpen,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AttendanceCRUD from './AttendanceCRUD';
import BulkAttendanceOperations from './BulkAttendanceOperations';
import StudentMyAttendance from './StudentMyAttendance';
import TakeAttendancePanel from './TakeAttendancePanel';

interface AttendanceDashboardProps {
  addNotification?: (message: string) => void;
}

type DashboardTab = 'overview' | 'take' | 'manage' | 'bulk' | 'view' | 'analytics';

const AttendanceDashboard: React.FC<AttendanceDashboardProps> = ({ addNotification }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  // Get available tabs based on user role
  const getAvailableTabs = () => {
    if (!user) return [];
    
    const tabs = [
      { id: 'overview', label: 'Overview', icon: BarChart3, description: 'Attendance summary and statistics' },
    ];
    
    if (user.role === 'teacher') {
      tabs.push(
        { id: 'take', label: 'Take Attendance', icon: Plus, description: 'Mark attendance for students' },
        { id: 'manage', label: 'Manage Records', icon: Settings, description: 'Create, update, and delete records' },
        { id: 'bulk', label: 'Bulk Operations', icon: FileSpreadsheet, description: 'Bulk import, export, and operations' },
        { id: 'analytics', label: 'Analytics', icon: TrendingUp, description: 'Attendance reports and insights' }
      );
    }
    
    if (user.role === 'student') {
      tabs.push(
        { id: 'view', label: 'My Attendance', icon: BookOpen, description: 'View your attendance records' }
      );
    }
    
    return tabs;
  };

  const availableTabs = getAvailableTabs();

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <AttendanceOverview addNotification={addNotification} />;
      case 'take':
        return <TakeAttendancePanel addNotification={addNotification} />;
      case 'manage':
        return <AttendanceCRUD addNotification={addNotification} />;
      case 'bulk':
        return <BulkAttendanceOperations addNotification={addNotification} />;
      case 'view':
        return <StudentMyAttendance />;
      case 'analytics':
        return <AttendanceAnalytics addNotification={addNotification} />;
      default:
        return <AttendanceOverview addNotification={addNotification} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
              <p className="text-gray-600 mt-1">
                {user?.role === 'teacher' ? 'Manage student attendance records' : 'View your attendance records'}
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <span>Welcome, {user?.name}</span>
              <span>•</span>
              <span className="capitalize">{user?.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {availableTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as DashboardTab)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="py-6">
        {renderTabContent()}
      </div>
    </div>
  );
};

// Attendance Overview Component
const AttendanceOverview: React.FC<{ addNotification?: (message: string) => void }> = ({ addNotification }) => {
  const { user } = useAuth();
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentToday: 0,
    absentToday: 0,
    attendanceRate: 0
  });

  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string;
    action: string;
    student: string;
    subject: string;
    time: string;
  }>>([]);

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        {/* Welcome Message */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Welcome to Attendance Management
          </h2>
          <p className="text-blue-100">
            {user?.role === 'teacher' 
              ? 'Manage student attendance efficiently with our comprehensive tools.'
              : 'Track your attendance records and stay updated with your academic progress.'
            }
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalStudents}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Present Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.presentToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Absent Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.absentToday}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.attendanceRate}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        {user?.role === 'teacher' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => {/* Navigate to take attendance */}}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-5 h-5 text-blue-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">Take Attendance</p>
                  <p className="text-sm text-gray-600">Mark attendance for today</p>
                </div>
              </button>

              <button
                onClick={() => {/* Navigate to manage records */}}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Settings className="w-5 h-5 text-green-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">Manage Records</p>
                  <p className="text-sm text-gray-600">Create, update, delete records</p>
                </div>
              </button>

              <button
                onClick={() => {/* Navigate to bulk operations */}}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileSpreadsheet className="w-5 h-5 text-purple-600 mr-3" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">Bulk Operations</p>
                  <p className="text-sm text-gray-600">Import, export, bulk actions</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-blue-600 rounded-full mr-3"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                      <p className="text-xs text-gray-600">{activity.student} - {activity.subject}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Need Help?</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>• Use the navigation tabs above to access different features</p>
            {user?.role === 'teacher' && (
              <>
                <p>• Take Attendance: Mark daily attendance for your classes</p>
                <p>• Manage Records: Create, update, and delete individual records</p>
                <p>• Bulk Operations: Import/export data and perform bulk actions</p>
                <p>• Analytics: View attendance reports and statistics</p>
              </>
            )}
            {user?.role === 'student' && (
              <p>• My Attendance: View your personal attendance records and statistics</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Attendance Analytics Component
const AttendanceAnalytics: React.FC<{ addNotification?: (message: string) => void }> = ({ addNotification }) => {
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Attendance Analytics</h2>
          <div className="text-center py-12 text-gray-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>Analytics features coming soon...</p>
            <p className="text-sm mt-2">Advanced reporting and insights will be available here</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceDashboard;
