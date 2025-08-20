import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertTriangle, X, Filter, Calendar, FileText, User, MapPin, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService, attendanceService } from '../../firebase/firestore';
import { LeaveRequest } from '../../types';

interface ActivityDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  activities: any[];
}

interface ActivityFullDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: any | null;
}

const ActivityFullDetailModal: React.FC<ActivityFullDetailModalProps> = ({ isOpen, onClose, activity }) => {
  if (!isOpen || !activity) return null;
  const Icon = activity.icon;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Activity Details</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg bg-gray-50 ${activity.color}`}><Icon className="w-6 h-6" /></div>
            <div>
              <h4 className="text-lg font-bold text-gray-900">{activity.title}</h4>
              <p className="text-sm text-gray-600">{activity.date} • {activity.time}</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Description</label>
            <p className="text-gray-900 mt-1">{activity.description}</p>
          </div>
          {activity.status && (
            <div>
              <label className="text-sm font-medium text-gray-500">Status</label>
              <p className="text-gray-900 mt-1">{activity.status}</p>
            </div>
          )}
          {activity.reason && (
            <div>
              <label className="text-sm font-medium text-gray-500">Reason</label>
              <p className="text-gray-900 mt-1">{activity.reason}</p>
            </div>
          )}
          {activity.daysCount && (
            <div>
              <label className="text-sm font-medium text-gray-500">Days</label>
              <p className="text-gray-900 mt-1">{activity.daysCount}</p>
            </div>
          )}
          {/* Add more fields as needed */}
        </div>
      </div>
    </div>
  );
};

const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({ isOpen, onClose, activities }) => {
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);

  if (!isOpen) return null;

  // Use the passed-in activities
  const allActivities: any[] = activities;

  const filteredActivities = allActivities.filter(activity => {
    const matchesFilter = filterType === 'all' || activity.type.includes(filterType);
    const matchesSearch = activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case 'leave_approved': return 'bg-green-50 border-green-200';
      case 'leave_rejected': return 'bg-red-50 border-red-200';
      case 'leave_submitted': return 'bg-amber-50 border-amber-200';
      case 'attendance_marked': return 'bg-blue-50 border-blue-200';
      case 'attendance_override': return 'bg-purple-50 border-purple-200';
      case 'profile_updated': return 'bg-gray-50 border-gray-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <>
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Activity History</h3>
            <p className="text-sm text-gray-600 mt-1">Complete record of your activities and requests</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Activities</option>
              <option value="leave">Leave Requests</option>
                <option value="attendance">Attendance</option>
                <option value="profile">Profile Updates</option>
              </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filteredActivities.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
          <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div
                  key={activity.id}
                  className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md cursor-pointer ${getActivityTypeColor(activity.type)}`}
                  onClick={() => setSelectedActivity(activity)}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 mt-1">
                      <activity.icon className={`w-5 h-5 ${activity.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">{activity.title}</h4>
                          <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>{activity.time}</span>
                            <span>{activity.date}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    <ActivityFullDetailModal isOpen={!!selectedActivity} onClose={() => setSelectedActivity(null)} activity={selectedActivity} />
    </>
  );
};

const RecentActivity: React.FC = () => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load recent activities from Firestore
  useEffect(() => {
    const loadRecentActivities = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        // Get recent leave requests
        const leaveRequests = await leaveService.getLeaveRequestsByUser(user.id);
        
        // Convert leave requests to activity format
        const activities = leaveRequests.slice(0, 5).map((request, index) => ({
          id: `leave_${request.id}`,
          type: `leave_${request.status}`,
          title: `Leave Request ${request.status.charAt(0).toUpperCase() + request.status.slice(1)}`,
          description: `${request.leaveType} for ${request.daysCount} day(s) - ${request.reason.substring(0, 50)}...`,
          time: formatTimeAgo(request.submittedAt),
          date: new Date(request.submittedAt).toLocaleDateString(),
          icon: request.status === 'approved' ? CheckCircle : 
                request.status === 'rejected' ? XCircle : AlertTriangle,
          color: request.status === 'approved' ? 'text-green-600' : 
                 request.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
        }));
        
        setRecentActivities(activities);
      } catch (error) {
        console.error('Error loading recent activities:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRecentActivities();
  }, [user]);

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Unknown time';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Loading activities...</h3>
              <p className="text-gray-600">Please wait while we fetch the latest activity.</p>
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`p-2 rounded-lg bg-gray-50 ${activity.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{activity.time}</p>
                </div>
              </div>
            );
          })}
            </div>
          )}
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          View all activity
        </button>
        
        {user?.accessLevel !== 'full' && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Approval Flow:</strong> All requests follow: Teacher → HOD
            </p>
          </div>
        )}
      </div>

      <ActivityDetailModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        activities={recentActivities}
      />
    </>
  );
};

export default RecentActivity;