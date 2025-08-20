const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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

const emailsToKeep = [
  'hod.demo@dypsn.edu',
  'teacher.demo@dypsn.edu',
  'student.demo@dypsn.edu'
];

async function getDemoUserIds() {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '>=', ''), where('email', '<=', '\uf8ff'));
  const querySnapshot = await getDocs(q);
  const demoUserIds = [];
  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data();
    if (
      data.email &&
      data.email.includes('demo') &&
      !emailsToKeep.includes(data.email)
    ) {
      demoUserIds.push(docSnap.id);
    }
  }
  return demoUserIds;
}

async function deleteDemoLeaves(demoUserIds) {
  const leaveRef = collection(db, 'leaveRequests');
  const q = query(leaveRef, where('userId', 'in', demoUserIds));
  const querySnapshot = await getDocs(q);
  let deleted = 0;
  for (const docSnap of querySnapshot.docs) {
    await deleteDoc(doc(db, 'leaveRequests', docSnap.id));
    deleted++;
  }
  console.log(`Deleted ${deleted} demo leave requests.`);
}

async function deleteDemoAttendance(demoUserIds) {
  const attRef = collection(db, 'attendance');
  const q = query(attRef, where('userId', 'in', demoUserIds));
  const querySnapshot = await getDocs(q);
  let deleted = 0;
  for (const docSnap of querySnapshot.docs) {
    await deleteDoc(doc(db, 'attendance', docSnap.id));
    deleted++;
  }
  console.log(`Deleted ${deleted} demo attendance records.`);
}

async function deleteDemoNotifications(demoUserIds) {
  const notifRef = collection(db, 'notifications');
  const q = query(notifRef, where('userId', 'in', demoUserIds));
  const querySnapshot = await getDocs(q);
  let deleted = 0;
  for (const docSnap of querySnapshot.docs) {
    await deleteDoc(doc(db, 'notifications', docSnap.id));
    deleted++;
  }
  console.log(`Deleted ${deleted} demo notifications.`);
}

async function deleteAllDemoData() {
  await deleteDemoUsers();
  const demoUserIds = await getDemoUserIds();
  await deleteDemoLeaves(demoUserIds);
  await deleteDemoAttendance(demoUserIds);
  await deleteDemoNotifications(demoUserIds);
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
deleteAllDemoData().then(() => process.exit(0)); 