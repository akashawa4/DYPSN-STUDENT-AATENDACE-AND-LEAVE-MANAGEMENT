import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Filter, 
  Download, 
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  Calendar,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { attendanceService } from '../../firebase/firestore';
import { AttendanceLog } from '../../types';

interface AttendanceCRUDProps {
  addNotification?: (message: string) => void;
}

interface AttendanceFormData {
  rollNumber: string;
  userName: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
  subject: string;
  notes: string;
  year: string;
  sem: string;
  div: string;
}

const AttendanceCRUD: React.FC<AttendanceCRUDProps> = ({ addNotification }) => {
  const { user } = useAuth();
  
  // State management
  const [attendances, setAttendances] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AttendanceFormData>({
    rollNumber: '',
    userName: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    subject: '',
    notes: '',
    year: user?.year || '2nd',
    sem: user?.sem || '3',
    div: user?.div || 'A'
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    subject: '',
    dateFrom: '',
    dateTo: '',
    year: user?.year || '2nd',
    sem: user?.sem || '3',
    div: user?.div || 'A'
  });
  
  // Available subjects
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);

  // Load available subjects
  useEffect(() => {
    const loadSubjects = async () => {
      if (!user || user.role !== 'teacher') return;
      
      setSubjectsLoading(true);
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../firebase/firebase');
        const { getDepartmentCode } = await import('../../utils/departmentMapping');
        
        const deptCode = getDepartmentCode(user.department);
        const batchYear = '2025';
        const collectionPath = `subjects/${batchYear}/${deptCode}/year/${filters.year}/sems/${filters.sem}`;
        
        const subjectsRef = collection(db, collectionPath);
        const querySnapshot = await getDocs(subjectsRef);
        
        const subjectNames: string[] = [];
        querySnapshot.docs.forEach(doc => {
          const subjectData = doc.data();
          const subjectName = subjectData.subjectName || subjectData.name || doc.id;
          if (!subjectNames.includes(subjectName)) {
            subjectNames.push(subjectName);
          }
        });
        setAvailableSubjects(subjectNames);
      } catch (error) {
        console.error('Error loading subjects:', error);
      } finally {
        setSubjectsLoading(false);
      }
    };

    loadSubjects();
  }, [user, filters.year, filters.sem]);

  // Load attendance records
  const loadAttendances = async () => {
    if (!user || user.role !== 'teacher') return;
    
    setLoading(true);
    setError('');
    
    try {
      // Get attendance for the selected subject and date range
      if (filters.subject && filters.dateFrom && filters.dateTo) {
        const startDate = new Date(filters.dateFrom);
        const endDate = new Date(filters.dateTo);
        
        const attendanceRecords = await attendanceService.getAttendanceByStudentAndDateRange(
          '', // Empty rollNumber to get all students
          filters.year,
          filters.sem,
          filters.div,
          filters.subject,
          startDate,
          endDate
        );
        
        // Filter by search term and status
        let filteredRecords = attendanceRecords;
        
        if (filters.search) {
          filteredRecords = filteredRecords.filter(record => 
            record.userName?.toLowerCase().includes(filters.search.toLowerCase()) ||
            record.rollNumber?.toLowerCase().includes(filters.search.toLowerCase())
          );
        }
        
        if (filters.status) {
          filteredRecords = filteredRecords.filter(record => record.status === filters.status);
        }
        
        setAttendances(filteredRecords);
      } else {
        setAttendances([]);
      }
    } catch (error) {
      setError('Failed to load attendance records');
      console.error('Error loading attendances:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load attendances when filters change
  useEffect(() => {
    if (filters.subject && filters.dateFrom && filters.dateTo) {
      loadAttendances();
    }
  }, [filters]);

  // CREATE - Add new attendance record
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.rollNumber || !formData.userName || !formData.subject) {
      setError('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const attendanceData = {
        userId: formData.rollNumber,
        userName: formData.userName,
        rollNumber: formData.rollNumber,
        date: formData.date,
        status: formData.status,
        subject: formData.subject,
        notes: formData.notes,
        year: formData.year,
        sem: formData.sem,
        div: formData.div,
        studentYear: formData.year,
        createdAt: new Date()
      };
      
      await attendanceService.markAttendance(attendanceData);
      
      setSuccess('Attendance record created successfully');
      setShowForm(false);
      resetForm();
      loadAttendances();
      
      if (addNotification) {
        addNotification(`Attendance record created for ${formData.userName} (${formData.rollNumber})`);
      }
    } catch (error) {
      setError('Failed to create attendance record');
      console.error('Error creating attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // UPDATE - Update existing attendance record
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingId) return;
    
    setLoading(true);
    setError('');
    
    try {
      const updateData = {
        status: formData.status,
        notes: formData.notes,
        userName: formData.userName
      };
      
      const success = await attendanceService.updateAttendance(
        editingId,
        formData.year,
        formData.sem,
        formData.div,
        formData.subject,
        formData.date,
        updateData
      );
      
      if (success) {
        setSuccess('Attendance record updated successfully');
        setShowForm(false);
        setEditingId(null);
        resetForm();
        loadAttendances();
        
        if (addNotification) {
          addNotification(`Attendance record updated for ${formData.userName} (${formData.rollNumber})`);
        }
      } else {
        setError('Failed to update attendance record');
      }
    } catch (error) {
      setError('Failed to update attendance record');
      console.error('Error updating attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // DELETE - Delete attendance record
  const handleDelete = async (attendanceId: string, rollNumber: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete the attendance record for ${userName} (${rollNumber})?`)) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const attendance = attendances.find(a => a.id === attendanceId);
      if (!attendance) {
        setError('Attendance record not found');
        return;
      }
      
      const success = await attendanceService.deleteAttendance(
        attendanceId,
        attendance.year || formData.year,
        attendance.sem || formData.sem,
        attendance.div || formData.div,
        attendance.subject || formData.subject,
        attendance.date instanceof Date ? attendance.date.toISOString().split('T')[0] : attendance.date
      );
      
      if (success) {
        setSuccess('Attendance record deleted successfully');
        loadAttendances();
        
        if (addNotification) {
          addNotification(`Attendance record deleted for ${userName} (${rollNumber})`);
        }
      } else {
        setError('Failed to delete attendance record');
      }
    } catch (error) {
      setError('Failed to delete attendance record');
      console.error('Error deleting attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  // Edit attendance record
  const handleEdit = (attendance: AttendanceLog) => {
    setFormData({
      rollNumber: attendance.rollNumber || attendance.userId || '',
      userName: attendance.userName || '',
      date: attendance.date instanceof Date ? 
        attendance.date.toISOString().split('T')[0] : 
        (attendance.date as any)?.toDate?.()?.toISOString().split('T')[0] || attendance.date,
      status: attendance.status,
      subject: attendance.subject || '',
      notes: attendance.notes || '',
      year: attendance.year || formData.year,
      sem: attendance.sem || formData.sem,
      div: attendance.div || formData.div
    });
    setEditingId(attendance.id);
    setShowForm(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      rollNumber: '',
      userName: '',
      date: new Date().toISOString().split('T')[0],
      status: 'present',
      subject: '',
      notes: '',
      year: user?.year || '2nd',
      sem: user?.sem || '3',
      div: user?.div || 'A'
    });
    setEditingId(null);
  };

  // Handle form submission
  const handleSubmit = editingId ? handleUpdate : handleCreate;

  // Clear messages
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // Get status icon and color
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'absent':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'late':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'half-day':
        return <Clock className="w-4 h-4 text-orange-600" />;
      case 'leave':
        return <User className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800';
      case 'absent':
        return 'bg-red-100 text-red-800';
      case 'late':
        return 'bg-yellow-100 text-yellow-800';
      case 'half-day':
        return 'bg-orange-100 text-orange-800';
      case 'leave':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user || user.role !== 'teacher') {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-600">Access denied. Only teachers can manage attendance records.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
        <p className="text-gray-600 mt-1">Create, read, update, and delete attendance records</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
          <button onClick={clearMessages} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            <span className="text-green-800">{success}</span>
          </div>
          <button onClick={clearMessages} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Filter className="w-5 h-5 mr-2" />
          Filters
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                placeholder="Search by name or roll number"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select
              value={filters.subject}
              onChange={(e) => setFilters({...filters, subject: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={subjectsLoading}
            >
              <option value="">Select Subject</option>
              {availableSubjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            {subjectsLoading && (
              <p className="text-xs text-gray-500 mt-1">Loading subjects...</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="half-day">Half Day</option>
              <option value="leave">Leave</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={loadAttendances}
            disabled={loading || !filters.subject || !filters.dateFrom || !filters.dateTo}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Search className="w-4 h-4 mr-2" />
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">Attendance Records</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Record
        </button>
      </div>

      {/* Attendance Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingId ? 'Edit Attendance Record' : 'Add New Attendance Record'}
                </h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Roll Number *</label>
                    <input
                      type="text"
                      value={formData.rollNumber}
                      onChange={(e) => setFormData({...formData, rollNumber: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={!!editingId}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Student Name *</label>
                    <input
                      type="text"
                      value={formData.userName}
                      onChange={(e) => setFormData({...formData, userName: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={!!editingId}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="half-day">Half Day</option>
                      <option value="leave">Leave</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                      disabled={!!editingId}
                    >
                      <option value="">Select Subject</option>
                      {availableSubjects.map(subject => (
                        <option key={subject} value={subject}>{subject}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                    <select
                      value={formData.year}
                      onChange={(e) => setFormData({...formData, year: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!!editingId}
                    >
                      <option value="1st">1st Year</option>
                      <option value="2nd">2nd Year</option>
                      <option value="3rd">3rd Year</option>
                      <option value="4th">4th Year</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
                    <select
                      value={formData.sem}
                      onChange={(e) => setFormData({...formData, sem: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!!editingId}
                    >
                      <option value="1">1st Semester</option>
                      <option value="2">2nd Semester</option>
                      <option value="3">3rd Semester</option>
                      <option value="4">4th Semester</option>
                      <option value="5">5th Semester</option>
                      <option value="6">6th Semester</option>
                      <option value="7">7th Semester</option>
                      <option value="8">8th Semester</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Division</label>
                    <select
                      value={formData.div}
                      onChange={(e) => setFormData({...formData, div: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={!!editingId}
                    >
                      <option value="A">Division A</option>
                      <option value="B">Division B</option>
                      <option value="C">Division C</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Additional notes (optional)"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        {editingId ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingId ? 'Update Record' : 'Create Record'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Records Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading attendance records...</p>
          </div>
        ) : attendances.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No attendance records found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or add new records</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendances.map((attendance) => (
                  <tr key={attendance.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {attendance.rollNumber || attendance.userId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attendance.userName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attendance.date instanceof Date ? 
                        attendance.date.toISOString().split('T')[0] : 
                        (attendance.date as any)?.toDate?.()?.toISOString().split('T')[0] || attendance.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {attendance.subject}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(attendance.status)}
                        <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(attendance.status)}`}>
                          {attendance.status.charAt(0).toUpperCase() + attendance.status.slice(1).replace('-', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {attendance.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(attendance)}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(attendance.id, attendance.rollNumber || attendance.userId, attendance.userName)}
                          className="text-red-600 hover:text-red-900 flex items-center"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {attendances.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {attendances.length} attendance record{attendances.length !== 1 ? 's' : ''}
            </div>
            <div className="flex space-x-4 text-sm">
              <span className="text-green-600">
                Present: {attendances.filter(a => a.status === 'present').length}
              </span>
              <span className="text-red-600">
                Absent: {attendances.filter(a => a.status === 'absent').length}
              </span>
              <span className="text-yellow-600">
                Late: {attendances.filter(a => a.status === 'late').length}
              </span>
              <span className="text-orange-600">
                Half Day: {attendances.filter(a => a.status === 'half-day').length}
              </span>
              <span className="text-blue-600">
                Leave: {attendances.filter(a => a.status === 'leave').length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCRUD;
