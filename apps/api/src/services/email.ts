import { Resend } from 'resend';

const FROM_EMAIL = process.env.FROM_EMAIL ?? 'SpotterSpace <noreply@noreply.spotterspace.com>';

/** Escape HTML special characters to prevent injection in email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetToken: string,
  baseUrl: string,
): Promise<void> {
  const resend = getResendClient();
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: 'Reset your SpotterSpace password',
    html: `
      <p>You requested a password reset for your SpotterSpace account.</p>
      <p>Click the link below to set a new password (expires in 1 hour):</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p>If you didn't request this, you can ignore this email.</p>
    `,
  });
}

export async function sendPasswordReminderEmail(toEmail: string, username: string): Promise<void> {
  const resend = getResendClient();
  await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: 'Your SpotterSpace account',
    html: `
      <p>The email associated with your SpotterSpace account is: <strong>${escapeHtml(toEmail)}</strong></p>
      <p>Username: <strong>${escapeHtml(username)}</strong></p>
      <p>To reset your password, visit the sign-in page and click "Forgot password".</p>
    `,
  });
}

export async function sendVerificationEmail(
  toEmail: string,
  username: string,
  token: string,
  baseUrl: string,
): Promise<void> {
  const resend = getResendClient();
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: 'Verify your SpotterSpace account',
    html: `
      <p>Hi <strong>${escapeHtml(username)}</strong>,</p>
      <p>Welcome to SpotterSpace! Please verify your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours. If you didn't create a SpotterSpace account, you can ignore this email.</p>
    `,
  });
}
