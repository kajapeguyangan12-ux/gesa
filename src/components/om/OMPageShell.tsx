"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type OMMetaCard = {
  label: string;
  value: string;
  hint: string;
  tone?: "teal" | "cyan" | "emerald" | "slate";
};

interface OMPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  statusTitle: string;
  statusDescription: string;
  metaCards: OMMetaCard[];
  children: ReactNode;
}

function toneClassName(tone: OMMetaCard["tone"] = "teal") {
  if (tone === "cyan") return "border-cyan-100 bg-gradient-to-br from-cyan-50 to-white text-cyan-700";
  if (tone === "emerald") return "border-emerald-100 bg-gradient-to-br from-emerald-50 to-white text-emerald-700";
  if (tone === "slate") return "border-slate-200 bg-gradient-to-br from-slate-50 to-white text-slate-600";
  return "border-teal-100 bg-gradient-to-br from-teal-50 to-white text-teal-700";
}

export function OMPageShell({
  eyebrow,
  title,
  description,
  statusTitle,
  statusDescription,
  metaCards,
  children,
}: OMPageShellProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(8,145,178,0.14),_transparent_24%),linear-gradient(180deg,_#f6fdfa_0%,_#eef8f7_48%,_#f8fafc_100%)]">
      <div className="w-full px-3 pb-6 pt-3 sm:px-4 sm:pb-8 sm:pt-4 lg:px-6 xl:px-8">
        <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/88 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.28)] backdrop-blur sm:rounded-[32px]">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-400" />
          <div className="absolute -left-12 top-10 h-40 w-40 rounded-full bg-teal-100/70 blur-3xl" />
          <div className="absolute -right-12 bottom-0 h-48 w-48 rounded-full bg-cyan-100/80 blur-3xl" />

          <div className="relative border-b border-slate-200/70 px-4 py-3 sm:px-6 xl:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/admin/om")}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-700"
                  aria-label="Kembali ke dashboard O&M"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 px-3 py-2">
                  <div className="relative h-11 w-11 overflow-hidden rounded-xl bg-white ring-1 ring-teal-100">
                    <Image src="/BDG1.png" alt="Bali Gerbang Digital" fill className="object-contain p-1.5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-700">Admin O&M</div>
                    <div className="text-sm font-semibold text-slate-900">{eyebrow}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Mode</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">Operations Workspace</div>
              </div>
            </div>
          </div>

          <div className="relative grid gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1.7fr)_340px] xl:gap-5 xl:px-7 xl:py-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-700 shadow-sm">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M14.7 6.3a4.5 4.5 0 005.84 5.84l-8.93 8.92a2 2 0 11-2.83-2.83l8.92-8.93A4.5 4.5 0 0114.7 6.3z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8l4 4" />
                </svg>
                {eyebrow}
              </div>
              <h1 className="mt-4 max-w-5xl text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl xl:text-[3.35rem] xl:leading-[1.02]">
                {title}
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {metaCards.map((card) => (
                  <div key={card.label} className={`rounded-2xl border p-4 ${toneClassName(card.tone)}`}>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em]">{card.label}</div>
                    <div className="mt-2 text-2xl font-bold text-slate-950">{card.value}</div>
                    <div className="mt-1 text-sm text-slate-600">{card.hint}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(15,118,110,0.92))] p-5 text-white shadow-[0_24px_48px_-24px_rgba(15,23,42,0.65)] xl:self-start">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-100/90">Status Halaman</div>
              <h2 className="mt-3 text-[1.75rem] font-bold leading-tight">{statusTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-teal-50/90">{statusDescription}</p>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-teal-100/80">Arah Desain</div>
                <div className="mt-1 text-sm font-semibold">Bahasa visual disamakan dengan dashboard O&M utama.</div>
              </div>
            </div>
          </div>

          <div className="-mt-2 px-4 pb-4 sm:px-6 sm:pb-6 xl:-mt-4 xl:px-7 xl:pb-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

interface OMPlaceholderPanelProps {
  label: string;
  title: string;
  description: string;
  note: string;
}

export function OMPlaceholderPanel({ label, title, description, note }: OMPlaceholderPanelProps) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/92 shadow-[0_18px_40px_-26px_rgba(15,23,42,0.38)]">
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.2fr)_280px] lg:p-6">
        <div>
          <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
            {label}
          </div>
          <h3 className="mt-4 text-2xl font-bold text-slate-950">{title}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
        </div>

        <div className="rounded-[24px] border border-dashed border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Status Pengembangan</div>
          <div className="mt-3 text-lg font-bold text-slate-950">{note}</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Area ini disiapkan agar saat fitur inti ditambahkan nanti, struktur visualnya sudah selaras dengan modul O&M.</p>
        </div>
      </div>
    </div>
  );
}
