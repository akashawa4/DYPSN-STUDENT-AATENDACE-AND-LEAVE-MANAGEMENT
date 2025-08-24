import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCViBhXXHRGvqVmtZiW5KwxNLsMNKIObp0",
  authDomain: "dyp-cse-attendace-management.firebaseapp.com",
  projectId: "dyp-cse-attendace-management",
  storageBucket: "dyp-cse-attendace-management.firebasestorage.app",
  messagingSenderId: "280758426439",
  appId: "1:280758426439:web:b4811c1f2e96ee8c9e0a62",
  measurementId: "G-11Q12HBJ5K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample notification data
const sampleNotifications = [
  {
    userId: 'teacher001',
    title: 'Welcome to DYPSN Portal',
    message: 'Welcome to the Digital Leave & Attendance System. You can now submit leave requests and track your attendance.',
    type: 'info',
    timestamp: new Date().toISOString(),
    category: 'system',
    priority: 'medium',
    actionRequired: false,
    read: false
  },
  {
    userId: 'hod001',
    title: 'Leave Request Pending',
    message: 'You have a new leave request from Dr. Sarah Johnson that requires your approval.',
    type: 'warning',
    timestamp: new Date().toISOString(),
    category: 'leave',
    priority: 'high',
    actionRequired: true,
    read: false
  },
  {
    userId: 'principal001',
    title: 'System Update',
    message: 'The leave approval system has been updated with new features.',
    type: 'info',
    timestamp: new Date().toISOString(),
    category: 'system',
    priority: 'low',
    actionRequired: false,
    read: false
  }
];

async function setupNotifications() {
  try {
    console.log('Setting up notifications collection...');
    
    const notificationsRef = collection(db, 'notifications');
    
    for (const notification of sampleNotifications) {
      const docRef = await addDoc(notificationsRef, {
        ...notification,
        createdAt: serverTimestamp()
      });
      console.log('Created notification with ID:', docRef.id);
    }
    
    console.log('Notifications collection setup completed successfully!');
  } catch (error) {
    console.error('Error setting up notifications:', error);
  }
}

// Run the setup
setupNotifications(); 