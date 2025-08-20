import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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