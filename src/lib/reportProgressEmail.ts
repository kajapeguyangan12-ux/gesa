type ProgressEmailInput = {
  to: string;
  reporterName: string;
  reportId: string;
  reportTitle: string;
  statusLabel: string;
  note: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isValidNotificationEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function sendReportProgressEmail(input: ProgressEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = (process.env.REPORT_PROGRESS_EMAIL_FROM || process.env.RESEND_FROM_EMAIL)?.trim();
  if (!apiKey || !from || !isValidNotificationEmail(input.to)) {
    return { sent: false, reason: "email_not_configured" as const };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `Progres laporan APJ: ${input.statusLabel}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
            <h2>Progres Perbaikan APJ</h2>
            <p>Halo ${escapeHtml(input.reporterName || "Pelapor")},</p>
            <p>Status laporan <strong>${escapeHtml(input.reportTitle)}</strong> telah diperbarui menjadi <strong>${escapeHtml(input.statusLabel)}</strong>.</p>
            <p>${escapeHtml(input.note)}</p>
            <p style="color:#64748b;font-size:13px">Nomor laporan: ${escapeHtml(input.reportId)}</p>
          </div>
        `,
      }),
    });
    if (!response.ok) {
      return { sent: false, reason: `provider_error_${response.status}` as const };
    }
    return { sent: true as const };
  } catch {
    return { sent: false, reason: "provider_unreachable" as const };
  }
}
