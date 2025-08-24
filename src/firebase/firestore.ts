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
import { User, LeaveRequest, AttendanceLog, Notification } from '../types';

// Collection names
export const COLLECTIONS = {
  USERS: 'users',
  TEACHERS: 'teachers',
  LEAVE_REQUESTS: 'leaveRequests',
  LEAVE: 'leave',
  ATTENDANCE: 'attendance',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'auditLogs',
  SETTINGS: 'settings'
} as const;

// User Management
export const userService = {
  // Create or update user
  async createUser(userData: User): Promise<void> {
    const userRef = doc(db, COLLECTIONS.USERS, userData.id);
    await setDoc(userRef, {
      ...userData,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
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

  // Get students by year, semester, and division
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
    // Prefer teachers collection
    const teachersRef = collection(db, COLLECTIONS.TEACHERS);
    const tq = query(teachersRef, where('email', '==', email));
    const tSnap = await getDocs(tq);
    let teacherDoc: { id: string; data: any } | null = null;
    if (!tSnap.empty) {
      const doc0 = tSnap.docs[0];
      teacherDoc = { id: doc0.id, data: doc0.data() };
    } else {
      // Fallback to users where role==teacher
      const usersRef = collection(db, COLLECTIONS.USERS);
      const uq = query(usersRef, where('email', '==', email), where('role', '==', 'teacher'));
      const uSnap = await getDocs(uq);
      if (uSnap.empty) return null;
      const doc0 = uSnap.docs[0];
      teacherDoc = { id: doc0.id, data: doc0.data() };
    }

    const teacher = teacherDoc!.data as User;
    const teacherPhone = teacher.phone || '';
    
    // Only proceed if teacher has a phone number
    if (!teacherPhone) {
      console.log(`Teacher ${teacher.email} has no phone number`);
      return null;
    }
    
    const normalizedTeacherPhone = teacherPhone.replace(/\D/g, '');
    const normalizedInputPhone = phoneNumber.replace(/\D/g, '');

    if (
      normalizedTeacherPhone === normalizedInputPhone ||
      teacherPhone === phoneNumber ||
      teacherPhone.endsWith(phoneNumber) ||
      phoneNumber.endsWith(normalizedTeacherPhone.slice(-10))
    ) {
      const { id: _ignoredTId, ...teacherRest } = teacher as any;
      return { id: teacherDoc!.id, ...teacherRest };
    }
    return null;
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

  // Create organized student collections by year, semester, division
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

  // Get students from organized collection
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
          const students = await this.getStudentsFromOrganizedCollection(year, sem, div);
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
  // Create leave request
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

    // Also mirror into hierarchical structure matching attendance
    try {
      const { year, sem, div } = (leaveData as any) || {};
      // Leave might not be subject-specific; default to 'General'
      const subject = ((leaveData as any)?.subject as string) || 'General';
      const fromDateStr = (leaveData as any)?.fromDate as string | undefined;

      if (year && sem && div && fromDateStr) {
        // Use fromDate as the folder date. If a range is needed, we can extend later.
        const dateObj = new Date(fromDateStr);
        const y = dateObj.getFullYear().toString();
        const m = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const d = dateObj.getDate().toString().padStart(2, '0');

        const hierPath = `${COLLECTIONS.LEAVE}/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${y}/${m}/${d}`;
        const hierRef = doc(collection(db, hierPath), docRef.id);
        await setDoc(hierRef, {
          ...docData,
          id: docRef.id,
        });
        console.log('[createLeaveRequest] Mirrored leave to hierarchical path:', hierPath, 'id:', docRef.id);
      } else {
        console.warn('[createLeaveRequest] Skipped hierarchical mirror (missing year/sem/div or fromDate)');
      }
    } catch (mirrorError) {
      console.error('[createLeaveRequest] Failed to mirror leave to hierarchical structure:', mirrorError);
      // Do not fail creation if mirror fails
    }
    return docRef.id;
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
    
    const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${attendanceYear}/${attendanceMonth}/${attendanceDate}`;
    const attendanceRef = doc(collection(db, collectionPath), docId);
    await setDoc(attendanceRef, {
      ...attendanceData,
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
    // Path: attendance/{year}/sems/{sem}/divs/{div}/subjects/{subject}/date/record
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
      const attendanceYear = dateObj.getFullYear().toString();
      const attendanceMonth = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const attendanceDate = dateObj.getDate().toString().padStart(2, '0');
      
      const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/${attendanceYear}/${attendanceMonth}/${attendanceDate}`;
      
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