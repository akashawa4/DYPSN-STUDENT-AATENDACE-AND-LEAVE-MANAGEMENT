import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  RotateCcw, 
  Clock, 
  User, 
  Calendar, 
  FileText, 
  MessageSquare,
  Filter,
  Search,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  Download
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../firebase/firestore';
import { LeaveRequest } from '../../types';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: LeaveRequest | null;
  onAction: (action: 'approve' | 'reject' | 'return', remarks?: string) => void;
  userRole: string;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ 
  isOpen, 
  onClose, 
  request, 
  onAction, 
  userRole 
}) => {
  const [action, setAction] = useState<'approve' | 'reject' | 'return' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !request) return null;

  const handleSubmit = async () => {
    if (!action) return;
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    onAction(action, remarks);
    setIsSubmitting(false);
    setAction(null);
    setRemarks('');
    onClose();
  };

  const getLeaveTypeName = (type: string) => {
    const types = {
      'SL': 'Sick Leave',
      'CL': 'Casual Leave',
      'OD': 'On Duty',
      'ML': 'Medical Leave',
      'OTH': 'Other'
    };
    return types[type as keyof typeof types] || type;
  };

  const getNextApprovalLevel = () => {
    const hierarchy = ['Teacher', 'HOD'];
    const currentLevel = request.currentApprovalLevel || '';
    const currentIndex = hierarchy.indexOf(currentLevel);
    return currentIndex < hierarchy.length - 1 && currentIndex !== -1 ? hierarchy[currentIndex + 1] : null;
  };

  return (
    <div className="modal-mobile">
      <div className="modal-content-mobile md:max-w-3xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Leave Request Review</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <XCircle className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Employee Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Student Details</label>
                <div className="mt-1">
                  <p className="text-lg font-semibold text-gray-900">{request.userName}</p>
                  <p className="text-sm text-gray-600">Student</p>
                  <p className="text-sm text-gray-600">{request.department}</p>
                  <p className="text-sm text-gray-600">ID: {request.userId}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Leave Details</label>
                <div className="mt-1 space-y-1">
                  <p className="text-sm"><strong>Type:</strong> {getLeaveTypeName(request.leaveType)}</p>
                  <p className="text-sm"><strong>Duration:</strong> {request.daysCount} day{request.daysCount > 1 ? 's' : ''}</p>
                  <p className="text-sm"><strong>From:</strong> {new Date(request.fromDate).toLocaleDateString()}</p>
                  <p className="text-sm"><strong>To:</strong> {new Date(request.toDate).toLocaleDateString()}</p>
                  <p className="text-sm"><strong>Submitted:</strong> {new Date(request.submittedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Reason for Leave</label>
                <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-900">{request.reason}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Current Approval Level</label>
                <div className="mt-1">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {request.currentApprovalLevel || 'HOD'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Approval Flow */}
          <div>
            <label className="text-sm font-medium text-gray-500">Approval Flow</label>
            <div className="mt-2 space-y-2">
              {request.approvalFlow && request.approvalFlow.map((level, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${
                    level === request.currentApprovalLevel ? 'bg-blue-500' :
                    request.approvalFlow && index < request.approvalFlow.indexOf(request.currentApprovalLevel || 'HOD') ? 'bg-green-500' :
                    'bg-gray-300'
                  }`}></div>
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">{level}</span>
                    <p className="text-sm text-gray-600">
                      {level === request.currentApprovalLevel ? 'Current Level' : 
                       request.approvalFlow && index < request.approvalFlow.indexOf(request.currentApprovalLevel || 'HOD') ? 'Completed' : 
                       'Pending'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Selection */}
          {!action && (
            <div className="border-t border-gray-200 pt-6">
              <label className="text-sm font-medium text-gray-500 mb-3 block">Select Action</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => setAction('approve')}
                  className="flex items-center justify-center space-x-2 p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors"
                >
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-700">
                    {getNextApprovalLevel() ? `Approve & Forward to ${getNextApprovalLevel()}` : 'Final Approval'}
                  </span>
                </button>
                
                <button
                  onClick={() => setAction('return')}
                  className="flex items-center justify-center space-x-2 p-4 border-2 border-amber-200 rounded-lg hover:bg-amber-50 transition-colors"
                >
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-amber-700">Return for Revision</span>
                </button>
                
                <button
                  onClick={() => setAction('reject')}
                  className="flex items-center justify-center space-x-2 p-4 border-2 border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-700">Reject Request</span>
                </button>
              </div>
            </div>
          )}

          {/* Remarks Input */}
          {action && (
            <div className="border-t border-gray-200 pt-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {action === 'approve' ? 'Approval Remarks (Optional)' : 
                     action === 'return' ? 'Return Reason (Required)' : 
                     'Rejection Reason (Required)'}
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={
                      action === 'approve' ? 'Add any additional comments...' :
                      action === 'return' ? 'Specify what needs to be corrected...' :
                      'Provide reason for rejection...'
                    }
                    required={action !== 'approve'}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      setAction(null);
                      setRemarks('');
                    }}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                  
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || (action !== 'approve' && !remarks.trim())}
                    className={`px-6 py-2 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${
                      action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                      action === 'return' ? 'bg-amber-600 hover:bg-amber-700' :
                      'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        {action === 'approve' && <CheckCircle className="w-4 h-4" />}
                        {action === 'return' && <RotateCcw className="w-4 h-4" />}
                        {action === 'reject' && <XCircle className="w-4 h-4" />}
                        <span>
                          {action === 'approve' ? 'Approve Request' :
                           action === 'return' ? 'Return Request' :
                           'Reject Request'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LeaveApprovalPanel: React.FC = () => {
  const { user } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [banner, setBanner] = useState<{ type: 'approve' | 'reject' | 'return'; message: string } | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    const fetchLeaveRequests = async () => {
      try {
        const requests = await leaveService.getLeaveRequestsByApprover(user?.id || '');
        setLeaveRequests(requests);
      } catch (error) {
        console.error("Error fetching leave requests:", error);
        setBanner({ type: 'reject', message: 'Failed to fetch leave requests.' });
        setTimeout(() => setBanner(null), 3000);
      }
    };

    fetchLeaveRequests();
    const interval = setInterval(fetchLeaveRequests, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleApprovalAction = async (action: 'approve' | 'reject' | 'return', remarks?: string) => {
    if (!selectedRequest) return;

    console.log('[LeaveApprovalPanel] Starting approval action:', action, 'for request:', selectedRequest.id);
    console.log('[LeaveApprovalPanel] Current user:', user);

    // Map UI action to backend status
    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      return: 'returned',
    } as const;
    const backendStatus = statusMap[action];
    if (!backendStatus) return; // Defensive: should never happen
    if (!user?.id) return; // Defensive: must have user id
    if (!selectedRequest.id) return;

    try {
      await leaveService.updateLeaveRequestStatus(selectedRequest.id!, backendStatus, user.id, remarks);
      setBanner({
        type: action,
        message:
          action === 'approve'
            ? 'Leave request approved successfully!'
            : action === 'reject'
            ? 'Leave request rejected.'
            : 'Leave request returned for revision.'
      });
      setTimeout(() => setBanner(null), 3000);
      // Refresh the list after action
      const updatedRequests = await leaveService.getLeaveRequestsByApprover(user?.id || '');
      setLeaveRequests(updatedRequests);
    } catch (error) {
      const err = error as any;
      console.error("[LeaveApprovalPanel] Error updating leave request status:", err);
      console.error("[LeaveApprovalPanel] Error message:", err.message);
      console.error("[LeaveApprovalPanel] Error code:", err.code);
      
      let errorMessage = 'Failed to update leave request status.';
      if (err.message) {
        errorMessage += ` ${err.message}`;
      }
      if (err.code) {
        errorMessage += ` (Code: ${err.code})`;
      }
      
      setBanner({ type: 'reject', message: errorMessage });
      setTimeout(() => setBanner(null), 5000);
    }
    setShowApprovalModal(false);
    setSelectedRequest(null);
  };

  const filteredRequests = leaveRequests.filter(request => {
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    const matchesDepartment = filterDepartment === 'all' || request.department === filterDepartment;
    const matchesSearch = request.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.reason.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesDepartment && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'returned': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
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

  const getLeaveTypeName = (type: string) => {
    const types = {
      'SL': 'Sick Leave',
      'CL': 'Casual Leave',
      'OD': 'On Duty',
      'ML': 'Medical Leave',
      'OTH': 'Other'
    };
    return types[type as keyof typeof types] || type;
  };

  const stats = {
    total: leaveRequests.length,
    pending: leaveRequests.filter(r => r.status === 'pending').length,
    approved: leaveRequests.filter(r => r.status === 'approved').length,
    rejected: leaveRequests.filter(r => r.status === 'rejected').length + leaveRequests.filter(r => r.status === 'returned').length
  };

  // Export leave requests as Excel (XLSX) matching requested format
  const handleExportLeaveReport = () => {
    const formatDate = (iso: string) => {
      if (!iso) return '';
      const d = new Date(iso);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    const yearToTY = (year?: string) => {
      if (!year) return '';
      const map: Record<string, string> = { '1st': 'FY', '2nd': 'SY', '3rd': 'TY', '4th': 'LY' };
      return map[year] || year;
    };

    const deptShort = (dept?: string) => {
      if (!dept) return '';
      const known: Record<string, string> = {
        'Information Technology': 'IT',
        'Computer Science': 'CSE',
        'Computer Science and Engineering': 'CSE',
        'Mechanical Engineering': 'ME',
        'Electronics': 'ENTC',
        'Civil Engineering': 'CIVIL'
      };
      if (known[dept]) return known[dept];
      return dept.split(' ').map(w => w[0]).join('').toUpperCase();
    };

    const headers = [
      'Sr. No',
      'Roll No',
      'Student Name',
      'Class',
      'From Date',
      'To Date',
      'No. of Days',
      'Reason',
      'Status (Approved/Pending/Rejected)',
      'Approved By (Teacher/HOD)'
    ];

    const rows = filteredRequests.map((req, idx) => {
      const classStr = `${yearToTY((req as any).year)} ${deptShort(req.department)}`.trim();
      // Determine approver level label
      const approverLevel = req.status === 'pending'
        ? (req.currentApprovalLevel || '')
        : (req.currentApprovalLevel || 'HOD');

      return [
        idx + 1,
        (req as any).rollNumber || req.userId || '',
        req.userName || '',
        classStr,
        formatDate(req.fromDate),
        formatDate(req.toDate),
        req.daysCount ?? '',
        (req.reason || '').replace(/\n|\r/g, ' '),
        (req.status || '').charAt(0).toUpperCase() + (req.status || '').slice(1),
        approverLevel
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Auto-width columns
    const colWidths = headers.map((h, i) => ({ wch: Math.max(h.length + 2, ...rows.map(r => String(r[i] ?? '').length + 2)) }));
    (worksheet as any)['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, worksheet, 'Leave Report');
    XLSX.writeFile(wb, 'leave_approval_report.xlsx');
  };

  return (
    <div className="space-y-4">
      {/* Animated banner for approval/rejection/return */}
      {banner && (
        <div
          className={`fixed left-1/2 top-6 z-50 -translate-x-1/2 px-6 py-3 rounded-lg shadow-mobile-lg text-white text-lg font-semibold transition-all duration-500 ease-in-out
            ${banner.type === 'approve' ? 'bg-green-600 animate-slide-down' : ''}
            ${banner.type === 'reject' ? 'bg-red-600 animate-slide-down' : ''}
            ${banner.type === 'return' ? 'bg-amber-600 animate-slide-down' : ''}
          `}
          style={{ minWidth: 320, textAlign: 'center' }}
        >
          {banner.message}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Approval Panel</h1>
          <p className="text-gray-600">
            Review and process leave requests - {user?.role?.toUpperCase()} Level
          </p>
        </div>
        <div className="flex items-center space-x-3" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected/Returned</p>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-600" />
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
              placeholder="Search by student name, ID, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="returned">Returned</option>
          </select>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Departments</option>
            <option value="Computer Science">Computer Science</option>
            <option value="Mechanical Engineering">Mechanical Engineering</option>
            <option value="Electronics">Electronics</option>
            <option value="Civil Engineering">Civil Engineering</option>
          </select>
        </div>
      </div>

      {/* Requests - Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredRequests.map((request) => (
          <div key={request.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-mobile">
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{request.userName}</p>
                  <p className="text-xs text-gray-500">ID: {request.userId}</p>
                  <p className="text-xs text-gray-500">{request.department}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              </span>
            </div>

            <div className="mt-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{getLeaveTypeName(request.leaveType)}</span>
                <span className="text-xs text-gray-600">
                  {new Date(request.fromDate).toLocaleDateString()} - {new Date(request.toDate).toLocaleDateString()}
                </span>
              </div>
              <p className="text-gray-600 mt-1 line-clamp-2">{request.reason}</p>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="inline-flex px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700">
                {request.currentApprovalLevel || 'HOD'}
              </span>
              <button
                onClick={() => { setSelectedRequest(request); setShowApprovalModal(true); }}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm active:scale-95"
              >
                Review
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Requests Table - Desktop */}
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto scrollbar-mobile-h">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRequests.map((request) => (
                <tr
                  key={request.id}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                  onClick={() => {
                    setSelectedRequest(request);
                    setShowApprovalModal(true);
                  }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{request.userName}</p>
                        <p className="text-sm text-gray-600">{user?.designation || 'Employee'}</p>
                        <p className="text-sm text-gray-500">{request.department}</p>
                        <p className="text-xs text-gray-400">ID: {request.userId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{getLeaveTypeName(request.leaveType)}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{request.userName}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{request.reason}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Submitted: {new Date(request.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(request.fromDate).toLocaleDateString()} - {new Date(request.toDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-600">{request.daysCount} day{request.daysCount > 1 ? 's' : ''}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {request.currentApprovalLevel || 'HOD'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </span>
                      <p className="text-xs text-gray-500">
                        Current: {request.currentApprovalLevel}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="p-1 text-blue-300">
                        <Eye className="w-4 h-4" />
                      </span>
                      <button
                        className="p-1 hover:bg-gray-100 rounded text-gray-600"
                        title="More Options"
                        onClick={e => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredRequests.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No leave requests found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Approval Modal */}
      <ApprovalModal
        isOpen={showApprovalModal}
        onClose={() => {
          setShowApprovalModal(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        onAction={handleApprovalAction}
        userRole={user?.role || ''}
      />
    </div>
  );
};

export default LeaveApprovalPanel;