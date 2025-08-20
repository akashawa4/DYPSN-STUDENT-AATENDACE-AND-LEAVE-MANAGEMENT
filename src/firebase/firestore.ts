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
  LEAVE_REQUESTS: 'leaveRequests',
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
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(
      usersRef, 
      where('email', '==', email), 
      where('role', '==', 'student')
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const student = querySnapshot.docs[0].data() as User;
    
    // Check if phone number matches (with or without country code)
    const studentPhone = student.phone || '';
    const normalizedStudentPhone = studentPhone.replace(/\D/g, ''); // Remove non-digits
    const normalizedInputPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
    
    // Check if phone numbers match (allowing for different formats)
    if (normalizedStudentPhone === normalizedInputPhone || 
        studentPhone === phoneNumber ||
        studentPhone.endsWith(phoneNumber) ||
        phoneNumber.endsWith(normalizedStudentPhone.slice(-10))) {
      return { id: querySnapshot.docs[0].id, ...student };
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
    const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/records`;
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
    // Path: attendance/{year}/sems/{sem}/divs/{div}/subjects/{subject}/records
    const collectionPath = `attendance/${year}/sems/${sem}/divs/${div}/subjects/${subject}/records`;
    const recordsRef = collection(db, collectionPath);
    const q = query(
      recordsRef,
      where('rollNumber', '==', rollNumber),
      where('date', '>=', startDate),
      where('date', '<=', endDate)
    );
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AttendanceLog[];
    // Sort by date ascending
    return records.sort((a, b) => {
      const aDate = a.date instanceof Date ? a.date : (a.date as any)?.toDate?.() || new Date(a.date || 0);
      const bDate = b.date instanceof Date ? b.date : (b.date as any)?.toDate?.() || new Date(b.date || 0);
      return aDate.getTime() - bDate.getTime();
    });
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