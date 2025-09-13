import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Users, Calendar, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { batchService } from '../../firebase/firestore';
import { getDepartmentCode } from '../../utils/departmentMapping';
import { getAvailableSemesters, isValidSemesterForYear, getDefaultSemesterForYear } from '../../utils/semesterMapping';

interface BatchData {
  id?: string;
  batchName: string;
  fromRollNo: string;
  toRollNo: string;
  year: string;
  sem: string;
  div: string;
  department: string;
  createdAt?: any;
  updatedAt?: any;
}

const YEARS = ['1st', '2nd', '3rd', '4th'];
const DIVS = ['A', 'B', 'C', 'D'];

const BatchManagementPanel: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<BatchData[]>([]);
  
  // Filter states
  const [selectedYear, setSelectedYear] = useState('2nd');
  const [selectedSem, setSelectedSem] = useState('3');
  const [selectedDiv, setSelectedDiv] = useState('A');
  const [availableSemesters, setAvailableSemesters] = useState<string[]>(getAvailableSemesters('2'));
  
  // Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchData | null>(null);
  const [newBatch, setNewBatch] = useState<BatchData>({
    batchName: '',
    fromRollNo: '',
    toRollNo: '',
    year: '2nd',
    sem: '3',
    div: 'A',
    department: 'CSE'
  });

  // Handle year change to update available semesters
  const handleYearChange = (newYear: string) => {
    setSelectedYear(newYear);
    const normalizedYear = newYear.replace(/(st|nd|rd|th)/i, '');
    const newAvailableSemesters = getAvailableSemesters(normalizedYear);
    setAvailableSemesters(newAvailableSemesters);
    
    // If current semester is not valid for new year, reset to first available
    if (!isValidSemesterForYear(normalizedYear, selectedSem)) {
      const defaultSem = getDefaultSemesterForYear(normalizedYear);
      setSelectedSem(defaultSem);
    }
  };

  // Load batches based on filters
  useEffect(() => {
    loadBatches();
  }, [selectedYear, selectedSem, selectedDiv]);

  // Filter batches based on search
  useEffect(() => {
    filterBatches();
  }, [batches]);

  const loadBatches = async () => {
    setLoading(true);
    try {
      const batch = '2025'; // Default batch year
      const department = getDepartmentCode(user?.department || 'CSE');
      
      const fetchedBatches = await batchService.getBatchesByFilters(
        batch,
        department,
        selectedYear,
        selectedSem,
        selectedDiv
      );
      
      setBatches(fetchedBatches);
    } catch (error) {
      console.error('Error loading batches:', error);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const filterBatches = () => {
    setFilteredBatches(batches);
  };

  const generateBatchNames = (div: string): string[] => {
    const batchNames: string[] = [];
    for (let i = 1; i <= 8; i++) {
      batchNames.push(`${div}${i}`);
    }
    return batchNames;
  };

  const getAvailableBatchNames = (div: string): string[] => {
    const allBatchNames = generateBatchNames(div);
    const existingBatchNames = batches.map(b => b.batchName);
    return allBatchNames.filter(name => !existingBatchNames.includes(name));
  };

  const handleAddBatch = async () => {
    if (!newBatch.batchName || !newBatch.fromRollNo || !newBatch.toRollNo) {
      alert('Please fill in all required fields');
      return;
    }

    if (parseInt(newBatch.fromRollNo) >= parseInt(newBatch.toRollNo)) {
      alert('From Roll No must be less than To Roll No');
      return;
    }

    try {
      setLoading(true);
      const batchData = {
        ...newBatch,
        year: selectedYear,
        sem: selectedSem,
        div: selectedDiv,
        department: getDepartmentCode(user?.department || 'CSE')
      };

      await batchService.createBatch(batchData);
      setShowAddModal(false);
      setNewBatch({
        batchName: '',
        fromRollNo: '',
        toRollNo: '',
        year: selectedYear,
        sem: selectedSem,
        div: selectedDiv,
        department: 'CSE'
      });
      loadBatches();
    } catch (error) {
      console.error('Error creating batch:', error);
      alert('Error creating batch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditBatch = async () => {
    if (!editingBatch || !editingBatch.batchName || !editingBatch.fromRollNo || !editingBatch.toRollNo) {
      alert('Please fill in all required fields');
      return;
    }

    if (parseInt(editingBatch.fromRollNo) >= parseInt(editingBatch.toRollNo)) {
      alert('From Roll No must be less than To Roll No');
      return;
    }

    try {
      setLoading(true);
      await batchService.updateBatch(editingBatch.id!, editingBatch);
      setShowEditModal(false);
      setEditingBatch(null);
      loadBatches();
    } catch (error) {
      console.error('Error updating batch:', error);
      alert('Error updating batch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!confirm('Are you sure you want to delete this batch? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      await batchService.deleteBatch(batchId);
      loadBatches();
    } catch (error) {
      console.error('Error deleting batch:', error);
      alert('Error deleting batch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (batch: BatchData) => {
    setEditingBatch({ ...batch });
    setShowEditModal(true);
  };

  const calculateRollNumbers = (fromRoll: string, toRoll: string): number[] => {
    const from = parseInt(fromRoll);
    const to = parseInt(toRoll);
    const rollNumbers: number[] = [];
    for (let i = from; i <= to; i++) {
      rollNumbers.push(i);
    }
    return rollNumbers;
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Batch Management</h2>
          <p className="text-gray-600 mt-1">Create and manage student batches for attendance tracking</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Batch
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <select
            value={selectedYear}
            onChange={e => handleYearChange(e.target.value)}
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {YEARS.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
          <select
            value={selectedSem}
            onChange={e => setSelectedSem(e.target.value)}
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {availableSemesters.map(sem => (
              <option key={sem} value={sem}>{sem}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
          <select
            value={selectedDiv}
            onChange={e => setSelectedDiv(e.target.value)}
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {DIVS.map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Batches List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading batches...</p>
        </div>
      ) : filteredBatches.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No batches found</h3>
          <p className="text-gray-600 mb-4">
            No batches have been created for {selectedYear} Year, Semester {selectedSem}, Division {selectedDiv}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Batch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBatches.map((batch) => {
            const rollNumbers = calculateRollNumbers(batch.fromRollNo, batch.toRollNo);
            return (
              <div key={batch.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">{batch.batchName}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(batch)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Edit batch"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBatch(batch.id!)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Delete batch"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{batch.year} Year, Sem {batch.sem}, Div {batch.div}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>Roll Numbers: {batch.fromRollNo} - {batch.toRollNo}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <BookOpen className="w-4 h-4" />
                    <span>Total Students: {rollNumbers.length}</span>
                  </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    Roll Numbers: {rollNumbers.slice(0, 5).join(', ')}
                    {rollNumbers.length > 5 && ` ... and ${rollNumbers.length - 5} more`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Batch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Batch</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Name</label>
                <select
                  value={newBatch.batchName}
                  onChange={e => setNewBatch({ ...newBatch, batchName: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Batch</option>
                  {getAvailableBatchNames(selectedDiv).map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Roll Number</label>
                <input
                  type="number"
                  value={newBatch.fromRollNo}
                  onChange={e => setNewBatch({ ...newBatch, fromRollNo: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 101"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Roll Number</label>
                <input
                  type="number"
                  value={newBatch.toRollNo}
                  onChange={e => setNewBatch({ ...newBatch, toRollNo: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 125"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBatch}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Batch Modal */}
      {showEditModal && editingBatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Batch</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Name</label>
                <input
                  type="text"
                  value={editingBatch.batchName}
                  onChange={e => setEditingBatch({ ...editingBatch, batchName: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  readOnly
                />
                <p className="text-xs text-gray-500 mt-1">Batch name cannot be changed</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Roll Number</label>
                <input
                  type="number"
                  value={editingBatch.fromRollNo}
                  onChange={e => setEditingBatch({ ...editingBatch, fromRollNo: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Roll Number</label>
                <input
                  type="number"
                  value={editingBatch.toRollNo}
                  onChange={e => setEditingBatch({ ...editingBatch, toRollNo: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditBatch}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchManagementPanel;
