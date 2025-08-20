import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { collection, query, where, getDocs, deleteDoc } from 'firebase-admin/firestore';

// Initialize Firebase Admin
initializeApp({
  credential: applicationDefault(),
});

const db = getFirestore();

const DEMO_USER_IDS = [
  'teacher001',
  'hod001',
  'principal001',
  'director001',
  'registrar001',
  'hr001',
];

const COLLECTIONS = ['leaveRequests', 'attendance', 'notifications'];

const emailsToKeep = [
  'hod.demo@dypsn.edu',
  'teacher.demo@dypsn.edu',
  'student.demo@dypsn.edu'
];

async function deleteDemoUserData() {
  for (const collectionName of COLLECTIONS) {
    const collectionRef = db.collection(collectionName);
    for (const userId of DEMO_USER_IDS) {
      const querySnapshot = await collectionRef.where('userId', '==', userId).get();
      if (querySnapshot.empty) {
        console.log(`[${collectionName}] No documents found for userId: ${userId}`);
        continue;
      }
      const batch = db.batch();
      querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`[${collectionName}] Deleted ${querySnapshot.size} documents for userId: ${userId}`);
    }
  }
  console.log('✅ All demo user data deleted (except user accounts).');
}

async function deleteDemoUsers() {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '>=', ''), where('email', '<=', '\uf8ff'));
  const querySnapshot = await getDocs(q);
  let deleted = 0;
  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();
    if (
      data.email &&
      data.email.includes('demo') &&
      !emailsToKeep.includes(data.email)
    ) {
      await deleteDoc(doc(db, 'users', docSnap.id));
      deleted++;
      console.log('Deleted demo user:', data.email);
    }
  }
  console.log(`Deleted ${deleted} demo users (except main demo accounts).`);
}

deleteDemoUserData().catch(err => {
  console.error('Error deleting demo user data:', err);
  process.exit(1);
});

deleteDemoUsers().then(() => process.exit(0)); 