import { NextRequest, NextResponse } from "next/server";
import { getAdminStorageBucket } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path")?.trim();

  if (!path) {
    return NextResponse.json({ error: "path parameter is required" }, { status: 400 });
  }

  try {
    const bucket = getAdminStorageBucket();
    const file = bucket.file(path);
    const [exists] = await file.exists();

    if (!exists) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    const [contents] = await file.download();
    const body = new Uint8Array(contents);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Proxy Storage JSON] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to proxy JSON bundle" },
      { status: 500 }
    );
  }
}
