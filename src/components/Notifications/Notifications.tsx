import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, Info, XCircle, Filter, Search, MoreHorizontal, Trash2, Archive } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService } from '../../firebase/firestore';
import { Notification } from '../../types';

// Accept setCurrentPage as a prop
interface NotificationsProps {
  setCurrentPage?: (page: string) => void;
}

const Notifications: React.FC<NotificationsProps> = ({ setCurrentPage }) => {
  const { user } = useAuth();
  const [filterType, setFilterType] = useState('all');
  const [filterRead, setFilterRead] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirm, setConfirm] = useState<null | { action: 'archive' | 'delete'; message: string }> (null);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  // Load user's notifications from Firestore
  useEffect(() => {
    const loadNotifications = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        const userNotifications = await notificationService.getNotificationsByUser(user.id);

        setNotifications(userNotifications);
      } catch (error) {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [user]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'info': return <Info className="w-5 h-5 text-blue-600" />;
      default: return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-green-50 border-green-200';
      case 'warning': return 'bg-amber-50 border-amber-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'info': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-amber-100 text-amber-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    const matchesType = filterType === 'all' || notification.category === filterType;
    const matchesRead = filterRead === 'all' || 
                       (filterRead === 'read' && notification.read) ||
                       (filterRead === 'unread' && !notification.read);
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesRead && matchesSearch;
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const actionRequiredCount = notifications.filter(n => n.actionRequired && !n.read).length;

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const toggleNotificationSelection = (id: string) => {
    setSelectedNotifications(prev => 
      prev.includes(id) 
        ? prev.filter(nId => nId !== id)
        : [...prev, id]
    );
  };

  const selectAllNotifications = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map(n => n.id));
    }
  };

  // Handler: Mark as Read
  const handleMarkAsRead = async () => {
    try {
      await Promise.all(selectedNotifications.map(id =>
        notificationService.markNotificationAsRead(id)
      ));
      setNotifications(prev => prev.map(n =>
        selectedNotifications.includes(n.id) ? { ...n, read: true } : n
      ));
      setSelectedNotifications([]);
    } catch (error) {
      alert('Failed to mark as read.');
    }
  };

  // Handler: Archive
  const handleArchive = async () => {
    setConfirm({ action: 'archive', message: 'Are you sure you want to archive the selected notifications?' });
  };

  // Handler: Delete
  const handleDelete = async () => {
    setConfirm({ action: 'delete', message: 'Are you sure you want to delete the selected notifications? This action cannot be undone.' });
  };

  // Confirmed action
  const handleConfirm = async () => {
    if (!confirm) return;
    if (confirm.action === 'archive') {
      try {
        await Promise.all(selectedNotifications.map(id =>
          notificationService.archiveNotification(id)
        ));
        setNotifications(prev => prev.map(n =>
          selectedNotifications.includes(n.id) ? { ...n, archived: true } : n
        ));
        setSelectedNotifications([]);
        setBanner({ type: 'success', message: 'Notifications archived successfully.' });
        setTimeout(() => setBanner(null), 3000);
      } catch (error) {
        setBanner({ type: 'error', message: 'Failed to archive notifications.' });
        setTimeout(() => setBanner(null), 3000);
      }
    } else if (confirm.action === 'delete') {
      try {
        await Promise.all(selectedNotifications.map(id =>
          notificationService.deleteNotification(id)
        ));
        setNotifications(prev => prev.filter(n => !selectedNotifications.includes(n.id)));
        setSelectedNotifications([]);
        setBanner({ type: 'success', message: 'Notifications deleted successfully.' });
        setTimeout(() => setBanner(null), 3000);
      } catch (error) {
        setBanner({ type: 'error', message: 'Failed to delete notifications.' });
        setTimeout(() => setBanner(null), 3000);
      }
    }
    setConfirm(null);
  };

  // Handler for reapply (for returned leave requests)
  const handleReapply = () => {
    if (setCurrentPage) {
      setCurrentPage('apply-leave');
    } else {
      window.location.href = '/'; // fallback
    }
  };

  return (
    <div className="space-y-4">
      {/* Animated banner for success/error */}
      {banner && (
        <div
          className={`fixed z-50 px-4 py-3 rounded-lg shadow-lg text-white font-semibold transition-all duration-500 ease-in-out
            ${banner.type === 'success' ? 'bg-green-600 animate-slide-down-fade' : ''}
            ${banner.type === 'error' ? 'bg-red-600 animate-slide-down-fade' : ''}
          `}
          style={{
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'fit-content',
            maxWidth: '95vw',
            fontSize: '1rem',
            padding: '0.75rem 1rem',
            margin: '0 auto',
            textAlign: 'center',
            zIndex: 9999,
          }}
        >
          {banner.message}
        </div>
      )}

      {/* Custom confirmation modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-xs w-full mx-2 text-center animate-slide-down-fade">
            <div className="mb-4 text-gray-900 text-base font-semibold">{confirm.message}</div>
            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 py-2 rounded-lg text-white font-medium ${confirm.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                Yes, {confirm.action === 'delete' ? 'Delete' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
              onClick={() => setSelectedNotification(null)}
            >
              &times;
            </button>
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-2">
                {getNotificationIcon(selectedNotification.type)}
                <h2 className="text-xl font-bold text-gray-900">{selectedNotification.title}</h2>
                {selectedNotification.actionRequired && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">Action Required</span>
                )}
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${getPriorityColor(selectedNotification.priority)}`}>{selectedNotification.priority}</span>
              </div>
              <p className="text-gray-700 mb-2">{selectedNotification.message}</p>
              <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                <span>{formatTimestamp(selectedNotification.timestamp)}</span>
                <span className="capitalize">{selectedNotification.category}</span>
              </div>
              {/* Show more leave details if available */}
              {selectedNotification.category === 'leave' && selectedNotification.details && (
                <div className="bg-gray-50 rounded p-3 text-sm text-gray-800 mb-2 space-y-1">
                  <div><span className="font-semibold">Leave Type:</span> {selectedNotification.details.leaveType}</div>
                  <div><span className="font-semibold">From:</span> {selectedNotification.details.fromDate}</div>
                  <div><span className="font-semibold">To:</span> {selectedNotification.details.toDate}</div>
                  <div><span className="font-semibold">Days:</span> {selectedNotification.details.daysCount}</div>
                  <div><span className="font-semibold">Reason:</span> {selectedNotification.details.reason}</div>
                  <div><span className="font-semibold">Status:</span> {selectedNotification.details.status}</div>
                  <div><span className="font-semibold">Approved By:</span> {selectedNotification.details.approvedBy || 'N/A'}</div>
                  <div><span className="font-semibold">Approval Level:</span> {selectedNotification.details.approvalLevel || 'N/A'}</div>
                  {selectedNotification.details.remarks && (
                    <div><span className="font-semibold">Remarks:</span> {selectedNotification.details.remarks}</div>
                  )}
                  {selectedNotification.details.approvalFlow && Array.isArray(selectedNotification.details.approvalFlow) && (
                    <div>
                      <span className="font-semibold">Approval Flow:</span>
                      <ul className="list-disc list-inside ml-4">
                        {selectedNotification.details.approvalFlow.map((step: string, idx: number) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {/* Reapply button for returned leave requests */}
              {selectedNotification.category === 'leave' && selectedNotification.title?.toLowerCase().includes('returned') && (
                <button
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                  onClick={handleReapply}
                >
                  Reapply for Leave
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600">Stay updated with important alerts and messages</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-sm">
            <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full font-medium">
              {unreadCount} unread
            </span>
            {actionRequiredCount > 0 && (
              <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-medium">
                {actionRequiredCount} action required
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{notifications.length}</p>
            </div>
            <Bell className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unread</p>
              <p className="text-2xl font-bold text-red-600">{unreadCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Action Required</p>
              <p className="text-2xl font-bold text-amber-600">{actionRequiredCount}</p>
            </div>
            <XCircle className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-green-600">
                {notifications.filter(n => {
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return new Date(n.timestamp) > weekAgo;
                }).length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="leave">Leave Related</option>
            <option value="attendance">Attendance</option>
            <option value="system">System</option>
            <option value="announcement">Announcements</option>
          </select>
          <select
            value={filterRead}
            onChange={(e) => setFilterRead(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedNotifications.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedNotifications.length} notification{selectedNotifications.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center space-x-2">
              <button onClick={handleMarkAsRead} className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                Mark as Read
              </button>
              <button onClick={handleArchive} className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700">
                Archive
              </button>
              <button onClick={handleDelete} className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
          </h3>
          <button
            onClick={selectAllNotifications}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {selectedNotifications.length === filteredNotifications.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-600">Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
          <div
            key={notification.id}
            className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
              getNotificationColor(notification.type)
            } ${!notification.read ? 'ring-2 ring-blue-200' : ''}`}
            onClick={() => setSelectedNotification(notification)}
            style={{ cursor: 'pointer' }}
          >
            <div className="flex items-start space-x-4">
              <input
                type="checkbox"
                checked={selectedNotifications.includes(notification.id)}
                onChange={() => toggleNotificationSelection(notification.id)}
                className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              
              <div className="flex-shrink-0 mt-1">
                {getNotificationIcon(notification.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      )}
                      {notification.actionRequired && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full font-medium">
                          Action Required
                        </span>
                      )}
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getPriorityColor(notification.priority)}`}>
                        {notification.priority}
                      </span>
                    </div>
                    <p className={`text-sm ${!notification.read ? 'text-gray-800' : 'text-gray-600'} mb-2`}>
                      {notification.message}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>{formatTimestamp(notification.timestamp)}</span>
                      <span className="capitalize">{notification.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button className="p-1 hover:bg-gray-100 rounded" title="More Options">
                      <MoreHorizontal className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;