import React from 'react';
import { 
  Home, 
  FileText, 
  CheckCircle, 
  RotateCcw, 
  Calendar, 
  BarChart3, 
  FileCheck, 
  Users, 
  Settings, 
  Megaphone,
  PlusCircle,
  Bell,
  X,
  LogOut,
  GraduationCap
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  onPageChange: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentPage, onPageChange }) => {
  const { user, logout } = useAuth();

  const getNavigationItems = () => {
    const studentItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'apply-leave', label: 'Apply Leave', icon: PlusCircle },
      { id: 'my-leaves', label: 'My Leaves', icon: FileText },
      { id: 'my-attendance', label: 'My Attendance', icon: Calendar },
      { id: 'notifications', label: 'Updates', icon: Bell },
    ];

    const teacherItems = [
      { id: 'dashboard', label: 'Dashboard', icon: Home },
      { id: 'student-leaves', label: 'Student Leaves', icon: FileText },
      { id: 'student-attendance', label: 'Student Attendance', icon: Calendar },
      { id: 'notifications', label: 'Updates', icon: Bell },
      { id: 'leave-requests', label: 'Leave Approval Panel', icon: CheckCircle },
      { id: 'student-management', label: 'Student Management', icon: Users },
    ];

    const adminItems = [
      ...teacherItems,
      // Admin has all teacher items plus additional admin features
      { id: 'teacher-management', label: 'Teacher Management', icon: GraduationCap },
    ];

    if (user?.accessLevel === 'full' || user?.role === 'hod') return adminItems;
    if (user?.role === 'teacher') return teacherItems;
    return studentItems;
  };

  const navigationItems = getNavigationItems();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40 animate-fade-in" 
          onClick={onClose} 
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-mobile-lg transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:shadow-none lg:border-r lg:border-gray-200 lg:w-64
        flex flex-col
      `}>
        {/* Header - Fixed */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-mobile">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">DYPSN</h1>
              <p className="text-sm text-gray-600">Leave & Attendance</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 space-y-1 scrollbar-mobile">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onPageChange(item.id);
                  onClose();
                }}
                className={`
                  w-full flex items-center space-x-4 px-4 py-4 rounded-xl text-left transition-all duration-200
                  ${isActive 
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border-l-4 border-blue-600 shadow-mobile' 
                    : 'text-gray-700 hover:bg-gray-50 hover:shadow-mobile'
                  }
                  active:scale-95
                `}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className="font-medium text-base">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile Section - Fixed */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-base border-2 border-white shadow-mobile">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          
          {/* Logout Button */}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;