// Script untuk membuat Super Admin di Firestore
// Jalankan dengan: node scripts/create-super-admin.js

const admin = require('firebase-admin');
const serviceAccount = require('../gesa-4a6a2-firebase-adminsdk-l2kge-a67b1af97a.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createSuperAdmin() {
  try {
    const superAdminData = {
      name: "Super Admin",
      username: "superadmin",
      email: "superadmin@gesa.com",
      password: "SuperAdmin123!", // Ganti dengan password yang aman
      role: "super-admin",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection('User-Admin').add(superAdminData);
    
    console.log('✅ Super Admin berhasil dibuat!');
    console.log('📧 Email: superadmin@gesa.com');
    console.log('🔑 Password: SuperAdmin123!');
    console.log('🆔 Document ID:', docRef.id);
    console.log('\n⚠️  PENTING: Segera ganti password setelah login pertama!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error membuat super admin:', error);
    process.exit(1);
  }
}

createSuperAdmin();
