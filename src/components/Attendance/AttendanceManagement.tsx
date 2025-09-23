import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AttendanceDashboard from './AttendanceDashboard';

interface AttendanceManagementProps {
  addNotification?: (message: string) => void;
}

/**
 * Main Attendance Management Component
 * 
 * This component serves as the entry point for all attendance-related functionality.
 * It provides role-based access to different attendance features:
 * 
 * For Teachers:
 * - Take attendance for classes
 * - Manage individual attendance records (CRUD)
 * - Perform bulk operations (import/export)
 * - View analytics and reports
 * 
 * For Students:
 * - View personal attendance records
 * - Check attendance statistics
 * - Export personal attendance data
 * 
 * Usage:
 * ```tsx
 * import AttendanceManagement from './components/Attendance/AttendanceManagement';
 * 
 * <AttendanceManagement 
 *   addNotification={(message) => {
 *     // Handle notification
 *     console.log(message);
 *   }} 
 * />
 * ```
 */
const AttendanceManagement: React.FC<AttendanceManagementProps> = ({ addNotification }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Handle notifications
  const handleNotification = (message: string) => {
    if (addNotification) {
      addNotification(message);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading attendance management...</p>
        </div>
      </div>
    );
  }

  // Check user authentication
  if (!user) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-600">Please log in to access attendance management.</p>
      </div>
    );
  }

  // Check user role
  if (user.role !== 'teacher' && user.role !== 'student') {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-600">Access denied. Only teachers and students can access attendance management.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AttendanceDashboard addNotification={handleNotification} />
    </div>
  );
};

export default AttendanceManagement;
