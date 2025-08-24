import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { userService, attendanceService } from '../../firebase/firestore';
import { User, AttendanceLog } from '../../types';
import { Upload, Download, Users, Plus, Trash2, Edit, Search, Filter, Calendar, FileText, BarChart3, Eye } from 'lucide-react';

interface StudentData {
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  rollNumber: string;
  year: string;
  sem: string;
  div: string;
  department: string;
}

interface StudentManagementPanelProps {
  user: User;
}

const YEARS = ['1st', '2nd', '3rd', '4th'];
const SEMS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const DIVS = ['A', 'B', 'C', 'D'];
const DEPARTMENTS = ['Computer Science', 'Information Technology', 'Mechanical', 'Electrical', 'Civil'];

const StudentManagementPanel: React.FC<StudentManagementPanelProps> = ({ user }) => {
  const [students, setStudents] = useState<User[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2nd');
  const [selectedSem, setSelectedSem] = useState('3');
  const [selectedDiv, setSelectedDiv] = useState('A');
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'basic' | 'monthly' | 'custom' | 'subject'>('basic');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [exporting, setExporting] = useState(false);
  const [editingStudent, setEditingStudent] = useState<User | null>(null);
  const [detailStudent, setDetailStudent] = useState<User | null>(null);
  // Export filter states
  const [exportYear, setExportYear] = useState(selectedYear);
  const [exportSem, setExportSem] = useState(selectedSem);
  const [exportDiv, setExportDiv] = useState(selectedDiv);
  const [exportSubject, setExportSubject] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const [newStudent, setNewStudent] = useState<Partial<User>>({
    name: '',
    email: '',
    phone: '',
    gender: '',
    rollNumber: '',
    year: '2nd',
    sem: '3',
    div: 'A',
    department: 'Computer Science',
    role: 'student',
    accessLevel: 'basic',
    isActive: true
  });

  useEffect(() => {
    fetchStudents();
  }, [selectedYear, selectedSem, selectedDiv]);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let fetchedStudents = [];
      try {
        const organizedStudents = await userService.getStudentsFromOrganizedCollection(selectedYear, selectedSem, selectedDiv);
        fetchedStudents = organizedStudents;
      } catch (error) {
        // Fallback to regular collection if organized collection doesn't exist
        console.log('Organized collection not found, using regular collection');
        const allStudents = await userService.getAllUsers();
        fetchedStudents = allStudents.filter(student =>
          student.year === selectedYear &&
          student.sem === selectedSem &&
          student.div === selectedDiv
        );
        // If no students match, show all students for the department
        if (fetchedStudents.length === 0) {
          fetchedStudents = allStudents.filter(student =>
            student.department === user.department
          );
        }
      }
      // Always filter to only students
      setStudents(fetchedStudents.filter(s => s.role === 'student'));
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    const filtered = students.filter(student =>
      student.role === 'student' &&
      (
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.rollNumber && student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    );
    setFilteredStudents(filtered);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] } }) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const data = await readExcelFile(file);
      await importStudents(data);
      setShowImportModal(false);
      fetchStudents();
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error('Error importing students:', error);
      alert(error.message || 'Error importing students. Please check the file format.');
    } finally {
      setUploading(false);
    }
  };

  const readExcelFile = (file: File): Promise<StudentData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (file.name.endsWith('.csv')) {
            // Parse CSV
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter(Boolean);
            const headers = lines[0].split(',').map(h => h.trim());
            const students: StudentData[] = lines.slice(1).map(line => {
              const values = line.split(',');
              const row: any = {};
              headers.forEach((h, i) => { row[h] = values[i] || ''; });
              return {
                name: row.name || row.Name || row.NAME || '',
                email: row.email || row.Email || row.EMAIL || '',
                phone: row.phone || row.Phone || row.PHONE || '',
                gender: row.gender || row.Gender || row.GENDER || '',
                rollNumber: row.rollNumber || row.roll || row.RollNumber || row.roll_number || '',
                year: row.year || row.Year || row.YEAR || '2nd',
                sem: row.sem || row.Sem || row.SEM || '3',
                div: row.div || row.Div || row.DIV || 'A',
                department: row.department || row.Department || row.DEPARTMENT || 'Computer Science'
              };
            });
            // Check required columns
            const missing = students.find(s => !s.name || !s.email || !s.rollNumber);
            if (missing) {
              reject(new Error('Missing required columns (name, email, rollNumber) in one or more rows.'));
              return;
            }
            resolve(students);
          } else {
            // Excel
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          const students: StudentData[] = jsonData.map((row: any) => ({
            name: row.name || row.Name || row.NAME || '',
            email: row.email || row.Email || row.EMAIL || '',
            phone: row.phone || row.Phone || row.PHONE || '',
            gender: row.gender || row.Gender || row.GENDER || '',
            rollNumber: row.rollNumber || row.roll || row.RollNumber || row.roll_number || '',
            year: row.year || row.Year || row.YEAR || '2nd',
            sem: row.sem || row.Sem || row.SEM || '3',
            div: row.div || row.Div || row.DIV || 'A',
            department: row.department || row.Department || row.DEPARTMENT || 'Computer Science'
          }));
            // Check required columns
            const missing = students.find(s => !s.name || !s.email || !s.rollNumber);
            if (missing) {
              reject(new Error('Missing required columns (name, email, rollNumber) in one or more rows.'));
              return;
            }
          resolve(students);
          }
        } catch (error) {
          console.error('Error parsing file:', error, 'File type:', file.type, 'File name:', file.name);
          reject(new Error('Failed to parse file. Please check the format and required columns.'));
        }
      };
      reader.onerror = reject;
      if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Unsupported file format. Please upload .xlsx, .xls, or .csv file.'));
      }
    });
  };

  const importStudents = async (studentsData: StudentData[]) => {
    const batch = [];
    setUploadProgress(0);
    for (let i = 0; i < studentsData.length; i++) {
      const studentData = studentsData[i];
      if (!studentData.name || !studentData.email || !studentData.rollNumber) {
        setUploadProgress(Math.round(((i + 1) / studentsData.length) * 100));
        continue;
      }
      const safeRollNumber = String(studentData.rollNumber || '');
      if (safeRollNumber.includes('/')) {
        setUploadProgress(Math.round(((i + 1) / studentsData.length) * 100));
        continue;
      }
      const student: User = {
        id: `student_${safeRollNumber}_${Date.now()}_${Math.random()}`,
        name: studentData.name,
        email: studentData.email,
        phone: studentData.phone || '',
        gender: studentData.gender || '',
        rollNumber: safeRollNumber,
        year: studentData.year,
        sem: studentData.sem,
        div: studentData.div,
        department: studentData.department,
        role: 'student',
        accessLevel: 'basic',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: '',
        loginCount: 0
      };
      batch.push(userService.createUser(student));
      batch.push(userService.createOrganizedStudentCollection(student));
      setUploadProgress(Math.round(((i + 1) / studentsData.length) * 100));
    }
    await Promise.all(batch);
    setUploadProgress(100);
  };

  const addStudent = async () => {
    if (!newStudent.name || !newStudent.email || !newStudent.rollNumber) {
      alert('Please fill in all required fields');
      return;
    }

    const safeRollNumber = String(newStudent.rollNumber || '');
    if (safeRollNumber.includes('/')) {
      alert('Roll Number cannot contain slashes');
      return;
    }

    try {
      const student: User = {
        id: `student_${safeRollNumber}_${Date.now()}_${Math.random()}`,
        name: newStudent.name!,
        email: newStudent.email!,
        phone: newStudent.phone || '',
        gender: newStudent.gender || '',
        rollNumber: safeRollNumber,
        year: newStudent.year!,
        sem: newStudent.sem!,
        div: newStudent.div!,
        department: newStudent.department!,
        role: 'student',
        accessLevel: 'basic',
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: '',
        loginCount: 0
      };

      // Create in both regular users collection and organized collection
      await userService.createUser(student);
      await userService.createOrganizedStudentCollection(student);
      
      setShowAddModal(false);
      setNewStudent({
        name: '',
        email: '',
        phone: '',
        gender: '',
        rollNumber: '',
        year: '2nd',
        sem: '3',
        div: 'A',
        department: 'Computer Science',
        role: 'student',
        accessLevel: 'basic',
        isActive: true
      });
      fetchStudents();
    } catch (error) {
      console.error('Error adding student:', error);
      alert('Error adding student');
    }
  };

  const updateStudent = async () => {
    if (!editingStudent) return;

    try {
      await userService.updateUser(editingStudent.id, editingStudent);
      setEditingStudent(null);
      fetchStudents();
    } catch (error) {
      console.error('Error updating student:', error);
      alert('Error updating student');
    }
  };

  const deleteStudent = async (studentId: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;

    try {
      await userService.deleteUser(studentId);
      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Error deleting student');
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        name: 'John Doe',
        email: 'john.doe@dypsn.edu',
        phone: '+91 90000 00001',
        gender: 'Male',
        rollNumber: 'CS001',
        year: '2nd',
        sem: '3',
        div: 'A',
        department: 'Computer Science'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'student_import_template.xlsx');
  };

  const exportStudents = () => {
    // Filter students for export based on exportYear, exportSem, exportDiv
    const exportData = students
      .filter(s => s.role === 'student' && s.year === exportYear && s.sem === exportSem && s.div === exportDiv)
      .map(student => ({
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      gender: student.gender || '',
      rollNumber: student.rollNumber || '',
      year: student.year || '',
      sem: student.sem || '',
      div: student.div || '',
      department: student.department || '',
      status: student.isActive ? 'Active' : 'Inactive'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `students_${exportYear}_${exportSem}_${exportDiv}.xlsx`);
  };

  const exportStudentsWithAttendance = async (type: 'monthly' | 'custom' | 'subject') => {
    setExporting(true);
    try {
      let startDateObj: Date;
      let endDateObj: Date;
      let fileName: string;
      let subject = exportSubject;
      switch (type) {
        case 'monthly':
          const [year, month] = selectedMonth.split('-');
          startDateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
          endDateObj = new Date(parseInt(year), parseInt(month), 0);
          fileName = `student_attendance_${selectedMonth}_${exportYear}_${exportSem}_${exportDiv}.xlsx`;
          break;
        case 'custom':
          if (!startDate || !endDate) {
            alert('Please select both start and end dates');
            return;
          }
          startDateObj = new Date(startDate);
          endDateObj = new Date(endDate);
          fileName = `student_attendance_${startDate}_to_${endDate}_${exportYear}_${exportSem}_${exportDiv}.xlsx`;
          break;
        case 'subject':
          if (!subject) {
            alert('Please select a subject');
            return;
          }
          startDateObj = new Date(new Date().getFullYear(), 0, 1); // Start of current year
          endDateObj = new Date();
          fileName = `student_attendance_${subject}_${exportYear}_${exportSem}_${exportDiv}.xlsx`;
          break;
        default:
          return;
      }

      // Filter students for export based on exportYear, exportSem, exportDiv
      const exportStudents = students.filter(s => s.role === 'student' && s.year === exportYear && s.sem === exportSem && s.div === exportDiv);
      const attendanceData: any[] = [];
      for (const student of exportStudents) {
        try {
          let studentAttendance: AttendanceLog[] = [];
          if (type === 'subject') {
            const allAttendance = await attendanceService.getAttendanceByUserAndDateRange(
              student.id,
              startDateObj,
              endDateObj
            );
            studentAttendance = allAttendance.filter(att => att.subject === subject);
          } else {
            studentAttendance = await attendanceService.getAttendanceByUserAndDateRange(
              student.id,
              startDateObj,
              endDateObj
            );
          }
          const totalDays = studentAttendance.length;
          const presentDays = studentAttendance.filter(att => att.status === 'present').length;
          const absentDays = studentAttendance.filter(att => att.status === 'absent').length;
          const lateDays = studentAttendance.filter(att => att.status === 'late').length;
          const leaveDays = studentAttendance.filter(att => att.status === 'leave').length;
          const attendancePercentage = totalDays > 0 ? ((presentDays + lateDays) / totalDays * 100).toFixed(2) : '0';
          attendanceData.push({
            name: student.name,
            email: student.email,
            rollNumber: student.rollNumber || '',
            phone: student.phone || '',
            gender: student.gender || '',
            year: student.year || '',
            sem: student.sem || '',
            div: student.div || '',
            department: student.department || '',
            totalDays,
            presentDays,
            absentDays,
            lateDays,
            leaveDays,
            attendancePercentage: `${attendancePercentage}%`,
            status: student.isActive ? 'Active' : 'Inactive'
          });
        } catch (error) {
          attendanceData.push({
            name: student.name,
            email: student.email,
            rollNumber: student.rollNumber || '',
            phone: student.phone || '',
            gender: student.gender || '',
            year: student.year || '',
            sem: student.sem || '',
            div: student.div || '',
            department: student.department || '',
            totalDays: 0,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            leaveDays: 0,
            attendancePercentage: '0%',
            status: student.isActive ? 'Active' : 'Inactive'
          });
        }
      }
      const ws = XLSX.utils.json_to_sheet(attendanceData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Student Attendance');
      XLSX.writeFile(wb, fileName);
      setShowExportModal(false);
    } catch (error) {
      alert('Error exporting attendance data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleExport = () => {
    if (exportType === 'basic') {
      exportStudents();
    } else {
      exportStudentsWithAttendance(exportType);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
          <p className="text-gray-600">Manage students by year, semester, and division</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-blue-700 touch-manipulation active:scale-95 transition-transform"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">Import Excel</span>
            <span className="sm:hidden">Import</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-green-700 touch-manipulation active:scale-95 transition-transform"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Student</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
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
            onChange={(e) => setSelectedSem(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
          >
            {SEMS.map(sem => (
              <option key={sem} value={sem}>{sem}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
          <select
            value={selectedDiv}
            onChange={(e) => setSelectedDiv(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
          >
            {DIVS.map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 pl-10 touch-manipulation"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-700 touch-manipulation active:scale-95 transition-transform"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Template</span>
            <span className="sm:hidden">Template</span>
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-purple-700 touch-manipulation active:scale-95 transition-transform"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export Data</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </div>

      {/* Students List - Mobile (cards) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center text-gray-500 py-6">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center text-gray-500 py-6">No students found</div>
        ) : (
          filteredStudents.map((student) => (
            <div key={student.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-mobile">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-semibold text-blue-600">
                    {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <div className="ml-3 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{student.name}</div>
                  <div className="text-sm text-gray-600 truncate">{student.email}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">Roll No.</div>
                  <div className="text-gray-900 font-medium">{student.rollNumber}</div>
                </div>
                <div>
                  <div className="text-gray-500">Contact</div>
                  <div className="text-gray-900 font-medium">{student.phone || '-'}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                  student.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {student.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDetailStudent(student)}
                    className="text-blue-600 hover:text-blue-800"
                    aria-label="View details"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => setEditingStudent(student)}
                    className="text-green-600 hover:text-green-800"
                    aria-label="Edit student"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => deleteStudent(student.id)}
                    className="text-red-600 hover:text-red-800"
                    aria-label="Delete student"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Students Table - Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll Number</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading students...</td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">No students found</td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
                <tr
                  key={student.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setDetailStudent(student)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{student.name}</div>
                        <div className="text-sm text-gray-500">{student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {student.rollNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {student.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      student.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {student.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); setEditingStudent(student); }}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteStudent(student.id); }}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
            {/* Close (X) button */}
            <button
              onClick={() => setShowImportModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none z-10"
              aria-label="Close"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold mb-4 sticky top-0 bg-white pb-2">Import Students from Excel</h3>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2 items-center">
                <label className="block text-sm font-medium text-gray-700 mb-2 sm:mb-0 w-full sm:w-auto">
                  <span className="mr-2">Select Excel File</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={e => { setImportFile(e.target.files?.[0] || null); }}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                    style={{ maxWidth: 220 }}
                  />
                </label>
                <button
                  onClick={async () => { if (importFile) await handleFileUpload({ target: { files: [importFile] } }); }}
                  className="flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-green-700 whitespace-nowrap disabled:opacity-50 touch-manipulation active:scale-95 transition-transform w-full sm:w-auto"
                  disabled={!importFile || uploading}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-blue-700 whitespace-nowrap touch-manipulation active:scale-95 transition-transform w-full sm:w-auto"
                >
                  Download Template
                </button>
              </div>
              {uploading && (
                <div className="w-full mt-2">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-2 bg-green-500" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                  <div className="text-xs text-gray-700 mt-1 text-center">Uploading... {uploadProgress}% complete</div>
                </div>
              )}
              <div className="text-sm text-gray-600">
                <p><span className="font-semibold">Required columns:</span> name, email, rollNumber</p>
                <p><span className="font-semibold">Optional columns:</span> phone, gender, year, sem, div, department</p>
              </div>
              <div className="flex justify-between items-center mt-2 sticky bottom-0 bg-white pt-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-500 hover:underline bg-transparent px-2 py-1 rounded touch-manipulation active:scale-95 transition-transform"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 sticky top-0 bg-white pb-2">Add New Student</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  placeholder="Email Address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number *</label>
                <input
                  type="text"
                  value={newStudent.rollNumber}
                  onChange={(e) => setNewStudent({...newStudent, rollNumber: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  placeholder="Roll Number"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({...newStudent, phone: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                    placeholder="Phone Number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={newStudent.gender}
                    onChange={(e) => setNewStudent({...newStudent, gender: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={newStudent.year}
                    onChange={(e) => setNewStudent({...newStudent, year: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select
                    value={newStudent.sem}
                    onChange={(e) => setNewStudent({...newStudent, sem: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    {SEMS.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                  <select
                    value={newStudent.div}
                    onChange={(e) => setNewStudent({...newStudent, div: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    {DIVS.map(div => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sticky bottom-0 bg-white pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-400 touch-manipulation active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={addStudent}
                  className="flex-1 bg-green-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-green-700 touch-manipulation active:scale-95 transition-transform"
                >
                  Add Student
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 sticky top-0 bg-white pb-2">Edit Student</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editingStudent.email}
                  onChange={(e) => setEditingStudent({...editingStudent, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                <input
                  type="text"
                  value={editingStudent.rollNumber}
                  onChange={(e) => setEditingStudent({...editingStudent, rollNumber: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editingStudent.phone}
                    onChange={(e) => setEditingStudent({...editingStudent, phone: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={editingStudent.gender}
                    onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={editingStudent.year}
                    onChange={(e) => setEditingStudent({...editingStudent, year: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select
                    value={editingStudent.sem}
                    onChange={(e) => setEditingStudent({...editingStudent, sem: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    {SEMS.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                  <select
                    value={editingStudent.div}
                    onChange={(e) => setEditingStudent({...editingStudent, div: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    {DIVS.map(div => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sticky bottom-0 bg-white pt-2">
                <button
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-400 touch-manipulation active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={updateStudent}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-blue-700 touch-manipulation active:scale-95 transition-transform"
                >
                  Update Student
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 sticky top-0 bg-white pb-2">Export Student Data</h3>
            <div className="space-y-4">
              {/* Always show Year, Semester, Division dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={exportYear}
                    onChange={e => setExportYear(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select
                    value={exportSem}
                    onChange={e => setExportSem(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    {SEMS.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                  <select
                    value={exportDiv}
                    onChange={e => setExportDiv(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    {DIVS.map(div => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Export Type and other filters remain below */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Export Type</label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value as any)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                >
                  <option value="basic">Basic Student List</option>
                  <option value="monthly">Monthly Attendance Report</option>
                  <option value="custom">Custom Date Range Report</option>
                  <option value="subject">Subject-wise Attendance Report</option>
                </select>
              </div>
              {exportType === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  />
                </div>
              )}
              {exportType === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                    />
                  </div>
                </div>
              )}
              {exportType === 'subject' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
                  >
                    <option value="">Select a subject</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="English">English</option>
                    <option value="Engineering Drawing">Engineering Drawing</option>
                    <option value="Programming">Programming</option>
                    <option value="Data Structures">Data Structures</option>
                    <option value="Database Management">Database Management</option>
                    <option value="Web Development">Web Development</option>
                    <option value="Software Engineering">Software Engineering</option>
                  </select>
                </div>
              )}
              <div className="text-sm text-gray-600">
                {exportType === 'basic' && (
                  <p>Export basic student information including contact details and academic info.</p>
                )}
                {exportType === 'monthly' && (
                  <p>Export student attendance data for the selected month with attendance statistics.</p>
                )}
                {exportType === 'custom' && (
                  <p>Export student attendance data for the custom date range with attendance statistics.</p>
                )}
                {exportType === 'subject' && (
                  <p>Export student attendance data for the selected subject for the current academic year.</p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sticky bottom-0 bg-white pt-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-400 touch-manipulation active:scale-95 transition-transform"
                  disabled={exporting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex-1 bg-purple-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 touch-manipulation active:scale-95 transition-transform"
                >
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 sticky top-0 bg-white pb-2">Student Details</h3>
            <div className="space-y-2">
              <div><strong>Name:</strong> {detailStudent.name}</div>
              <div><strong>Email:</strong> {detailStudent.email}</div>
              <div><strong>Roll Number:</strong> {detailStudent.rollNumber}</div>
              <div><strong>Phone:</strong> {detailStudent.phone || '-'}</div>
              <div><strong>Gender:</strong> {detailStudent.gender || '-'}</div>
              <div><strong>Year:</strong> {detailStudent.year}</div>
              <div><strong>Semester:</strong> {detailStudent.sem}</div>
              <div><strong>Division:</strong> {detailStudent.div}</div>
              <div><strong>Department:</strong> {detailStudent.department}</div>
              <div><strong>Status:</strong> {detailStudent.isActive ? 'Active' : 'Inactive'}</div>
              <div><strong>Created At:</strong> {detailStudent.createdAt ? new Date(detailStudent.createdAt).toLocaleString() : '-'}</div>
              {/* Add more fields as needed */}
            </div>
            <div className="flex justify-end mt-4 sticky bottom-0 bg-white pt-2">
              <button
                onClick={() => setDetailStudent(null)}
                className="bg-gray-300 text-gray-700 px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-400 touch-manipulation active:scale-95 transition-transform"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentManagementPanel; 