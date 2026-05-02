async function dataUrlToFile(dataUrl: string, filename: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("Gagal membaca data gambar untuk upload.");
  }

  const blob = await response.blob();
  return new File([blob], filename, {
    type: blob.type || "image/webp",
  });
}

export async function uploadSurveyAttachmentFromDataUrl(
  dataUrl: string,
  folder: string,
  filename: string
) {
  const file = await dataUrlToFile(dataUrl, filename);
  const body = new FormData();
  body.append("file", file);
  body.append("folder", folder);
  body.append("filename", filename);

  const response = await fetch("/api/storage/survey-attachments", {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error("Gagal upload lampiran survey ke Supabase Storage.");
  }

  const payload = (await response.json()) as { url?: string };
  const url = typeof payload.url === "string" ? payload.url : "";
  if (!url) {
    throw new Error("Supabase Storage tidak mengembalikan URL lampiran survey.");
  }

  return url;
}
