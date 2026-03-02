import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Script untuk membuat Super Admin pertama kali
 * Jalankan fungsi ini di browser console atau buat halaman khusus setup
 */
export async function createInitialSuperAdmin() {
  try {
    // Check if super admin already exists
    const q = query(
      collection(db, "User-Admin"),
      where("role", "==", "super-admin")
    );
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      console.log("⚠️  Super Admin sudah ada!");
      return { success: false, message: "Super Admin sudah ada" };
    }

    // Create super admin
    const superAdminData = {
      name: "Super Admin",
      username: "superadmin",
      email: "superadmin@gesa.com",
      password: "SuperAdmin123!", // Ganti dengan password yang aman!
      role: "super-admin",
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, "User-Admin"), superAdminData);
    
    console.log("✅ Super Admin berhasil dibuat!");
    console.log("📧 Email: superadmin@gesa.com");
    console.log("👤 Username: superadmin");
    console.log("🔑 Password: SuperAdmin123!");
    console.log("🆔 Document ID:", docRef.id);
    console.log("\n⚠️  PENTING: Segera ganti password setelah login pertama!");
    
    return { 
      success: true, 
      message: "Super Admin berhasil dibuat",
      credentials: {
        email: "superadmin@gesa.com",
        username: "superadmin",
        password: "SuperAdmin123!"
      }
    };
  } catch (error: any) {
    console.error("❌ Error membuat super admin:", error);
    return { success: false, message: error.message };
  }
}

/**
 * Cara menggunakan:
 * 
 * 1. Import fungsi ini di component atau page
 * 2. Buat tombol atau panggil fungsi di browser console:
 * 
 *    import { createInitialSuperAdmin } from "@/lib/createSuperAdmin";
 *    
 *    // Di component:
 *    const handleCreateSuperAdmin = async () => {
 *      const result = await createInitialSuperAdmin();
 *      alert(result.message);
 *    };
 * 
 * 3. Atau langsung di browser console (setelah import fungsi di page):
 *    
 *    createInitialSuperAdmin().then(result => console.log(result));
 */
