import React from 'react';
import { 
  Home, 
  FileText, 
  Calendar, 
  Bell, 
  User,
  CheckCircle,
  Users,
  GraduationCap,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface MobileBottomNavProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentPage, onPageChange }) => {
  const { user } = useAuth();

  const getNavigationItems = () => {
    const studentItems = [
      { id: 'dashboard', label: 'Home', icon: Home },
      { id: 'my-leaves', label: 'Leaves', icon: FileText },
      { id: 'my-attendance', label: 'Attendance', icon: Calendar },
      { id: 'my-results', label: 'Results', icon: BarChart3 },
      { id: 'profile', label: 'Profile', icon: User },
    ];

    const teacherItems = [
      { id: 'dashboard', label: 'Home', icon: Home },
      { id: 'student-leaves', label: 'Leaves', icon: FileText },
      { id: 'leave-requests', label: 'Approve', icon: CheckCircle },
      { id: 'student-management', label: 'Students', icon: Users },
      { id: 'profile', label: 'Profile', icon: User },
    ];

    const adminItems = [
      { id: 'dashboard', label: 'Home', icon: Home },
      { id: 'student-management', label: 'Students', icon: Users },
      { id: 'teacher-management', label: 'Teachers', icon: GraduationCap },
      { id: 'leave-requests', label: 'Approve', icon: CheckCircle },
      { id: 'profile', label: 'Profile', icon: User },
    ];

    if (user?.accessLevel === 'full' || user?.role === 'hod') return adminItems;
    if (user?.role === 'teacher') return teacherItems;
    return studentItems;
  };

  const navigationItems = getNavigationItems();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-mobile-lg z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`
                flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'text-blue-600 bg-blue-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
              <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Safe area for devices with home indicator */}
      <div className="h-safe-area-inset-bottom bg-white"></div>
    </div>
  );
};

export default MobileBottomNav;
