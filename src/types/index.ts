export interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'teacher' | 'hod';
  department: string;
  accessLevel: 'basic' | 'approver' | 'full';
  isActive: boolean;
  phone?: string;
  rollNumber?: string;
  joiningDate?: string;
  designation?: string;
  gender?: string;
  div?: string;
  year?: string;
  sem?: string;
  createdAt?: string;
  lastLogin?: string;
  loginCount?: number;
  updatedAt?: string;
  
  // Teacher-specific fields
  qualification?: string;
  specialization?: string;
  experience?: string;
  salary?: string;
  address?: string;
  emergencyContact?: string;
  bloodGroup?: string;
  dateOfBirth?: string;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  department: string;
  leaveType: 'CL' | 'ML' | 'EL' | 'LOP' | 'COH' | 'SL' | 'OD' | 'OTH';
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'returned';
  submittedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  comments?: string;
  daysCount: number;
  currentApprovalLevel?: string;
  approvalFlow?: string[];
  createdAt?: any; // Firestore timestamp
  updatedAt?: any; // Firestore timestamp
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'half-day';
  subject?: string;
  notes?: string;
  createdAt?: any;
}

export interface AttendanceLog {
  id: string;
  userId: string;
  userName: string;
  date: string | Date;
  status: 'present' | 'absent' | 'late' | 'leave' | 'half-day';
  notes?: string;
  subject?: string; // Added for subject-wise attendance
  createdAt?: any; // Firestore timestamp
  year?: string;
  sem?: string;
  div?: string;
}

export interface LeaveBalance {
  userId: string;
  CL: number;
  ML: number;
  EL: number;
  totalUsed: number;
  totalAvailable: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  timestamp: string;
  details: Record<string, any>;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  readAt?: any; // Firestore timestamp
  targetRoles?: string[];
  createdAt?: any; // Firestore timestamp
  category?: 'leave' | 'attendance' | 'system' | 'announcement';
  priority?: 'low' | 'medium' | 'high';
  actionRequired?: boolean;
}