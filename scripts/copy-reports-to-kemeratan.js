/**
 * scripts/copy-reports-to-kemeratan.js
 *
 * Usage:
 * 1. Create two service account JSON keys with Firestore access:
 *    - serviceAccountSource.json  (for project containing `reports`)
 *    - serviceAccountDest.json    (for destination project where app runs)
 * 2. Place both files in the `scripts/` folder.
 * 3. Install dependency: `npm install firebase-admin`
 * 4. Run: `node scripts/copy-reports-to-kemeratan.js`
 *
 * What it does:
 * - Reads all documents from collection `reports` in source project.
 * - For each document, maps fields and ensures `gridData` is an Array (parses JSON strings if needed).
 * - Writes documents to collection `kemeratanCahaya` in destination project preserving the same document ID.
 * - Writes in batches of 400 to avoid Firestore limits.
 *
 * Note: This script only copies Firestore documents. If your `reports` documents reference Storage objects (images),
 * copy buckets/objects via `gsutil` or Storage Transfer Service as previously instructed.
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const SRC_SA = path.join(__dirname, "serviceAccountSource.json");
const DST_SA = path.join(__dirname, "serviceAccountDest.json");

if (!fs.existsSync(SRC_SA) || !fs.existsSync(DST_SA)) {
  console.error("Please place serviceAccountSource.json and serviceAccountDest.json in the scripts/ folder and try again.");
  process.exit(1);
}

const srcCred = require(SRC_SA);
const dstCred = require(DST_SA);

const srcApp = admin.initializeApp({ credential: admin.credential.cert(srcCred) }, "src");
const dstApp = admin.initializeApp({ credential: admin.credential.cert(dstCred) }, "dst");

const srcDb = srcApp.firestore();
const dstDb = dstApp.firestore();

async function ensureGridDataIsArray(obj) {
  if (!obj) return obj;
  let gd = obj.gridData;
  if (gd === undefined) return obj; // nothing to do
  if (typeof gd === "string") {
    try {
      gd = JSON.parse(gd);
    } catch (e) {
      console.warn("Warning: failed to parse gridData JSON for doc", obj.id || "(no id)");
      return obj;
    }
  }
  // if it's not an array, try to coerce to array
  if (!Array.isArray(gd)) {
    console.warn("gridData is not an array, skipping transform for doc", obj.id || "(no id)");
    return obj;
  }
  obj.gridData = gd;
  return obj;
}

async function copyAll() {
  console.log("Starting copy from 'reports' (source) -> 'kemeratanCahaya' (dest)");

  const srcColRef = srcDb.collection("reports");
  const snapshot = await srcColRef.get();
  console.log(`Found ${snapshot.size} documents in 'reports'`);

  if (snapshot.empty) return;

  const docs = snapshot.docs;
  const BATCH_SIZE = 400; // keep under 500

  let batch = dstDb.batch();
  let opCount = 0;
  let batchCount = 0;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    let data = doc.data();

    // try to normalize gridData
    data = await ensureGridDataIsArray(data);

    const dstRef = dstDb.collection("kemeratanCahaya").doc(doc.id);
    batch.set(dstRef, data, { merge: false });
    opCount++;

    if (opCount >= BATCH_SIZE) {
      batchCount++;
      console.log(`Committing batch #${batchCount} (${opCount} ops)`);
      await batch.commit();
      // reset
      batch = dstDb.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    batchCount++;
    console.log(`Committing final batch #${batchCount} (${opCount} ops)`);
    await batch.commit();
  }

  console.log("Copy finished.");
}

copyAll().catch((err) => {
  console.error("Error copying:", err);
  process.exit(1);
});
