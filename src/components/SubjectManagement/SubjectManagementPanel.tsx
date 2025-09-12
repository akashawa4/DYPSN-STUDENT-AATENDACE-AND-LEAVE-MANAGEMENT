import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Save,
  X,
  Download,
  Upload,
  GraduationCap,
} from 'lucide-react';
import { subjectService } from '../../firebase/firestore';
import * as XLSX from 'xlsx';
import { Subject } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { getDepartmentCode } from '../../utils/departmentMapping';
import { getAvailableSemesters, formatYear, isValidSemesterForYear, getDefaultSemesterForYear } from '../../utils/semesterMapping';

interface SubjectFormData {
  subjectCode: string;
  subjectName: string;
  subjectType: 'Theory' | 'Practical' | 'Lab' | 'Project' | 'Seminar' | 'Tutorial';
  department: string;
  year: string;
  sem: string;
}

const SubjectManagementPanel: React.FC = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterYear, setFilterYear] = useState('2'); // Default to Year 2
  const [filterSem, setFilterSem] = useState('3'); // Default to Semester 3
  const [filterDiv, setFilterDiv] = useState('A'); // Default to Division A
  const [availableSemesters, setAvailableSemesters] = useState<string[]>(getAvailableSemesters('2'));
  const [formAvailableSemesters, setFormAvailableSemesters] = useState<string[]>(getAvailableSemesters('2'));
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [formData, setFormData] = useState<SubjectFormData>({
    subjectCode: '',
    subjectName: '',
    subjectType: 'Theory',
    department: 'CSE',
    year: filterYear,
    sem: filterSem
  });

  const departments = ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'AI&ML', 'Data Science'];
  const years = ['1', '2', '3', '4'];
  const divs = ['A', 'B', 'C'];

  // Handle year change to update available semesters
  const handleYearChange = (newYear: string) => {
    setFilterYear(newYear);
    const newAvailableSemesters = getAvailableSemesters(newYear);
    setAvailableSemesters(newAvailableSemesters);
    
    // If current semester is not valid for new year, reset to first available
    if (!isValidSemesterForYear(newYear, filterSem)) {
      const defaultSem = getDefaultSemesterForYear(newYear);
      setFilterSem(defaultSem);
    }
  };
  const subjectTypes = ['Theory', 'Practical', 'Lab', 'Project', 'Seminar', 'Tutorial'];

  useEffect(() => {
    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 10000); // 10 second timeout

    loadData();

    return () => clearTimeout(timeoutId);
  }, [filterYear, filterSem, filterType, filterDiv]);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadingError(null);
      
      // Check if user is authenticated
      if (!user) {
        setSubjects([]);
        setLoading(false);
        setLoadingError('User not authenticated');
        return;
      }
      
      // Load subjects data
      const subjectsData = await loadSubjectsData();
      
      setSubjects(subjectsData);
    } catch (error) {
      setLoadingError(error instanceof Error ? error.message : 'Unknown error occurred');
      // Set empty arrays on error to stop loading
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSubjectsData = async (): Promise<Subject[]> => {
    try {
      let subjectsData: Subject[] = [];
      
      if (user?.role === 'teacher') {
        // For teachers, show all subjects (same as HOD) instead of just assigned ones
        const deptCode = getDepartmentCode(user?.department);
        
        // Use the same logic as HOD to get all subjects
        // Convert filter values to the correct format for the new structure
        const mappedYear = formatYear(filterYear);
        
        subjectsData = await subjectService.getSubjectsByDepartment(
          deptCode,
          mappedYear,
          filterSem
        );
      } else {
        const deptCode = getDepartmentCode(user?.department);
        
        // For HOD, use optimized query with server-side filtering
        // Convert filter values to the correct format for the new structure
        const mappedYear = formatYear(filterYear);
        
        subjectsData = await subjectService.getSubjectsByDepartment(
          deptCode,
          mappedYear,
          filterSem
        );
      }
      
      // Apply type filter (client-side for both roles)
      if (filterType) {
        subjectsData = subjectsData.filter(subject => subject.subjectType === filterType);
      }
      
      return subjectsData;
    } catch (error) {
      return [];
    }
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subjectData: Subject = {
        id: editingSubject?.id || `${formData.subjectCode}_2025_${formData.department}_${formData.sem}_A`,
        subjectCode: formData.subjectCode,
        subjectName: formData.subjectName,
        subjectType: formData.subjectType,
        credits: 3, // Default value
        hoursPerWeek: 3, // Default value
        department: formData.department,
        year: formatYear(formData.year),
        sem: formData.sem,
        div: 'A', // Default division
        batch: '2025', // Default batch
        teacherId: '',
        teacherName: '',
        teacherEmail: '',
        description: '',
        objectives: [],
        prerequisites: [],
        syllabus: '',
        evaluationScheme: {
          internal: 30,
          external: 70,
          total: 100
        },
        isActive: true,
        createdAt: editingSubject?.createdAt || new Date(),
        updatedAt: new Date(),
        createdBy: user?.id || '',
        updatedBy: user?.id || ''
      };

      if (editingSubject) {
        // Map year format for updateSubject
        const mappedYear = formatYear(formData.year);
        
        await subjectService.updateSubject(
          '2025',
          formData.department,
          mappedYear,
          formData.sem,
          editingSubject.id,
          subjectData
        );
      } else {
        await subjectService.createSubject(subjectData);
      }

      setShowForm(false);
      setEditingSubject(null);
      resetForm();
      loadData();
    } catch (error) {
      // Handle error silently
    }
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      subjectCode: subject.subjectCode,
      subjectName: subject.subjectName,
      subjectType: subject.subjectType,
      department: subject.department,
      year: subject.year,
      sem: subject.sem
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!subjectToDelete) return;
    
    try {
      await subjectService.deleteSubject(
        subjectToDelete.batch,
        subjectToDelete.department,
        subjectToDelete.year,
        subjectToDelete.sem,
        subjectToDelete.id
      );
      setShowDeleteModal(false);
      setSubjectToDelete(null);
      loadData();
    } catch (error) {
      // Handle error silently
    }
  };

  const resetForm = () => {
    setFormData({
      subjectCode: '',
      subjectName: '',
      subjectType: 'Theory',
      department: user?.department || 'CSE',
      year: filterYear,
      sem: filterSem
    });
  };


  const downloadTemplate = () => {
    const templateData = [
      {
        'Subject Code': 'CS301',
        'Subject Name': 'Data Structures',
        'Subject Type': 'Theory',
        'Department': 'CSE',
        'Year': '2',
        'Semester': '3'
      },
      {
        'Subject Code': 'CS302',
        'Subject Name': 'Database Management Systems',
        'Subject Type': 'Theory',
        'Department': 'Computer',
        'Year': '2',
        'Semester': '3'
      },
      {
        'Subject Code': 'CS303',
        'Subject Name': 'Computer Networks Lab',
        'Subject Type': 'Lab',
        'Department': 'CSE',
        'Year': '2',
        'Semester': '3'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subjects');
    
    const columnWidths = [
      { wch: 15 }, // Subject Code
      { wch: 30 }, // Subject Name
      { wch: 15 }, // Subject Type
      { wch: 12 }, // Department
      { wch: 8 },  // Year
      { wch: 10 }  // Semester
    ];
    ws['!cols'] = columnWidths;

    XLSX.writeFile(wb, 'subject_import_template.xlsx');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const subjects = jsonData.map((row: any) => {
        const getValue = (key: string) => row[key] || row[key.toLowerCase()] || '';
        
        const dept = getDepartmentCode(String(getValue('Department') || user?.department || 'CSE'));
        const yearVal = formatYear(String(getValue('Year') || filterYear));
        const semVal = String(getValue('Semester') || filterSem);
        const code = String(getValue('Subject Code')).trim();
        const name = String(getValue('Subject Name') || '').trim();
        const type = String(getValue('Subject Type') || 'Theory');
        
        return {
          id: `${code}_2025_${dept}_${semVal}_A`,
          subjectCode: code,
          subjectName: name,
          subjectType: type,
          credits: 3, // Default value
          hoursPerWeek: 3, // Default value
          department: dept,
          year: yearVal,
          sem: semVal,
          div: 'A', // Default division
          batch: '2025', // Default batch
          teacherId: '',
          teacherName: '',
          teacherEmail: '',
          description: '',
          objectives: [],
          prerequisites: [],
          syllabus: '',
          evaluationScheme: {
            internal: 30,
            external: 70,
            total: 100
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: user?.id || '',
          updatedBy: user?.id || ''
        } as Subject;
      }).filter(s => s.subjectCode);

      await subjectService.bulkImportSubjects(subjects);
      loadData();
    } catch (error) {
      // Handle error silently
    } finally {
      setIsImporting(false);
    }
  };

  const exportSubjects = async () => {
    try {
      // Map year format for exportSubjects
      const mappedYear = formatYear(formData.year);
      
      const result = await subjectService.exportSubjects(
        '2025',
        formData.department,
        mappedYear,
        formData.sem
      );
      
      if (result.success && result.data) {
        const ws = XLSX.utils.json_to_sheet(result.data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Subjects');
        XLSX.writeFile(wb, result.filename || 'subjects.xlsx');
      }
    } catch (error) {
      // Handle error silently
    }
  };


  const filteredSubjects = subjects.filter(subject =>
    subject.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.subjectCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.subjectType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subject.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Subject Management</h1>
          <p className="text-gray-600 mt-1">Manage subjects and course curriculum</p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={downloadTemplate}
            className="btn-mobile bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Excel Template</span>
            <span className="sm:hidden">Template</span>
          </button>
          
          <label className="btn-mobile bg-blue-600 hover:bg-blue-700 text-white cursor-pointer flex items-center justify-center gap-2">
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">{isImporting ? 'Importing...' : 'Import Excel'}</span>
            <span className="sm:hidden">{isImporting ? 'Importing...' : 'Import'}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          
          <button
            onClick={exportSubjects}
            className="btn-mobile bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
            <span className="sm:hidden">Export</span>
          </button>
          
          <button
            onClick={() => setShowForm(true)}
            className="btn-mobile bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Subject</span>
            <span className="sm:hidden">Add</span>
          </button>
          
          
        </div>
      </div>


      {/* Filters */}
      <div className="bg-white rounded-lg shadow-mobile p-4 lg:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="label-mobile">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-mobile pl-10"
                placeholder="Search subjects..."
              />
            </div>
          </div>
          
          <div>
            <label className="label-mobile">Year *</label>
            <select
              value={filterYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="input-mobile"
            >
              {years.map(year => (
                <option key={year} value={year}>Year {year}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label-mobile">Semester *</label>
            <select
              value={filterSem}
              onChange={(e) => setFilterSem(e.target.value)}
              className="input-mobile"
            >
              {availableSemesters.map(sem => (
                <option key={sem} value={sem}>Sem {sem}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label-mobile">Division *</label>
            <select
              value={filterDiv}
              onChange={(e) => setFilterDiv(e.target.value)}
              className="input-mobile"
            >
              {divs.map(div => (
                <option key={div} value={div}>Div {div}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="label-mobile">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input-mobile"
            >
              <option value="">All Types</option>
              {subjectTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing subjects for: <span className="font-semibold">Year {filterYear}, Sem {filterSem}, Div {filterDiv}</span>
            {filterType && <span className="ml-2">| Type: <span className="font-semibold">{filterType}</span></span>}
          </div>
          <button
            onClick={() => {
              setFilterYear('2');
              setFilterSem('3');
              setFilterDiv('A');
              setFilterType('');
              setSearchTerm('');
              setAvailableSemesters(getAvailableSemesters('2'));
            }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Subjects Grid */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600">Loading subjects...</p>
          {loadingError && (
            <div className="text-center mt-4">
              <p className="text-red-600 text-sm mb-2">Error: {loadingError}</p>
              <button
                onClick={loadData}
                className="btn-mobile bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="text-center py-12">
          <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No subjects found</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || filterType
              ? `No subjects match your current filters for Year ${filterYear}, Sem ${filterSem}, Div ${filterDiv}. Try adjusting your search criteria.`
              : `No subjects found for Year ${filterYear}, Sem ${filterSem}, Div ${filterDiv}. Get started by adding your first subject or importing from Excel.`
            }
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowForm(true)}
              className="btn-mobile bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Subject
            </button>
            <button
              onClick={downloadTemplate}
              className="btn-mobile bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {filteredSubjects.map((subject) => (
            <div
              key={subject.id}
              className="bg-white rounded-lg shadow-mobile p-4 lg:p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedSubject(subject);
                setShowDetailModal(true);
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                    {subject.subjectType}
                  </span>
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(subject);
                    }}
                    className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSubjectToDelete(subject);
                      setShowDeleteModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <h3 className="font-semibold text-gray-900 mb-1">{subject.subjectName}</h3>
              <p className="text-sm text-gray-600 mb-2">{subject.subjectCode}</p>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center">
                  <GraduationCap className="w-4 h-4 mr-2 text-gray-400" />
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                    {subject.subjectType}
                  </span>
                </div>
                <div className="flex items-center">
                  <GraduationCap className="w-4 h-4 mr-2 text-gray-400" />
                  <span>{subject.department} - Year {subject.year}, Sem {subject.sem}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Subject Form Modal */}
      {showForm && (
        <div className="modal-mobile">
          <div className="modal-content-mobile max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-200">
              <h3 className="text-lg lg:text-xl font-semibold text-gray-900">
                {editingSubject ? 'Edit Subject' : 'Add New Subject'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingSubject(null);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 lg:p-6 space-y-4 lg:space-y-6">
              {/* Essential Fields Only */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                <div>
                  <label className="label-mobile">Subject Code *</label>
                  <input
                    type="text"
                    value={formData.subjectCode}
                    onChange={(e) => setFormData({...formData, subjectCode: e.target.value})}
                    className="input-mobile"
                    placeholder="e.g., CS301"
                    required
                  />
                </div>
                <div>
                  <label className="label-mobile">Subject Name *</label>
                  <input
                    type="text"
                    value={formData.subjectName}
                    onChange={(e) => setFormData({...formData, subjectName: e.target.value})}
                    className="input-mobile"
                    placeholder="e.g., Data Structures"
                    required
                  />
                </div>
                <div>
                  <label className="label-mobile">Subject Type *</label>
                  <select
                    value={formData.subjectType}
                    onChange={(e) => setFormData({...formData, subjectType: e.target.value as any})}
                    className="input-mobile"
                    required
                  >
                    {subjectTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-mobile">Department *</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="input-mobile"
                    required
                  >
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-mobile">Year *</label>
                  <select
                    value={formData.year}
                    onChange={(e) => {
                      const newYear = e.target.value;
                      const newAvailableSemesters = getAvailableSemesters(newYear);
                      const defaultSem = getDefaultSemesterForYear(newYear);
                      setFormAvailableSemesters(newAvailableSemesters);
                      setFormData({
                        ...formData, 
                        year: newYear,
                        sem: isValidSemesterForYear(newYear, formData.sem) ? formData.sem : defaultSem
                      });
                    }}
                    className="input-mobile"
                    required
                  >
                    {years.map(year => (
                      <option key={year} value={year}>Year {year}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-mobile">Semester *</label>
                  <select
                    value={formData.sem}
                    onChange={(e) => setFormData({...formData, sem: e.target.value})}
                    className="input-mobile"
                    required
                  >
                    {formAvailableSemesters.map(sem => (
                      <option key={sem} value={sem}>Sem {sem}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingSubject(null);
                    resetForm();
                  }}
                  className="btn-mobile bg-gray-500 hover:bg-gray-600 text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-mobile bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingSubject ? 'Update Subject' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subject Detail Modal */}
      {showDetailModal && selectedSubject && (
        <div className="modal-mobile">
          <div className="modal-content-mobile max-w-2xl">
            <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-200">
              <h3 className="text-lg lg:text-xl font-semibold text-gray-900">
                Subject Details
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 lg:p-6 space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                  <GraduationCap className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedSubject.subjectName}</h3>
                <p className="text-lg text-gray-600 mb-4">{selectedSubject.subjectCode}</p>
                <div className="inline-flex items-center px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                  {selectedSubject.subjectType}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Academic Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Department:</span>
                        <span className="text-gray-900">{selectedSubject.department}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Year:</span>
                        <span className="text-gray-900">{selectedSubject.year}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Semester:</span>
                        <span className="text-gray-900">{selectedSubject.sem}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">System Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Status:</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          selectedSubject.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedSubject.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-600">Created:</span>
                        <span className="text-gray-900">
                          {selectedSubject.createdAt ? new Date(selectedSubject.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && subjectToDelete && (
        <div className="modal-mobile">
          <div className="modal-content-mobile max-w-md">
            <div className="p-4 lg:p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Subject</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Are you sure you want to delete "{subjectToDelete.subjectName}"? This action cannot be undone.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="btn-mobile bg-gray-500 hover:bg-gray-600 text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="btn-mobile bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectManagementPanel;
