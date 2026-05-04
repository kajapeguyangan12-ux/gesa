import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

const DEFAULT_BUCKET =
  process.env.SUPABASE_TASK_ATTACHMENTS_BUCKET ||
  process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET ||
  "task-attachments";

function sanitizePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]/g, "_");
}

async function ensureBucketExists(bucketName: string) {
  const supabase = getSupabaseAdminClient();
  const { data: existingBucket, error: getBucketError } = await supabase.storage.getBucket(bucketName);

  if (!getBucketError && existingBucket) {
    return supabase;
  }

  const bucketMissing =
    getBucketError &&
    /not found|does not exist|404/i.test(getBucketError.message);

  if (getBucketError && !bucketMissing) {
    throw new Error(`Gagal memeriksa bucket storage '${bucketName}': ${getBucketError.message}`);
  }

  const { error: createBucketError } = await supabase.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: "50MB",
  });

  if (createBucketError && !/already exists|duplicate/i.test(createBucketError.message)) {
    throw new Error(`Gagal membuat bucket storage '${bucketName}': ${createBucketError.message}`);
  }

  return supabase;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = String(formData.get("folder") || "").trim();
    const filename = String(formData.get("filename") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File wajib diisi." }, { status: 400 });
    }
    if (!folder) {
      return NextResponse.json({ error: "folder wajib diisi." }, { status: 400 });
    }

    const safeFolder = sanitizePathPart(folder.replace(/^\/+|\/+$/g, ""));
    const safeFileName = sanitizePathPart(filename || file.name || "attachment.webp");
    const objectPath = `${safeFolder}/${Date.now()}-${safeFileName}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    const supabase = await ensureBucketExists(DEFAULT_BUCKET);
    const { error: uploadError } = await supabase.storage
      .from(DEFAULT_BUCKET)
      .upload(objectPath, bytes, {
        contentType: file.type || "image/webp",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from(DEFAULT_BUCKET)
      .getPublicUrl(objectPath);

    return NextResponse.json({
      ok: true,
      bucket: DEFAULT_BUCKET,
      path: objectPath,
      url: publicUrlData.publicUrl,
      source: "supabase-storage",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengunggah lampiran survey ke Supabase Storage.",
      },
      { status: 500 }
    );
  }
}
