import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  User, 
  Mail, 
  Phone, 
  GraduationCap, 
  BookOpen, 
  Calendar,
  Award,
  MapPin,
  Save,
  X,
  Clock,
  DollarSign,
  Heart,
  AlertCircle,
  Download,
  Upload
} from 'lucide-react';
import { userService } from '../../firebase/firestore';
import * as XLSX from 'xlsx';
import { User as UserType } from '../../types';

interface TeacherFormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  qualification: string;
  specialization: string;
  experience: string;
  joiningDate: string;
  salary: string;
  address: string;
  emergencyContact: string;
  bloodGroup: string;
  dateOfBirth: string;
  gender: string;
  isActive: boolean;
}

const TeacherManagementPanel: React.FC = () => {
  const [teachers, setTeachers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<UserType | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterDesignation, setFilterDesignation] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<UserType | null>(null);
  
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<UserType | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const [formData, setFormData] = useState<TeacherFormData>({
    name: '',
    email: '',
    phone: '',
    department: 'CSE',
    designation: 'Assistant Professor',
    qualification: '',
    specialization: '',
    experience: '',
    joiningDate: '',
    salary: '',
    address: '',
    emergencyContact: '',
    bloodGroup: '',
    dateOfBirth: '',
    gender: 'Male',
    isActive: true
  });

  const departments = ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'AI&ML', 'Data Science'];
  const designations = [
    'Assistant Professor',
    'Associate Professor', 
    'Professor',
    'Head of Department',
    'Dean',
    'Lecturer',
    'Senior Lecturer'
  ];
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  const genders = ['Male', 'Female', 'Other'];

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      setLoading(true);
      const teacherUsers = await userService.getAllTeachers();
      setTeachers(teacherUsers);
    } catch (error) {
      console.error('Error loading teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const teacherData: Partial<UserType> = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: 'teacher',
        department: formData.department,
        designation: formData.designation,
        accessLevel: 'approver',
        isActive: formData.isActive,
        // Additional teacher-specific fields
        qualification: formData.qualification,
        specialization: formData.specialization,
        experience: formData.experience,
        joiningDate: formData.joiningDate,
        salary: formData.salary,
        address: formData.address,
        emergencyContact: formData.emergencyContact,
        bloodGroup: formData.bloodGroup,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        loginCount: 0
      };

      if (editingTeacher) {
        await userService.updateTeacher(editingTeacher.id, teacherData);
        console.log('Teacher updated successfully');
      } else {
        const newTeacherId = `teacher_${Date.now()}`;
        await userService.createTeacher({
          ...teacherData,
          id: newTeacherId
        } as UserType);
        console.log('Teacher created successfully');
      }

      setShowForm(false);
      setEditingTeacher(null);
      resetForm();
      loadTeachers();
    } catch (error) {
      console.error('Error saving teacher:', error);
    }
  };

  const handleEdit = (teacher: UserType) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      department: teacher.department || 'CSE',
      designation: teacher.designation || 'Assistant Professor',
      qualification: teacher.qualification || '',
      specialization: teacher.specialization || '',
      experience: teacher.experience || '',
      joiningDate: teacher.joiningDate || '',
      salary: teacher.salary || '',
      address: teacher.address || '',
      emergencyContact: teacher.emergencyContact || '',
      bloodGroup: teacher.bloodGroup || '',
      dateOfBirth: teacher.dateOfBirth || '',
      gender: teacher.gender || 'Male',
      isActive: teacher.isActive ?? true
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!teacherToDelete) return;
    
    try {
      await userService.deleteTeacher(teacherToDelete.id);
      console.log('Teacher deleted successfully');
      setShowDeleteModal(false);
      setTeacherToDelete(null);
      loadTeachers();
    } catch (error) {
      console.error('Error deleting teacher:', error);
    }
  };

  const handleViewDetails = (teacher: UserType) => {
    setSelectedTeacher(teacher);
    setShowDetailModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      department: 'CSE',
      designation: 'Assistant Professor',
      qualification: '',
      specialization: '',
      experience: '',
      joiningDate: '',
      salary: '',
      address: '',
      emergencyContact: '',
      bloodGroup: '',
      dateOfBirth: '',
      gender: 'Male',
      isActive: true
    });
  };

  const downloadTemplate = () => {
    // Create a more structured CSV with proper formatting
    const headers = [
      'Name',
      'Email', 
      'Phone',
      'Department',
      'Designation',
      'Qualification',
      'Specialization',
      'Experience (Years)',
      'Joining Date (YYYY-MM-DD)',
      'Address',
      'Emergency Contact',
      'Blood Group',
      'Date of Birth (YYYY-MM-DD)',
      'Gender',
      'Is Active (true/false)'
    ];
    
    const sampleData = [
      {
        name: 'Dr. Aakash Patil',
        email: 'aakash.patil@college.edu',
        phone: '+91 9876543210',
        department: 'CSE',
        designation: 'Assistant Professor',
        qualification: 'Ph.D.',
        specialization: 'Machine Learning',
        experience: '6',
        joiningDate: '2020-07-01',
        address: 'Pune, Maharashtra',
        emergencyContact: '+91 9123456780',
        bloodGroup: 'O+',
        dateOfBirth: '1985-05-12',
        gender: 'Male',
        isActive: 'true'
      },
      {
        name: 'Prof. Neha Shah',
        email: 'neha.shah@college.edu',
        phone: '+91 9988776655',
        department: 'CSE',
        designation: 'Associate Professor',
        qualification: 'M.Tech',
        specialization: 'Database Systems',
        experience: '10',
        joiningDate: '2016-08-15',
        address: 'Mumbai, Maharashtra',
        emergencyContact: '+91 9876501234',
        bloodGroup: 'AB+',
        dateOfBirth: '1982-03-22',
        gender: 'Female',
        isActive: 'true'
      },
      {
        name: 'Dr. Rajesh Kumar',
        email: 'rajesh.kumar@college.edu',
        phone: '+91 9876543211',
        department: 'CSE',
        designation: 'Professor',
        qualification: 'Ph.D.',
        specialization: 'Artificial Intelligence',
        experience: '15',
        joiningDate: '2010-06-01',
        address: 'Delhi, India',
        emergencyContact: '+91 9123456781',
        bloodGroup: 'B+',
        dateOfBirth: '1978-12-15',
        gender: 'Male',
        isActive: 'true'
      }
    ];

    // Convert to CSV format with proper escaping
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => [
        `"${row.name}"`,
        `"${row.email}"`,
        `"${row.phone}"`,
        `"${row.department}"`,
        `"${row.designation}"`,
        `"${row.qualification}"`,
        `"${row.specialization}"`,
        `"${row.experience}"`,
        `"${row.joiningDate}"`,
        `"${row.address}"`,
        `"${row.emergencyContact}"`,
        `"${row.bloodGroup}"`,
        `"${row.dateOfBirth}"`,
        `"${row.gender}"`,
        `"${row.isActive}"`
      ].join(','))
    ].join('\n');

    // Add BOM for proper Excel encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teacher_import_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadExcelTemplate = () => {
    console.log('Downloading Excel template...');
    // Create Excel template with proper formatting
    const headers = [
      'Name',
      'Email', 
      'Phone',
      'Department',
      'Designation',
      'Qualification',
      'Specialization',
      'Experience (Years)',
      'Joining Date (YYYY-MM-DD)',
      'Address',
      'Emergency Contact',
      'Blood Group',
      'Date of Birth (YYYY-MM-DD)',
      'Gender',
      'Is Active (true/false)'
    ];
    
    const sampleData = [
      {
        name: 'Dr. Aakash Patil',
        email: 'aakash.patil@college.edu',
        phone: '+91 9876543210',
        department: 'CSE',
        designation: 'Assistant Professor',
        qualification: 'Ph.D.',
        specialization: 'Machine Learning',
        experience: '6',
        joiningDate: '2020-07-01',
        address: 'Pune, Maharashtra',
        emergencyContact: '+91 9123456780',
        bloodGroup: 'O+',
        dateOfBirth: '1985-05-12',
        gender: 'Male',
        isActive: 'true'
      },
      {
        name: 'Prof. Neha Shah',
        email: 'neha.shah@college.edu',
        phone: '+91 9988776655',
        department: 'CSE',
        designation: 'Associate Professor',
        qualification: 'M.Tech',
        specialization: 'Database Systems',
        experience: '10',
        joiningDate: '2016-08-15',
        address: 'Mumbai, Maharashtra',
        emergencyContact: '+91 9876501234',
        bloodGroup: 'AB+',
        dateOfBirth: '1982-03-22',
        gender: 'Female',
        isActive: 'true'
      },
      {
        name: 'Dr. Rajesh Kumar',
        email: 'rajesh.kumar@college.edu',
        phone: '+91 9876543211',
        department: 'CSE',
        designation: 'Professor',
        qualification: 'Ph.D.',
        specialization: 'Artificial Intelligence',
        experience: '15',
        joiningDate: '2010-06-01',
        address: 'Delhi, India',
        emergencyContact: '+91 9123456781',
        bloodGroup: 'B+',
        dateOfBirth: '1978-12-15',
        gender: 'Male',
        isActive: 'true'
      }
    ];

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    
    // Set column widths for better readability
    const columnWidths = [
      { wch: 25 }, // Name
      { wch: 30 }, // Email
      { wch: 18 }, // Phone
      { wch: 12 }, // Department
      { wch: 20 }, // Designation
      { wch: 15 }, // Qualification
      { wch: 20 }, // Specialization
      { wch: 18 }, // Experience
      { wch: 20 }, // Joining Date
      { wch: 25 }, // Address
      { wch: 18 }, // Emergency Contact
      { wch: 12 }, // Blood Group
      { wch: 20 }, // Date of Birth
      { wch: 10 }, // Gender
      { wch: 15 }  // Is Active
    ];
    worksheet['!cols'] = columnWidths;

    // Add the worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Teacher Template');
    
    // Generate and download the file
    XLSX.writeFile(workbook, 'teacher_import_template.xlsx');
  };

  const handleImportTeachers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsImporting(true);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

      // Handle both old and new CSV formats with flexible header mapping
      const headerMapping: { [key: string]: string } = {
        'name': 'name',
        'Name': 'name',
        'email': 'email',
        'Email': 'email',
        'phone': 'phone',
        'Phone': 'phone',
        'department': 'department',
        'Department': 'department',
        'designation': 'designation',
        'Designation': 'designation',
        'qualification': 'qualification',
        'Qualification': 'qualification',
        'specialization': 'specialization',
        'Specialization': 'specialization',
        'experience': 'experience',
        'Experience (Years)': 'experience',
        'joiningDate': 'joiningDate',
        'Joining Date (YYYY-MM-DD)': 'joiningDate',
        'address': 'address',
        'Address': 'address',
        'emergencyContact': 'emergencyContact',
        'Emergency Contact': 'emergencyContact',
        'bloodGroup': 'bloodGroup',
        'Blood Group': 'bloodGroup',
        'dateOfBirth': 'dateOfBirth',
        'Date of Birth (YYYY-MM-DD)': 'dateOfBirth',
        'gender': 'gender',
        'Gender': 'gender',
        'isActive': 'isActive',
        'Is Active (true/false)': 'isActive'
      };

      const teachers: UserType[] = rows.map((row: any, idx: number) => {
        const id = (row.id || row.email || `teacher_${Date.now()}_${idx}`).toString();
        
        // Map values using the header mapping
        const getValue = (key: string) => {
          for (const [header, mappedKey] of Object.entries(headerMapping)) {
            if (header === mappedKey) {
              return row[key] || '';
            }
          }
          // Try direct mapping first
          if (row[key] !== undefined) return row[key];
          // Try case-insensitive mapping
          const lowerKey = key.toLowerCase();
          for (const [header, mappedKey] of Object.entries(headerMapping)) {
            if (header.toLowerCase() === lowerKey) {
              return row[header] || '';
            }
          }
          return '';
        };

        return {
          id,
          name: getValue('name') || '',
          email: getValue('email') || '',
          phone: getValue('phone')?.toString?.() || '',
          role: 'teacher',
          department: getValue('department') || 'CSE',
          accessLevel: 'approver',
          isActive: String(getValue('isActive') || 'true').toLowerCase() !== 'false',
          designation: getValue('designation') || 'Assistant Professor',
          qualification: getValue('qualification') || '',
          specialization: getValue('specialization') || '',
          experience: getValue('experience')?.toString?.() || '',
          joiningDate: getValue('joiningDate') || '',
          address: getValue('address') || '',
          emergencyContact: getValue('emergencyContact')?.toString?.() || '',
          bloodGroup: getValue('bloodGroup') || '',
          dateOfBirth: getValue('dateOfBirth') || '',
          gender: getValue('gender') || '',
        } as UserType;
      }).filter(t => t.email);

      if (teachers.length === 0) {
        console.warn('No valid teacher rows found in sheet');
        return;
      }

      await userService.bulkImportTeachers(teachers);
      await loadTeachers();
    } catch (err) {
      console.error('Failed to import teachers:', err);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = teacher.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         teacher.phone?.includes(searchTerm);
    const matchesDepartment = !filterDepartment || teacher.department === filterDepartment;
    const matchesDesignation = !filterDesignation || teacher.designation === filterDesignation;
    
    return matchesSearch && matchesDepartment && matchesDesignation;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-mobile border border-gray-200 p-4 lg:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-mobile border border-gray-200 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4 lg:mb-6">
        <div className="mb-4 lg:mb-0">
          <h2 className="text-lg lg:text-2xl font-bold text-gray-900 mb-2">Teacher Management</h2>
          <p className="text-sm lg:text-base text-gray-600">Manage faculty members and their information</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <button
          onClick={() => {
            setShowForm(true);
            setEditingTeacher(null);
            resetForm();
          }}
          className="btn-mobile bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 active:scale-95 w-full lg:w-auto"
        >
          <Plus className="w-5 h-5" />
          Add Teacher
        </button>
                  <button
          onClick={() => downloadExcelTemplate()}
          className="btn-mobile bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg flex items-center gap-2 text-sm"
        >
          <Download className="w-4 h-4" />
          Excel Template
        </button>
          <label className="btn-mobile bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer font-medium">
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportTeachers} disabled={isImporting} />
            <Upload className="w-4 h-4" />
            {isImporting ? 'Importing…' : 'Import Excel'}
          </label>
        </div>
      </div>

      {/* Search and Filters - Mobile Optimized */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-4 mb-4 lg:mb-6">
        <div className="lg:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search teachers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-mobile pl-10 w-full text-sm lg:text-base"
            />
          </div>
        </div>
        <select
          value={filterDepartment}
          onChange={(e) => setFilterDepartment(e.target.value)}
          className="input-mobile text-sm lg:text-base"
        >
          <option value="">All Departments</option>
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        <select
          value={filterDesignation}
          onChange={(e) => setFilterDesignation(e.target.value)}
          className="input-mobile text-sm lg:text-base"
        >
          <option value="">All Designations</option>
          {designations.map(desig => (
            <option key={desig} value={desig}>{desig}</option>
          ))}
        </select>
      </div>

      {/* Teachers Grid - Mobile Optimized */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          {filteredTeachers.map((teacher) => (
            <div 
              key={teacher.id} 
              className="border border-gray-200 rounded-xl p-4 hover:shadow-mobile transition-shadow cursor-pointer active:scale-[0.98]"
              onClick={() => handleViewDetails(teacher)}
            >
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{teacher.name}</h3>
                  <p className="text-sm text-gray-500 truncate">{teacher.designation}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center text-gray-600">
                  <Mail className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{teacher.email}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{teacher.phone}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span className="truncate">{teacher.department}</span>
                </div>
              </div>
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  teacher.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {teacher.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(teacher);
                    }}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTeacherToDelete(teacher);
                      setShowDeleteModal(true);
                    }}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

      {filteredTeachers.length === 0 && (
        <div className="text-center py-12">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No teachers found</h3>
          <p className="text-gray-500">Get started by adding your first teacher.</p>
        </div>
      )}

      {/* Teacher Detail Modal */}
      {showDetailModal && selectedTeacher && (
        <div className="modal-mobile">
          <div className="modal-content-mobile max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-200">
              <h3 className="text-lg lg:text-xl font-semibold text-gray-900">Teacher Details</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 lg:p-6 space-y-6">
              {/* Header with Avatar and Basic Info */}
              <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-gray-900">{selectedTeacher.name}</h2>
                  <p className="text-blue-600 font-medium">{selectedTeacher.designation}</p>
                  <p className="text-gray-600">{selectedTeacher.department} Department</p>
                </div>
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                  selectedTeacher.isActive 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {selectedTeacher.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 flex items-center">
                    <Mail className="w-4 h-4 mr-2 text-blue-600" />
                    Contact Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <Mail className="w-4 h-4 mr-3 text-gray-400" />
                      <span className="truncate">{selectedTeacher.email}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Phone className="w-4 h-4 mr-3 text-gray-400" />
                      <span>{selectedTeacher.phone}</span>
                    </div>
                    {selectedTeacher.emergencyContact && (
                      <div className="flex items-center text-gray-600">
                        <AlertCircle className="w-4 h-4 mr-3 text-gray-400" />
                        <span>Emergency: {selectedTeacher.emergencyContact}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 flex items-center">
                    <User className="w-4 h-4 mr-2 text-blue-600" />
                    Personal Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <User className="w-4 h-4 mr-3 text-gray-400" />
                      <span>Gender: {selectedTeacher.gender || 'Not specified'}</span>
                    </div>
                    {selectedTeacher.dateOfBirth && (
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                        <span>DOB: {new Date(selectedTeacher.dateOfBirth).toLocaleDateString()}</span>
                      </div>
                    )}
                    {selectedTeacher.bloodGroup && (
                      <div className="flex items-center text-gray-600">
                        <Heart className="w-4 h-4 mr-3 text-gray-400" />
                        <span>Blood Group: {selectedTeacher.bloodGroup}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Academic Information */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 flex items-center">
                  <GraduationCap className="w-4 h-4 mr-2 text-blue-600" />
                  Academic Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center text-gray-600">
                      <BookOpen className="w-4 h-4 mr-3 text-gray-400" />
                      <span>Qualification: {selectedTeacher.qualification || 'Not specified'}</span>
                    </div>
                    {selectedTeacher.specialization && (
                      <div className="flex items-center text-gray-600">
                        <Award className="w-4 h-4 mr-3 text-gray-400" />
                        <span>Specialization: {selectedTeacher.specialization}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    {selectedTeacher.experience && (
                      <div className="flex items-center text-gray-600">
                        <Clock className="w-4 h-4 mr-3 text-gray-400" />
                        <span>Experience: {selectedTeacher.experience}</span>
                      </div>
                    )}
                    {selectedTeacher.joiningDate && (
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-4 h-4 mr-3 text-gray-400" />
                        <span>Joined: {new Date(selectedTeacher.joiningDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              {(selectedTeacher.salary || selectedTeacher.address) && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900 flex items-center">
                    <DollarSign className="w-4 h-4 mr-2 text-blue-600" />
                    Employment Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    {selectedTeacher.salary && (
                      <div className="flex items-center text-gray-600">
                        <DollarSign className="w-4 h-4 mr-3 text-gray-400" />
                        <span>Annual Salary: {selectedTeacher.salary}</span>
                      </div>
                    )}
                    {selectedTeacher.address && (
                      <div className="flex items-start text-gray-600">
                        <MapPin className="w-4 h-4 mr-3 text-gray-400 mt-0.5" />
                        <span>Address: {selectedTeacher.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    handleEdit(selectedTeacher);
                  }}
                  className="btn-mobile bg-blue-600 text-white hover:bg-blue-700 flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Teacher
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setTeacherToDelete(selectedTeacher);
                    setShowDeleteModal(true);
                  }}
                  className="btn-mobile bg-red-600 text-white hover:bg-red-700 flex-1"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Teacher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Teacher Form Modal */}
      {showForm && (
        <div className="modal-mobile">
          <div className="modal-content-mobile max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 lg:p-6 border-b border-gray-200">
              <h3 className="text-lg lg:text-xl font-semibold text-gray-900">
                {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
              </h3>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingTeacher(null);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 lg:p-6 space-y-4 lg:space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                <div>
                  <label className="label-mobile">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="input-mobile"
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div>
                  <label className="label-mobile">Email Address *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="input-mobile"
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <div>
                  <label className="label-mobile">Phone Number *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="input-mobile"
                    placeholder="Enter phone number"
                    required
                  />
                </div>
                <div>
                  <label className="label-mobile">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="input-mobile"
                  >
                    {genders.map(gender => (
                      <option key={gender} value={gender}>{gender}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Academic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
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
                  <label className="label-mobile">Designation *</label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({...formData, designation: e.target.value})}
                    className="input-mobile"
                    required
                  >
                    {designations.map(desig => (
                      <option key={desig} value={desig}>{desig}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-mobile">Qualification *</label>
                  <input
                    type="text"
                    value={formData.qualification}
                    onChange={(e) => setFormData({...formData, qualification: e.target.value})}
                    className="input-mobile"
                    placeholder="e.g., Ph.D., M.Tech, B.E."
                    required
                  />
                </div>
                <div>
                  <label className="label-mobile">Specialization</label>
                  <input
                    type="text"
                    value={formData.specialization}
                    onChange={(e) => setFormData({...formData, specialization: e.target.value})}
                    className="input-mobile"
                    placeholder="e.g., Machine Learning, Database Systems"
                  />
                </div>
              </div>

              {/* Experience and Employment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                <div>
                  <label className="label-mobile">Years of Experience</label>
                  <input
                    type="text"
                    value={formData.experience}
                    onChange={(e) => setFormData({...formData, experience: e.target.value})}
                    className="input-mobile"
                    placeholder="e.g., 5 years"
                  />
                </div>
                <div>
                  <label className="label-mobile">Joining Date</label>
                  <input
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({...formData, joiningDate: e.target.value})}
                    className="input-mobile"
                  />
                </div>
                <div>
                  <label className="label-mobile">Salary (Annual)</label>
                  <input
                    type="text"
                    value={formData.salary}
                    onChange={(e) => setFormData({...formData, salary: e.target.value})}
                    className="input-mobile"
                    placeholder="e.g., ₹8,00,000"
                  />
                </div>
                <div>
                  <label className="label-mobile">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                    className="input-mobile"
                  />
                </div>
              </div>

              {/* Additional Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                <div>
                  <label className="label-mobile">Blood Group</label>
                  <select
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({...formData, bloodGroup: e.target.value})}
                    className="input-mobile"
                  >
                    <option value="">Select Blood Group</option>
                    {bloodGroups.map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-mobile">Emergency Contact</label>
                  <input
                    type="tel"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                    className="input-mobile"
                    placeholder="Emergency contact number"
                  />
                </div>
              </div>

              <div>
                <label className="label-mobile">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="input-mobile"
                  rows={3}
                  placeholder="Enter complete address"
                />
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active Teacher
                </label>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTeacher(null);
                    resetForm();
                  }}
                  className="btn-mobile bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-mobile bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingTeacher ? 'Update Teacher' : 'Add Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-mobile">
          <div className="modal-content-mobile max-w-md">
            <div className="p-4 lg:p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Teacher</h3>
                  <p className="text-gray-500">This action cannot be undone.</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6">
                Are you sure you want to delete <strong>{teacherToDelete?.name}</strong>? 
                This will permanently remove their account and all associated data.
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-mobile bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="btn-mobile bg-red-600 text-white hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Teacher
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherManagementPanel;

