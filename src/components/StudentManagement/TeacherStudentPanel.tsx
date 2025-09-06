import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { userService, attendanceService } from '../../firebase/firestore';
import { User, AttendanceLog } from '../../types';
import { Users, Search, Filter, Download, Eye, Upload, Plus, Edit, Trash2, Calendar, FileText, BarChart3, X } from 'lucide-react';
import { getDepartmentCode } from '../../utils/departmentMapping';

interface TeacherStudentPanelProps {
  user: User;
}

const YEARS = ['1st', '2nd', '3rd', '4th'];
const SEMS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const DIVS = ['A', 'B', 'C', 'D'];

const TeacherStudentPanel: React.FC<TeacherStudentPanelProps> = ({ user }) => {
  const [students, setStudents] = useState<User[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState('2nd');
  const [selectedSem, setSelectedSem] = useState('3');
  const [selectedDiv, setSelectedDiv] = useState('A');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'basic' | 'monthly' | 'custom' | 'subject'>('basic');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Refactor to use rollNumber instead of employeeId ---

  // Update newStudent and editingStudent state to use rollNumber
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

  const [editingStudent, setEditingStudent] = useState<Partial<User>>({
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
      // Use the new batch structure to get students
      const batch = '2025'; // Default batch year
      const department = getDepartmentCode(user.department);
      
      
      const fetchedStudents = await userService.getStudentsByBatchDeptYearSemDiv(
        batch,
        department,
        selectedYear,
        selectedSem,
        selectedDiv
      );
      
      setStudents(fetchedStudents);
    } catch (error) {
      // Handle error silently
      setStudents([]);
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

  // Gender counts (robust normalization: trims and accepts Male/M/F, Female/F)
  const normalizeGender = (value?: string) => {
    const g = String(value || '').trim().toLowerCase();
    if (g === 'male' || g === 'm' || g === 'boy') return 'male';
    if (g === 'female' || g === 'f' || g === 'girl') return 'female';
    return '';
  };
  const maleCount = filteredStudents.filter(s => normalizeGender(s.gender) === 'male').length;
  const femaleCount = filteredStudents.filter(s => normalizeGender(s.gender) === 'female').length;

  const exportStudents = () => {
    const exportData = filteredStudents.filter(s => s.role === 'student').map(student => ({
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

    // Create CSV content
    const headers = ['Name', 'Email', 'Phone', 'Gender', 'Roll Number', 'Year', 'Semester', 'Division', 'Department', 'Status'];
    const csvContent = [
      headers.join(','),
      ...exportData.map(row => [
        row.name,
        row.email,
        row.phone,
        row.gender,
        row.rollNumber,
        row.year,
        row.sem,
        row.div,
        row.department,
        row.status
      ].join(','))
    ].join('\n');

    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students_${selectedYear}_${selectedSem}_${selectedDiv}_${user.department}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportStudentsWithAttendance = async (type: 'monthly' | 'custom' | 'subject') => {
    setExporting(true);
    try {
      let startDateObj: Date;
      let endDateObj: Date;
      let fileName: string;

      switch (type) {
        case 'monthly':
          const [year, month] = selectedMonth.split('-');
          startDateObj = new Date(parseInt(year), parseInt(month) - 1, 1);
          endDateObj = new Date(parseInt(year), parseInt(month), 0);
          fileName = `student_attendance_${selectedMonth}_all_subjects_${selectedYear}_${selectedSem}_${selectedDiv}.csv`;
          break;
        case 'custom':
          if (!startDate || !endDate) {
            alert('Please select both start and end dates');
            return;
          }
          startDateObj = new Date(startDate);
          endDateObj = new Date(endDate);
          fileName = `student_attendance_${startDate}_to_${endDate}_all_subjects_${selectedYear}_${selectedSem}_${selectedDiv}.csv`;
          break;
        case 'subject':
          if (!selectedSubject) {
            alert('Please select a subject');
            return;
          }
          startDateObj = new Date(new Date().getFullYear(), 0, 1); // Start of current year
          endDateObj = new Date();
          fileName = `student_attendance_${selectedSubject}_${selectedYear}_${selectedSem}_${selectedDiv}.csv`;
          break;
        default:
          return;
      }

      // Define all subjects
      const allSubjects = [
        'Mathematics', 'Physics', 'Chemistry', 'Computer Science', 'English', 
        'Engineering Drawing', 'Programming', 'Data Structures', 'Database Management', 
        'Web Development', 'Software Engineering'
      ];

      // Get attendance data for all students using optimized batch function
      const attendanceData: any[] = [];
      const students = filteredStudents.filter(s => s.role === 'student');
      const studentRollNumbers = students.map(s => s.rollNumber || s.id).filter(Boolean);
          
          if (type === 'subject') {
        // For subject-wise export, use the new organized structure
        for (const student of students) {
          try {
            const studentAttendance = await attendanceService.getOrganizedAttendanceByUserAndDateRange(
              student.rollNumber || student.id,
              selectedYear,
              selectedSem,
              selectedDiv,
              selectedSubject,
              startDateObj,
              endDateObj
            );
            
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
              subject: selectedSubject,
            totalDays,
            presentDays,
            absentDays,
            lateDays,
            leaveDays,
            attendancePercentage: `${attendancePercentage}%`,
            status: student.isActive ? 'Active' : 'Inactive'
          });
          } catch (error) {
            // Handle error silently
          }
        }
          } else {
        // For monthly and custom exports, use the optimized batch function
        const allSubjects = [
          'Mathematics', 'Physics', 'Chemistry', 'Computer Science', 'English', 
          'Engineering Drawing', 'Programming', 'Data Structures', 'Database Management', 
          'Web Development', 'Software Engineering'
        ];
        
                      try {
          
          // Calculate total queries for progress tracking
          const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
          const totalQueries = allSubjects.length * daysDiff;
          
          
          // Show progress
          setExporting(true);
          setExportProgress({
            current: 0,
            total: totalQueries,
            message: '🚀 Starting ULTRA-FAST parallel queries...'
          });
          
          // Update progress to show parallel execution
          setTimeout(() => {
            setExportProgress({
              current: Math.floor(totalQueries * 0.3),
              total: totalQueries,
              message: '⚡ Executing all queries in parallel...'
            });
          }, 500);
          
          setTimeout(() => {
            setExportProgress({
              current: Math.floor(totalQueries * 0.7),
              total: totalQueries,
              message: '🔄 Processing results...'
            });
          }, 1000);
          
          // Use the NEW ultra-fast parallel function with progress updates
          const batchAttendance = await attendanceService.getBatchAttendanceForExport(
            selectedYear,
            selectedSem,
            selectedDiv,
            allSubjects,
            startDateObj,
            endDateObj,
            studentRollNumbers,
            (progress) => {
              setExportProgress({
                current: Math.floor(totalQueries * progress),
                total: totalQueries,
                message: `⚡ Ultra-fast export: ${Math.floor(progress * 100)}% complete`
              });
            }
          );
          
          
          // Update progress to show completion
          setExportProgress({
            current: totalQueries,
            total: totalQueries,
            message: '✅ Export completed! Processing data...'
          });
          
          // Process the batch data for each student
          for (const student of students) {
            const rollNumber = student.rollNumber || student.id;
            const studentAttendance: AttendanceLog[] = [];
            
            // Collect all attendance records for this student
            if (batchAttendance[rollNumber]) {
            allSubjects.forEach(subject => {
                if (batchAttendance[rollNumber][subject]) {
                  studentAttendance.push(...batchAttendance[rollNumber][subject]);
                }
              });
            }
            
            // Calculate statistics
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
              subject: 'All Subjects',
              totalDays,
              presentDays,
              absentDays,
              lateDays,
              leaveDays,
              attendancePercentage: `${attendancePercentage}%`,
                status: student.isActive ? 'Active' : 'Inactive'
            });
          }
        } catch (error) {
          // Handle error silently
          
          // Check if it's a limit error
          if (error instanceof Error && error.message.includes('Too many')) {
            alert(`Export limit exceeded: ${error.message}. Please reduce the scope of your export.`);
            setExporting(false);
            return;
          }
          
          // Fallback to parallel individual queries if batch fails
          
          setExportProgress({
            current: 0,
            total: students.length,
            message: '🔄 Processing students in parallel...'
          });
          
          // Create all promises for parallel execution
          const studentPromises = students.map(async (student) => {
            try {
              // Create promises for all subjects for this student
              const subjectPromises = allSubjects.map(async (subject) => {
                try {
                  return await attendanceService.getOrganizedAttendanceByUserAndDateRange(
                    student.rollNumber || student.id,
                    selectedYear,
                    selectedSem,
                    selectedDiv,
                    subject,
                    startDateObj,
                    endDateObj
                  );
                } catch (error) {
                  return [];
                }
              });
              
              // Execute all subject queries in parallel
              const subjectResults = await Promise.all(subjectPromises);
              
              // Combine all attendance records for this student
              const studentAttendance: AttendanceLog[] = [];
              subjectResults.forEach(subjectAttendance => {
                studentAttendance.push(...subjectAttendance);
              });
              
              // Calculate statistics
              const totalDays = studentAttendance.length;
              const presentDays = studentAttendance.filter(att => att.status === 'present').length;
              const absentDays = studentAttendance.filter(att => att.status === 'absent').length;
              const lateDays = studentAttendance.filter(att => att.status === 'late').length;
              const leaveDays = studentAttendance.filter(att => att.status === 'leave').length;
              const attendancePercentage = totalDays > 0 ? ((presentDays + lateDays) / totalDays * 100).toFixed(2) : '0';

              return {
                name: student.name,
                email: student.email,
                rollNumber: student.rollNumber || '',
                phone: student.phone || '',
                gender: student.gender || '',
                year: student.year || '',
                sem: student.sem || '',
                div: student.div || '',
                department: student.department || '',
                subject: 'All Subjects',
                totalDays,
                presentDays,
                absentDays,
                lateDays,
                leaveDays,
                attendancePercentage: `${attendancePercentage}%`,
                status: student.isActive ? 'Active' : 'Inactive'
              };
            } catch (error) {
              // Handle error silently
              return null;
            }
          });
          
          // Execute all student queries in parallel
          const studentResults = await Promise.all(studentPromises);
          
          // Filter out null results and add to attendance data
          studentResults.forEach(result => {
            if (result) {
              attendanceData.push(result);
            }
          });
        }
      }






      // Create CSV content
      const headers = [
        'Name', 'Email', 'Roll Number', 'Phone', 'Gender', 'Year', 'Semester', 'Division', 'Department', 'Subject',
        'Total Days', 'Present Days', 'Absent Days', 'Late Days', 'Leave Days', 'Attendance Percentage', 'Status'
      ];
      
      const csvContent = [
        headers.join(','),
        ...attendanceData.map(row => [
          row.name,
          row.email,
          row.rollNumber,
          row.phone,
          row.gender,
          row.year,
          row.sem,
          row.div,
          row.department,
          row.subject,
          row.totalDays,
          row.presentDays,
          row.absentDays,
          row.lateDays,
          row.leaveDays,
          row.attendancePercentage,
          row.status
        ].join(','))
      ].join('\n');

      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting attendance data:', error);
      alert('Error exporting attendance data. Please try again.');
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  const handleExport = () => {
    if (exportType === 'basic') {
      exportStudents();
    } else {
      exportStudentsWithAttendance(exportType);
    }
  };

  const getAttendanceStatus = (student: User) => {
    // This would be integrated with actual attendance data
    // For now, return a mock status
    const statuses = ['Present', 'Absent', 'Late'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  };

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setUploading(true);
    try {
      const data = await readExcelFile(selectedFile);
      await importStudents(data);
      setShowImportModal(false);
      setSelectedFile(null);
      fetchStudents();
    } catch (error) {
      console.error('Error importing students:', error);
      alert('Error importing students. Please check the file format.');
    } finally {
      setUploading(false);
    }
  };

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          const students = jsonData.map((row: any) => ({
            name: String(row.name || row.Name || row.NAME || ''),
            email: String(row.email || row.Email || row.EMAIL || ''),
            phone: String(row.phone || row.Phone || row.PHONE || ''),
            gender: String(row.gender || row.Gender || row.GENDER || ''),
            rollNumber: String(row.rollNumber || row.roll || row.RollNumber || row.roll_number || ''),
            year: String(row.year || row.Year || row.YEAR || '2nd'),
            sem: String(row.sem || row.Sem || row.SEM || '3'),
            div: String(row.div || row.Div || row.DIV || 'A'),
            department: String(row.department || row.Department || row.DEPARTMENT || user.department)
          }));

          resolve(students);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const importStudents = async (studentsData: any[]) => {
    const batch = [];
    
    for (const studentData of studentsData) {
      if (!studentData.name || !studentData.email || !studentData.rollNumber) {
        continue; // Skip invalid entries
      }
      
      // Ensure rollNumber is a string
      const rollNumber = String(studentData.rollNumber);
      if (rollNumber.includes('/')) {
        continue; // Skip entries with slashes in roll number
      }

      const student: User = {
        id: `student_${rollNumber}_${Date.now()}_${Math.random()}`,
        name: studentData.name,
        email: studentData.email,
        phone: studentData.phone || '',
        gender: studentData.gender || '',
        rollNumber: rollNumber,
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

      // Create student (automatically creates in batch structure)
      batch.push(userService.createUser(student));
    }

    await Promise.all(batch);
  };

  // Update addStudent to use rollNumber and validate
  const addStudent = async () => {
    console.log('DEBUG newStudent:', newStudent);
    if (!newStudent.name || !newStudent.email || !newStudent.rollNumber) {
      alert('Please fill in all required fields');
      return;
    }
    if (newStudent.rollNumber.includes('/')) {
      alert('Roll Number cannot contain slashes');
      return;
    }
    try {
      // Check for duplicate email
      const emailExists = await userService.checkStudentExists(newStudent.email!);
      if (emailExists) {
        alert('A student with this email already exists.');
        return;
      }
      // Check for duplicate roll number
      const rollExists = await userService.checkStudentExistsByRollNumber(newStudent.rollNumber!);
      if (rollExists) {
        alert('A student with this roll number already exists.');
        return;
      }
      const student: User = {
        id: `student_${newStudent.rollNumber}_${Date.now()}_${Math.random()}`,
        name: newStudent.name!,
        email: newStudent.email!,
        phone: newStudent.phone || '',
        gender: newStudent.gender || '',
        rollNumber: newStudent.rollNumber!,
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
      // Create student (automatically creates in batch structure)
      await userService.createUser(student);
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
    } catch (error: any) {
      console.error('Error adding student:', error, error?.message, error?.stack);
      alert('Error adding student: ' + (error?.message || error));
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

  const handleEditStudent = (student: User) => {
    setEditingStudent({
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      gender: student.gender || '',
      rollNumber: student.rollNumber || '',
      year: student.year || '2nd',
      sem: student.sem || '3',
      div: student.div || 'A',
      department: student.department || 'Computer Science',
      role: 'student',
      accessLevel: 'basic',
      isActive: student.isActive
    });
    setShowEditModal(true);
  };

  const updateStudent = async () => {
    if (!editingStudent.name || !editingStudent.email || !editingStudent.rollNumber) {
      alert('Please fill in all required fields');
      return;
    }
    if (editingStudent.rollNumber.includes('/')) {
      alert('Roll Number cannot contain slashes');
      return;
    }
    try {
      const updatedStudent: User = {
        id: editingStudent.id!,
        name: editingStudent.name!,
        email: editingStudent.email!,
        phone: editingStudent.phone || '',
        gender: editingStudent.gender || '',
        rollNumber: editingStudent.rollNumber!,
        year: editingStudent.year!,
        sem: editingStudent.sem!,
        div: editingStudent.div!,
        department: editingStudent.department!,
        role: 'student',
        accessLevel: 'basic',
        isActive: editingStudent.isActive!,
        createdAt: new Date().toISOString(),
        lastLogin: '',
        loginCount: 0
      };

      // Update in both regular users collection and organized collection
      await userService.updateUser(updatedStudent.id, updatedStudent);
      await userService.updateOrganizedStudentCollection(updatedStudent);
      
      setShowEditModal(false);
      setEditingStudent({
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
      console.error('Error updating student:', error);
      alert('Error updating student');
    }
  };

  const handleDeleteStudent = async (student: User) => {
    setStudentToDelete(student);
    setShowDeleteModal(true);
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<User | null>(null);

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    
    try {
      await userService.deleteUser(studentToDelete.id);
      await userService.deleteOrganizedStudentCollection(studentToDelete);
      setShowDeleteModal(false);
      setStudentToDelete(null);
      fetchStudents(); // Refresh the student list
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Error deleting student');
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setStudentToDelete(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Student Management</h2>
          <p className="text-gray-600">View and manage students in your department</p>
          <p className="text-sm text-blue-600 mt-1">
            Role: {user.role.toUpperCase()} | Department: {user.department} | Year: {selectedYear} | Sem: {selectedSem} | Div: {selectedDiv}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Upload size={16} />
            Import Excel
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            <Plus size={16} />
            Add Student
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            <Download size={16} />
            Export Data
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2"
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
            className="w-full border border-gray-300 rounded-lg p-2"
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
            className="w-full border border-gray-300 rounded-lg p-2"
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
              className="w-full border border-gray-300 rounded-lg p-2 pl-10"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats (shown before student list) */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-900">Total Students</p>
              <p className="text-2xl font-bold text-blue-600">{filteredStudents.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-amber-50 rounded-lg p-4">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-amber-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-amber-900">Male Students</p>
              <p className="text-2xl font-bold text-amber-600">{maleCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-purple-900">Female Students</p>
              <p className="text-2xl font-bold text-purple-600">{femaleCount}</p>
            </div>
          </div>
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
                    onClick={() => setSelectedStudent(student)}
                    className="text-blue-600 hover:text-blue-800"
                    aria-label="View details"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => handleEditStudent(student)}
                    className="text-green-600 hover:text-green-800"
                    aria-label="Edit student"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteStudent(student)}
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
                <tr key={student.id} className="hover:bg-gray-50">
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
                        onClick={() => setSelectedStudent(student)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleEditStudent(student)}
                        className="text-green-600 hover:text-green-900"
                        title="Edit Student"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(student)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete Student"
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

      {/* Student Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Student Details</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-600">
                    {selectedStudent.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{selectedStudent.name}</h4>
                  <p className="text-gray-600">{selectedStudent.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Roll Number:</span>
                  <p className="text-gray-900">{selectedStudent.rollNumber}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Phone:</span>
                  <p className="text-gray-900">{selectedStudent.phone || 'Not provided'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Gender:</span>
                  <p className="text-gray-900">{selectedStudent.gender || 'Not specified'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Year:</span>
                  <p className="text-gray-900">{selectedStudent.year}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Semester:</span>
                  <p className="text-gray-900">{selectedStudent.sem}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Division:</span>
                  <p className="text-gray-900">{selectedStudent.div}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Department:</span>
                  <p className="text-gray-900">{selectedStudent.department}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <p className="text-gray-900">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedStudent.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {selectedStudent.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Import Students from Excel</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Excel File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="w-full border border-gray-300 rounded-lg p-2"
                />
                {selectedFile && (
                  <p className="text-sm text-green-600 mt-1">
                    Selected: {selectedFile.name}
                  </p>
                )}
              </div>
              <div className="text-sm text-gray-600">
                <p>Required columns: name, email, rollNumber</p>
                <p>Optional columns: phone, gender, year, sem, div, department</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setSelectedFile(null);
                  }}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={downloadTemplate}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Download Template
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Upload Students'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Student</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="studentName" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  id="studentName"
                  name="name"
                  type="text"
                  value={newStudent.name}
                  onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Full Name"
                  required
                />
              </div>
              <div>
                <label htmlFor="studentEmail" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  id="studentEmail"
                  name="email"
                  type="email"
                  value={newStudent.email}
                  onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Email Address"
                  required
                />
              </div>
              <div>
                <label htmlFor="studentRollNumber" className="block text-sm font-medium text-gray-700 mb-1">Roll Number *</label>
                <input
                  id="studentRollNumber"
                  name="rollNumber"
                  type="text"
                  value={newStudent.rollNumber}
                  onChange={(e) => setNewStudent({...newStudent, rollNumber: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Roll Number"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="studentPhone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    id="studentPhone"
                    name="phone"
                    type="tel"
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({...newStudent, phone: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="Phone Number"
                  />
                </div>
                <div>
                  <label htmlFor="studentGender" className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    id="studentGender"
                    name="gender"
                    value={newStudent.gender}
                    onChange={(e) => setNewStudent({...newStudent, gender: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="studentYear" className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    id="studentYear"
                    name="year"
                    value={newStudent.year}
                    onChange={(e) => setNewStudent({...newStudent, year: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    required
                  >
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="studentSem" className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select
                    id="studentSem"
                    name="sem"
                    value={newStudent.sem}
                    onChange={(e) => setNewStudent({...newStudent, sem: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    required
                  >
                    {SEMS.map(sem => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="studentDiv" className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                  <select
                    id="studentDiv"
                    name="div"
                    value={newStudent.div}
                    onChange={(e) => setNewStudent({...newStudent, div: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    required
                  >
                    {DIVS.map(div => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={addStudent}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Add Student
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Student</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={editingStudent.email}
                  onChange={(e) => setEditingStudent({...editingStudent, email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Email Address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number *</label>
                <input
                  type="text"
                  value={editingStudent.rollNumber}
                  onChange={(e) => setEditingStudent({...editingStudent, rollNumber: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                  placeholder="Roll Number"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editingStudent.phone}
                    onChange={(e) => setEditingStudent({...editingStudent, phone: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                    placeholder="Phone Number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={editingStudent.gender}
                    onChange={(e) => setEditingStudent({...editingStudent, gender: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={editingStudent.year}
                    onChange={(e) => setEditingStudent({...editingStudent, year: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg p-2"
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
                    className="w-full border border-gray-300 rounded-lg p-2"
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
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    {DIVS.map(div => (
                      <option key={div} value={div}>{div}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={editingStudent.isActive ? 'true' : 'false'}
                  onChange={(e) => setEditingStudent({...editingStudent, isActive: e.target.value === 'true'})}
                  className="w-full border border-gray-300 rounded-lg p-2"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={updateStudent}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Export Student Data</h3>
            <div className="space-y-4">
              {/* Always show Year, Semester, Division dropdowns */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2"
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
                    className="w-full border border-gray-300 rounded-lg p-2"
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
                    className="w-full border border-gray-300 rounded-lg p-2"
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
                  className="w-full border border-gray-300 rounded-lg p-2"
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
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
              )}

              {exportType === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg p-2"
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
                    className="w-full border border-gray-300 rounded-lg p-2"
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
                  <p>Export student attendance data for the selected month with attendance statistics for all subjects.</p>
                )}
                {exportType === 'custom' && (
                  <p>Export student attendance data for the custom date range with attendance statistics for all subjects.</p>
                )}
                {exportType === 'subject' && (
                  <p>Export student attendance data for the selected subject for the current academic year.</p>
                )}
              </div>

              {/* Progress Indicator */}
              {exporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Processing export...</span>
                    <span className="font-medium">Please wait</span>
                  </div>
                  
                  {exportProgress ? (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>{exportProgress.message}</span>
                        <span>{exportProgress.current} / {exportProgress.total}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-purple-600 h-2 rounded-full animate-pulse"></div>
                    </div>
                  )}
                  
                  <p className="text-xs text-gray-500">
                    Using ULTRA-FAST parallel processing for maximum speed...
                  </p>
                  <div className="text-xs text-purple-600 font-medium">
                    🚀 ULTRA-FAST parallel export in progress
                  </div>
                  <div className="text-xs text-green-600 font-medium">
                    ⚡ All queries execute simultaneously
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
                  disabled={exporting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-mobile-lg animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete Student</h3>
              <button
                onClick={cancelDelete}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold text-gray-900">{studentToDelete?.name}</span>? This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherStudentPanel; 