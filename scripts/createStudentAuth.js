const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

// Your Firebase config
const firebaseConfig = {
  // Add your Firebase config here
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createStudentAuthCredentials() {
  try {
    console.log('Starting to create Firebase auth credentials for students...');
    
    // Get all students from Firestore
    const studentsRef = collection(db, 'users');
    const q = query(studentsRef, where('role', '==', 'student'));
    const querySnapshot = await getDocs(q);
    
    console.log(`Found ${querySnapshot.size} students in Firestore`);
    
    for (const doc of querySnapshot.docs) {
      const student = doc.data();
      
      if (!student.email || !student.phone) {
        console.log(`Skipping student ${student.name} - missing email or phone`);
        continue;
      }
      
      try {
        // Create Firebase auth user with email and phone number as password
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          student.email, 
          student.phone
        );
        
        console.log(`✅ Created auth for: ${student.name} (${student.email})`);
        
        // Optional: Update the student document with Firebase UID
        // await updateDoc(doc(db, 'users', doc.id), {
        //   firebaseUid: userCredential.user.uid
        // });
        
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`⚠️  Auth already exists for: ${student.name} (${student.email})`);
        } else {
          console.error(`❌ Error creating auth for ${student.name}:`, error.message);
        }
      }
    }
    
    console.log('Finished creating student auth credentials');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
createStudentAuthCredentials();
