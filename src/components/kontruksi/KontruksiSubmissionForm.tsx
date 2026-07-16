"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

type ZoneItem = {
  id?: string;
  idTitik?: string;
  grup?: string;
  group?: string;
  zona?: string;
  namaTitik?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  [key: string]: unknown;
};

type ActiveTask = {
  id?: string;
  designUploadId?: string;
  zones?: ZoneItem[];
  assigneeId?: string;
  assigneeName?: string;
  createdById?: string;
  createdByName?: string;
};

type SubmissionField = {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "file";
  required?: boolean;
};

type KontruksiSubmissionFormProps = {
  title: string;
  stage: string;
  backHref: string;
  fields: SubmissionField[];
  successHref?: string;
};

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export default function KontruksiSubmissionForm({
  title,
  stage,
  backHref,
  fields,
  successHref,
}: KontruksiSubmissionFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [task, setTask] = useState<ActiveTask | null>(null);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const [selectedIdTitik, setSelectedIdTitik] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("activeKontruksiTask");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ActiveTask;
      setTask(parsed);
      setZones(Array.isArray(parsed?.zones) ? parsed.zones : []);
    } catch {
      setTask(null);
      setZones([]);
    }
  }, []);

  const idOptions = useMemo(() => (zones || []).filter((zone) => zone.idTitik), [zones]);
  const selectedZone = useMemo(() => idOptions.find((zone) => zone.idTitik === selectedIdTitik) || null, [idOptions, selectedIdTitik]);

  const updateValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const updateFile = (key: string, file: File | null) => {
    setFiles((current) => ({ ...current, [key]: file }));
    if (file) updateValue(key, file.name);
  };

  const uploadFile = async (field: SubmissionField, file: File) => {
    const body = new FormData();
    body.append("file", file);
    body.append("folder", `kontruksi/${stage}/${selectedIdTitik || "unknown"}`);
    body.append("filename", `${field.key}-${file.name}`);
    const response = await fetch("/api/storage/survey-attachments", {
      method: "POST",
      body,
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url) {
      throw new Error(payload.error || `Gagal mengunggah ${field.label}.`);
    }
    return payload.url;
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (!selectedIdTitik) {
      setError("Pilih ID titik terlebih dahulu.");
      return;
    }

    const selectedStatus = String(selectedZone?.status || selectedZone?.kontruksiStatus || "");
    const isDuplicateStage =
      selectedZone?.submittedStage === stage &&
      Boolean(selectedZone?.submissionId) &&
      ["submitted", "valid", "rejected"].includes(selectedStatus);
    const allowDuplicate =
      isDuplicateStage &&
      window.confirm(
        "Titik ini sudah pernah dikirim untuk tahap yang sama. Tetap kirim ulang sebagai data baru?"
      );
    if (isDuplicateStage && !allowDuplicate) {
      setError("Pengiriman dibatalkan agar data titik+tahap tidak dobel.");
      return;
    }

    const missingField = fields.find((field) => {
      if (!field.required) return false;
      if (field.type === "file") return !files[field.key] && !values[field.key]?.trim();
      return !values[field.key]?.trim();
    });
    if (missingField) {
      setError(`${missingField.label} wajib diisi.`);
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const uploadedValues: Record<string, string> = { ...values };
      for (const field of fields) {
        const file = files[field.key];
        if (field.type === "file" && file) {
          uploadedValues[field.key] = await uploadFile(field, file);
          uploadedValues[`${field.key}Name`] = file.name;
        }
      }

      const payload = {
        resource: "submission",
        sourceTaskId: task?.id || "",
        designUploadId: task?.designUploadId || "",
        submittedById: user?.uid || task?.assigneeId || "",
        submittedByName: user?.displayName || user?.name || task?.assigneeName || user?.email || "Petugas Kontruksi",
        assigneeId: task?.assigneeId || user?.uid || "",
        assigneeName: task?.assigneeName || user?.displayName || user?.name || "",
        createdById: task?.createdById || "",
        createdByName: task?.createdByName || "",
        idTitik: selectedIdTitik,
        namaTitik: selectedZone?.namaTitik || selectedIdTitik,
        zona: selectedZone?.zona || selectedZone?.grup || selectedZone?.group || "",
        grup: selectedZone?.grup || selectedZone?.group || selectedZone?.zona || "",
        latitude: normalizeNumber(selectedZone?.latitude ?? selectedZone?.lat),
        longitude: normalizeNumber(selectedZone?.longitude ?? selectedZone?.lng),
        stage,
        tahap: stage,
        type: stage,
        kategori: stage,
        status: "submitted",
        kontruksiStatus: "submitted",
        allowDuplicate,
        formData: uploadedValues,
        ...uploadedValues,
        createdAt: now,
        updatedAt: now,
      };

      const response = await fetch("/api/admin/kontruksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok) throw new Error(result.error || "Gagal mengirim data konstruksi.");

      if (task) {
        const nextZones = (task.zones || []).map((zone) => {
          if (zone.idTitik !== selectedIdTitik) return zone;
          return {
            ...zone,
            status: "submitted",
            kontruksiStatus: "submitted",
            submittedStage: stage,
            submissionId: result.id,
            submittedAt: now,
          };
        });
        localStorage.setItem(
          "activeKontruksiTask",
          JSON.stringify({
            ...task,
            zones: nextZones,
            status: nextZones.every((zone) => zone.status === "submitted" || zone.kontruksiStatus === "submitted") ? "submitted" : "in-progress",
          })
        );
      }

      setSuccess("Data berhasil dikirim dan menunggu validasi admin.");
      setValues({});
      setFiles({});
      setSelectedIdTitik("");
      setTimeout(() => router.push(successHref || backHref), 800);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal mengirim data konstruksi.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <div className="absolute left-4 top-20 h-20 w-1 bg-red-600" />
      <div className="absolute left-6 top-20 h-20 w-[3px] bg-red-500" />

      <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-red-600" />
      <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full border-[6px] border-red-500" />

      <div className="relative mx-auto w-full max-w-md px-5 pb-24 pt-5">
        <div className="text-[11px] uppercase tracking-wide text-gray-300">dashboard</div>

        <header className="mt-2 flex items-center justify-between">
          <button
            onClick={() => router.push(backHref)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white shadow-md"
            aria-label="Kembali"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <div className="text-base font-semibold text-gray-900">{title}</div>
          </div>

          <div className="relative h-12 w-12">
            <Image src="/BDG1.png" alt="Logo" fill className="object-contain" />
          </div>
        </header>

        <div className="mt-6 rounded-2xl border border-gray-300 bg-white p-4 shadow-sm">
          <div className="text-center text-xs text-gray-700">Lengkapi data Dibawah</div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-gray-900">Pilih Id Titik</label>
              <select
                value={selectedIdTitik}
                onChange={(event) => setSelectedIdTitik(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs"
              >
                <option value="">Masukkan Id Titik</option>
                {idOptions.map((zone, index) => (
                  <option key={`${zone.id || index}`} value={zone.idTitik}>
                    {zone.idTitik} {zone.grup ? `- ${zone.grup}` : ""}
                  </option>
                ))}
              </select>
              {idOptions.length === 0 ? (
                <div className="mt-1 text-[11px] text-amber-600">Belum ada titik dari tugas aktif. Buka dari Daftar Tugas terlebih dahulu.</div>
              ) : null}
            </div>

            {fields.map((field) => (
              <div key={field.key}>
                <label className="text-[11px] font-semibold text-gray-900">{field.label}</label>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs">
                  {field.type === "file" ? (
                    <>
                      <span className="min-w-0 flex-1 truncate text-gray-500">{files[field.key]?.name || values[field.key] || field.placeholder}</span>
                      <input
                        id={`${stage}-${field.key}`}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) => updateFile(field.key, event.target.files?.[0] || null)}
                      />
                      <label htmlFor={`${stage}-${field.key}`} className="cursor-pointer rounded-md bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700">
                        Pilih
                      </label>
                    </>
                  ) : (
                    <input
                      type="text"
                      value={values[field.key] || ""}
                      onChange={(event) => updateValue(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className="w-full outline-none"
                    />
                  )}
                  {field.type === "file" ? (
                    <svg className="h-4 w-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h3l2-3h8l2 3h3v11H3z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div> : null}
          {success ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">{success}</div> : null}

          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-24 rounded-full border border-gray-400 bg-sky-100 py-1 text-xs font-semibold text-gray-800 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Kirim..." : "Kirim"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
