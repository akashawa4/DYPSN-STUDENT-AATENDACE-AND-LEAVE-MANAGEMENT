import { 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp,
  Timestamp,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import type { DocumentData, QuerySnapshot } from 'firebase/firestore';
import { User, LeaveRequest, AttendanceLog, Notification, Subject, ResultRecord } from '../types';
import { getDepartmentCode } from '../utils/departmentMapping';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  TEACHERS: 'teachers',
  LEAVE_REQUESTS: 'leaveRequests',
  LEAVE: 'leave',
  ATTENDANCE: 'attendance',
  RESULTS: 'results',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'auditLogs',
  SETTINGS: 'settings',
  STUDENTS: 'students',
  SUBJECTS: 'subjects'
} as const;

// Department constants
export const DEPARTMENTS = {
  FIRST_YEAR: 'FIRST_YEAR',
  CSE: 'CSE',
  DATA_SCIENCE: 'DATA_SCIENCE',
  CIVIL: 'CIVIL',
  ELECTRICAL: 'ELECTRICAL'
} as const;

// Department display names
export const DEPARTMENT_NAMES = {
  [DEPARTMENTS.FIRST_YEAR]: 'First Year',
  [DEPARTMENTS.CSE]: 'Computer Science & Engineering',
  [DEPARTMENTS.DATA_SCIENCE]: 'Data Science (CSE)',
  [DEPARTMENTS.CIVIL]: 'Civil Engineering',
  [DEPARTMENTS.ELECTRICAL]: 'Electrical Engineering'
} as const;

// Batch-based collection path builder with department support
export const buildBatchPath = {
  // Build attendance path: /attendance/batch/{batch}/DEPARTMENT/year/{studentYear}/sems/{sem}/divs/{div}/subjects/{subject}/{year}/{month}/{day}
  attendance: (batch: string, department: string, studentYear: string, sem: string, div: string, subject: string, date: Date) => {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${COLLECTIONS.ATTENDANCE}/batch/${batch}/${department}/year/${studentYear}/sems/${sem}/divs/${div}/subjects/${subject}/${year}/${month}/${day}`;
  },

  // Build leave path: /leave/batch/{batch}/DEPARTMENT/year/{studentYear}/sems/{sem}/divs/{div}/subjects/{subject}/{year}/{month}/{day}
  leave: (batch: string, department: string, studentYear: string, sem: string, div: string, subject: string, date: Date) => {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${COLLECTIONS.LEAVE}/batch/${batch}/${department}/year/${studentYear}/sems/${sem}/divs/${div}/subjects/${subject}/${year}/${month}/${day}`;
  },

  // Build student path: /students/batch/{batch}/DEPARTMENT/year/{year}/sems/{sem}/divs/{div}/students
  student: (batch: string, department: string, year: string, sem: string, div: string) => {
    return `${COLLECTIONS.STUDENTS}/batch/${batch}/${department}/year/${year}/sems/${sem}/divs/${div}/students`;
  },

  // Build teacher path: /teachers/batch/{batch}/DEPARTMENT/sems/{sem}/divs/{div}/teachers
  teacher: (batch: string, department: string, sem: string, div: string) => {
    return `teachers/batch/${batch}/${department}/sems/${sem}/divs/${div}/teachers`;
  },

  // Build notification path: /notifications/batch/{batch}/DEPARTMENT/sems/{sem}/divs/{div}/{year}/{month}/{day}
  notification: (batch: string, department: string, sem: string, div: string, date: Date) => {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${COLLECTIONS.NOTIFICATIONS}/batch/${batch}/${department}/sems/${sem}/divs/${div}/${year}/${month}/${day}`;
  },

  // Build audit log path: /auditLogs/batch/{batch}/DEPARTMENT/sems/{sem}/divs/{div}/{year}/{month}/{day}
  auditLog: (batch: string, department: string, sem: string, div: string, date: Date) => {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${COLLECTIONS.AUDIT_LOGS}/batch/${batch}/${department}/sems/${sem}/divs/${div}/${year}/${month}/${day}`;
  },

  // Build results path:
  // /results/batch/{batch}/{department}/year/{studentYear}/sems/{sem}/divs/{div}/subjects/{subject}/{examType}
  result: (batch: string, department: string, studentYear: string, sem: string, div: string, subject: string, examType: string) => {
    return `${COLLECTIONS.RESULTS}/batch/${batch}/${department}/year/${studentYear}/sems/${sem}/divs/${div}/subjects/${subject}/${examType}`;
  },

  // Build batch attendance path: /batchattendance/batch/{batchYear}/CSE/year/{year}/sems/{sem}/divs/{division}/batch/{batchName}/subjects/{subjectName}/{date}
  batchAttendance: (batch: string, department: string, year: string, sem: string, div: string, batchName: string, subject: string, date: Date) => {
    const attendanceYear = date.getFullYear().toString();
    const attendanceMonth = (date.getMonth() + 1).toString().padStart(2, '0');
    const attendanceDate = date.getDate().toString().padStart(2, '0');
    return `batchattendance/batch/${batch}/${department}/year/${year}/sems/${sem}/divs/${div}/batch/${batchName}/subjects/${subject}/${attendanceYear}/${attendanceMonth}/${attendanceDate}`;
  },

  // Build batch path: /batches/{batchId} (simplified structure)
  batch: (batchId: string) => {
    return `batches/${batchId}`;
  }
};

// Helper function to get batch year from student year
export const getBatchYear = (studentYear: string): string => {
  const currentYear = new Date().getFullYear();
  // All students belong to the current year batch
  return currentYear.toString();
};

// Helper function to get current batch year
export const getCurrentBatchYear = (): string => {
  return new Date().getFullYear().toString();
};

// Helper function to get department from student data
export const getDepartment = (studentData: any): string => {
  // Map department names to constants
  const departmentMap: { [key: string]: string } = {
    'first year': DEPARTMENTS.FIRST_YEAR,
    'first_year': DEPARTMENTS.FIRST_YEAR,
    'FIRST_YEAR': DEPARTMENTS.FIRST_YEAR,
    'cse': DEPARTMENTS.CSE,
    'CSE': DEPARTMENTS.CSE,
    'computer science': DEPARTMENTS.CSE,
    'computer science & engineering': DEPARTMENTS.CSE,
    'data science': DEPARTMENTS.DATA_SCIENCE,
    'DATA_SCIENCE': DEPARTMENTS.DATA_SCIENCE,
    'data science (cse)': DEPARTMENTS.DATA_SCIENCE,
    'civil': DEPARTMENTS.CIVIL,
    'CIVIL': DEPARTMENTS.CIVIL,
    'civil engineering': DEPARTMENTS.CIVIL,
    'electrical': DEPARTMENTS.ELECTRICAL,
    'ELECTRICAL': DEPARTMENTS.ELECTRICAL,
    'electrical engineering': DEPARTMENTS.ELECTRICAL
  };

  const dept = studentData.department || studentData.dept || 'CSE';
  return departmentMap[dept.toLowerCase()] || DEPARTMENTS.CSE;
};

// Helper function to get department from teacher data
export const getTeacherDepartment = (teacherData: any): string => {
  // Map department names to constants
  const departmentMap: { [key: string]: string } = {
    'first year': DEPARTMENTS.FIRST_YEAR,
    'first_year': DEPARTMENTS.FIRST_YEAR,
    'FIRST_YEAR': DEPARTMENTS.FIRST_YEAR,
    'cse': DEPARTMENTS.CSE,
    'CSE': DEPARTMENTS.CSE,
    'computer science': DEPARTMENTS.CSE,
    'computer science & engineering': DEPARTMENTS.CSE,
    'data science': DEPARTMENTS.DATA_SCIENCE,
    'DATA_SCIENCE': DEPARTMENTS.DATA_SCIENCE,
    'data science (cse)': DEPARTMENTS.DATA_SCIENCE,
    'civil': DEPARTMENTS.CIVIL,
    'CIVIL': DEPARTMENTS.CIVIL,
    'civil engineering': DEPARTMENTS.CIVIL,
    'electrical': DEPARTMENTS.ELECTRICAL,
    'ELECTRICAL': DEPARTMENTS.ELECTRICAL,
    'electrical engineering': DEPARTMENTS.ELECTRICAL
  };

  const dept = teacherData.department || teacherData.dept || teacherData.assignedDepartment || 'CSE';
  return departmentMap[dept.toLowerCase()] || DEPARTMENTS.CSE;
};

// Helper function to auto-detect department from existing Firestore data
export const autoDetectDepartment = async (userId: string, role: 'student' | 'teacher'): Promise<string> => {
  try {
    if (role === 'student') {
      // Check existing student data in Firestore
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.department || userData.dept) {
          return getDepartment(userData);
        }
        
        // Check department-based collections for existing data
        for (const dept of Object.values(DEPARTMENTS)) {
          try {
            const batchPath = buildBatchPath.student('2025', dept, '2nd', '3', 'A');
            const studentRef = doc(db, batchPath, userId);
            const studentDoc = await getDoc(studentRef);
            
            if (studentDoc.exists()) {
              return dept;
            }
          } catch (error) {
            // Collection might not exist, continue to next department
            continue;
          }
        }
      }
    } else if (role === 'teacher') {
      // Check existing teacher data in Firestore
      const teacherRef = doc(db, COLLECTIONS.TEACHERS, userId);
      const teacherDoc = await getDoc(teacherRef);
      
      if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data();
        if (teacherData.department || teacherData.dept || teacherData.assignedDepartment) {
          return getTeacherDepartment(teacherData);
        }
        
        // Check department-based collections for existing data
        for (const dept of Object.values(DEPARTMENTS)) {
          try {
            const batchPath = buildBatchPath.teacher('2025', dept, '3', 'A');
            const teacherRef = doc(db, batchPath, userId);
            const teacherDoc = await getDoc(teacherRef);
            
            if (teacherDoc.exists()) {
              return dept;
            }
          } catch (error) {
            // Collection might not exist, continue to next department
            continue;
          }
        }
      }
    }
    
    // Default to CSE if no department found
    return DEPARTMENTS.CSE;
  } catch (error) {
    // Handle error silently
    return DEPARTMENTS.CSE;
  }
};

// Helper function to get department faculty for leave approval
export const getDepartmentFaculty = async (department: string): Promise<any[]> => {
  try {
    const faculty: any[] = [];
    
    // Search for teachers in the specified department across all batches
    for (const batch of ['2025', '2026', '2027', '2028']) {
      for (const sem of ['1', '2', '3', '4', '5', '6', '7', '8']) {
        for (const div of ['A', 'B', 'C', 'D']) {
          try {
            const batchPath = buildBatchPath.teacher(batch, department, sem, div);
            const teachersSnapshot = await getDocs(collection(db, batchPath));
            
            teachersSnapshot.docs.forEach(doc => {
              const teacherData = doc.data();
              if (teacherData.role === 'teacher' && teacherData.department === department) {
                faculty.push({
                  id: doc.id,
                  ...teacherData
                });
              }
            });
          } catch (error) {
            // Collection might not exist, continue to next
            continue;
          }
        }
      }
    }
    
    // Also check main teachers collection
    const teachersQuery = query(
      collection(db, COLLECTIONS.TEACHERS),
      where('department', '==', department),
      where('role', '==', 'teacher')
    );
    
    const teachersSnapshot = await getDocs(teachersQuery);
    teachersSnapshot.docs.forEach(doc => {
      const teacherData = doc.data();
      if (!faculty.find(f => f.id === doc.id)) {
        faculty.push({
          id: doc.id,
          ...teacherData
        });
      }
    });
    
    return faculty;
  } catch (error) {
    // Handle error silently
    return [];
  }
};

// Helper function to get department head or coordinator
export const getDepartmentHead = async (department: string): Promise<any | null> => {
  try {
    // First check for department head/coordinator in main teachers collection
    const teachersQuery = query(
      collection(db, COLLECTIONS.TEACHERS),
      where('department', '==', department),
      where('role', '==', 'teacher'),
      where('isDepartmentHead', '==', true)
    );
    
    const teachersSnapshot = await getDocs(teachersQuery);
    if (!teachersSnapshot.empty) {
      const teacherDoc = teachersSnapshot.docs[0];
      return {
        id: teacherDoc.id,
        ...teacherDoc.data()
      };
    }
    
    // If no department head found, get the first available teacher
    const faculty = await getDepartmentFaculty(department);
    if (faculty.length > 0) {
      return faculty[0];
    }
    
    return null;
  } catch (error) {
    // Handle error silently
    return null;
  }
};

// Helper function to validate department
export const isValidDepartment = (department: string): boolean => {
  return Object.values(DEPARTMENTS).includes(department as any);
};

// Helper function to get department display name
export const getDepartmentDisplayName = (department: string): string => {
  return DEPARTMENT_NAMES[department as keyof typeof DEPARTMENT_NAMES] || department;
};

// User Management
export const userService = {
  // Create or update user with department support and roll number change handling
  async createUser(userData: User): Promise<void> {
    const userRef = doc(db, COLLECTIONS.USERS, userData.id);
    
    // Check if this is a roll number update for existing student
    const existingUser = await getDoc(userRef);
    let isRollNumberChange = false;
    let oldRollNumber = '';
    
    if (existingUser.exists() && userData.role === 'student') {
      const existingData = existingUser.data();
      if (existingData.rollNumber && existingData.rollNumber !== userData.rollNumber) {
        isRollNumberChange = true;
        oldRollNumber = existingData.rollNumber;
        // Roll number change detected
      }
    }

    // Update main user document
    await setDoc(userRef, {
      ...userData,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });

    // If it's a student, handle department-based structure
    if (userData.role === 'student' && userData.year && userData.sem && userData.div) {
      const batch = getBatchYear(userData.year);
      // Auto-detect department if not provided
      let department = userData.department || (userData as any).dept;
      if (!department) {
        department = await autoDetectDepartment(userData.id, 'student');
        // Auto-detected department for student
      } else {
        department = getDepartment(userData);
      }
      
      const batchPath = buildBatchPath.student(batch, department, userData.year, userData.sem, userData.div);
      
      // If roll number changed, migrate historical data
      if (isRollNumberChange && oldRollNumber) {
        await this.migrateStudentDataOnRollNumberChange(
          userData.id,
          oldRollNumber,
          userData.rollNumber!,
          batch,
          department,
          userData.year,
          userData.sem,
          userData.div
        );
      }
      
      // Save/update student in department structure
      const studentRef = doc(db, batchPath, userData.rollNumber || userData.id);
      await setDoc(studentRef, {
        ...userData,
        batchYear: batch,
        department: department,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });
    }

    // If it's a teacher, also save to department-based structure
    if (userData.role === 'teacher' && userData.year && userData.sem && userData.div) {
      const batch = getBatchYear(userData.year);
      // Auto-detect department if not provided
      let department = userData.department || (userData as any).dept || (userData as any).assignedDepartment;
      if (!department) {
        department = await autoDetectDepartment(userData.id, 'teacher');
        // Auto-detected department for teacher
      } else {
        department = getTeacherDepartment(userData);
      }
      
      const batchPath = buildBatchPath.teacher(batch, department, userData.sem, userData.div);
      const teacherRef = doc(db, batchPath, userData.id);
      await setDoc(teacherRef, {
        ...userData,
        batchYear: batch,
        department: department,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      }, { merge: true });
    }
  },

  // Migrate all student data when roll number changes
  async migrateStudentDataOnRollNumberChange(
    userId: string,
    oldRollNumber: string,
    newRollNumber: string,
    batch: string,
    department: string,
    year: string,
    sem: string,
    div: string
  ): Promise<void> {
    try {
      // Starting data migration for roll number change
      
      const migrationResults = {
        attendance: { migrated: 0, errors: 0 },
        leaves: { migrated: 0, errors: 0 },
        notifications: { migrated: 0, errors: 0 },
        auditLogs: { migrated: 0, errors: 0 }
      };

      // 1. Migrate attendance records
      try {
        await this.migrateAttendanceRecords(userId, oldRollNumber, newRollNumber, batch, department, sem, div, migrationResults);
      } catch (error) {
        // Handle error silently
      }

      // 2. Migrate leave requests
      try {
        await this.migrateLeaveRecords(userId, oldRollNumber, newRollNumber, batch, department, sem, div, migrationResults);
      } catch (error) {
        // Handle error silently
      }

      // 3. Migrate notifications
      try {
        await this.migrateNotificationRecords(userId, oldRollNumber, newRollNumber, batch, department, sem, div, migrationResults);
      } catch (error) {
        // Handle error silently
      }

      // 4. Migrate audit logs
      try {
        await this.migrateAuditLogRecords(userId, oldRollNumber, newRollNumber, batch, department, sem, div, migrationResults);
      } catch (error) {
        // Handle error silently
      }

      // 5. Update roll number mapping for future reference
      await this.updateRollNumberMapping(userId, oldRollNumber, newRollNumber);

      // Roll number change migration completed
    } catch (error) {
      // Handle error silently
      throw error;
    }
  },

  // Migrate attendance records
  async migrateAttendanceRecords(
    userId: string,
    oldRollNumber: string,
    newRollNumber: string,
    batch: string,
    department: string,
    sem: string,
    div: string,
    results: any
  ): Promise<void> {
    // Query all attendance records for this user across all subjects and dates
    const attendanceQuery = query(
      collection(db, COLLECTIONS.ATTENDANCE),
      where('userId', '==', userId)
    );
    
    const attendanceSnapshot = await getDocs(attendanceQuery);
    
    for (const docSnapshot of attendanceSnapshot.docs) {
      try {
        const attendance = docSnapshot.data();
        
        // Update the attendance record with new roll number
        await updateDoc(docSnapshot.ref, {
          rollNumber: newRollNumber,
          userName: attendance.userName || newRollNumber,
          updatedAt: serverTimestamp(),
          rollNumberChanged: true,
          previousRollNumber: oldRollNumber,
          rollNumberChangeDate: serverTimestamp()
        });
        
        results.attendance.migrated++;
      } catch (error) {
        // Handle error silently
        results.attendance.errors++;
      }
    }

    // Also update department-based attendance records
    await this.migrateDepartmentBasedAttendanceRecords(
      userId, oldRollNumber, newRollNumber, batch, department, sem, div, results
    );
  },

  // Migrate department-based attendance records
  async migrateDepartmentBasedAttendanceRecords(
    userId: string,
    oldRollNumber: string,
    newRollNumber: string,
    batch: string,
    department: string,
    sem: string,
    div: string,
    results: any
  ): Promise<void> {
    // Get all subjects this student might have attended
    const subjects = ['General', 'Microprocessor', 'Data Structures', 'Database', 'Web Development', 'Machine Learning'];
    
    for (const subject of subjects) {
      try {
        // Query department-based attendance for this subject
        const attendancePath = buildBatchPath.attendance(batch, department, '2nd', sem, div, subject, new Date());
        const attendanceQuery = query(
          collection(db, attendancePath),
          where('userId', '==', userId)
        );
        
        const snapshot = await getDocs(attendanceQuery);
        
        for (const docSnapshot of snapshot.docs) {
          try {
            await updateDoc(docSnapshot.ref, {
              rollNumber: newRollNumber,
              userName: newRollNumber,
              updatedAt: serverTimestamp(),
              rollNumberChanged: true,
              previousRollNumber: oldRollNumber,
              rollNumberChangeDate: serverTimestamp()
            });
            
            results.attendance.migrated++;
          } catch (error) {
            // Handle error silently
            results.attendance.errors++;
          }
        }
      } catch (error) {
        // Subject collection might not exist, continue to next
        continue;
      }
    }
  },

  // Migrate leave records
  async migrateLeaveRecords(
    userId: string,
    oldRollNumber: string,
    newRollNumber: string,
    batch: string,
    department: string,
    sem: string,
    div: string,
    results: any
  ): Promise<void> {
    // Query all leave requests for this user
    const leaveQuery = query(
      collection(db, COLLECTIONS.LEAVE_REQUESTS),
      where('userId', '==', userId)
    );
    
    const leaveSnapshot = await getDocs(leaveQuery);
    
    for (const docSnapshot of leaveSnapshot.docs) {
      try {
        await updateDoc(docSnapshot.ref, {
          rollNumber: newRollNumber,
          updatedAt: serverTimestamp(),
          rollNumberChanged: true,
          previousRollNumber: oldRollNumber,
          rollNumberChangeDate: serverTimestamp()
        });
        
        results.leaves.migrated++;
      } catch (error) {
        // Handle error silently
        results.leaves.errors++;
      }
    }

    // Also update department-based leave records
    await this.migrateDepartmentBasedLeaveRecords(
      userId, oldRollNumber, newRollNumber, batch, department, sem, div, results
    );
  },

  // Migrate department-based leave records
  async migrateDepartmentBasedLeaveRecords(
    userId: string,
    oldRollNumber: string,
    newRollNumber: string,
    batch: string,
    department: string,
    sem: string,
    div: string,
    results: any
  ): Promise<void> {
    const subjects = ['General', 'Microprocessor', 'Data Structures', 'Database', 'Web Development', 'Machine Learning'];
    
    for (const subject of subjects) {
      try {
        const leavePath = buildBatchPath.leave(batch, department, '2nd', sem, div, subject, new Date());
        const leaveQuery = query(
          collection(db, leavePath),
          where('userId', '==', userId)
        );
        
        const snapshot = await getDocs(leaveQuery);
        
        for (const docSnapshot of snapshot.docs) {
          try {
            await updateDoc(docSnapshot.ref, {
              rollNumber: newRollNumber,
              updatedAt: serverTimestamp(),
              rollNumberChanged: true,
              previousRollNumber: oldRollNumber,
              rollNumberChangeDate: serverTimestamp()
            });
            
            results.leaves.migrated++;
          } catch (error) {
            // Handle error silently
            results.leaves.errors++;
          }
        }
      } catch (error) {
        // Subject collection might not exist, continue to next
        continue;
      }
    }
  },

  // Migrate notification records
  async migrateNotificationRecords(
    userId: string,
    oldRollNumber: string,
    newRollNumber: string,
    batch: string,
    department: string,
    sem: string,
    div: string,
    results: any
  ): Promise<void> {
    const notificationQuery = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('userId', '==', userId)
    );
    
    const notificationSnapshot = await getDocs(notificationQuery);
    
    for (const docSnapshot of notificationSnapshot.docs) {
      try {
        await updateDoc(docSnapshot.ref, {
          rollNumber: newRollNumber,
          updatedAt: serverTimestamp(),
          rollNumberChanged: true,
          previousRollNumber: oldRollNumber,
          rollNumberChangeDate: serverTimestamp()
        });
        
        results.notifications.migrated++;
      } catch (error) {
        console.error('[userService] Error updating notification record:', docSnapshot.id, error);
        results.notifications.errors++;
      }
    }
  },

  // Migrate audit log records
  async migrateAuditLogRecords(
    userId: string,
    oldRollNumber: string,
    newRollNumber: string,
    batch: string,
    department: string,
    sem: string,
    div: string,
    results: any
  ): Promise<void> {
    const auditQuery = query(
      collection(db, COLLECTIONS.AUDIT_LOGS),
      where('userId', '==', userId)
    );
    
    const auditSnapshot = await getDocs(auditQuery);
    
    for (const docSnapshot of auditSnapshot.docs) {
      try {
        await updateDoc(docSnapshot.ref, {
          rollNumber: newRollNumber,
          updatedAt: serverTimestamp(),
          rollNumberChanged: true,
          previousRollNumber: oldRollNumber,
          rollNumberChangeDate: serverTimestamp()
        });
        
        results.auditLogs.migrated++;
      } catch (error) {
        console.error('[userService] Error updating audit log record:', docSnapshot.id, error);
        results.auditLogs.errors++;
      }
    }
  },

  // Update roll number mapping for future reference
  async updateRollNumberMapping(userId: string, oldRollNumber: string, newRollNumber: string): Promise<void> {
    const mappingRef = doc(db, 'rollNumberMappings', userId);
    await setDoc(mappingRef, {
      userId: userId,
      oldRollNumber: oldRollNumber,
      newRollNumber: newRollNumber,
      changeDate: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  },

  // Get user by ID
  async getUser(userId: string): Promise<User | null> {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() } as User;
    }
    return null;
  },

  // Get all users
  async getAllUsers(): Promise<User[]> {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, orderBy('name'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[];
  },

  // TEACHERS: dedicated collection helpers
  async createTeacher(teacher: User): Promise<void> {
    // Write to teachers collection
    const teacherRef = doc(db, COLLECTIONS.TEACHERS, teacher.id);
    await setDoc(teacherRef, {
      ...teacher,
      role: 'teacher',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });

    // Mirror into users collection for backward compatibility/queries
    const userRef = doc(db, COLLECTIONS.USERS, teacher.id);
    await setDoc(userRef, {
      ...teacher,
      role: 'teacher',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });
  },

  async updateTeacher(teacherId: string, updates: Partial<User>): Promise<void> {
    const teacherRef = doc(db, COLLECTIONS.TEACHERS, teacherId);
    await setDoc(teacherRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true });

    const userRef = doc(db, COLLECTIONS.USERS, teacherId);
    await setDoc(userRef, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
  },

  async deleteTeacher(teacherId: string): Promise<void> {
    const teacherRef = doc(db, COLLECTIONS.TEACHERS, teacherId);
    await deleteDoc(teacherRef);

    const userRef = doc(db, COLLECTIONS.USERS, teacherId);
    await deleteDoc(userRef);
  },

  async getAllTeachers(): Promise<User[]> {
    // Prefer the teachers collection; fallback to users with role filter if empty
    const teachersRef = collection(db, COLLECTIONS.TEACHERS);
    const tq = query(teachersRef, orderBy('name'));
    const tSnap = await getDocs(tq);
    if (!tSnap.empty) {
      return tSnap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
    }
    const usersRef = collection(db, COLLECTIONS.USERS);
    const uq = query(usersRef, where('role', '==', 'teacher'), orderBy('name'));
    const uSnap = await getDocs(uq);
    return uSnap.docs.map(d => ({ id: d.id, ...d.data() })) as User[];
  },

  // Bulk import teachers (writes to teachers and users collections)
  async bulkImportTeachers(teachers: User[]): Promise<void> {
    const batch = writeBatch(db);
    const now = serverTimestamp();
    for (const teacher of teachers) {
      const teacherId = teacher.id || (teacher.email || `teacher_${Date.now()}`);
      const base = {
        ...teacher,
        id: teacherId,
        role: 'teacher',
        accessLevel: teacher.accessLevel || 'approver',
        isActive: teacher.isActive !== false,
        updatedAt: now,
        createdAt: now
      } as any;
      const tRef = doc(db, COLLECTIONS.TEACHERS, teacherId);
      batch.set(tRef, base, { merge: true });
      const uRef = doc(db, COLLECTIONS.USERS, teacherId);
      batch.set(uRef, base, { merge: true });
    }
    await batch.commit();
  },

  // Get users by role
  async getUsersByRole(role: string): Promise<User[]> {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('role', '==', role), orderBy('name'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[];
  },

  // Update user
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await setDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    }, { merge: true });
  },

  // Delete user
  async deleteUser(userId: string): Promise<void> {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await deleteDoc(userRef);
  },

  // Get students by year, semester, and division (from main users collection)
  async getStudentsByYearSemDiv(year: string, sem: string, div: string): Promise<User[]> {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(
      usersRef, 
      where('role', '==', 'student'),
      where('year', '==', year),
      where('sem', '==', sem),
      where('div', '==', div),
      orderBy('name')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[];
  },

  // Get students by batch, department, year, semester, and division (from batch structure)
  async getStudentsByBatchDeptYearSemDiv(
    batch: string, 
    department: string, 
    year: string, 
    sem: string, 
    div: string
  ): Promise<User[]> {
    try {
      const batchPath = buildBatchPath.student(batch, department, year, sem, div);
      const studentsRef = collection(db, batchPath);
      const querySnapshot = await getDocs(studentsRef);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
    } catch (error) {
      console.error('[userService] Error getting students from batch structure:', error);
      return [];
    }
  },

  // Get all students
  async getAllStudents(): Promise<User[]> {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('role', '==', 'student'), orderBy('name'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[];
  },

  // Check if student exists by email
  async checkStudentExists(email: string): Promise<boolean> {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('email', '==', email), where('role', '==', 'student'));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  },

  // Check if student exists by roll number
  async checkStudentExistsByRollNumber(rollNumber: string): Promise<boolean> {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('rollNumber', '==', rollNumber), where('role', '==', 'student'));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  },

  // Validate student credentials (email and phone number)
  async validateStudentCredentials(email: string, phoneNumber: string): Promise<User | null> {
    console.log(`🔍 Searching for student with email: ${email}`);
    
    try {
      // Create all queries in parallel for organized collections
      const years = ['2', '3', '4']; // Common engineering years
      const sems = ['3', '5', '7']; // Common semesters
      const divs = ['A', 'B', 'C']; // Common divisions
      
      // Generate all possible collection paths
      const collectionPaths: string[] = [];
      for (const year of years) {
        for (const sem of sems) {
          for (const div of divs) {
            collectionPaths.push(`students/${year}/sems/${sem}/divs/${div}/students`);
          }
        }
      }
      
      // Create all queries in parallel using Promise.all - much faster!
      const queryPromises = collectionPaths.map(async (collectionPath) => {
        try {
          const studentsRef = collection(db, collectionPath);
          const q = query(studentsRef, where('email', '==', email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            console.log(`✅ Student found in organized collection: ${collectionPath}`);
            const student = querySnapshot.docs[0].data() as User;
            
            // Check if phone number matches (with or without country code)
            const studentPhone = student.phone || '';
            
            // Only proceed if student has a phone number
            if (!studentPhone) {
              console.log(`❌ Student ${student.email} has no phone number`);
              return null;
            }
            
            const normalizedStudentPhone = studentPhone.toString().replace(/\D/g, ''); // Remove non-digits
            const normalizedInputPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
            
            console.log(`📱 Phone comparison: ${normalizedStudentPhone} vs ${normalizedInputPhone}`);
            
            // Check if phone numbers match (allowing for different formats)
            if (normalizedStudentPhone === normalizedInputPhone || 
                studentPhone.toString() === phoneNumber ||
                studentPhone.toString().endsWith(phoneNumber) ||
                phoneNumber.endsWith(normalizedStudentPhone.slice(-10))) {
              console.log(`✅ Phone number match found for student: ${student.name}`);
              const { id: _ignoredId, ...studentRest } = student as any;
              return { id: querySnapshot.docs[0].id, ...studentRest };
            }
            
            console.log(`❌ Phone number mismatch for student: ${student.name}`);
            return null;
          }
          return null;
        } catch (error) {
          console.log(`⚠️ Error searching in ${collectionPath}:`, error);
          return null; // Return null instead of continuing
        }
      });
      
      // Execute all queries in parallel using Promise.all
      const results = await Promise.all(queryPromises);
      
      // Find the first valid result
      const validResult = results.find(result => result !== null);
      if (validResult) {
        return validResult;
      }
      
      console.log(`❌ Student not found in organized collections`);
      
      // Fallback: Search in users collection
      const usersRef = collection(db, COLLECTIONS.USERS);
      const q = query(
        usersRef, 
        where('email', '==', email), 
        where('role', '==', 'student')
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log(`❌ Student not found in users collection either`);
        return null;
      }
      
      const student = querySnapshot.docs[0].data() as User;
      
      // Check if phone number matches (with or without country code)
      const studentPhone = student.phone || '';
      
      // Only proceed if student has a phone number
      if (!studentPhone) {
        console.log(`❌ Student ${student.email} has no phone number`);
        return null;
      }
      
      const normalizedStudentPhone = studentPhone.toString().replace(/\D/g, ''); // Remove non-digits
      const normalizedInputPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
      
      // Check if phone numbers match (allowing for different formats)
      if (normalizedStudentPhone === normalizedInputPhone || 
          studentPhone.toString() === phoneNumber ||
          studentPhone.toString().endsWith(phoneNumber) ||
          phoneNumber.endsWith(normalizedStudentPhone.slice(-10))) {
        const { id: _ignoredFallbackId, ...studentRest } = student as any;
        return { id: querySnapshot.docs[0].id, ...studentRest };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error in validateStudentCredentials:', error);
      return null;
    }
  },

  // Validate teacher credentials (email and phone number)
  async validateTeacherCredentials(email: string, phoneNumber: string): Promise<User | null> {
    console.log(`🔍 Searching for teacher with email: ${email}, phone: ${phoneNumber}`);
    
    try {
      // Clean the email to remove any trailing spaces
      const cleanEmail = email.trim();
      console.log(`🔍 Cleaned email: "${cleanEmail}"`);
      
      // Debug: List all users in the collection to help identify the issue
      console.log(`🔍 Debug: Listing all users in users collection...`);
      const usersRef = collection(db, COLLECTIONS.USERS);
      const allUsersQuery = query(usersRef, where('role', '==', 'teacher'));
      const allUsersSnap = await getDocs(allUsersQuery);
      console.log(`📊 Found ${allUsersSnap.size} teachers in users collection:`);
      allUsersSnap.docs.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${doc.id}: ${data.email} (role: ${data.role})`);
      });
      
      // PRIMARY: Check users collection first (as per requirement)
      console.log(`🔍 Step 1: Checking users collection for teacher...`);
      
      // First try direct document access by email as ID
      const userDocRef = doc(usersRef, cleanEmail);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        console.log(`👤 Found user by document ID:`, {
          id: userDocSnap.id,
          email: userData.email,
          role: userData.role,
          name: userData.name,
          phone: userData.phone
        });
        
        if (userData.role === 'teacher') {
          console.log(`✅ User has teacher role, validating phone number...`);
          
          // Validate phone number
          const teacherPhone = userData.phone || '';
          console.log(`📞 Teacher phone: "${teacherPhone}", Input phone: "${phoneNumber}"`);
          
          if (!teacherPhone) {
            console.log(`❌ Teacher has no phone number`);
            return null;
          }
          
          const normalizedTeacherPhone = teacherPhone.replace(/\D/g, '');
          const normalizedInputPhone = phoneNumber.replace(/\D/g, '');
          
          console.log(`📞 Normalized teacher phone: "${normalizedTeacherPhone}", Normalized input phone: "${normalizedInputPhone}"`);
          
          if (
            normalizedTeacherPhone === normalizedInputPhone ||
            teacherPhone === phoneNumber ||
            teacherPhone.endsWith(phoneNumber) ||
            phoneNumber.endsWith(normalizedTeacherPhone.slice(-10))
          ) {
            console.log(`✅ Teacher phone number matches! Authentication successful.`);
            const { id: _ignoredTId, ...teacherRest } = userData as any;
            return { id: userDocSnap.id, ...teacherRest };
          } else {
            console.log(`❌ Teacher phone number does not match`);
            return null;
          }
        } else {
          console.log(`❌ User found but role is "${userData.role}", not "teacher"`);
          return null;
        }
      } else {
        console.log(`❌ No document found with ID: ${cleanEmail}`);
        
        // Fallback: Search by email field using query
        console.log(`🔍 Fallback: Searching by email field in users collection...`);
        const emailQuery = query(usersRef, where('email', '==', cleanEmail), where('role', '==', 'teacher'));
        const emailQuerySnap = await getDocs(emailQuery);
        
        console.log(`📊 Email field query result: ${emailQuerySnap.size} documents found`);
        
        if (!emailQuerySnap.empty) {
          const doc = emailQuerySnap.docs[0];
          const userData = doc.data();
          console.log(`👤 Found user by email field:`, {
            id: doc.id,
            email: userData.email,
            role: userData.role,
            name: userData.name,
            phone: userData.phone
          });
          
          if (userData.role === 'teacher') {
            console.log(`✅ User has teacher role, validating phone number...`);
            
            // Validate phone number
            const teacherPhone = userData.phone || '';
            console.log(`📞 Teacher phone: "${teacherPhone}", Input phone: "${phoneNumber}"`);
            
    if (!teacherPhone) {
              console.log(`❌ Teacher has no phone number`);
      return null;
    }
    
    const normalizedTeacherPhone = teacherPhone.replace(/\D/g, '');
    const normalizedInputPhone = phoneNumber.replace(/\D/g, '');
            
            console.log(`📞 Normalized teacher phone: "${normalizedTeacherPhone}", Normalized input phone: "${normalizedInputPhone}"`);

    if (
      normalizedTeacherPhone === normalizedInputPhone ||
      teacherPhone === phoneNumber ||
      teacherPhone.endsWith(phoneNumber) ||
      phoneNumber.endsWith(normalizedTeacherPhone.slice(-10))
    ) {
              console.log(`✅ Teacher phone number matches! Authentication successful.`);
              const { id: _ignoredTId, ...teacherRest } = userData as any;
              return { id: doc.id, ...teacherRest };
            } else {
              console.log(`❌ Teacher phone number does not match`);
              return null;
            }
          } else {
            console.log(`❌ User found but role is "${userData.role}", not "teacher"`);
    return null;
          }
        } else {
          console.log(`❌ No teacher found with email: ${cleanEmail}`);
          
          // Final fallback: Search through all teachers we found earlier
          console.log(`🔍 Final fallback: Searching through known teachers...`);
          const allTeachersQuery = query(usersRef, where('role', '==', 'teacher'));
          const allTeachersSnap = await getDocs(allTeachersQuery);
          
          console.log(`📊 All teachers query result: ${allTeachersSnap.size} documents found`);
          
          for (const doc of allTeachersSnap.docs) {
            const userData = doc.data();
            console.log(`🔍 Checking teacher: ${doc.id} - email: "${userData.email}"`);
            
            // Check if email matches (with trimming)
            const docEmail = (userData.email || '').trim();
            if (docEmail === cleanEmail) {
              console.log(`✅ Found matching teacher by email comparison:`, {
                id: doc.id,
                email: userData.email,
                role: userData.role,
                name: userData.name,
                phone: userData.phone
              });
              
              if (userData.role === 'teacher') {
                console.log(`✅ User has teacher role, validating phone number...`);
                
                // Validate phone number
                const teacherPhone = userData.phone || '';
                console.log(`📞 Teacher phone: "${teacherPhone}", Input phone: "${phoneNumber}"`);
                
                if (!teacherPhone) {
                  console.log(`❌ Teacher has no phone number`);
                  continue;
                }
                
                const normalizedTeacherPhone = teacherPhone.replace(/\D/g, '');
                const normalizedInputPhone = phoneNumber.replace(/\D/g, '');
                
                console.log(`📞 Normalized teacher phone: "${normalizedTeacherPhone}", Normalized input phone: "${normalizedInputPhone}"`);
                
                if (
                  normalizedTeacherPhone === normalizedInputPhone ||
                  teacherPhone === phoneNumber ||
                  teacherPhone.endsWith(phoneNumber) ||
                  phoneNumber.endsWith(normalizedTeacherPhone.slice(-10))
                ) {
                  console.log(`✅ Teacher phone number matches! Authentication successful.`);
                  const { id: _ignoredTId, ...teacherRest } = userData as any;
                  return { id: doc.id, ...teacherRest };
                } else {
                  console.log(`❌ Teacher phone number does not match for ${doc.id}`);
                }
              } else {
                console.log(`❌ User found but role is "${userData.role}", not "teacher"`);
              }
            }
          }
          
          console.log(`❌ No matching teacher found after checking all teachers`);
        }
      }
      
      // FALLBACK: Check teachers collection if not found in users
      console.log(`🔍 Step 2: Checking teachers collection as fallback...`);
      const teachersRef = collection(db, COLLECTIONS.TEACHERS);
      const teacherDocRef = doc(teachersRef, cleanEmail); // Use cleaned email as document ID
      const teacherDocSnap = await getDoc(teacherDocRef);
      
      if (teacherDocSnap.exists()) {
        const teacherData = teacherDocSnap.data();
        console.log(`✅ Found teacher in teachers collection by document ID:`, {
          id: teacherDocSnap.id,
          email: teacherData.email,
          role: teacherData.role,
          name: teacherData.name,
          phone: teacherData.phone
        });
        
        // Validate phone number
        const teacherPhone = teacherData.phone || '';
        console.log(`📞 Teacher phone: "${teacherPhone}", Input phone: "${phoneNumber}"`);
        
        if (!teacherPhone) {
          console.log(`❌ Teacher has no phone number`);
          return null;
        }
        
        const normalizedTeacherPhone = teacherPhone.replace(/\D/g, '');
        const normalizedInputPhone = phoneNumber.replace(/\D/g, '');
        
        console.log(`📞 Normalized teacher phone: "${normalizedTeacherPhone}", Normalized input phone: "${normalizedInputPhone}"`);
        
        if (
          normalizedTeacherPhone === normalizedInputPhone ||
          teacherPhone === phoneNumber ||
          teacherPhone.endsWith(phoneNumber) ||
          phoneNumber.endsWith(normalizedTeacherPhone.slice(-10))
        ) {
          console.log(`✅ Teacher phone number matches! Authentication successful.`);
          const { id: _ignoredTId, ...teacherRest } = teacherData as any;
          return { id: teacherDocSnap.id, ...teacherRest };
        } else {
          console.log(`❌ Teacher phone number does not match`);
          return null;
        }
      }
      
      console.log(`❌ Teacher not found in either collection: ${cleanEmail}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Error in validateTeacherCredentials:`, error);
      return null;
    }
  },

  // Bulk import students
  async bulkImportStudents(students: User[]): Promise<void> {
    const batch = writeBatch(db);
    
    for (const student of students) {
      const userRef = doc(db, COLLECTIONS.USERS, student.id);
      batch.set(userRef, {
        ...student,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    }
    
    await batch.commit();
  },

  // DEPRECATED: Create organized student collections by year, semester, division
  // This function is deprecated. Use createUser() which automatically creates students in the batch structure.
  async createOrganizedStudentCollection(student: User): Promise<void> {
    if (!student.year || !student.sem || !student.div || !student.rollNumber) {
      throw new Error('Missing year, sem, div, or rollNumber for organized collection path');
    }
    if (student.rollNumber.includes('/')) {
      throw new Error('rollNumber cannot contain slashes');
    }
    const collectionPath = `students/${student.year}/sems/${student.sem}/divs/${student.div}/students`;
    const studentRef = doc(db, collectionPath, student.rollNumber);
    await setDoc(studentRef, {
      ...student,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });
  },

  // DEPRECATED: Get students from organized collection
  // This function is deprecated. Use getStudentsByYearSemDiv() which queries the main users collection.
  async getStudentsFromOrganizedCollection(year: string, sem: string, div: string): Promise<User[]> {
    const collectionPath = `students/${year}/sems/${sem}/divs/${div}/students`;
    const studentsRef = collection(db, collectionPath);
    const querySnapshot = await getDocs(studentsRef);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[];
  },

  // Get all students from organized collections
  async getAllStudentsFromOrganizedCollections(): Promise<User[]> {
    const allStudents: User[] = [];
    
    // Get all years
    const yearsRef = collection(db, 'students');
    const yearsSnapshot = await getDocs(yearsRef);
    
    for (const yearDoc of yearsSnapshot.docs) {
      const year = yearDoc.id;
      
      // Get all semesters for this year
      const semsRef = collection(db, `students/${year}`);
      const semsSnapshot = await getDocs(semsRef);
      
      for (const semDoc of semsSnapshot.docs) {
        const sem = semDoc.id;
        
        // Get all divisions for this semester
        const divsRef = collection(db, `students/${year}/${sem}`);
        const divsSnapshot = await getDocs(divsRef);
        
        for (const divDoc of divsSnapshot.docs) {
          const div = divDoc.id;
          
          // Get all students for this division
          // Use batch structure instead of deprecated organized collection
          const batch = '2025'; // Default batch year
          const department = DEPARTMENTS.CSE; // Default department
          const students = await this.getStudentsByBatchDeptYearSemDiv(batch, department, year, sem, div);
          allStudents.push(...students);
        }
      }
    }
    
    return allStudents;
  },

  // Update organized student collection
  async updateOrganizedStudentCollection(student: User): Promise<void> {
    const collectionPath = `students/${student.year}/sems/${student.sem}/divs/${student.div}/students`;
    const studentRef = doc(db, collectionPath, student.rollNumber || student.id);
    await setDoc(studentRef, {
      ...student,
      updatedAt: serverTimestamp()
    }, { merge: true });
  },

  // Delete organized student collection
  async deleteOrganizedStudentCollection(student: User): Promise<void> {
    const collectionPath = `students/${student.year}/sems/${student.sem}/divs/${student.div}/students`;
    const studentRef = doc(db, collectionPath, student.rollNumber || student.id);
    await deleteDoc(studentRef);
  }
};

// Leave Request Management
export const leaveService = {
  // Create leave request with automatic department faculty assignment
  async createLeaveRequest(leaveData: Omit<LeaveRequest, 'id'>): Promise<string> {
    const leaveRef = collection(db, COLLECTIONS.LEAVE_REQUESTS);
    const docData = {
      ...leaveData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'pending', // Always set
      // currentApprovalLevel and approvalFlow come from leaveData
    };
    console.log('[createLeaveRequest] Writing leave request:', docData);
    const docRef = await addDoc(leaveRef, docData);

    // Auto-detect student department and assign to department faculty
    try {
      const { year, sem, div, department, userId } = (leaveData as any) || {};
      const subject = ((leaveData as any)?.subject as string) || 'General';
      const fromDateStr = (leaveData as any)?.fromDate as string | undefined;

      if (year && sem && div && fromDateStr && userId) {
        const dateObj = new Date(fromDateStr);
        const batch = getBatchYear(year);
        
        // Auto-detect department if not provided
        let dept = department;
        if (!dept) {
          dept = await autoDetectDepartment(userId, 'student');
          console.log(`[createLeaveRequest] Auto-detected department for student ${userId}: ${dept}`);
        } else {
          dept = getDepartment({ department: dept });
        }
        
        // Get department faculty for leave approval
        const departmentFaculty = await getDepartmentFaculty(dept);
        const departmentHead = await getDepartmentHead(dept);
        
        // Assign to department head if available, otherwise to first faculty member
        const assignedTo = departmentHead || (departmentFaculty.length > 0 ? departmentFaculty[0] : null);
        
        // Update leave request with department and assigned faculty
        await updateDoc(docRef, {
          department: dept,
          assignedTo: assignedTo ? {
            id: assignedTo.id,
            name: assignedTo.name,
            email: assignedTo.email,
            role: assignedTo.isDepartmentHead ? 'Department Head' : 'Faculty'
          } : null,
          departmentFaculty: departmentFaculty.map(f => ({
            id: f.id,
            name: f.name,
            email: f.email,
            role: f.isDepartmentHead ? 'Department Head' : 'Faculty'
          })),
          updatedAt: serverTimestamp()
        });
        
        // Mirror to department-based structure
        const hierPath = buildBatchPath.leave(batch, dept, '2nd', sem, div, subject, dateObj);
        const hierRef = doc(collection(db, hierPath), docRef.id);
        await setDoc(hierRef, {
          ...docData,
          id: docRef.id,
          batchYear: batch,
          department: dept,
          assignedTo: assignedTo ? {
            id: assignedTo.id,
            name: assignedTo.name,
            email: assignedTo.email,
            role: assignedTo.isDepartmentHead ? 'Department Head' : 'Faculty'
          } : null,
          departmentFaculty: departmentFaculty.map(f => ({
            id: f.id,
            name: f.name,
            email: f.email,
            role: f.isDepartmentHead ? 'Department Head' : 'Faculty'
          }))
        });
        
        console.log(`[createLeaveRequest] Leave request assigned to department ${dept}, faculty: ${assignedTo?.name || 'No faculty found'}`);
        console.log('[createLeaveRequest] Mirrored leave to department-based path:', hierPath, 'id:', docRef.id);
        
        // Create notification for assigned faculty
        if (assignedTo) {
          await this.createLeaveNotification(assignedTo.id, docRef.id, leaveData, dept);
        }
      } else {
        console.warn('[createLeaveRequest] Skipped department assignment (missing year/sem/div/fromDate or userId)');
      }
    } catch (error) {
      console.error('[createLeaveRequest] Error in department assignment:', error);
      // Do not fail creation if department assignment fails
    }
    
    return docRef.id;
  },

  // Create notification for leave request assignment
  async createLeaveNotification(
    facultyId: string, 
    leaveId: string, 
    leaveData: any, 
    department: string
  ): Promise<void> {
    try {
      const notificationData = {
        userId: facultyId,
        type: 'leave_request',
        title: 'New Leave Request',
        message: `New leave request from ${leaveData.studentName || 'Student'} (${leaveData.rollNumber || leaveData.userId}) in ${getDepartmentDisplayName(department)} department`,
        data: {
          leaveId: leaveId,
          studentId: leaveData.userId,
          studentName: leaveData.studentName,
          rollNumber: leaveData.rollNumber,
          department: department,
          fromDate: leaveData.fromDate,
          toDate: leaveData.toDate,
          reason: leaveData.reason
        },
        read: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const notificationRef = collection(db, COLLECTIONS.NOTIFICATIONS);
      await addDoc(notificationRef, notificationData);
      
      console.log(`[createLeaveNotification] Notification created for faculty ${facultyId} for leave request ${leaveId}`);
    } catch (error) {
      console.error('[createLeaveNotification] Error creating notification:', error);
    }
  },

  // Get leave request by ID
  async getLeaveRequest(requestId: string): Promise<LeaveRequest | null> {
    const leaveRef = doc(db, COLLECTIONS.LEAVE_REQUESTS, requestId);
    const leaveSnap = await getDoc(leaveRef);
    
    if (leaveSnap.exists()) {
      return { id: leaveSnap.id, ...leaveSnap.data() } as LeaveRequest;
    }
    return null;
  },

  // Get leave requests by user
  async getLeaveRequestsByUser(userId: string): Promise<LeaveRequest[]> {
    const leaveRef = collection(db, COLLECTIONS.LEAVE_REQUESTS);
    const q = query(
      leaveRef, 
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    
    // Sort in memory to avoid composite index requirement
    const requests = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LeaveRequest[];
    
    // Sort by createdAt descending (most recent first)
    return requests.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return bTime.getTime() - aTime.getTime();
    });
  },

  // Get leave requests assigned to department faculty
  async getLeaveRequestsByFaculty(facultyId: string): Promise<LeaveRequest[]> {
    const leaveRef = collection(db, COLLECTIONS.LEAVE_REQUESTS);
    const q = query(
      leaveRef, 
      where('assignedTo.id', '==', facultyId)
    );
    const querySnapshot = await getDocs(q);
    
    const requests = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LeaveRequest[];
    
    // Sort by createdAt descending (most recent first)
    return requests.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return bTime.getTime() - aTime.getTime();
    });
  },



  // Get pending leave requests for department faculty
  async getPendingLeaveRequestsByFaculty(facultyId: string): Promise<LeaveRequest[]> {
    const leaveRef = collection(db, COLLECTIONS.LEAVE_REQUESTS);
    const q = query(
      leaveRef, 
      where('assignedTo.id', '==', facultyId),
      where('status', '==', 'pending')
    );
    const querySnapshot = await getDocs(q);
    
    const requests = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LeaveRequest[];
    
    // Sort by createdAt descending (most recent first)
    return requests.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return bTime.getTime() - aTime.getTime();
    });
  },

  // NEW: Read leaves from hierarchical leave structure for a specific date
  async getClassLeavesByDate(
    year: string,
    sem: string,
    div: string,
    subject: string,
    date: string // YYYY-MM-DD
  ): Promise<LeaveRequest[]> {
    const dateObj = new Date(date);
    const y = dateObj.getFullYear().toString();
    const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const d = dateObj.getDate().toString().padStart(2, '0');
    const path = `${COLLECTIONS.LEAVE}/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${y}/${m}/${d}`;
    try {
      const colRef = collection(db, path);
      const snap = await getDocs(colRef);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
    } catch (err) {
      console.log('[leaveService.getClassLeavesByDate] No data at', path);
      return [];
    }
  },

  // OPTIMIZED: Read leaves from hierarchical leave structure for an entire month using parallel queries
  async getClassLeavesByMonth(
    year: string,
    sem: string,
    div: string,
    subject: string,
    month: string, // MM
    yearForMonth: string // YYYY
  ): Promise<LeaveRequest[]> {
    console.log(`🚀 Starting optimized leave fetch for ${year}/${sem}/${div}/${subject}/${yearForMonth}/${month}`);
    
    const results: LeaveRequest[] = [];
    
    // Create all day queries in parallel instead of sequential
    const dayPromises: Promise<LeaveRequest[]>[] = [];
    
    // Get the number of days in the month
    const daysInMonth = new Date(parseInt(yearForMonth), parseInt(month), 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const d = String(day).padStart(2, '0');
      const path = `${COLLECTIONS.LEAVE}/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${yearForMonth}/${month}/${d}`;
      
      const dayPromise = (async () => {
        try {
          const colRef = collection(db, path);
          const snap = await getDocs(colRef);
          if (!snap.empty) {
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
          }
          return [];
        } catch (error) {
          // Non-existent day path - skip silently
          console.log(`No leave data for ${path}`);
          return [];
        }
      })();
      
      dayPromises.push(dayPromise);
    }
    
    console.log(`⚡ Executing ${dayPromises.length} parallel day queries...`);
    
    // Execute all day queries in parallel
    const dayResults = await Promise.all(dayPromises);
    
    // Combine all results
    dayResults.forEach(dayLeaves => {
      results.push(...dayLeaves);
    });
    
    console.log(`✅ Found ${results.length} leave records for ${year}/${sem}/${div}/${subject}/${yearForMonth}/${month}`);
    
    return results;
  },

  // Get pending leave requests for approval
  async getPendingLeaveRequests(): Promise<LeaveRequest[]> {
    const leaveRef = collection(db, COLLECTIONS.LEAVE_REQUESTS);
    const q = query(
      leaveRef, 
      where('status', '==', 'pending')
    );
    const querySnapshot = await getDocs(q);
    
    // Sort in memory to avoid composite index requirement
    const requests = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LeaveRequest[];
    
    // Sort by createdAt descending (most recent first)
    return requests.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return bTime.getTime() - aTime.getTime();
    });
  },

  // Update leave request status
  async updateLeaveRequestStatus(
    requestId: string, 
    status: 'approved' | 'rejected' | 'returned' | 'pending',
    approvedBy?: string,
    comments?: string
  ): Promise<void> {
    try {
      console.log('[updateLeaveRequestStatus] Starting update for request:', requestId, 'with status:', status, 'approvedBy:', approvedBy);
      
      const leaveRef = doc(db, COLLECTIONS.LEAVE_REQUESTS, requestId);
      console.log('[updateLeaveRequestStatus] Document reference created');
      
      const leaveDoc = await getDoc(leaveRef);
      console.log('[updateLeaveRequestStatus] Document fetched, exists:', leaveDoc.exists());
      
      if (!leaveDoc.exists()) {
        throw new Error('Leave request not found');
      }

      const leaveData = leaveDoc.data() as LeaveRequest;
      console.log('[updateLeaveRequestStatus] Found leave data:', leaveData);
      
      // Simplified update logic
      let newStatus = status;
      let nextApprovalLevel = leaveData.currentApprovalLevel || 'HOD';
      
      if (status === 'approved') {
        const approvalFlow = leaveData.approvalFlow || ['HOD', 'Principal', 'Registrar', 'HR Executive'];
        const currentIndex = approvalFlow.indexOf(nextApprovalLevel);
        
        if (currentIndex === approvalFlow.length - 1) {
          newStatus = 'approved';
          nextApprovalLevel = 'HR Executive';
        } else {
          nextApprovalLevel = approvalFlow[currentIndex + 1];
          newStatus = 'pending';
        }
      }

      console.log('[updateLeaveRequestStatus] Will update with:', { newStatus, nextApprovalLevel });

      // Simple update without complex fields
      const updateData: any = {
        status: newStatus,
        currentApprovalLevel: nextApprovalLevel,
        updatedAt: serverTimestamp()
      };

      if (comments) {
        updateData.remarks = comments;
      }

      if (status === 'approved' && approvedBy) {
        updateData.approvedBy = approvedBy;
        updateData.approvedAt = serverTimestamp();
      }

      console.log('[updateLeaveRequestStatus] Update data:', updateData);
      
      // Perform the update
      await updateDoc(leaveRef, updateData);
      console.log('[updateLeaveRequestStatus] Leave request updated successfully');

      // Mirror the status update into the hierarchical leave document if present
      try {
        const { year, sem, div } = (leaveData as any) || {};
        const subject = ((leaveData as any)?.subject as string) || 'General';
        const fromDateStr = (leaveData as any)?.fromDate as string | undefined;
        if (year && sem && div && fromDateStr) {
          const dateObj = new Date(fromDateStr);
          const y = dateObj.getFullYear().toString();
          const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
          const d = dateObj.getDate().toString().padStart(2, '0');
          const hierPath = `${COLLECTIONS.LEAVE}/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${y}/${m}/${d}`;
          const hierRef = doc(collection(db, hierPath), requestId);
          await updateDoc(hierRef, updateData);
          console.log('[updateLeaveRequestStatus] Mirrored update to hierarchical leave doc:', hierPath, requestId);
        }
      } catch (mirrorErr) {
        console.error('[updateLeaveRequestStatus] Failed to mirror hierarchical leave update:', mirrorErr);
      }

      // Create notification (optional - don't fail if this fails)
      try {
        // Build details object without undefined fields
        const details: any = {
          leaveType: leaveData.leaveType,
          fromDate: leaveData.fromDate,
          toDate: leaveData.toDate,
          reason: leaveData.reason,
          status: newStatus,
          approvedBy: updateData.approvedBy || leaveData.approvedBy,
          approvalLevel: nextApprovalLevel,
          approvalFlow: leaveData.approvalFlow,
          submittedAt: leaveData.submittedAt,
          daysCount: leaveData.daysCount,
        };
        if (updateData.remarks || leaveData.remarks) {
          details.remarks = updateData.remarks || leaveData.remarks;
        }
        const notificationData = {
          userId: leaveData.userId,
          title: `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `Your ${leaveData.leaveType} leave request has been ${status}${comments ? `: ${comments}` : ''}`,
          type: (status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'warning') as 'info' | 'success' | 'warning' | 'error',
          timestamp: new Date().toISOString(),
          category: 'leave' as 'leave' | 'attendance' | 'system' | 'announcement',
          priority: 'high' as 'low' | 'medium' | 'high',
          actionRequired: status === 'returned',
          read: false,
          details
        };

        await notificationService.createNotification(notificationData);
        console.log('[updateLeaveRequestStatus] Notification created successfully');
      } catch (notificationError) {
        console.error('[updateLeaveRequestStatus] Failed to create notification:', notificationError);
        // Don't throw error for notification failure
      }

    } catch (error) {
      console.error('[updateLeaveRequestStatus] Error details:', error);
      if (typeof error === 'object' && error !== null) {
        if ('message' in error) {
          console.error('[updateLeaveRequestStatus] Error message:', (error as any).message);
        }
        if ('code' in error) {
          console.error('[updateLeaveRequestStatus] Error code:', (error as any).code);
        }
      }
      throw error;
    }
  },

  // Get leave requests by department
  async getLeaveRequestsByDepartment(department: string): Promise<LeaveRequest[]> {
    const leaveRef = collection(db, COLLECTIONS.LEAVE_REQUESTS);
    const q = query(
      leaveRef, 
      where('department', '==', department),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LeaveRequest[];
  },

  // Get all leave requests (for testing)
  async getAllLeaveRequests(): Promise<LeaveRequest[]> {
    const leaveRef = collection(db, COLLECTIONS.LEAVE_REQUESTS);
    const q = query(
      leaveRef, 
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LeaveRequest[];
  },

  // Test function to verify Firestore operations
  async testFirestoreConnection(): Promise<boolean> {
    try {
      console.log('[testFirestoreConnection] Testing Firestore connection...');
      const testRef = doc(db, 'test', 'connection');
      await setDoc(testRef, { test: true, timestamp: serverTimestamp() });
      console.log('[testFirestoreConnection] Write test successful');
      await deleteDoc(testRef);
      console.log('[testFirestoreConnection] Delete test successful');
      return true;
    } catch (error) {
      console.error('[testFirestoreConnection] Test failed:', error);
      return false;
    }
  },

  // Get leave requests by approver (for approval panel)
  async getLeaveRequestsByApprover(approverId: string): Promise<LeaveRequest[]> {
    try {
      // First get the user to determine their role
      const user = await userService.getUser(approverId);
      if (!user) {
        console.error('User not found:', approverId);
        return [];
      }

      const leaveRef = collection(db, COLLECTIONS.LEAVE_REQUESTS);
      const q = query(
        leaveRef,
        where('status', '==', 'pending')
      );
      const querySnapshot = await getDocs(q);
      
      const allRequests = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeaveRequest[];

      // Sort in memory to avoid composite index requirement
      allRequests.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return bTime.getTime() - aTime.getTime();
      });

      // Map user roles to approval levels
      const roleToLevel: { [key: string]: string } = {
        'teacher': 'Teacher',
        'hod': 'HOD'
      };

      const userLevel = roleToLevel[user.role.toLowerCase()];

      // Filter based on user role and current approval level
      const filteredRequests = allRequests.filter(request => {
        // If no currentApprovalLevel, it's at the first level (Teacher)
        const currentLevel = request.currentApprovalLevel || 'Teacher';
        
        // Return requests that match the user's approval level
        return currentLevel === userLevel;
      });


      return filteredRequests;
    } catch (error) {
      console.error('Error fetching leave requests by approver:', error);
      return [];
    }
  }
};

// Attendance Management
export const attendanceService = {
  // Mark attendance
  async markAttendance(attendanceData: Omit<AttendanceLog, 'id'> & { rollNumber?: string, userName?: string }): Promise<string> {
    // Extract year, sem, div, subject, rollNumber, date from attendanceData
    const { year, sem, div, subject, rollNumber, userId, userName, date } = attendanceData;
    if (!year || !sem || !div || !subject) {
      throw new Error('Missing year, sem, div, or subject for organized attendance path');
    }
    // Ensure date is a string in YYYY-MM-DD format
    let dateString = '';
    if (typeof date === 'string') {
      if ((date as string).length > 10) {
        dateString = (date as string).split('T')[0];
      } else {
        dateString = date as string;
      }
    } else if (date instanceof Date) {
      dateString = date.toISOString().split('T')[0];
    } else if (date && typeof date === 'object' && typeof (date as any).toDate === 'function') {
      dateString = (date as any).toDate().toISOString().split('T')[0];
    }
    const docId = `${rollNumber || userId}_${dateString}`;
    
    // Extract year, month, and date from dateString
    const dateObj = new Date(dateString);
    const attendanceYear = dateObj.getFullYear().toString();
    const attendanceMonth = (dateObj.getMonth() + 1).toString().padStart(2, '0'); // 01, 02, etc.
    const attendanceDate = dateObj.getDate().toString().padStart(2, '0'); // 01, 02, etc.
    
    const batch = getBatchYear(year);
    const department = (attendanceData as any).department || DEPARTMENTS.CSE;
    const studentYear = (attendanceData as any).studentYear || year; // Use studentYear if available, fallback to year
    const collectionPath = buildBatchPath.attendance(batch, department, studentYear, sem, div, subject, dateObj);
    const attendanceRef = doc(collection(db, collectionPath), docId);
    await setDoc(attendanceRef, {
      ...attendanceData,
      batchYear: batch,
      department: department,
      rollNumber: rollNumber || userId,
      userName: userName || '',
      subject: subject || null,
      id: docId,
      createdAt: serverTimestamp(),
      date: dateString
    });
    return docId;
  },

  // Get attendance by user and date range
  async getAttendanceByUserAndDateRange(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<AttendanceLog[]> {
    const attendanceRef = collection(db, COLLECTIONS.ATTENDANCE);
    const q = query(
      attendanceRef,
      where('userId', '==', userId),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const querySnapshot = await getDocs(q);
    
    // Sort in memory to avoid composite index requirement
    const records = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AttendanceLog[];
    
    // Sort by date descending (most recent first)
    return records.sort((a, b) => {
      const aDate = a.date instanceof Date ? a.date : 
                   (a.date as any)?.toDate?.() || new Date(a.date || 0);
      const bDate = b.date instanceof Date ? b.date : 
                   (b.date as any)?.toDate?.() || new Date(b.date || 0);
      return bDate.getTime() - aDate.getTime();
    });
  },

  // Get attendance by user
  async getAttendanceByUser(userId: string): Promise<AttendanceLog[]> {
    const attendanceRef = collection(db, COLLECTIONS.ATTENDANCE);
    const q = query(
      attendanceRef,
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      subject: doc.data().subject || null // Ensure subject is present
    })) as AttendanceLog[];
    return records.sort((a, b) => {
      const aDate = a.date instanceof Date ? a.date : 
                   (a.date as any)?.toDate?.() || new Date(a.date || 0);
      const bDate = b.date instanceof Date ? b.date : 
                   (b.date as any)?.toDate?.() || new Date(b.date || 0);
      return bDate.getTime() - aDate.getTime();
    });
  },

  // Get today's attendance
  async getTodayAttendance(): Promise<AttendanceLog[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const attendanceRef = collection(db, COLLECTIONS.ATTENDANCE);
    const q = query(
      attendanceRef,
      where('date', '>=', today),
      where('date', '<', tomorrow)
    );
    const querySnapshot = await getDocs(q);
    
    // Sort in memory to avoid composite index requirement
    const records = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AttendanceLog[];
    
    // Sort by date descending (most recent first)
    return records.sort((a, b) => {
      const aDate = a.date instanceof Date ? a.date : 
                   (a.date as any)?.toDate?.() || new Date(a.date || 0);
      const bDate = b.date instanceof Date ? b.date : 
                   (b.date as any)?.toDate?.() || new Date(b.date || 0);
      return bDate.getTime() - aDate.getTime();
    });
  },

  // ESL Biometric Machine Integration Functions
  async importESLAttendanceData(eslData: any[]): Promise<void> {
    const batch = writeBatch(db);
    
    for (const record of eslData) {
      const attendanceRef = doc(collection(db, COLLECTIONS.ATTENDANCE));
      const attendanceData = {
        id: attendanceRef.id,
        userId: record.rollNumber || record.userId,
        userName: record.employeeName || record.userName,
        date: new Date(record.date),
        clockIn: record.clockIn,
        clockOut: record.clockOut,
        status: this.calculateAttendanceStatus(record.clockIn, record.clockOut),
        workingHours: this.calculateWorkingHours(record.clockIn, record.clockOut),
        deviceId: record.deviceId || 'ESL_Biometric',
        deviceType: 'ESL_Biometric_Thumb_Scanner',
        location: record.location || 'Main Gate',
        createdAt: serverTimestamp(),
        source: 'ESL_Biometric_Machine'
      };
      
      batch.set(attendanceRef, attendanceData);
    }
    
    await batch.commit();
  },

  // Calculate attendance status based on clock in/out times
  calculateAttendanceStatus(clockIn: string, clockOut?: string): string {
    const clockInTime = new Date(`2000-01-01 ${clockIn}`);
    const expectedTime = new Date('2000-01-01 09:00:00'); // Expected arrival time
    
    if (clockInTime > expectedTime) {
      return 'late';
    }
    
    if (!clockOut) {
      return 'present'; // Only clocked in
    }
    
    return 'present';
  },

  // Calculate working hours
  calculateWorkingHours(clockIn: string, clockOut?: string): string {
    if (!clockOut) {
      return '---';
    }
    
    const clockInTime = new Date(`2000-01-01 ${clockIn}`);
    const clockOutTime = new Date(`2000-01-01 ${clockOut}`);
    
    const diffMs = clockOutTime.getTime() - clockInTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${diffHours}h ${diffMinutes}m`;
  },

  // Sync attendance data from ESL machine
  async syncESLAttendance(deviceId: string, startDate: Date, endDate: Date): Promise<void> {
    // This function would integrate with ESL machine API
    // For now, we'll create a mock implementation
    
    // In real implementation, this would:
    // 1. Connect to ESL machine API
    // 2. Fetch attendance data for the specified period
    // 3. Transform data to our format
    // 4. Import using importESLAttendanceData
  },

  // Get attendance from organized structure by year, sem, div, subject, and date range
  async getOrganizedAttendanceByUserAndDateRange(
    rollNumber: string,
    year: string,
    sem: string,
    div: string,
    subject: string,
    startDate: Date,
    endDate: Date
  ): Promise<AttendanceLog[]> {
    // Path: /attendance/batch/{batch}/DEPARTMENT/year/{studentYear}/sems/{sem}/divs/{div}/subjects/{subject}/{year}/{month}/{day}
    // Use Promise.all for parallel date processing - much faster
    
    // Generate all dates in the range
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    while (currentDate <= endDateObj) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Create promises for all dates to process in parallel
    const datePromises = dates.map(async (date) => {
      const dateString = date.toISOString().split('T')[0];
      const dateObj = new Date(dateString);
      
      // Use batch structure with student year
      const batch = getBatchYear(year);
      const department = DEPARTMENTS.CSE; // Default department, should be passed as parameter
      const collectionPath = buildBatchPath.attendance(batch, department, year, sem, div, subject, dateObj);
      
      try {
        const recordsRef = collection(db, collectionPath);
        const q = query(recordsRef, where('rollNumber', '==', rollNumber));
        const querySnapshot = await getDocs(q);
        
        const records = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AttendanceLog[];
        
        return records;
      } catch (error) {
        console.log(`No attendance data for date: ${dateString}`);
        return [];
      }
    });
    
    // Execute all date queries in parallel using Promise.all
    const dateResults = await Promise.all(datePromises);
    
    // Flatten and sort results
    const attendanceRecords = dateResults.flat().sort((a, b) => {
      const aDate = a.date instanceof Date ? a.date : (a.date as any)?.toDate?.() || new Date(a.date || 0);
      const bDate = b.date instanceof Date ? b.date : (b.date as any)?.toDate?.() || new Date(b.date || 0);
      return aDate.getTime() - bDate.getTime();
    });
    
    return attendanceRecords;
  },

  // Get attendance for a specific date from organized structure
  async getAttendanceByDate(
    year: string,
    sem: string,
    div: string,
    subject: string,
    date: string
  ): Promise<AttendanceLog[]> {
    // Path: attendance/{year}/sems/{sem}/divs/{div}/subjects/{subject}/year/month/date
    const dateObj = new Date(date);
    const attendanceYear = dateObj.getFullYear().toString();
    const attendanceMonth = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const attendanceDate = dateObj.getDate().toString().padStart(2, '0');
    
    const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${attendanceYear}/${attendanceMonth}/${attendanceDate}`;
    const recordsRef = collection(db, collectionPath);
    
    try {
      const querySnapshot = await getDocs(recordsRef);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceLog[];
      
      return records;
    } catch (error) {
      console.log(`No attendance data for date: ${date}`);
      return [];
    }
  },

  // Get all attendance for a specific subject on a specific date
  async getAllAttendanceForSubjectAndDate(
    year: string,
    sem: string,
    div: string,
    subject: string,
    date: string
  ): Promise<AttendanceLog[]> {
    // Path: attendance/{year}/sems/{sem}/divs/{div}/subjects/{subject}/year/month/date
    const dateObj = new Date(date);
    const attendanceYear = dateObj.getFullYear().toString();
    const attendanceMonth = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const attendanceDate = dateObj.getDate().toString().padStart(2, '0');
    
    const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${attendanceYear}/${attendanceMonth}/${attendanceDate}`;
    const recordsRef = collection(db, collectionPath);
    
    try {
      const querySnapshot = await getDocs(recordsRef);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceLog[];
      
      return records;
    } catch (error) {
      console.log(`No attendance data for subject ${subject} on date: ${date}`);
      return [];
    }
  },

  // Get all attendance for a specific subject in a specific month
  async getAttendanceByMonth(
    year: string,
    sem: string,
    div: string,
    subject: string,
    month: string, // Format: "01", "02", etc.
    yearForMonth: string // The year for the month (e.g., "2025")
  ): Promise<AttendanceLog[]> {
    // Path: attendance/{year}/sems/{sem}/divs/{div}/subjects/{subject}/year/month
    const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${yearForMonth}/${month}`;
    const monthRef = collection(db, collectionPath);
    
    try {
      const querySnapshot = await getDocs(monthRef);
      const allRecords: AttendanceLog[] = [];
      
      // Iterate through all date collections in the month
      for (const dateDoc of querySnapshot.docs) {
        const dateCollectionPath = `${collectionPath}/${dateDoc.id}`;
        const dateRef = collection(db, dateCollectionPath);
        const dateQuerySnapshot = await getDocs(dateRef);
        
        const records = dateQuerySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AttendanceLog[];
        
        allRecords.push(...records);
      }
      
      return allRecords;
    } catch (error) {
      console.log(`No attendance data for month: ${month}/${yearForMonth}`);
      return [];
    }
  },

  // Get all attendance for a specific subject in a specific year
  async getAttendanceByYear(
    year: string,
    sem: string,
    div: string,
    subject: string,
    yearForYear: string // The year for the year (e.g., "2025")
  ): Promise<AttendanceLog[]> {
    // Path: attendance/{year}/sems/{sem}/divs/{div}/subjects/{subject}/year
    const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${yearForYear}`;
    const yearRef = collection(db, collectionPath);
    
    try {
      const querySnapshot = await getDocs(yearRef);
      const allRecords: AttendanceLog[] = [];
      
      // Iterate through all month collections in the year
      for (const monthDoc of querySnapshot.docs) {
        const monthCollectionPath = `${collectionPath}/${monthDoc.id}`;
        const monthRef = collection(db, monthCollectionPath);
        const monthQuerySnapshot = await getDocs(monthRef);
        
        // Iterate through all date collections in the month
        for (const dateDoc of monthQuerySnapshot.docs) {
          const dateCollectionPath = `${monthCollectionPath}/${dateDoc.id}`;
          const dateRef = collection(db, dateCollectionPath);
          const dateQuerySnapshot = await getDocs(dateRef);
          
          const records = dateQuerySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as AttendanceLog[];
          
          allRecords.push(...records);
        }
      }
      
      return allRecords;
    } catch (error) {
      console.log(`No attendance data for year: ${yearForYear}`);
      return [];
    }
  },

  // Get all attendance for a specific subject in a specific month (optimized for exports)
  async getAttendanceByMonthOptimized(
    year: string,
    sem: string,
    div: string,
    subject: string,
    month: string, // Format: "01", "02", etc.
    yearForMonth: string // The year for the month (e.g., "2025")
  ): Promise<AttendanceLog[]> {
    // Path: attendance/{year}/sems/{sem}/divs/{div}/subjects/{subject}/year/month
    const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${yearForMonth}/${month}`;
    const monthRef = collection(db, collectionPath);
    
    try {
      const querySnapshot = await getDocs(monthRef);
      const allRecords: AttendanceLog[] = [];
      
      // Iterate through all date collections in the month
      for (const dateDoc of querySnapshot.docs) {
        const dateCollectionPath = `${collectionPath}/${dateDoc.id}`;
        const dateRef = collection(db, dateCollectionPath);
        const dateQuerySnapshot = await getDocs(dateRef);
        
        const records = dateQuerySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AttendanceLog[];
        
        allRecords.push(...records);
      }
      
      return allRecords;
    } catch (error) {
      console.log(`No attendance data for month: ${month}/${yearForMonth}`);
      return [];
    }
  },

  // Get all attendance for a specific date (optimized for exports)
  async getAttendanceByDateOptimized(
    year: string,
    sem: string,
    div: string,
    subject: string,
    date: string
  ): Promise<AttendanceLog[]> {
    // Path: attendance/{year}/sems/{sem}/divs/{div}/subjects/{subject}/year/month/date
    const dateObj = new Date(date);
    const attendanceYear = dateObj.getFullYear().toString();
    const attendanceMonth = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const attendanceDate = dateObj.getDate().toString().padStart(2, '0');
    
    const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${attendanceYear}/${attendanceMonth}/${attendanceDate}`;
    const recordsRef = collection(db, collectionPath);
    
    try {
      const querySnapshot = await getDocs(recordsRef);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceLog[];
      
      return records;
    } catch (error) {
      console.log(`No attendance data for date: ${date}`);
      return [];
    }
  },

  // Get all students' attendance for a specific date and subject (for daily reports)
  async getAllStudentsAttendanceForDate(
    year: string,
    sem: string,
    div: string,
    subject: string,
    date: string
  ): Promise<AttendanceLog[]> {
    // Path: attendance/{year}/sems/{sem}/divs/{div}/subjects/{subject}/year/month/date
    const dateObj = new Date(date);
    const attendanceYear = dateObj.getFullYear().toString();
    const attendanceMonth = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const attendanceDate = dateObj.getDate().toString().padStart(2, '0');
    
    const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${attendanceYear}/${attendanceMonth}/${attendanceDate}`;
    const recordsRef = collection(db, collectionPath);
    
    try {
      const querySnapshot = await getDocs(recordsRef);
      const records = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceLog[];
      
      return records;
    } catch (error) {
      console.log(`No attendance data for date: ${date}`);
      return [];
    }
  },

  // Ultra-fast batch export function using optimized batching strategies
  async getBatchAttendanceForExport(
    year: string,
    sem: string,
    div: string,
    subjects: string[],
    startDate: Date,
    endDate: Date,
    studentRollNumbers: string[],
    progressCallback?: (progress: number) => void
  ): Promise<{ [studentRoll: string]: { [subject: string]: AttendanceLog[] } }> {
    // Add safety limits to prevent extremely long exports
    const MAX_STUDENTS = 100;
    const MAX_SUBJECTS = 15;
    const MAX_DAYS = 90; // 3 months max
    
    if (studentRollNumbers.length > MAX_STUDENTS) {
      throw new Error(`Too many students (${studentRollNumbers.length}). Maximum allowed: ${MAX_STUDENTS}`);
    }
    
    if (subjects.length > MAX_SUBJECTS) {
      throw new Error(`Too many subjects (${subjects.length}). Maximum allowed: ${MAX_SUBJECTS}`);
    }
    
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > MAX_DAYS) {
      throw new Error(`Date range too large (${daysDiff} days). Maximum allowed: ${MAX_DAYS} days`);
    }

    console.log(`🚀 Starting ULTRA-FAST batch export for ${studentRollNumbers.length} students, ${subjects.length} subjects, ${daysDiff} days`);
    
    const result: { [studentRoll: string]: { [subject: string]: AttendanceLog[] } } = {};
    
    // Initialize result structure
    studentRollNumbers.forEach(roll => {
      result[roll] = {};
      subjects.forEach(subject => {
        result[roll][subject] = [];
      });
    });

    // Generate all dates in the range once
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // OPTIMIZATION: Use larger batch queries instead of individual date queries
    // Group dates by month to reduce the number of queries
    const monthGroups: { [key: string]: string[] } = {};
    dates.forEach(dateStr => {
      const dateObj = new Date(dateStr);
      const monthKey = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(dateStr);
    });

    console.log(`📅 Grouped ${dates.length} dates into ${Object.keys(monthGroups).length} month batches`);

    // Create promises for each subject-month combination (much fewer queries)
    const allPromises: Promise<{ subject: string; monthKey: string; records: AttendanceLog[] }>[] = [];

    subjects.forEach(subject => {
      Object.keys(monthGroups).forEach(monthKey => {
        const promise = (async () => {
          try {
            const [yearStr, monthStr] = monthKey.split('-');
            const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${yearStr}/${monthStr}`;
            const monthRef = collection(db, collectionPath);
            
            // Get all documents in this month
            const querySnapshot = await getDocs(monthRef);
            const allRecords: AttendanceLog[] = [];
            
            // Process each date subcollection
            const datePromises = querySnapshot.docs.map(async (dateDoc) => {
              const dateRef = collection(db, `${collectionPath}/${dateDoc.id}`);
              const dateSnapshot = await getDocs(dateRef);
              return dateSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as AttendanceLog[];
            });
            
            const dateResults = await Promise.all(datePromises);
            dateResults.forEach(records => {
              allRecords.push(...records);
            });
            
            return { subject, monthKey, records: allRecords };
          } catch (error) {
            console.log(`No data for ${subject} in ${monthKey}`);
            return { subject, monthKey, records: [] };
          }
        })();
        
        allPromises.push(promise);
      });
    });

    console.log(`⚡ Executing ${allPromises.length} optimized parallel queries (vs ${subjects.length * dates.length} individual queries)`);
    
    // Execute ALL promises simultaneously with progress updates
    const allResults = await Promise.all(allPromises);
    
    if (progressCallback) {
      progressCallback(1.0); // 100% complete
    }
    
    console.log(`✅ All queries completed. Processing results...`);
    
    // Process all results and organize by student
    allResults.forEach(({ subject, monthKey, records }) => {
      records.forEach(record => {
        // Extract roll number from the document ID (format: rollNumber_date)
        const rollNumber = record.id.split('_')[0];
        if (rollNumber && result[rollNumber] && result[rollNumber][subject]) {
          result[rollNumber][subject].push(record);
        }
      });
    });

    console.log(`🎉 ULTRA-FAST batch export completed successfully!`);
    return result;
  },

  // Test function to check student data in organized collections
  async testStudentSearch(email: string): Promise<{ found: boolean; locations: string[]; details?: any }> {
    console.log(`🧪 Testing student search for: ${email}`);
    const locations: string[] = [];
    
    try {
      // Search in all possible year/sem/div combinations
      const years = ['2', '3', '4'];
      const sems = ['3', '5', '7'];
      const divs = ['A', 'B', 'C'];
      
      for (const year of years) {
        for (const sem of sems) {
          for (const div of divs) {
            try {
              const collectionPath = `students/${year}/sems/${sem}/divs/${div}/students`;
              const studentsRef = collection(db, collectionPath);
              const q = query(studentsRef, where('email', '==', email));
              const querySnapshot = await getDocs(q);
              
              if (!querySnapshot.empty) {
                const location = `${collectionPath}/${querySnapshot.docs[0].id}`;
                locations.push(location);
                console.log(`✅ Found in: ${location}`);
                
                const student = querySnapshot.docs[0].data();
                console.log(`📋 Student details:`, student);
                
                return {
                  found: true,
                  locations: [location],
                  details: student
                };
              }
            } catch (error) {
              console.log(`⚠️ Error searching in ${year}/${sem}/${div}:`, error);
              continue;
            }
          }
        }
      }
      
      console.log(`❌ Student not found in organized collections`);
      return { found: false, locations: [] };
      
    } catch (error) {
      console.error('❌ Error in testStudentSearch:', error);
      return { found: false, locations: [] };
    }
  },

  // NEW: Ultra-fast parallel export for ALL students at once
  async getUltraFastParallelExport(
    year: string,
    sem: string,
    div: string,
    subjects: string[],
    startDate: Date,
    endDate: Date,
    studentRollNumbers: string[]
  ): Promise<{ [studentRoll: string]: { [subject: string]: AttendanceLog[] } }> {
    console.log(`🚀 Starting ULTRA-FAST parallel export for ${studentRollNumbers.length} students, ${subjects.length} subjects`);
    
    const result: { [studentRoll: string]: { [subject: string]: AttendanceLog[] } } = {};
    
    // Initialize result structure
    studentRollNumbers.forEach(roll => {
      result[roll] = {};
      subjects.forEach(subject => {
        result[roll][subject] = [];
      });
    });

    // Generate all dates in the range once
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`📅 Processing ${dates.length} dates: ${dates.join(', ')}`);

    // Create ALL promises for parallel execution - ONE PROMISE PER SUBJECT-DATE COMBINATION
    const allPromises: Promise<{ subject: string; date: string; records: AttendanceLog[] }>[] = [];

    // Create promises for each subject-date combination
    subjects.forEach(subject => {
      dates.forEach(dateStr => {
        const promise = (async () => {
          try {
            const dateObj = new Date(dateStr);
            const attendanceYear = dateObj.getFullYear().toString();
            const attendanceMonth = (dateObj.getMonth() + 1).toString().padStart(2, '0');
            const attendanceDate = dateObj.getDate().toString().padStart(2, '0');
            
            const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${attendanceYear}/${attendanceMonth}/${attendanceDate}`;
            const recordsRef = collection(db, collectionPath);
            
            const querySnapshot = await getDocs(recordsRef);
            const records = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as AttendanceLog[];
            
            return { subject, date: dateStr, records };
          } catch (error) {
            return { subject, date: dateStr, records: [] };
          }
        })();
        
        allPromises.push(promise);
      });
    });

    console.log(`⚡ Executing ${allPromises.length} parallel queries simultaneously...`);
    
    // Execute ALL promises simultaneously - THIS IS THE KEY!
    const allResults = await Promise.all(allPromises);
    
    console.log(`✅ All ${allResults.length} queries completed! Processing results...`);
    
    // Process all results and organize by student - SINGLE PASS
    allResults.forEach(({ subject, date, records }) => {
      records.forEach(record => {
        // Extract roll number from the document ID (format: rollNumber_date)
        const rollNumber = record.id.split('_')[0];
        if (rollNumber && result[rollNumber] && result[rollNumber][subject]) {
          result[rollNumber][subject].push(record);
        }
      });
    });

    console.log(`🎉 ULTRA-FAST parallel export completed successfully!`);
    return result;
  }
};

// Batch Attendance Management
export const batchAttendanceService = {
  // Mark batch attendance
  async markBatchAttendance(attendanceData: Omit<AttendanceLog, 'id'> & { 
    rollNumber?: string, 
    userName?: string,
    batchName?: string,
    fromRollNo?: string,
    toRollNo?: string,
    isBatchAttendance?: boolean
  }): Promise<string> {
    const { year, sem, div, subject, rollNumber, userId, userName, date, batchName, fromRollNo, toRollNo } = attendanceData;
    
    if (!year || !sem || !div || !subject || !batchName) {
      throw new Error('Missing required fields for batch attendance: year, sem, div, subject, or batchName');
    }

    // Ensure date is a string in YYYY-MM-DD format
    let dateString = '';
    if (typeof date === 'string') {
      if ((date as string).length > 10) {
        dateString = (date as string).split('T')[0];
      } else {
        dateString = date as string;
      }
    } else if (date instanceof Date) {
      dateString = date.toISOString().split('T')[0];
    } else if (date && typeof date === 'object' && typeof (date as any).toDate === 'function') {
      dateString = (date as any).toDate().toISOString().split('T')[0];
    }

    const docId = `${rollNumber || userId}_${dateString}`;
    const dateObj = new Date(dateString);
    
    const batch = getBatchYear(year);
    const department = (attendanceData as any).department || DEPARTMENTS.CSE;
    const studentYear = (attendanceData as any).studentYear || year;
    
    // Build batch attendance collection path
    const collectionPath = buildBatchPath.batchAttendance(batch, department, studentYear, sem, div, batchName, subject, dateObj);
    const attendanceRef = doc(collection(db, collectionPath), docId);
    
    await setDoc(attendanceRef, {
      ...attendanceData,
      batchYear: batch,
      department: department,
      rollNumber: rollNumber || userId,
      userName: userName || '',
      subject: subject || null,
      batchName: batchName,
      fromRollNo: fromRollNo || '',
      toRollNo: toRollNo || '',
      isBatchAttendance: true,
      id: docId,
      createdAt: serverTimestamp(),
      date: dateString
    });
    
    return docId;
  },

  // Get batch attendance by date and batch
  async getBatchAttendanceByDate(
    year: string, 
    sem: string, 
    div: string, 
    batchName: string, 
    subject: string, 
    date: string
  ): Promise<AttendanceLog[]> {
    const dateObj = new Date(date);
    const batch = getBatchYear(year);
    const department = DEPARTMENTS.CSE;
    const studentYear = year;
    
    const collectionPath = buildBatchPath.batchAttendance(batch, department, studentYear, sem, div, batchName, subject, dateObj);
    const attendanceRef = collection(db, collectionPath);
    const snapshot = await getDocs(attendanceRef);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as AttendanceLog));
  },

  // Get all batch attendance for a subject and date
  async getAllBatchAttendanceForSubjectAndDate(
    year: string, 
    sem: string, 
    div: string, 
    subject: string, 
    date: string
  ): Promise<{ [batchName: string]: AttendanceLog[] }> {
    const batchNames = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4'];
    const result: { [batchName: string]: AttendanceLog[] } = {};
    
    await Promise.all(
      batchNames.map(async (batchName) => {
        try {
          const attendance = await this.getBatchAttendanceByDate(year, sem, div, batchName, subject, date);
          if (attendance.length > 0) {
            result[batchName] = attendance;
          }
        } catch (error) {
          // Batch might not exist, continue with other batches
          console.log(`No attendance found for batch ${batchName}`);
        }
      })
    );
    
    return result;
  }
};

// Batch Management Service
export const batchService = {
  // Create a new batch
  async createBatch(batchData: {
    batchName: string;
    fromRollNo: string;
    toRollNo: string;
    year: string;
    sem: string;
    div: string;
    department: string;
  }): Promise<string> {
    const { batchName, fromRollNo, toRollNo, year, sem, div, department } = batchData;
    
    if (!batchName || !fromRollNo || !toRollNo || !year || !sem || !div || !department) {
      throw new Error('Missing required fields for batch creation');
    }

    const batch = getBatchYear(year);
    const batchRef = doc(collection(db, 'batches'));
    
    const batchDoc = {
      id: batchRef.id,
      batchName,
      fromRollNo,
      toRollNo,
      year,
      sem,
      div,
      department,
      batchYear: batch,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(batchRef, batchDoc);
    return batchRef.id;
  },

  // Get batches by filters
  async getBatchesByFilters(
    batch: string,
    department: string,
    year: string,
    sem: string,
    div: string
  ): Promise<any[]> {
    const batchesRef = collection(db, 'batches');
    const q = query(
      batchesRef,
      where('batchYear', '==', batch),
      where('department', '==', department),
      where('year', '==', year),
      where('sem', '==', sem),
      where('div', '==', div)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },

  // Get a specific batch
  async getBatch(
    batch: string,
    department: string,
    year: string,
    sem: string,
    div: string,
    batchName: string
  ): Promise<any | null> {
    const batchesRef = collection(db, 'batches');
    const q = query(
      batchesRef,
      where('batchYear', '==', batch),
      where('department', '==', department),
      where('year', '==', year),
      where('sem', '==', sem),
      where('div', '==', div),
      where('batchName', '==', batchName)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    }
    return null;
  },

  // Update a batch
  async updateBatch(batchId: string, batchData: {
    batchName: string;
    fromRollNo: string;
    toRollNo: string;
    year: string;
    sem: string;
    div: string;
    department: string;
  }): Promise<void> {
    const { fromRollNo, toRollNo } = batchData;
    
    const batchRef = doc(db, 'batches', batchId);
    
    await updateDoc(batchRef, {
      fromRollNo,
      toRollNo,
      updatedAt: serverTimestamp()
    });
  },

  // Delete a batch
  async deleteBatch(batchId: string): Promise<void> {
    const batchRef = doc(db, 'batches', batchId);
    await deleteDoc(batchRef);
  },

  // Get all batches for a division (for dropdown)
  async getBatchesForDivision(
    batch: string,
    department: string,
    year: string,
    sem: string,
    div: string
  ): Promise<{ batchName: string; fromRollNo: string; toRollNo: string }[]> {
    const batches = await this.getBatchesByFilters(batch, department, year, sem, div);
    return batches.map(b => ({
      batchName: b.batchName,
      fromRollNo: b.fromRollNo,
      toRollNo: b.toRollNo
    }));
  },

  // Get roll numbers for a specific batch
  async getRollNumbersForBatch(
    batch: string,
    department: string,
    year: string,
    sem: string,
    div: string,
    batchName: string
  ): Promise<number[]> {
    const batchData = await this.getBatch(batch, department, year, sem, div, batchName);
    if (!batchData) {
      return [];
    }
    
    const fromRoll = parseInt(batchData.fromRollNo);
    const toRoll = parseInt(batchData.toRollNo);
    const rollNumbers: number[] = [];
    
    for (let i = fromRoll; i <= toRoll; i++) {
      rollNumbers.push(i);
    }
    
    return rollNumbers;
  }
};

// Notification Management
export const notificationService = {
  // Create notification
  async createNotification(notificationData: Omit<Notification, 'id'>): Promise<string> {
    const notificationRef = collection(db, COLLECTIONS.NOTIFICATIONS);
    const docRef = await addDoc(notificationRef, {
      ...notificationData,
      createdAt: serverTimestamp(),
      read: false
    });
    return docRef.id;
  },

  // Get notifications by user
  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    const notificationRef = collection(db, COLLECTIONS.NOTIFICATIONS);
    const q = query(
      notificationRef,
      where('userId', '==', userId),
      limit(50)
    );
    const querySnapshot = await getDocs(q);
    
    // Sort in memory to avoid composite index requirement
    const notifications = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Notification[];
    
    // Sort by createdAt descending (most recent first)
    return notifications.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return bTime.getTime() - aTime.getTime();
    });
  },

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<void> {
    const notificationRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp()
    });
  },

  // Archive notification
  async archiveNotification(notificationId: string): Promise<void> {
    const notificationRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
    await updateDoc(notificationRef, {
      archived: true,
      archivedAt: serverTimestamp()
    });
  },

  // Delete notification
  async deleteNotification(notificationId: string): Promise<void> {
    const notificationRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
    await deleteDoc(notificationRef);
  },

  // Get unread notifications count
  async getUnreadNotificationsCount(userId: string): Promise<number> {
    const notificationRef = collection(db, COLLECTIONS.NOTIFICATIONS);
    const q = query(
      notificationRef,
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  },

  // Get all notifications (for testing)
  async getAllNotifications(): Promise<Notification[]> {
    const notificationRef = collection(db, COLLECTIONS.NOTIFICATIONS);
    const q = query(
      notificationRef,
      limit(100)
    );
    const querySnapshot = await getDocs(q);
    
    // Sort in memory to avoid composite index requirement
    const notifications = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Notification[];
    
    // Sort by createdAt descending (most recent first)
    return notifications.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
      return bTime.getTime() - aTime.getTime();
    });
  }
};

// Real-time listeners
export const realtimeService = {
  // Listen to user's leave requests
  onLeaveRequestsChange(userId: string, callback: (requests: LeaveRequest[]) => void) {
    const leaveRef = collection(db, COLLECTIONS.LEAVE_REQUESTS);
    const q = query(
      leaveRef,
      where('userId', '==', userId)
    );
    
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeaveRequest[];
      
      // Sort in memory to avoid composite index requirement
      requests.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return bTime.getTime() - aTime.getTime();
      });
      
      callback(requests);
    });
  },

  // Listen to pending leave requests
  onPendingLeaveRequestsChange(callback: (requests: LeaveRequest[]) => void) {
    const leaveRef = collection(db, COLLECTIONS.LEAVE_REQUESTS);
    const q = query(
      leaveRef,
      where('status', '==', 'pending')
    );
    
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeaveRequest[];
      
      // Sort in memory to avoid composite index requirement
      requests.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return bTime.getTime() - aTime.getTime();
      });
      
      callback(requests);
    });
  },

  // Listen to user's notifications
  onNotificationsChange(userId: string, callback: (notifications: Notification[]) => void) {
    const notificationRef = collection(db, COLLECTIONS.NOTIFICATIONS);
    const q = query(
      notificationRef,
      where('userId', '==', userId),
      limit(20)
    );
    
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      
      // Sort in memory to avoid composite index requirement
      notifications.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return bTime.getTime() - aTime.getTime();
      });
      
      callback(notifications);
    });
  }
}; 

// Roll Number Change Management Service
export const rollNumberChangeService = {
  // Get roll number change history for a student
  async getRollNumberHistory(userId: string): Promise<any[]> {
    try {
      const mappingRef = doc(db, 'rollNumberMappings', userId);
      const mappingDoc = await getDoc(mappingRef);
      
      if (mappingDoc.exists()) {
        return [mappingDoc.data()];
      }
      
      return [];
    } catch (error) {
      console.error('[rollNumberChangeService] Error getting roll number history:', error);
      return [];
    }
  },

  // Get all students with roll number changes
  async getAllRollNumberChanges(): Promise<any[]> {
    try {
      const mappingsSnapshot = await getDocs(collection(db, 'rollNumberMappings'));
      return mappingsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('[rollNumberChangeService] Error getting all roll number changes:', error);
      return [];
    }
  },

  // Search records by old roll number
  async searchByOldRollNumber(oldRollNumber: string): Promise<any> {
    try {
      const results: {
        attendance: any[];
        leaves: any[];
        notifications: any[];
        auditLogs: any[];
      } = {
        attendance: [],
        leaves: [],
        notifications: [],
        auditLogs: []
      };

      // Search in main collections
      const attendanceQuery = query(
        collection(db, COLLECTIONS.ATTENDANCE),
        where('previousRollNumber', '==', oldRollNumber)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      results.attendance = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const leaveQuery = query(
        collection(db, COLLECTIONS.LEAVE_REQUESTS),
        where('previousRollNumber', '==', oldRollNumber)
      );
      const leaveSnapshot = await getDocs(leaveQuery);
      results.leaves = leaveSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const notificationQuery = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('previousRollNumber', '==', oldRollNumber)
      );
      const notificationSnapshot = await getDocs(notificationQuery);
      results.notifications = notificationSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const auditQuery = query(
        collection(db, COLLECTIONS.AUDIT_LOGS),
        where('previousRollNumber', '==', oldRollNumber)
      );
      const auditSnapshot = await getDocs(auditQuery);
      results.auditLogs = auditSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return results;
    } catch (error) {
      console.error('[rollNumberChangeService] Error searching by old roll number:', error);
      return { attendance: [], leaves: [], notifications: [], auditLogs: [] };
    }
  },

  // Get complete student history including roll number changes
  async getCompleteStudentHistory(userId: string, currentRollNumber: string): Promise<any> {
    try {
      const history: {
        currentRollNumber: string;
        rollNumberChanges: any[];
        attendance: any[];
        leaves: any[];
        notifications: any[];
        auditLogs: any[];
      } = {
        currentRollNumber: currentRollNumber,
        rollNumberChanges: [],
        attendance: [],
        leaves: [],
        notifications: [],
        auditLogs: []
      };

      // Get roll number change history
      history.rollNumberChanges = await this.getRollNumberHistory(userId);

      // Get all attendance records (current and previous roll numbers)
      const attendanceQuery = query(
        collection(db, COLLECTIONS.ATTENDANCE),
        where('userId', '==', userId)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      history.attendance = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get all leave records
      const leaveQuery = query(
        collection(db, COLLECTIONS.LEAVE_REQUESTS),
        where('userId', '==', userId)
      );
      const leaveSnapshot = await getDocs(leaveQuery);
      history.leaves = leaveSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get all notification records
      const notificationQuery = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('userId', '==', userId)
      );
      const notificationSnapshot = await getDocs(notificationQuery);
      history.notifications = notificationSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Get all audit log records
      const auditQuery = query(
        collection(db, COLLECTIONS.AUDIT_LOGS),
        where('userId', '==', userId)
      );
      const auditSnapshot = await getDocs(auditQuery);
      history.auditLogs = auditSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return history;
    } catch (error) {
      console.error('[rollNumberChangeService] Error getting complete student history:', error);
      return {
        currentRollNumber: currentRollNumber,
        rollNumberChanges: [],
        attendance: [],
        leaves: [],
        notifications: [],
        auditLogs: []
      };
    }
  },

  // Export student history with roll number changes
  async exportStudentHistoryWithRollNumberChanges(
    userId: string,
    currentRollNumber: string,
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<{ success: boolean; data?: any; filename?: string; message?: string }> {
    try {
      const history = await this.getCompleteStudentHistory(userId, currentRollNumber);
      
      if (!history.attendance.length && !history.leaves.length) {
        return {
          success: false,
          message: 'No historical data found for this student'
        };
      }

      const filename = `student_history_${currentRollNumber}_${new Date().toISOString().split('T')[0]}.${format}`;
      
      return {
        success: true,
        data: history,
        filename: filename
      };
    } catch (error) {
      console.error('[rollNumberChangeService] Error exporting student history:', error);
      return {
        success: false,
        message: `Export failed: ${(error as any).message}`
      };
    }
  }
};

// Result Management
export const resultService = {
  // Create or update a result entry (Teacher/HOD access)
  async upsertResult(result: Omit<ResultRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
    const {
      id,
      userId,
      userName,
      rollNumber,
      batch,
      department,
      year,
      sem,
      div,
      subject,
      examType,
      marksObtained,
      maxMarks,
      percentage,
      grade,
      remarks
    } = result;

    const studentYear = year; // align with attendance path builder
    const collectionPath = buildBatchPath.result(batch, department, studentYear, sem, div, subject, examType);

    // Document id: rollNumber for hierarchical path
    const docId = id || rollNumber;

    // Prepare data object, filtering out undefined values
    const resultData: any = {
      id: docId,
      userId,
      userName: userName || '',
      rollNumber,
      batch,
      department,
      year,
      sem,
      div,
      subject,
      examType,
      marksObtained,
      maxMarks,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    // Only add fields that have values
    if (typeof percentage === 'number') {
      resultData.percentage = percentage;
    } else if (maxMarks > 0) {
      resultData.percentage = (marksObtained / maxMarks) * 100;
    }

    if (grade && grade.trim()) {
      resultData.grade = grade;
    }

    if (remarks && remarks.trim()) {
      resultData.remarks = remarks;
    }

    // Write to hierarchical path
    const ref = doc(collection(db, collectionPath), docId);
    await setDoc(ref, resultData, { merge: true });

    // Also write to flat collection for easy querying (like attendance system)
    const flatRef = doc(collection(db, COLLECTIONS.RESULTS), `${batch}_${department}_${studentYear}_${sem}_${div}_${subject}_${examType}_${rollNumber}`);
    await setDoc(flatRef, resultData, { merge: true });

    return docId;
  },

  // Get class results by subject and exam type (Teacher/HOD)
  async getClassResults(
    batch: string,
    department: string,
    year: string,
    sem: string,
    div: string,
    subject: string,
    examType: string
  ): Promise<ResultRecord[]> {
    try {
      const collectionPath = buildBatchPath.result(batch, department, year, sem, div, subject, examType);
      const qSnap = await getDocs(collection(db, collectionPath));
      return qSnap.docs.map(d => ({ id: d.id, ...d.data() } as ResultRecord));
    } catch (err) {
      console.error('Error getting class results:', err);
      return [];
    }
  },

  // Get a student's results across subjects/exams (similar to getAttendanceByUser)
  async getMyResults(userId: string): Promise<ResultRecord[]> {
    try {
      console.log('Getting results for userId:', userId);

      // Read user to get rollNumber fallback
      const userDocRef = doc(db, COLLECTIONS.USERS, userId);
      const userDocSnap = await getDoc(userDocRef);
      const rollNumber = userDocSnap.exists() ? (userDocSnap.data() as any).rollNumber : undefined;
      // Try to guess roll from userId if not present
      const guessedRoll = rollNumber || (userId.match(/\d{2,}/)?.[0] ?? undefined);

      const resultsRef = collection(db, COLLECTIONS.RESULTS);

      // Run both queries in parallel: by userId and by rollNumber (if available)
      const queries: Promise<QuerySnapshot<DocumentData>>[] = [];
      queries.push(getDocs(query(resultsRef, where('userId', '==', userId))));
      if (rollNumber) {
        queries.push(getDocs(query(resultsRef, where('rollNumber', '==', String(rollNumber)))));
      }

      const snaps = await Promise.all(queries);
      const merged: Record<string, ResultRecord> = {};
      snaps.forEach(snap => {
        snap.docs.forEach(d => {
          const rec = { id: d.id, ...(d.data() as any) } as ResultRecord;
          merged[d.id] = rec;
        });
      });

      let records = Object.values(merged);
      console.log('Found results (merged):', records.length);

      // If still empty, backfill from hierarchical path once (like attendance organized lookup)
      if (records.length === 0 && userDocSnap.exists()) {
        const userData = userDocSnap.data() as any;
        const batch = getBatchYear(userData.year || '1st');
        const department = getDepartmentCode(userData.department);
        const year = userData.year || '1st';
        const sem = userData.sem || '1';
        const div = userData.div || 'A';
        const targetIdOrRoll = guessedRoll || userId;
        console.log('Backfill scan:', { batch, department, year, sem, div, targetIdOrRoll });

        // Get subjects first
        const subjects = await subjectService.getSubjectsByDepartment(department, year, sem);
        const examTypes = ['UT1', 'UT2', 'Practical', 'Viva', 'Midterm', 'Endsem'];
        for (const s of subjects) {
          for (const examType of examTypes) {
            try {
              const hierPath = buildBatchPath.result(batch, department, year, sem, div, s.subjectName, examType);
              const marksSnap = await getDocs(collection(db, hierPath));
              for (const d of marksSnap.docs) {
                const data = d.data() as any;
                if (data.userId === userId || data.rollNumber === targetIdOrRoll || d.id === targetIdOrRoll) {
                  const rec = { id: d.id, ...data } as ResultRecord;
                  merged[`${batch}_${department}_${year}_${sem}_${div}_${s.subjectName}_${examType}_${d.id}`] = rec;
                  // Mirror into flat collection for future fast queries
                  const flatId = `${batch}_${department}_${year}_${sem}_${div}_${s.subjectName}_${examType}_${d.id}`;
                  await setDoc(doc(collection(db, COLLECTIONS.RESULTS), flatId), rec, { merge: true });
                }
              }
            } catch {}
          }
        }
        records = Object.values(merged);
        console.log('Backfill found:', records.length);
      }

      // Sort newest updated first if available
      return records.sort((a, b) => {
        const aT = (a.updatedAt as any)?.toDate?.() || new Date(a.updatedAt || 0);
        const bT = (b.updatedAt as any)?.toDate?.() || new Date(b.updatedAt || 0);
        return bT.getTime() - aT.getTime();
      });
    } catch (error) {
      console.error('Error getting user results:', error);
      return [];
    }
  },

  // Get a student's results filtered by subject and exam type
  async getMyResultsBySubjectExam(userId: string, subject: string, examType?: string): Promise<ResultRecord[]> {
    const allResults = await this.getMyResults(userId);
    
    // Filter by subject and exam type
    let filtered = allResults.filter(r => r.subject === subject);
    if (examType) {
      filtered = filtered.filter(r => r.examType === examType);
    }
    
    return filtered;
  },

  // Export results by batch (for teachers/HOD)
  async exportResultsByBatch(
    batch: string,
    department: string,
    year: string,
    sem: string,
    div: string,
    subject: string,
    examType: string,
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<{ success: boolean; data?: any; filename?: string; message?: string }> {
    try {
      const results = await this.getClassResults(batch, department, year, sem, div, subject, examType);
      
      if (results.length === 0) {
        return {
          success: false,
          message: 'No results found for the specified criteria'
        };
      }

      const exportData = results.map(result => ({
        'Roll Number': result.rollNumber,
        'Student Name': result.userName || '',
        'Subject': result.subject,
        'Exam Type': result.examType,
        'Marks Obtained': result.marksObtained,
        'Max Marks': result.maxMarks,
        'Percentage': typeof result.percentage === 'number' ? `${result.percentage.toFixed(1)}%` : '',
        'Year': result.year,
        'Semester': result.sem,
        'Division': result.div,
        'Batch': result.batch,
        'Department': result.department
      }));

      const filename = `results_${batch}_${department}_${year}_${sem}_${div}_${subject}_${examType}.${format}`;

      return {
        success: true,
        data: exportData,
        filename: filename
      };
    } catch (error) {
      console.error('Error exporting results:', error);
      return {
        success: false,
        message: `Export failed: ${error}`
      };
    }
  },

  // Import results by batch (for teachers/HOD)
  async importResultsByBatch(
    batch: string,
    department: string,
    year: string,
    sem: string,
    div: string,
    resultsData: any[]
  ): Promise<{ success: boolean; imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      for (const row of resultsData) {
        try {
          const rollNumber = String(row.rollNumber || row.roll || '').trim();
          if (!rollNumber) {
            errors.push(`Row ${resultsData.indexOf(row) + 1}: Missing roll number`);
            continue;
          }

          const subject = String(row.subject || '').trim();
          if (!subject) {
            errors.push(`Row ${resultsData.indexOf(row) + 1}: Missing subject`);
            continue;
          }

          const examType = String(row.examType || row.exam || '').trim();
          if (!examType) {
            errors.push(`Row ${resultsData.indexOf(row) + 1}: Missing exam type`);
            continue;
          }

          const marksObtained = Number(row.marksObtained || row.obtained || row.marks || 0);
          const maxMarks = Number(row.maxMarks || row.total || row.max || 20);

          if (isNaN(marksObtained) || isNaN(maxMarks) || marksObtained < 0 || maxMarks <= 0) {
            errors.push(`Row ${resultsData.indexOf(row) + 1}: Invalid marks (${marksObtained}/${maxMarks})`);
            continue;
          }

          await this.upsertResult({
            userId: rollNumber, // fallback if student not found
            userName: String(row.name || row.studentName || ''),
            rollNumber,
            batch,
            department,
            year,
            sem,
            div,
            subject,
            examType,
            marksObtained,
            maxMarks
          });

          imported++;
        } catch (error) {
          errors.push(`Row ${resultsData.indexOf(row) + 1}: ${error}`);
        }
      }

      return {
        success: errors.length === 0,
        imported,
        errors
      };
    } catch (error) {
      return {
        success: false,
        imported: 0,
        errors: [`Import failed: ${error}`]
      };
    }
  }
};

// Batch Migration Service with Department Support
export const batchMigrationService = {
  // Migrate existing data to batch 2025 with department structure
  async migrateToBatch2025(): Promise<{ success: boolean; message?: string; details?: any }> {
    try {
      console.log('[batchMigrationService] Starting migration to batch 2025 with department structure...');
      
      const results = {
        students: { migrated: 0, errors: 0 },
        teachers: { migrated: 0, errors: 0 },
        attendance: { migrated: 0, errors: 0 },
        leaves: { migrated: 0, errors: 0 }
      };

      // Migrate students
      try {
        const studentsSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
        for (const docSnapshot of studentsSnapshot.docs) {
          const student = docSnapshot.data();
          if (student.role === 'student') {
            try {
              if (student.year && student.sem && student.div) {
                // Use batch 2025 for existing data
                const department = getDepartment(student);
                const batchPath = buildBatchPath.student('2025', department, student.year, student.sem, student.div);
                const studentRef = doc(db, batchPath, student.rollNumber || student.id);
                await setDoc(studentRef, {
                  ...student,
                  batchYear: '2025',
                  department: department,
                  migratedFrom: 'legacy',
                  migratedAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  createdAt: serverTimestamp()
                }, { merge: true });
                results.students.migrated++;
              }
            } catch (error) {
              console.error('[batchMigrationService] Error migrating student:', student.id, error);
              results.students.errors++;
            }
          }
        }
      } catch (error) {
        console.error('[batchMigrationService] Error migrating students:', error);
      }

      // Migrate teachers
      try {
        const teachersSnapshot = await getDocs(collection(db, COLLECTIONS.TEACHERS));
        for (const docSnapshot of teachersSnapshot.docs) {
          const teacher = docSnapshot.data();
          try {
            if (teacher.year && teacher.sem && teacher.div) {
              const department = getDepartment(teacher);
              const batchPath = buildBatchPath.teacher('2025', department, teacher.sem, teacher.div);
              const teacherRef = doc(db, batchPath, teacher.id);
              await setDoc(teacherRef, {
                ...teacher,
                batchYear: '2025',
                department: department,
                migratedFrom: 'legacy',
                migratedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
              }, { merge: true });
              results.teachers.migrated++;
            }
          } catch (error) {
            console.error('[batchMigrationService] Error migrating teacher:', teacher.id, error);
            results.teachers.errors++;
          }
        }
      } catch (error) {
        console.error('[batchMigrationService] Error migrating teachers:', error);
      }

      // Migrate attendance records
      try {
        const attendanceSnapshot = await getDocs(collection(db, COLLECTIONS.ATTENDANCE));
        for (const docSnapshot of attendanceSnapshot.docs) {
          const attendance = docSnapshot.data();
          try {
            if (attendance.year && attendance.sem && attendance.div && attendance.subject && attendance.date) {
              const batch = getBatchYear(attendance.year);
              const department = getDepartment(attendance);
              const dateObj = new Date(attendance.date);
              const batchPath = buildBatchPath.attendance(batch, department, attendance.year, attendance.sem, attendance.div, attendance.subject, dateObj);
              const attendanceRef = doc(db, batchPath, attendance.id);
              await setDoc(attendanceRef, {
                ...attendance,
                batchYear: batch,
                department: department,
                migratedFrom: 'legacy',
                migratedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
              }, { merge: true });
              results.attendance.migrated++;
            }
          } catch (error) {
            console.error('[batchMigrationService] Error migrating attendance:', attendance.id, error);
            results.attendance.errors++;
          }
        }
      } catch (error) {
        console.error('[batchMigrationService] Error migrating attendance:', error);
      }

      // Migrate leave requests
      try {
        const leavesSnapshot = await getDocs(collection(db, COLLECTIONS.LEAVE_REQUESTS));
        for (const docSnapshot of leavesSnapshot.docs) {
          const leave = docSnapshot.data();
          try {
            if (leave.year && leave.sem && leave.div && leave.fromDate) {
              const batch = getBatchYear(leave.year);
              const department = getDepartment(leave);
              const dateObj = new Date(leave.fromDate);
              const subject = leave.subject || 'General';
              const batchPath = buildBatchPath.leave(batch, department, leave.year, leave.sem, leave.div, subject, dateObj);
              const leaveRef = doc(db, batchPath, leave.id);
              await setDoc(leaveRef, {
                ...leave,
                batchYear: batch,
                department: department,
                migratedFrom: 'legacy',
                migratedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdAt: serverTimestamp()
              }, { merge: true });
              results.leaves.migrated++;
            }
          } catch (error) {
            console.error('[batchMigrationService] Error migrating leave:', leave.id, error);
            results.leaves.errors++;
          }
        }
      } catch (error) {
        console.error('[batchMigrationService] Error migrating leaves:', error);
      }

      console.log('[batchMigrationService] Migration completed:', results);
      return {
        success: true,
        message: 'Migration to batch 2025 with department structure completed successfully',
        details: results
      };
    } catch (error) {
      console.error('[batchMigrationService] Migration failed:', error);
      return {
        success: false,
        message: `Migration failed: ${(error as any).message}`
      };
    }
  },

  // Check migration status
  async getMigrationStatus(): Promise<{ migrated: boolean; counts?: any }> {
    try {
      // Check if any batch 2025 data exists
      const batch2025Students = await getDocs(collection(db, buildBatchPath.student('2025', DEPARTMENTS.CSE, '2nd', '3', 'A')));
      const batch2025Teachers = await getDocs(collection(db, buildBatchPath.teacher('2025', DEPARTMENTS.CSE, '3', 'A')));
      
      if (!batch2025Students.empty || !batch2025Teachers.empty) {
        return {
          migrated: true,
          counts: {
            students: batch2025Students.size,
            teachers: batch2025Teachers.size
          }
        };
      }
      
      return { migrated: false };
    } catch (error) {
      console.error('[batchMigrationService] Error checking migration status:', error);
      return { migrated: false };
    }
  }
};

// Import/Export Service with Department Support
export const importExportService = {
  // Export attendance data by batch and department
  async exportAttendanceByBatch(
    batch: string,
    department: string,
    sem: string,
    div: string,
    subject: string,
    startDate: Date,
    endDate: Date,
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<{ success: boolean; data?: any; filename?: string; message?: string }> {
    try {
      const attendanceData: any[] = [];
      
      // Query attendance from department-based structure
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        try {
          const path = buildBatchPath.attendance(batch, department, '2nd', sem, div, subject, currentDate);
          const snapshot = await getDocs(collection(db, path));
          
          snapshot.docs.forEach(doc => {
            attendanceData.push({
              id: doc.id,
              ...doc.data(),
              date: currentDate.toISOString().split('T')[0]
            });
          });
        } catch (error) {
          // Collection might not exist for this date
          console.log(`[importExportService] No attendance data for ${currentDate.toISOString().split('T')[0]}`);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (attendanceData.length === 0) {
        return {
          success: false,
          message: 'No attendance data found for the specified criteria'
        };
      }

      const filename = `attendance_${batch}_${department}_${sem}_${div}_${subject}_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.${format}`;
      
      return {
        success: true,
        data: attendanceData,
        filename: filename
      };
    } catch (error) {
      console.error('[importExportService] Error exporting attendance:', error);
      return {
        success: false,
        message: `Export failed: ${(error as any).message}`
      };
    }
  },

  // Export leave data by batch and department
  async exportLeavesByBatch(
    batch: string,
    department: string,
    sem: string,
    div: string,
    subject: string,
    startDate: Date,
    endDate: Date,
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<{ success: boolean; data?: any; filename?: string; message?: string }> {
    try {
      const leaveData: any[] = [];
      
      // Query leaves from department-based structure
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        try {
          const path = buildBatchPath.leave(batch, department, '2nd', sem, div, subject, currentDate);
          const snapshot = await getDocs(collection(db, path));
          
          snapshot.docs.forEach(doc => {
            leaveData.push({
              id: doc.id,
              ...doc.data(),
              date: currentDate.toISOString().split('T')[0]
            });
          });
        } catch (error) {
          // Collection might not exist for this date
          console.log(`[importExportService] No leave data for ${currentDate.toISOString().split('T')[0]}`);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      if (leaveData.length === 0) {
        return {
          success: false,
          message: 'No leave data found for the specified criteria'
        };
      }

      const filename = `leaves_${batch}_${department}_${sem}_${div}_${subject}_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.${format}`;
      
      return {
        success: true,
        data: leaveData,
        filename: filename
      };
    } catch (error) {
      console.error('[importExportService] Error exporting leaves:', error);
      return {
        success: false,
        message: `Export failed: ${(error as any).message}`
      };
    }
  },

  // Export students by batch and department
  async exportStudentsByBatch(
    batch: string,
    department: string,
    sem: string,
    div: string,
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<{ success: boolean; data?: any; filename?: string; message?: string }> {
    try {
      const path = buildBatchPath.student(batch, department, '2nd', sem, div);
      const snapshot = await getDocs(collection(db, path));
      
      if (snapshot.empty) {
        return {
          success: false,
          message: 'No students found for the specified criteria'
        };
      }

      const students = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const filename = `students_${batch}_${department}_${sem}_${div}.${format}`;
      
      return {
        success: true,
        data: students,
        filename: filename
      };
    } catch (error) {
      console.error('[importExportService] Error exporting students:', error);
      return {
        success: false,
        message: `Export failed: ${(error as any).message}`
      };
    }
  },

  // Export comprehensive batch report
  async exportBatchReport(
    batch: string,
    department: string,
    sem: string,
    div: string,
    startDate: Date,
    endDate: Date,
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<{ success: boolean; data?: any; filename?: string; message?: string }> {
    try {
      // Get students
      const studentsResult = await this.exportStudentsByBatch(batch, department, sem, div, format);
      if (!studentsResult.success) {
        return studentsResult;
      }

      // Get attendance
      const attendanceResult = await this.exportAttendanceByBatch(batch, department, sem, div, 'General', startDate, endDate, format);
      
      // Get leaves
      const leavesResult = await this.exportLeavesByBatch(batch, department, sem, div, 'General', startDate, endDate, format);

      const report = {
        summary: {
          batch: batch,
          department: getDepartmentDisplayName(department),
          semester: sem,
          division: div,
          totalStudents: studentsResult.data?.length || 0,
          totalAttendanceRecords: attendanceResult.data?.length || 0,
          totalLeaveRequests: leavesResult.data?.length || 0,
          dateRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
        },
        students: studentsResult.data || [],
        attendance: attendanceResult.data || [],
        leaves: leavesResult.data || []
      };

      const filename = `batch_report_${batch}_${department}_${sem}_${div}_${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}.${format}`;
      
      return {
        success: true,
        data: report,
        filename: filename
      };
    } catch (error) {
      console.error('[importExportService] Error exporting batch report:', error);
      return {
        success: false,
        message: `Export failed: ${(error as any).message}`
      };
    }
  },

  // Import students with batch and department assignment
  async importStudentsWithBatch(
    studentsData: any[],
    batch: string,
    department: string,
    sem: string,
    div: string
  ): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      const errors: string[] = [];
      let imported = 0;

      for (const student of studentsData) {
        try {
          // Validate department
          if (!isValidDepartment(department)) {
            errors.push(`Invalid department for student ${student.name || student.id}: ${department}`);
            continue;
          }

          // Add batch and department info
          const studentWithBatch = {
            ...student,
            batchYear: batch,
            department: department,
            year: student.year || sem,
            sem: sem,
            div: div,
            role: 'student',
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          };

          // Save to main users collection
          await userService.createUser(studentWithBatch);
          imported++;
        } catch (error) {
          errors.push(`Error importing student ${student.name || student.id}: ${(error as any).message}`);
        }
      }

      return {
        success: imported > 0,
        imported,
        errors
      };
    } catch (error) {
      console.error('[importExportService] Error importing students:', error);
      return {
        success: false,
        imported: 0,
        errors: [`Import failed: ${(error as any).message}`]
      };
    }
  },

  // Get available batches
  async getAvailableBatches(): Promise<string[]> {
    try {
      const batches = new Set<string>();
      
      // Query students collection to find existing batches
      const studentsSnapshot = await getDocs(collection(db, COLLECTIONS.STUDENTS));
      studentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.batchYear) {
          batches.add(data.batchYear);
        }
      });

      return Array.from(batches).sort();
    } catch (error) {
      console.error('[importExportService] Error getting available batches:', error);
      return [];
    }
  },

  // Get batch statistics
  async getBatchStatistics(batch: string): Promise<any> {
    try {
      const stats = {
        batch: batch,
        departments: {} as any,
        totalStudents: 0,
        totalTeachers: 0
      };

      // Get statistics for each department
      for (const dept of Object.values(DEPARTMENTS)) {
        try {
          // Count students
          const studentsSnapshot = await getDocs(collection(db, buildBatchPath.student(batch, dept, '2nd', '3', 'A')));
          const studentCount = studentsSnapshot.size;

          // Count teachers
          const teachersSnapshot = await getDocs(collection(db, buildBatchPath.teacher(batch, dept, '3', 'A')));
          const teacherCount = teachersSnapshot.size;

          stats.departments[dept] = {
            students: studentCount,
            teachers: teacherCount
          };

          stats.totalStudents += studentCount;
          stats.totalTeachers += teacherCount;
        } catch (error) {
          // Department collection might not exist
          stats.departments[dept] = { students: 0, teachers: 0 };
        }
      }

      return stats;
    } catch (error) {
      console.error('[importExportService] Error getting batch statistics:', error);
      return { batch, error: (error as any).message };
    }
  }
};

// Subject Management Service
export const subjectService = {
  // Helper function to build subject collection path
  // New structure: /subjects/2025/CSE/year/2nd/sems/3
  buildSubjectPath: (batch: string, department: string, year: string, sem: string) => {
    return `${COLLECTIONS.SUBJECTS}/${batch}/${department}/year/${year}/sems/${sem}`;
  },

  // Create a new subject
  async createSubject(subjectData: Subject): Promise<void> {
    try {
      const path = this.buildSubjectPath(subjectData.batch, subjectData.department, subjectData.year, subjectData.sem);
      console.log(`[subjectService] Creating subject with path: ${path}`);
      console.log(`[subjectService] Subject ID: ${subjectData.id}`);
      
      const subjectRef = doc(db, path, subjectData.id);
      
      const subjectDoc = {
        ...subjectData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      await setDoc(subjectRef, subjectDoc);
      console.log(`[subjectService] Subject created successfully: ${subjectData.subjectCode}`);
    } catch (error) {
      console.error('[subjectService] Error creating subject:', error);
      throw error;
    }
  },

  // Get subjects by year, sem, department (no division)
  async getSubjectsByYearSem(
    batch: string,
    department: string,
    year: string,
    sem: string
  ): Promise<Subject[]> {
    try {
      const path = this.buildSubjectPath(batch, department, year, sem);
      console.log(`[subjectService] Getting subjects with path: ${path}`);
      const subjectsRef = collection(db, path);
      const q = query(subjectsRef, orderBy('subjectCode'));
      const querySnapshot = await getDocs(q);
      
      console.log(`[subjectService] Found ${querySnapshot.docs.length} subjects`);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subject[];
    } catch (error) {
      console.error('[subjectService] Error getting subjects:', error);
      return [];
    }
  },

  // Get subjects for a department with optional year/semester filtering
  async getSubjectsByDepartment(
    department: string, 
    year?: string, 
    semester?: string
  ): Promise<Subject[]> {
    try {
      console.log(`[subjectService] Getting subjects for department: ${department}, year: ${year}, sem: ${semester}`);
      const subjects: Subject[] = [];
      
      // If specific year/semester is requested, only check those
      if (year && semester) {
        const batches = ['2025', '2024', '2023', '2022'];
        for (const batch of batches) {
          try {
            const path = this.buildSubjectPath(batch, department, year, semester);
            console.log(`[subjectService] Checking specific path: ${path}`);
            const subjectsRef = collection(db, path);
            const q = query(subjectsRef, orderBy('subjectCode'));
            const querySnapshot = await getDocs(q);
            
            console.log(`[subjectService] Query snapshot size: ${querySnapshot.docs.length} for path: ${path}`);
            if (querySnapshot.docs.length > 0) {
              console.log(`[subjectService] Found ${querySnapshot.docs.length} subjects in ${path}`);
              console.log(`[subjectService] Sample subject data:`, querySnapshot.docs[0].data());
            }
            
            const batchSubjects = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Subject[];
            
            subjects.push(...batchSubjects);
          } catch (error) {
            console.log(`[subjectService] Collection not found: ${this.buildSubjectPath(batch, department, year, semester)}`, error);
            continue;
          }
        }
      } else if (semester && !year) {
        // Get subjects for semester across all years
        const batches = ['2025', '2024', '2023', '2022'];
        const years = ['2nd', '3rd', '4th'];
        for (const batch of batches) {
          for (const y of years) {
            try {
              const path = this.buildSubjectPath(batch, department, y, semester);
              const subjectsRef = collection(db, path);
              const q = query(subjectsRef, orderBy('subjectCode'));
              const querySnapshot = await getDocs(q);
              const batchSubjects = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Subject[];
              subjects.push(...batchSubjects);
            } catch (error) {
              continue;
            }
          }
        }
        // De-duplicate by subjectCode + subjectName across years
        const seen = new Set<string>();
        const deduped: Subject[] = [];
        for (const s of subjects) {
          const key = `${(s as any).subjectCode || ''}|${(s as any).subjectName || ''}`;
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(s);
          }
        }
        return deduped;
      } else {
        // If no specific filters, get all subjects (original behavior)
        const batches = ['2025', '2024', '2023', '2022'];
        const sems = ['1', '2', '3', '4', '5', '6', '7', '8'];
        const years = ['2nd', '3rd', '4th'];
        
        for (const batch of batches) {
          for (const sem of sems) {
            for (const year of years) {
              try {
                const path = this.buildSubjectPath(batch, department, year, sem);
                const subjectsRef = collection(db, path);
                const q = query(subjectsRef, orderBy('subjectCode'));
                const querySnapshot = await getDocs(q);
                
                const batchSubjects = querySnapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                })) as Subject[];
                
                subjects.push(...batchSubjects);
              } catch (error) {
                continue;
              }
            }
          }
        }
      }
      
      console.log(`[subjectService] Total subjects found: ${subjects.length}`);
      
      // If no subjects found for the specific department, try to find any subjects in the system
      if (subjects.length === 0) {
        console.log(`[subjectService] No subjects found for ${department}, checking all departments...`);
        const allDepartments = ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'AI&ML', 'Data Science'];
        for (const dept of allDepartments) {
          if (dept === department) continue; // Skip the original department
          
          const batches = ['2025', '2024', '2023', '2022'];
          for (const batch of batches) {
            try {
              const path = this.buildSubjectPath(batch, dept, '2nd', semester || '3');
              console.log(`[subjectService] Checking fallback path: ${path}`);
              const subjectsRef = collection(db, path);
              const q = query(subjectsRef, orderBy('subjectCode'));
              const querySnapshot = await getDocs(q);
              
              if (querySnapshot.docs.length > 0) {
                console.log(`[subjectService] Found ${querySnapshot.docs.length} subjects in fallback path: ${path}`);
                const batchSubjects = querySnapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                })) as Subject[];
                subjects.push(...batchSubjects);
                break; // Found subjects, no need to check more
              }
            } catch (error) {
              continue;
            }
          }
          if (subjects.length > 0) break; // Found subjects, no need to check more departments
        }
      }
      
      // Apply year filter if provided
      let finalSubjects = year ? subjects.filter(s => String((s as any).year || '').trim() === String(year).trim()) : subjects;
      console.log(`[subjectService] Final subjects after year filter: ${finalSubjects.length}`);
      
      // If no subjects found with exact year match, try without year filter
      if (finalSubjects.length === 0 && year) {
        console.log(`[subjectService] No subjects found for year ${year}, returning all subjects for department`);
        finalSubjects = subjects;
      }
      
      return finalSubjects;
    } catch (error) {
      console.error('[subjectService] Error getting subjects by department:', error);
      return [];
    }
  },

  // Get all subjects for a department across all years and sems (legacy method)
  async getAllSubjectsByDepartment(department: string): Promise<Subject[]> {
    return this.getSubjectsByDepartment(department);
  },

  // Get subject by ID
  async getSubjectById(
    batch: string,
    department: string,
    year: string,
    sem: string,
    subjectId: string
  ): Promise<Subject | null> {
    try {
      const path = this.buildSubjectPath(batch, department, year, sem);
      const subjectRef = doc(db, path, subjectId);
      const subjectDoc = await getDoc(subjectRef);
      
      if (subjectDoc.exists()) {
        return { id: subjectDoc.id, ...subjectDoc.data() } as Subject;
      }
      return null;
    } catch (error) {
      console.error('[subjectService] Error getting subject by ID:', error);
      return null;
    }
  },

  // Update subject
  async updateSubject(
    batch: string,
    department: string,
    year: string,
    sem: string,
    subjectId: string,
    updates: Partial<Subject>
  ): Promise<void> {
    try {
      const path = this.buildSubjectPath(batch, department, year, sem);
      const subjectRef = doc(db, path, subjectId);
      
      await setDoc(subjectRef, {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log(`[subjectService] Subject updated: ${subjectId}`);
    } catch (error) {
      console.error('[subjectService] Error updating subject:', error);
      throw error;
    }
  },

  // Delete subject
  async deleteSubject(
    batch: string,
    department: string,
    year: string,
    sem: string,
    subjectId: string
  ): Promise<void> {
    try {
      const path = this.buildSubjectPath(batch, department, year, sem);
      const subjectRef = doc(db, path, subjectId);
      await deleteDoc(subjectRef);
      
      console.log(`[subjectService] Subject deleted: ${subjectId}`);
    } catch (error) {
      console.error('[subjectService] Error deleting subject:', error);
      throw error;
    }
  },

  // Assign teacher to subject
  async assignTeacherToSubject(
    batch: string,
    department: string,
    year: string,
    sem: string,
    subjectId: string,
    teacherId: string,
    teacherName: string,
    teacherEmail: string
  ): Promise<void> {
    try {
      const path = this.buildSubjectPath(batch, department, year, sem);
      const subjectRef = doc(db, path, subjectId);
      
      await setDoc(subjectRef, {
        teacherId,
        teacherName,
        teacherEmail,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      console.log(`[subjectService] Teacher assigned to subject: ${subjectId}`);
    } catch (error) {
      console.error('[subjectService] Error assigning teacher:', error);
      throw error;
    }
  },

  // Get subjects assigned to a teacher
  async getSubjectsByTeacher(teacherId: string): Promise<Subject[]> {
    try {
      const subjects: Subject[] = [];
      const batches = ['2025', '2024', '2023', '2022'];
      const departments = ['CSE', 'IT', 'ECE', 'EEE', 'ME', 'CE', 'AI&ML', 'Data Science'];
      const sems = ['1', '2', '3', '4', '5', '6', '7', '8'];
      const years = ['2nd', '3rd', '4th'];
      
      for (const batch of batches) {
        for (const department of departments) {
          for (const sem of sems) {
            for (const year of years) {
              try {
                const path = this.buildSubjectPath(batch, department, year, sem);
                const subjectsRef = collection(db, path);
                const q = query(subjectsRef, where('teacherId', '==', teacherId));
                const querySnapshot = await getDocs(q);
                
                const teacherSubjects = querySnapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                })) as Subject[];
                
                subjects.push(...teacherSubjects);
              } catch (error) {
                // Collection might not exist, continue
                continue;
              }
            }
          }
        }
      }
      
      return subjects;
    } catch (error) {
      console.error('[subjectService] Error getting subjects by teacher:', error);
      return [];
    }
  },

  // Bulk import subjects
  async bulkImportSubjects(subjects: Subject[]): Promise<void> {
    try {
      const batch = writeBatch(db);
      
      for (const subject of subjects) {
        const path = this.buildSubjectPath(subject.batch, subject.department, subject.year, subject.sem);
        const subjectRef = doc(db, path, subject.id);
        
        batch.set(subjectRef, {
          ...subject,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      await batch.commit();
      console.log(`[subjectService] Bulk imported ${subjects.length} subjects`);
    } catch (error) {
      console.error('[subjectService] Error bulk importing subjects:', error);
      throw error;
    }
  },

  // Migrate subjects from old structure to new structure
  async migrateSubjectsToNewStructure(
    batch: string = '2025',
    department: string = 'CSE',
    deleteOldData: boolean = false
  ): Promise<{ success: boolean; migrated: number; errors: string[] }> {
    try {
      console.log('[subjectService] Starting subject migration...');
      const errors: string[] = [];
      let migratedCount = 0;
      
      // Define the mapping from old structure to new structure
      const yearSemMapping = [
        { oldSem: '3', newYear: '2nd', newSem: '3' },
        { oldSem: '4', newYear: '2nd', newSem: '4' },
        { oldSem: '5', newYear: '3rd', newSem: '5' },
        { oldSem: '6', newYear: '3rd', newSem: '6' },
        { oldSem: '7', newYear: '4th', newSem: '7' },
        { oldSem: '8', newYear: '4th', newSem: '8' }
      ];
      
      const divisions = ['A', 'B', 'C'];
      
      for (const mapping of yearSemMapping) {
        for (const div of divisions) {
          try {
            // Old path: /subjects/2025/CSE/sems/7/divs/A/
            const oldPath = `${COLLECTIONS.SUBJECTS}/${batch}/${department}/sems/${mapping.oldSem}/divs/${div}`;
            console.log(`[subjectService] Checking old path: ${oldPath}`);
            
            const oldSubjectsRef = collection(db, oldPath);
            const oldQuerySnapshot = await getDocs(oldSubjectsRef);
            
            if (oldQuerySnapshot.docs.length > 0) {
              console.log(`[subjectService] Found ${oldQuerySnapshot.docs.length} subjects in ${oldPath}`);
              
              // New path: /subjects/2025/CSE/year/4th/sems/7/
              const newPath = `${COLLECTIONS.SUBJECTS}/${batch}/${department}/year/${mapping.newYear}/sems/${mapping.newSem}`;
              console.log(`[subjectService] Migrating to new path: ${newPath}`);
              
              // Process each subject
              for (const docSnapshot of oldQuerySnapshot.docs) {
                try {
                  const subjectData = docSnapshot.data();
                  
                  // Update the subject data with new structure
                  const { div: _, ...subjectDataWithoutDiv } = subjectData;
                  const updatedSubjectData = {
                    ...subjectDataWithoutDiv,
                    year: mapping.newYear,
                    sem: mapping.newSem,
                    // Update the document ID to remove division
                    id: docSnapshot.id.replace(`_${div}`, ''),
                    migratedAt: serverTimestamp(),
                    migratedFrom: oldPath
                  };
                  
                  // Create new document in new structure
                  const newSubjectRef = doc(db, newPath, updatedSubjectData.id);
                  await setDoc(newSubjectRef, updatedSubjectData);
                  
                  console.log(`[subjectService] Migrated subject: ${updatedSubjectData.id}`);
                  migratedCount++;
                  
                  // Optionally delete old document
                  if (deleteOldData) {
                    await deleteDoc(docSnapshot.ref);
                    console.log(`[subjectService] Deleted old subject: ${docSnapshot.id}`);
                  }
                  
                } catch (subjectError) {
                  const errorMsg = `Error migrating subject ${docSnapshot.id}: ${subjectError}`;
                  console.error(`[subjectService] ${errorMsg}`);
                  errors.push(errorMsg);
                }
              }
            }
          } catch (pathError) {
            // Handle error silently
            // Continue with next path
          }
        }
      }
      
      console.log(`[subjectService] Migration completed. Migrated: ${migratedCount}, Errors: ${errors.length}`);
      
      return {
        success: errors.length === 0,
        migrated: migratedCount,
        errors: errors
      };
      
    } catch (error) {
      console.error('[subjectService] Error during migration:', error);
      return {
        success: false,
        migrated: 0,
        errors: [`Migration failed: ${error}`]
      };
    }
  },

  // Export subjects to Excel/CSV
  async exportSubjects(
    batch: string,
    department: string,
    year: string,
    sem: string,
    format: 'xlsx' | 'csv' = 'xlsx'
  ): Promise<{ success: boolean; data?: any; filename?: string; message?: string }> {
    try {
      const subjects = await this.getSubjectsByYearSem(batch, department, year, sem);
      
      if (subjects.length === 0) {
        return {
          success: false,
          message: 'No subjects found for the specified criteria'
        };
      }

      // Export only the required fields
      const exportData = subjects.map(subject => ({
        'Subject Code': subject.subjectCode,
        'Subject Name': subject.subjectName,
        'Subject Type': subject.subjectType,
        'Department': subject.department,
        'Year': subject.year,
        'Semester': subject.sem
      }));

      const filename = `subjects_${batch}_${department}_${year}_${sem}.${format}`;
      
      return {
        success: true,
        data: exportData,
        filename: filename
      };
    } catch (error) {
      console.error('[subjectService] Error exporting subjects:', error);
      return {
        success: false,
        message: `Export failed: ${(error as any).message}`
      };
    }
  }
};