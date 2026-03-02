#!/usr/bin/env bash
# Firestore export/import helper
# Usage: edit the variables below then run from a shell with gcloud & gsutil installed.

# --------------------
# CONFIG — replace these
SOURCE_PROJECT_ID="aplikasi-survei-lampu-jalan"
DEST_PROJECT_ID="gesa-4a6a2"
# bucket must be in same Firestore location (attachment shows asia-southeast2)
# Pick globally-unique bucket names — these are examples. Change if already taken.
SOURCE_BUCKET="gs://aplikasi-survei-exports-231759165437"
DEST_BUCKET="gs://gesa-imports-565729570320"
EXPORT_PREFIX="exports/$(date +%F-%H%M%S)"
FIRESTORE_REGION="asia-southeast2"
# If you want to export only specific collections, set COLLECTION_IDS to a space-separated
# list of collection IDs. Example: COLLECTION_IDS=(reports users)
COLLECTION_IDS=(reports)
# --------------------

set -euo pipefail

echo "Source project: $SOURCE_PROJECT_ID"
echo "Destination project: $DEST_PROJECT_ID"

echo "1) Ensure you are logged in and gcloud is installed"
# gcloud auth login
# gcloud components update

echo "2) Enable APIs on source and destination (run as needed)"
gcloud services enable firestore.googleapis.com --project="$SOURCE_PROJECT_ID"
gcloud services enable storage.googleapis.com --project="$SOURCE_PROJECT_ID"

gcloud services enable firestore.googleapis.com --project="$DEST_PROJECT_ID"
gcloud services enable storage.googleapis.com --project="$DEST_PROJECT_ID"

echo "3) Create buckets (if not exist). Buckets must be in the same region as Firestore (e.g. asia-southeast2)."
# Example: gsutil mb -l asia-southeast2 gs://my-source-export-bucket
# gsutil mb -l asia-southeast2 gs://my-dest-import-bucket

read -p "Create buckets now? (y/N) " create_buckets
if [[ "$create_buckets" == "y" || "$create_buckets" == "Y" ]]; then
  gsutil mb -l asia-southeast2 "$SOURCE_BUCKET"
  gsutil mb -l asia-southeast2 "$DEST_BUCKET"
fi

echo "4) Export from source project to source bucket"
gcloud config set project "$SOURCE_PROJECT_ID"
if [ ${#COLLECTION_IDS[@]} -gt 0 ]; then
  # Join array into comma-separated list
  IFS=','; COLLECTIONS_STR="${COLLECTION_IDS[*]}"; unset IFS
  echo "Exporting collections: $COLLECTIONS_STR"
  gcloud firestore export "$SOURCE_BUCKET/$EXPORT_PREFIX" --project="$SOURCE_PROJECT_ID" --collection-ids="$COLLECTIONS_STR"
else
  echo "Exporting whole database"
  gcloud firestore export "$SOURCE_BUCKET/$EXPORT_PREFIX" --project="$SOURCE_PROJECT_ID"
fi

echo "Export created at: $SOURCE_BUCKET/$EXPORT_PREFIX"

echo "5) Make export visible to destination project or copy to dest bucket"
cat <<'NOTE'
Two options:
 - Option A: Grant the DEST project access to SOURCE_BUCKET (add storage.objectViewer or storage.objectAdmin for DEST project's service account), then import directly from the source bucket.
 - Option B: Copy exported files into a bucket owned by DEST_PROJECT and import from there (recommended when projects are separate).
NOTE

read -p "Copy export to dest bucket now? (y/N) " copy_now
if [[ "$copy_now" == "y" || "$copy_now" == "Y" ]]; then
  # Copy recursively
  gsutil -m cp -r "$SOURCE_BUCKET/$EXPORT_PREFIX" "$DEST_BUCKET/"
  DEST_EXPORT_PATH="$DEST_BUCKET/$EXPORT_PREFIX"
else
  DEST_EXPORT_PATH="$SOURCE_BUCKET/$EXPORT_PREFIX"
fi

echo "6) Import into destination Firestore project"
gcloud config set project "$DEST_PROJECT_ID"
# Make sure destination Firestore is in same location as export
gcloud firestore import "$DEST_EXPORT_PATH" --project="$DEST_PROJECT_ID"

echo "Import command finished — verify in Firebase Console"

echo "7) Deploy firestore rules & indexes (if you have them in project)"
# firebase login
# firebase use --add $DEST_PROJECT_ID
# firebase deploy --only firestore:rules,firestore:indexes --project=$DEST_PROJECT_ID

echo "Done. Verify data in Firebase Console (Firestore)."
