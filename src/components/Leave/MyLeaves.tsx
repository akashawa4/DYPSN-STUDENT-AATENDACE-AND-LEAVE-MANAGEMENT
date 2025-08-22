import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, XCircle, AlertTriangle, Filter, Search, Download, Eye, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { leaveService } from '../../firebase/firestore';
import { userService } from '../../firebase/firestore';
import { LeaveRequest, User } from '../../types';
import { saveAs } from 'file-saver';

const YEARS = ['2nd', '3rd', '4th'];
const SEMS = ['3', '4', '5', '6', '7', '8'];
const DIVS = ['A', 'B', 'C'];

const MyLeaves: React.FC = () => {
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Add year/sem/div state for teacher/HOD
  const [year, setYear] = useState(YEARS[0]);
  const [sem, setSem] = useState(SEMS[0]);
  const [div, setDiv] = useState(DIVS[0]);

  // Load leave requests with optimized loading and timeout
  useEffect(() => {
    const loadLeaveRequests = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      console.log(`🔄 Loading leave requests for user: ${user.name} (${user.role})`);
      
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setLoading(false);
        setError('Loading timeout. Please try again.');
        console.log('⏰ Loading timeout reached');
      }, 30000); // 30 seconds timeout
      
      try {
        if (user.role === 'teacher' || user.role === 'hod') {
          // Fetch from hierarchical leave collection for the currently selected class and month
          const numericYear = (year.match(/\d+/)?.[0] || year);
          const subject = 'General';
          const now = new Date();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const yearForMonth = String(now.getFullYear());

          console.log(`📅 Fetching leaves for: ${numericYear}/${sem}/${div}/${subject}/${yearForMonth}/${month}`);

          const classLeaves = await leaveService.getClassLeavesByMonth(
            numericYear,
            sem,
            div,
            subject,
            month,
            yearForMonth
          );

          // Restrict to teacher's department if present on records
          const filtered = classLeaves.filter(l => !l.department || l.department === user.department);
          console.log(`✅ Loaded ${filtered.length} leave records for teacher/HOD`);
          setLeaveRecords(filtered);
        } else {
          // Student: only their own leaves
          console.log(`📚 Fetching student leaves for: ${user.id}`);
          const requests = await leaveService.getLeaveRequestsByUser(user.id);
          console.log(`✅ Loaded ${requests.length} leave records for student`);
          setLeaveRecords(requests);
        }
      } catch (error) {
        console.error('❌ Error loading leave requests:', error);
        setError('Failed to load leave requests. Please try again.');
        // Set empty array to prevent infinite loading
        setLeaveRecords([]);
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };
    
    // Only reload for teachers/HODs when year/sem/div changes
    if (user?.role === 'teacher' || user?.role === 'hod') {
      loadLeaveRequests();
    } else {
      // For students, just once on mount
      if (loading) loadLeaveRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, year, sem, div]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-amber-600" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'returned': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-50 text-green-700 border-green-200';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      case 'returned': return 'bg-orange-50 text-orange-700 border-orange-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
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

  const filteredLeaves = leaveRecords.filter(leave => {
    const matchesStatus = filterStatus === 'all' || leave.status === filterStatus;
    const matchesType = filterType === 'all' || leave.leaveType === filterType;
    const matchesSearch = leave.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         leave.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  const leaveStats = {
    total: leaveRecords.length,
    approved: leaveRecords.filter(l => l.status === 'approved').length,
    pending: leaveRecords.filter(l => l.status === 'pending').length,
    rejected: leaveRecords.filter(l => l.status === 'rejected').length + leaveRecords.filter(l => l.status === 'returned').length
  };

  // Export leave data as CSV for the logged-in student
  const handleExportLeaves = async () => {
    if (!filteredLeaves.length) {
      alert('No leave records to export.');
      return;
    }
    const headers = [
      'Sr No',
      'Roll No',
      'Student Name',
      'Request ID',
      'Type of Leave',
      'Reason',
      'From Date',
      'To Date',
      'Days',
      'Status',
      'Approval Flow',
      'Final Approver',
      'Approved Date',
      'Remarks'
    ];
    const rows = await Promise.all(filteredLeaves.map(async (leave, idx) => {
      const fromDate = new Date(leave.fromDate).toLocaleDateString('en-GB');
      const toDate = new Date(leave.toDate).toLocaleDateString('en-GB');
      const approvedDate = leave.approvedAt ? new Date(leave.approvedAt).toLocaleDateString('en-GB') : '';
      const approvalFlow = leave.approvalFlow ? leave.approvalFlow.join(' > ') : '';
      // For teacher/HOD view, get student data from the leave record
      let rollNo = '';
      let studentName = '';
      
      if (user?.role === 'teacher' || user?.role === 'hod') {
        // Get student data from the leave record
        rollNo = (leave as any).rollNumber || '';
        studentName = leave.userName || '';
        
        // If not available in leave record, try to get from student data
        if (!rollNo || !studentName) {
          try {
            const studentData = await userService.getUser(leave.userId);
            if (studentData) {
              rollNo = studentData.rollNumber || '';
              studentName = studentData.name || '';
            }
          } catch (error) {
            console.log('Could not fetch student data for export:', error);
          }
        }
      } else {
        // For student view, use their own data
        rollNo = user?.rollNumber || '';
        studentName = user?.name || '';
      }
      
      return [
        idx + 1,
        rollNo,
        studentName,
        leave.id,
        getLeaveTypeName(leave.leaveType),
        (leave.reason || '').replace(/\n|\r/g, ' '),
        fromDate,
        toDate,
        leave.daysCount,
        leave.status,
        approvalFlow,
        leave.approvedBy || '',
        approvedDate,
                 leave.remarks ? leave.remarks.replace(/\n|\r/g, ' ') : ''
       ];
     }));
    const csv = [headers, ...rows].map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `my_leaves_${user?.rollNumber || user?.id || 'student'}.csv`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {user?.role === 'teacher' || user?.role === 'hod' ? 'Student Leaves' : 'My Leaves'}
            </h1>
            <p className="text-gray-600">Track and manage your leave requests</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">
            {user?.role === 'teacher' || user?.role === 'hod' 
              ? `Loading leaves for ${year}/${sem}/${div}...` 
              : 'Loading leave requests...'
            }
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {user?.role === 'teacher' || user?.role === 'hod' ? 'Student Leaves' : 'My Leaves'}
            </h1>
            <p className="text-gray-600">Track and manage your leave requests</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {user?.role === 'teacher' || user?.role === 'hod' ? 'Student Leaves' : 'My Leaves'}
          </h1>
          <p className="text-gray-600">Track and manage your leave requests</p>
        </div>
        <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700" onClick={handleExportLeaves}>
          <Download className="w-4 h-4" />
          <span>Export</span>
        </button>
      </div>
      {/* Year/Sem/Div dropdowns for teacher/HOD only */}
      {(user?.role === 'teacher' || user?.role === 'hod') && (
        <div className="flex flex-wrap gap-2 mb-2">
          <div>
            <label className="block text-xs font-medium text-gray-600">Year</label>
            <select value={year} onChange={e => setYear(e.target.value)} className="mt-1 block border rounded p-2">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Semester</label>
            <select value={sem} onChange={e => setSem(e.target.value)} className="mt-1 block border rounded p-2">
              {SEMS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600">Division</label>
            <select value={div} onChange={e => setDiv(e.target.value)} className="mt-1 block border rounded p-2">
              {DIVS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{leaveStats.total}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{leaveStats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-amber-600">{leaveStats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Rejected/Returned</p>
              <p className="text-2xl font-bold text-red-600">{leaveStats.rejected}</p>
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
              placeholder="Search by reason or ID..."
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
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="rejected">Rejected</option>
            <option value="returned">Returned</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="SL">Sick Leave</option>
            <option value="CL">Casual Leave</option>
            <option value="OD">On Duty</option>
            <option value="ML">Medical Leave</option>
            <option value="OTH">Other</option>
          </select>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredLeaves.map((leave) => (
          <div key={leave.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-mobile" onClick={() => setSelectedLeave(leave)}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-gray-900">{getLeaveTypeName(leave.leaveType)}</span>
                  <span className="text-xs text-gray-500">{leave.id}</span>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{leave.reason}</p>
              </div>
              <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(leave.status)}`}>
                {getStatusIcon(leave.status)}
                <span className="capitalize">{leave.status}</span>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600 flex items-center justify-between">
              <span>{new Date(leave.fromDate).toLocaleDateString()} - {new Date(leave.toDate).toLocaleDateString()}</span>
              <span>{leave.daysCount} day{leave.daysCount > 1 ? 's' : ''}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeaves.map((leave) => (
                <tr
                  key={leave.id}
                  className="hover:bg-blue-50 cursor-pointer"
                  onClick={() => setSelectedLeave(leave)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{getLeaveTypeName(leave.leaveType)}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{leave.id}</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{leave.reason}</p>
                      <p className="text-xs text-gray-400 mt-1">Submitted: {new Date(leave.submittedAt).toLocaleDateString()}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(leave.fromDate).toLocaleDateString()} - {new Date(leave.toDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-600">{leave.daysCount} day{leave.daysCount > 1 ? 's' : ''}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(leave.status)}`}>
                      {getStatusIcon(leave.status)}
                      <span className="capitalize">{leave.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      {leave.approvalFlow ? (
                        <div className="space-y-1">
                          {leave.approvalFlow.map((step, index) => (
                            <div key={index} className="text-xs text-gray-600">
                              {step}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Pending</span>
                      )}
                      {leave.currentApprovalLevel && leave.status === 'pending' && (
                        <p className="text-xs text-amber-600 mt-1">
                          Currently with: {leave.currentApprovalLevel}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedLeave(leave)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded" title="More Options">
                        <MoreHorizontal className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredLeaves.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No leave records found</h3>
          <p className="text-gray-600">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Leave Detail Modal */}
      {selectedLeave && (
        <div className="modal-mobile">
          <div className="modal-content-mobile md:max-w-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Leave Request Details</h3>
              <button
                onClick={() => setSelectedLeave(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <XCircle className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Request ID</label>
                  <p className="text-lg font-semibold text-gray-900">{selectedLeave.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Leave Type</label>
                  <p className="text-lg font-semibold text-gray-900">{getLeaveTypeName(selectedLeave.leaveType)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">From Date</label>
                  <p className="text-lg font-semibold text-gray-900">{new Date(selectedLeave.fromDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">To Date</label>
                  <p className="text-lg font-semibold text-gray-900">{new Date(selectedLeave.toDate).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Reason</label>
                <p className="text-gray-900 mt-1">{selectedLeave.reason}</p>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-500">Status:</label>
                <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedLeave.status)}`}>
                  {getStatusIcon(selectedLeave.status)}
                  <span className="capitalize">{selectedLeave.status}</span>
                </div>
              </div>

              {selectedLeave.approvalFlow && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Approval Flow</label>
                  <div className="mt-2 space-y-2">
                    {selectedLeave.approvalFlow.map((step, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">{index + 1}.</span>
                        <span className="text-sm text-gray-900">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLeave.approvedBy && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Final Approved By</label>
                  <p className="text-gray-900 mt-1">{selectedLeave.approvedBy}</p>
                  {selectedLeave.approvedAt && (
                    <p className="text-sm text-gray-600">on {new Date(selectedLeave.approvedAt).toLocaleDateString()}</p>
                  )}
                </div>
              )}

              {selectedLeave.remarks && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Remarks</label>
                  <p className="text-gray-900 mt-1 p-3 bg-gray-50 rounded-lg">{selectedLeave.remarks}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLeaves;