import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function checkLeaveRequests() {
  try {
    console.log('Checking leave requests in Firestore...');
    
    const leaveRequestsRef = collection(db, 'leaveRequests');
    const querySnapshot = await getDocs(leaveRequestsRef);
    
    console.log(`Found ${querySnapshot.size} leave requests`);
    
    if (querySnapshot.size === 0) {
      console.log('No leave requests found. This might be the issue!');
      return;
    }
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`\nLeave Request ID: ${doc.id}`);
      console.log('Data:', JSON.stringify(data, null, 2));
      console.log('Status:', data.status);
      console.log('Current Approval Level:', data.currentApprovalLevel);
      console.log('User ID:', data.userId);
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error checking leave requests:', error);
  }
}

// Run the check
checkLeaveRequests(); 