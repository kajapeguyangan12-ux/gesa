import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "node:fs";
import path from "node:path";

type ServiceAccountJson = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function readServiceAccount(): ServiceAccountJson {
  const rawFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawFromEnv) {
    const parsed = JSON.parse(rawFromEnv) as ServiceAccountJson;
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }
    return parsed;
  }

  const localKeyPath = path.resolve(process.cwd(), "serviceAccountKey.json");
  if (!fs.existsSync(localKeyPath)) {
    throw new Error("Firebase Admin credentials tidak ditemukan. Set FIREBASE_SERVICE_ACCOUNT_JSON atau sediakan serviceAccountKey.json.");
  }

  const parsed = JSON.parse(fs.readFileSync(localKeyPath, "utf8")) as ServiceAccountJson;
  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  return parsed;
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = readServiceAccount();
  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
  });
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}

export function getAdminStorageBucket() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) {
    throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET belum diset.");
  }

  return getStorage(getAdminApp()).bucket(bucketName);
}
