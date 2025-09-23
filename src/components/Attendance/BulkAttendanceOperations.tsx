import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Trash2, 
  Edit, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  FileSpreadsheet,
  Save,
  X,
  Plus,
  Minus
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { attendanceService } from '../../firebase/firestore';
import { AttendanceLog } from '../../types';

interface BulkAttendanceOperationsProps {
  addNotification?: (message: string) => void;
}

interface BulkOperation {
  type: 'create' | 'update' | 'delete';
  records: Array<{
    id?: string;
    rollNumber: string;
    userName: string;
    status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
    notes?: string;
  }>;
}

const BulkAttendanceOperations: React.FC<BulkAttendanceOperationsProps> = ({ addNotification }) => {
  const { user } = useAuth();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showBulkForm, setShowBulkForm] = useState(false);
  
  // Form states
  const [bulkData, setBulkData] = useState({
    year: user?.year || '2nd',
    sem: user?.sem || '3',
    div: user?.div || 'A',
    subject: '',
    date: new Date().toISOString().split('T')[0],
    operation: 'create' as 'create' | 'update' | 'delete'
  });
  
  // Bulk records
  const [bulkRecords, setBulkRecords] = useState<Array<{
    id?: string;
    rollNumber: string;
    userName: string;
    status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
    notes: string;
  }>>([]);
  
  // Available subjects
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  
  // Results
  const [operationResults, setOperationResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

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
        const collectionPath = `subjects/${batchYear}/${deptCode}/year/${bulkData.year}/sems/${bulkData.sem}`;
        
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
  }, [user, bulkData.year, bulkData.sem]);

  // Add new record to bulk list
  const addBulkRecord = () => {
    setBulkRecords([...bulkRecords, {
      rollNumber: '',
      userName: '',
      status: 'present',
      notes: ''
    }]);
  };

  // Remove record from bulk list
  const removeBulkRecord = (index: number) => {
    setBulkRecords(bulkRecords.filter((_, i) => i !== index));
  };

  // Update bulk record
  const updateBulkRecord = (index: number, field: string, value: string) => {
    const updated = [...bulkRecords];
    updated[index] = { ...updated[index], [field]: value };
    setBulkRecords(updated);
  };

  // Handle CSV import
  const handleCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      const lines = csv.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const records = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
          const values = line.split(',').map(v => v.trim());
          const record: any = {};
          
          headers.forEach((header, index) => {
            const value = values[index] || '';
            if (header.includes('roll') || header.includes('id')) {
              record.rollNumber = value;
            } else if (header.includes('name')) {
              record.userName = value;
            } else if (header.includes('status')) {
              record.status = value.toLowerCase();
            } else if (header.includes('note')) {
              record.notes = value;
            }
          });
          
          return {
            rollNumber: record.rollNumber || '',
            userName: record.userName || '',
            status: (record.status || 'present') as 'present' | 'absent' | 'late' | 'half-day' | 'leave',
            notes: record.notes || ''
          };
        });
      
      setBulkRecords(records);
      setSuccess(`Imported ${records.length} records from CSV`);
    };
    
    reader.readAsText(file);
  };

  // Handle CSV export
  const handleCSVExport = () => {
    const headers = ['Roll Number', 'Student Name', 'Status', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...bulkRecords.map(record => [
        record.rollNumber,
        record.userName,
        record.status,
        record.notes
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk_attendance_${bulkData.subject}_${bulkData.date}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Execute bulk operation
  const executeBulkOperation = async () => {
    if (bulkRecords.length === 0) {
      setError('No records to process');
      return;
    }
    
    if (!bulkData.subject || !bulkData.date) {
      setError('Please select subject and date');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      let result;
      
      switch (bulkData.operation) {
        case 'create':
          result = await attendanceService.markBulkAttendanceWithStatus(
            bulkRecords.map(record => ({
              rollNumber: record.rollNumber,
              userName: record.userName,
              status: record.status,
              notes: record.notes
            })),
            bulkData.year,
            bulkData.sem,
            bulkData.div,
            bulkData.subject,
            bulkData.date
          );
          break;
          
        case 'update':
          // For update operations, we need existing records
          const updateRecords = bulkRecords.filter(r => r.id).map(record => ({
            attendanceId: record.id!,
            updateData: {
              status: record.status,
              notes: record.notes,
              userName: record.userName
            }
          }));
          
          if (updateRecords.length === 0) {
            setError('No records with IDs found for update operation');
            return;
          }
          
          result = await attendanceService.updateBulkAttendance(
            updateRecords,
            bulkData.year,
            bulkData.sem,
            bulkData.div,
            bulkData.subject,
            bulkData.date
          );
          break;
          
        case 'delete':
          const deleteIds = bulkRecords.filter(r => r.id).map(r => r.id!);
          
          if (deleteIds.length === 0) {
            setError('No records with IDs found for delete operation');
            return;
          }
          
          result = await attendanceService.deleteBulkAttendance(
            deleteIds,
            bulkData.year,
            bulkData.sem,
            bulkData.div,
            bulkData.subject,
            bulkData.date
          );
          break;
          
        default:
          setError('Invalid operation type');
          return;
      }
      
      setOperationResults(result);
      
      if (result.success > 0) {
        setSuccess(`Successfully processed ${result.success} records`);
        if (addNotification) {
          addNotification(`Bulk ${bulkData.operation} operation completed: ${result.success} successful, ${result.failed} failed`);
        }
      }
      
      if (result.failed > 0) {
        setError(`${result.failed} records failed to process`);
      }
      
      // Clear records after successful operation
      if (result.failed === 0) {
        setBulkRecords([]);
      }
      
    } catch (error) {
      setError('Failed to execute bulk operation');
      console.error('Bulk operation error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Clear messages
  const clearMessages = () => {
    setError('');
    setSuccess('');
    setOperationResults(null);
  };

  // Get status color
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
        <p className="text-gray-600">Access denied. Only teachers can perform bulk operations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Attendance Operations</h1>
        <p className="text-gray-600 mt-1">Manage multiple attendance records at once</p>
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

      {/* Operation Results */}
      {operationResults && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Operation Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{operationResults.success}</div>
              <div className="text-sm text-gray-600">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{operationResults.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{operationResults.success + operationResults.failed}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>
          {operationResults.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">Errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {operationResults.errors.slice(0, 5).map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
                {operationResults.errors.length > 5 && (
                  <li>• ... and {operationResults.errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Bulk Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Bulk Operation Settings
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Operation Type</label>
            <select
              value={bulkData.operation}
              onChange={(e) => setBulkData({...bulkData, operation: e.target.value as any})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="create">Create New Records</option>
              <option value="update">Update Existing Records</option>
              <option value="delete">Delete Records</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <select
              value={bulkData.subject}
              onChange={(e) => setBulkData({...bulkData, subject: e.target.value})}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={bulkData.date}
              onChange={(e) => setBulkData({...bulkData, date: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Import/Export Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer flex items-center">
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden"
            />
          </label>
          
          <button
            onClick={handleCSVExport}
            disabled={bulkRecords.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          
          <button
            onClick={() => setBulkRecords([])}
            disabled={bulkRecords.length === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </button>
        </div>

        {/* Bulk Records List */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-medium text-gray-900">
              Records ({bulkRecords.length})
            </h3>
            <button
              onClick={addBulkRecord}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center text-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Record
            </button>
          </div>

          {bulkRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p>No records added yet</p>
              <p className="text-sm">Add records manually or import from CSV</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {bulkRecords.map((record, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-medium text-gray-700">Record {index + 1}</span>
                    <button
                      onClick={() => removeBulkRecord(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Roll Number</label>
                      <input
                        type="text"
                        value={record.rollNumber}
                        onChange={(e) => updateBulkRecord(index, 'rollNumber', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter roll number"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Student Name</label>
                      <input
                        type="text"
                        value={record.userName}
                        onChange={(e) => updateBulkRecord(index, 'userName', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter student name"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={record.status}
                        onChange={(e) => updateBulkRecord(index, 'status', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="half-day">Half Day</option>
                        <option value="leave">Leave</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <input
                        type="text"
                        value={record.notes}
                        onChange={(e) => updateBulkRecord(index, 'notes', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}>
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('-', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Execute Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={executeBulkOperation}
            disabled={loading || bulkRecords.length === 0 || !bulkData.subject || !bulkData.date}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Execute {bulkData.operation.charAt(0).toUpperCase() + bulkData.operation.slice(1)} Operation
              </>
            )}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-md font-semibold text-gray-900 mb-2">Instructions</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Create:</strong> Add new attendance records for students</li>
          <li>• <strong>Update:</strong> Modify existing attendance records (requires record IDs)</li>
          <li>• <strong>Delete:</strong> Remove attendance records (requires record IDs)</li>
          <li>• <strong>CSV Import:</strong> Upload a CSV file with columns: Roll Number, Student Name, Status, Notes</li>
          <li>• <strong>CSV Export:</strong> Download current records as CSV for backup or editing</li>
        </ul>
      </div>
    </div>
  );
};

export default BulkAttendanceOperations;
