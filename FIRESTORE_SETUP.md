# Firebase Firestore Setup - Step 1

## Overview
This document explains the Firestore integration that has been added to your DYPSN Leave and Attendance Management System.

## Quick Start

1. **Enable Firestore** in Firebase Console (see setup section below)
2. **Start the app**: `npm run dev`
3. **Login** with any demo account
4. **Go to Dashboard** - you'll see the "Firestore Test Panel"
5. **Test the functionality** using the test buttons

## What's Been Added

### 1. Firebase Configuration (`src/firebase/firebase.ts`)
- Added Firestore import and initialization
- Exported `db` instance for use throughout the application

### 2. Firestore Service (`src/firebase/firestore.ts`)
Comprehensive service layer with the following modules:

#### User Management (`userService`)
- `createUser()` - Create or update user data
- `getUser()` - Get user by ID
- `getAllUsers()` - Get all users
- `getUsersByRole()` - Get users by role
- `updateUser()` - Update user data
- `deleteUser()` - Delete user

#### Leave Request Management (`leaveService`)
- `createLeaveRequest()` - Create new leave request
- `getLeaveRequest()` - Get leave request by ID
- `getLeaveRequestsByUser()` - Get user's leave requests
- `getPendingLeaveRequests()` - Get all pending requests
- `updateLeaveRequestStatus()` - Approve/reject leave requests
- `getLeaveRequestsByDepartment()` - Get requests by department

#### Attendance Management (`attendanceService`)
- `markAttendance()` - Mark daily attendance
- `getAttendanceByUserAndDateRange()` - Get attendance for date range
- `getTodayAttendance()` - Get today's attendance

#### Notification Management (`notificationService`)
- `createNotification()` - Create new notification
- `getNotificationsByUser()` - Get user's notifications
- `markNotificationAsRead()` - Mark notification as read
- `getUnreadNotificationsCount()` - Get unread count

#### Real-time Listeners (`realtimeService`)
- `onLeaveRequestsChange()` - Listen to user's leave requests
- `onPendingLeaveRequestsChange()` - Listen to pending requests
- `onNotificationsChange()` - Listen to user's notifications

### 3. Updated Types (`src/types/index.ts`)
- Added `AttendanceLog` interface
- Updated existing interfaces to support Firestore timestamps
- Added missing fields for better data structure

### 4. Updated Components
- **LeaveRequestForm**: Now saves leave requests to Firestore
- **FirestoreTest**: Test component to verify Firestore functionality

## How to Use

### 1. Create a Leave Request
```typescript
import { leaveService } from '../firebase/firestore';

const leaveData = {
  userId: user.id,
  userName: user.name,
  department: user.department,
  leaveType: 'CL',
  fromDate: '2024-01-15',
  toDate: '2024-01-16',
  reason: 'Personal emergency',
  daysCount: 2,
  submittedAt: new Date().toISOString()
};

const requestId = await leaveService.createLeaveRequest(leaveData);
```

### 2. Get User's Leave Requests
```typescript
const requests = await leaveService.getLeaveRequestsByUser(userId);
```

### 3. Approve/Reject Leave Request
```typescript
await leaveService.updateLeaveRequestStatus(
  requestId, 
  'approved', 
  approverId, 
  'Approved for personal emergency'
);
```

### 4. Real-time Updates
```typescript
import { realtimeService } from '../firebase/firestore';

const unsubscribe = realtimeService.onLeaveRequestsChange(userId, (requests) => {
  console.log('Leave requests updated:', requests);
});

// Don't forget to unsubscribe when component unmounts
// unsubscribe();
```

## Testing

1. **Start the development server**: `npm run dev`
2. **Login** with any demo account (e.g., `sarah.johnson@dypsn.edu` with password `demo123`)
3. **Navigate to Dashboard** - you'll see the "Firestore Test Panel"
4. **Test the buttons** to create users, leave requests, and notifications
5. **Check the browser console** for detailed logs
6. **Check your Firebase Console** to see the data being created

### Demo Accounts Available:
- **Teacher**: `sarah.johnson@dypsn.edu` / `demo123`
- **HOD**: `michael.chen@dypsn.edu` / `demo123`
- **Principal**: `priya.sharma@dypsn.edu` / `demo123`
- **Director**: `rajesh.patel@dypsn.edu` / `demo123`

## Firebase Console Setup

### 1. Enable Firestore
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `dypsn-teachers-leave`
3. Go to **Firestore Database** in the left sidebar
4. Click **Create Database**
5. Choose **Start in test mode** (for development)
6. Select a location (choose the closest to your users)

### 2. Security Rules (Optional)
For production, you'll want to set up proper security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Leave requests - users can create, read their own, approvers can read all
    match /leaveRequests/{requestId} {
      allow create: if request.auth != null;
      allow read: if request.auth != null && 
        (resource.data.userId == request.auth.uid || 
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.accessLevel in ['approver', 'full']);
      allow update: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.accessLevel in ['approver', 'full'];
    }
    
    // Similar rules for other collections...
  }
}
```

## Next Steps

This completes **Step 1: Firebase Firestore**. The next steps would be:

1. **Step 2: Firebase Cloud Storage** - For file attachments
2. **Step 3: Firebase Cloud Functions** - For automated workflows
3. **Step 4: Firebase Cloud Messaging** - For push notifications

## Troubleshooting

### Common Issues

1. **"Firestore is not enabled"**
   - Go to Firebase Console and enable Firestore Database

2. **"Permission denied"**
   - Check Firestore security rules
   - Ensure you're in test mode for development

3. **"Collection not found"**
   - Collections are created automatically when you first add documents
   - This is normal behavior

4. **"Invalid timestamp"**
   - Use `serverTimestamp()` for Firestore timestamps
   - Use `new Date().toISOString()` for regular date strings

5. **"Build errors"**
   - Run `npm run build` to check for TypeScript errors
   - All syntax errors have been fixed in this setup

### Debug Mode
The FirestoreTest component is only shown in development mode. You can access it by:
1. Setting `NODE_ENV=development` in your environment
2. Or temporarily removing the condition in Dashboard.tsx

## Data Structure

### Collections Created
- `users` - User profiles and authentication data
- `leaveRequests` - Leave applications and approvals
- `attendance` - Daily attendance records
- `notifications` - System notifications
- `auditLogs` - System audit trail (future use)
- `settings` - System configuration (future use)

Each document has automatic timestamps (`createdAt`, `updatedAt`) and proper indexing for efficient queries.

## Verification Checklist

- [ ] Firebase Firestore enabled in console
- [ ] App builds without errors (`npm run build`)
- [ ] Can login with demo accounts
- [ ] FirestoreTest panel appears on Dashboard
- [ ] Test buttons create data successfully
- [ ] Data appears in Firebase Console
- [ ] LeaveRequestForm saves to Firestore
- [ ] No console errors in browser

## Performance Notes

- Firestore automatically handles offline caching
- Real-time listeners provide instant updates
- Queries are optimized with proper indexing
- Data is automatically synced across devices 