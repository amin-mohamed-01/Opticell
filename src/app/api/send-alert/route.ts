// app/api/send-alert/route.ts
import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

// In-memory storage for the last known status per batch ID
// Note: This only persists while the serverless instance is warm.
// On cold starts (after inactivity), it resets and assumes 'Normal' for new/unknown batches.
// For production with high reliability, replace with persistent storage (Vercel KV, Redis, database, etc.)
const lastStatuses: Record<string, string> = {};

export async function POST(req: Request) {
  try {
    const report = await req.json();

    // Validate required fields
    if (!report.id || !report.status || report.timestamp == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const batchId = String(report.id);
    const currentStatus = report.status.trim();

    // Allowed statuses
    if (!['Normal', 'Warning', 'Critical'].includes(currentStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Get previous status (default to 'Normal' for new/unknown batches)
    const previousStatus = lastStatuses[batchId] ?? 'Normal';

    // Send alert ONLY on escalation:
    // - Normal → Warning
    // - Normal → Critical
    // - Warning → Critical
    // No alert if status stays the same or goes down
    let shouldSend = false;
    if (
      (previousStatus === 'Normal' && currentStatus === 'Warning') ||
      (previousStatus === 'Normal' && currentStatus === 'Critical') ||
      (previousStatus === 'Warning' && currentStatus === 'Critical')
    ) {
      shouldSend = true;
    }

    // Always update the stored status
    lastStatuses[batchId] = currentStatus;

    if (!shouldSend) {
      return NextResponse.json({
        sent: false,
        message: 'No status escalation detected – email not sent'
      });
    }

    // Format timestamp (using en-US for English version – you can change locale if needed)
    const date = new Date(report.timestamp);
    const formattedDate = date.toLocaleString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    // Prepare email content
    const alertType = currentStatus; // Normal/Warning/Critical
    const alertColor =
      currentStatus === 'Critical' ? '#dc2626' :
        currentStatus === 'Warning' ? '#f59e0b' :
          '#16a34a';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: ${alertColor};">
          ${alertType} Alert - Bioreactor-01
        </h2>
        <p><strong>Date & Time:</strong> ${formattedDate}</p>
        <p><strong>Batch ID:</strong> ${report.id}</p>
        <p><strong>Temperature:</strong> ${report.temp ?? 'Not available'}°C</p>
        <p><strong>Humidity:</strong> ${report.humidity ?? 'Not available'}%</p>
        <p><strong>Alert Level:</strong> ${alertType}</p>
        <p><strong>Details / Reason:</strong> ${report.details ?? 'No additional details'}</p>
      </div>
    `;

    await resend.emails.send({
      from: 'Opticell Alerts <onboarding@resend.dev>',
      to: 'a.mohamed0238@gmail.com',
      subject: `${alertType} Alert - Batch ${report.id}`,
      html,
    });

    return NextResponse.json({
      sent: true,
      message: 'Alert email sent successfully'
    });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}