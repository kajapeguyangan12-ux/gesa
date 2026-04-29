import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

const DEFAULT_BUCKET = process.env.SUPABASE_REPORT_ATTACHMENTS_BUCKET || "report-attachments";

function sanitizePathPart(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]/g, "_");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const reportId = String(formData.get("reportId") || "").trim();
    const cellKey = String(formData.get("cellKey") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File wajib diisi." }, { status: 400 });
    }
    if (!reportId) {
      return NextResponse.json({ error: "reportId wajib diisi." }, { status: 400 });
    }
    if (!cellKey) {
      return NextResponse.json({ error: "cellKey wajib diisi." }, { status: 400 });
    }

    const safeReportId = sanitizePathPart(reportId);
    const safeCellKey = sanitizePathPart(cellKey);
    const safeFileName = sanitizePathPart(file.name || "attachment.webp");
    const objectPath = `reports/${safeReportId}/cells/${safeCellKey}-${Date.now()}-${safeFileName}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    const supabase = getSupabaseAdminClient();
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
            : "Gagal mengunggah lampiran report ke Supabase Storage.",
      },
      { status: 500 }
    );
  }
}
