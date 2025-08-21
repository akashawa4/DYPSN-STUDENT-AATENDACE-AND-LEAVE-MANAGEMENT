const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccount = require('../firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://your-project-id.firebaseio.com" // Replace with your project URL
});

const db = admin.firestore();

async function createTeacherAuthUsers() {
  try {
    console.log('Starting teacher authentication user creation...');
    
    // Get all teachers from Firestore
    const teachersSnapshot = await db.collection('teachers').get();
    
    if (teachersSnapshot.empty) {
      console.log('No teachers found in Firestore');
      return;
    }
    
    console.log(`Found ${teachersSnapshot.size} teachers`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const doc of teachersSnapshot.docs) {
      const teacher = doc.data();
      
      try {
        // Check if user already exists in Firebase Auth
        try {
          await admin.auth().getUserByEmail(teacher.email);
          console.log(`User already exists for ${teacher.email}`);
          continue;
        } catch (error) {
          if (error.code !== 'auth/user-not-found') {
            throw error;
          }
        }
        
        // Create user in Firebase Auth
        const userRecord = await admin.auth().createUser({
          email: teacher.email,
          password: teacher.phone, // Use phone number as password
          displayName: teacher.name,
          disabled: !teacher.isActive
        });
        
        // Set custom claims for teacher role
        await admin.auth().setCustomUserClaims(userRecord.uid, {
          role: 'teacher',
          department: teacher.department,
          accessLevel: 'approver'
        });
        
        // Update the teacher document with the UID
        await doc.ref.update({
          uid: userRecord.uid,
          authCreated: true,
          authCreatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`✅ Created auth user for ${teacher.name} (${teacher.email})`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Error creating auth user for ${teacher.name} (${teacher.email}):`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`✅ Successfully created: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${teachersSnapshot.size}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    process.exit(0);
  }
}

// Run the function
createTeacherAuthUsers();
