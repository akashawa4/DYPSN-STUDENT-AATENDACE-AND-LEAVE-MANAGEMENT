import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAnYtVcATytnQQCuBOE_0rK3mfhNujvU24",
  authDomain: "dypsn-teachers-leave.firebaseapp.com",
  projectId: "dypsn-teachers-leave",
  storageBucket: "dypsn-teachers-leave.firebasestorage.app",
  messagingSenderId: "682691028081",
  appId: "1:682691028081:web:e1e869db5922a94749a7d0",
  databaseURL: "https://dypsn-teachers-leave-default-rtdb.firebaseio.com/"
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