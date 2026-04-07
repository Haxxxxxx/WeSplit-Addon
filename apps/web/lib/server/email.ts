import 'server-only';

/**
 * Email sending utilities — server-side only.
 *
 * Uses Resend (https://resend.com) for transactional email delivery.
 * Requires RESEND_API_KEY environment variable.
 *
 * Gracefully falls back to console.log when the API key is not configured
 * so development works without setting up a real email provider.
 */

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL || 'WeSplit <noreply@wesplit.io>';

const APP_NAME = 'WeSplit';

// ---------------------------------------------------------------------------
// Send OTP email for Telegram account linking
// ---------------------------------------------------------------------------

export interface SendOtpEmailOptions {
  to: string;
  otp: string;
  userName?: string;
  /** OTP validity window in minutes (default 10) */
  expiryMinutes?: number;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** true when we fell back to console.log (no API key configured) */
  devMode?: boolean;
}

export async function sendOtpEmail(options: SendOtpEmailOptions): Promise<SendEmailResult> {
  const { to, otp, userName, expiryMinutes = 10 } = options;

  const apiKey = process.env.RESEND_API_KEY;

  // Dev / staging fallback — log to console if no API key (never in production)
  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is required in production');
    }
    console.warn('[Email] RESEND_API_KEY not set — OTP sent to server console (dev only)');
    // NOTE: OTP only logged in dev — never reaches production logs
    console.log(`[Email] DEV OTP for ${to}: ${otp} (expires in ${expiryMinutes}min)`);
    return { success: true, devMode: true };
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const greeting = userName ? `Hi ${userName},` : 'Hi,';

  const html = buildOtpEmailHtml({ otp, greeting, expiryMinutes });
  const text = buildOtpEmailText({ otp, greeting, expiryMinutes });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      // S1-8: OTP kept in body only — not in subject (prevents notification preview leakage)
      subject: `Your ${APP_NAME} verification code`,
      html,
      text,
    });

    if (error) {
      console.error('[Email] Resend API error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error sending email';
    console.error('[Email] Failed to send OTP email:', err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Send sign-in link email (passwordless auth)
// ---------------------------------------------------------------------------

export interface SendSignInEmailOptions {
  to: string;
  signInLink: string;
}

export async function sendSignInEmail(options: SendSignInEmailOptions): Promise<SendEmailResult> {
  const { to, signInLink } = options;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is required in production');
    }
    console.warn('[Email] RESEND_API_KEY not set — sign-in link sent to server console (dev only)');
    console.log(`[Email] DEV sign-in link for ${to}: ${signInLink}`);
    return { success: true, devMode: true };
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  const html = buildSignInEmailHtml({ signInLink });
  const text = buildSignInEmailText({ signInLink });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `Sign in to ${APP_NAME}`,
      html,
      text,
    });

    if (error) {
      // If custom domain isn't verified, retry with Resend's free sender
      if (error.message?.includes('not verified') || error.message?.includes('domain')) {
        console.warn('[Email] Custom domain not verified — retrying with onboarding@resend.dev');
        const { data: retryData, error: retryError } = await resend.emails.send({
          from: 'WeSplit <onboarding@resend.dev>',
          to,
          subject: `Sign in to ${APP_NAME}`,
          html,
          text,
        });

        if (retryError) {
          console.error('[Email] Resend fallback also failed:', retryError);
          return { success: false, error: retryError.message };
        }

        return { success: true, messageId: retryData?.id };
      }

      console.error('[Email] Resend API error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error sending email';
    console.error('[Email] Failed to send sign-in email:', err);
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

interface TemplateVars {
  otp: string;
  greeting: string;
  expiryMinutes: number;
}

function buildOtpEmailHtml({ otp, greeting, expiryMinutes }: TemplateVars): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your ${APP_NAME} Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#061113;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#061113;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background-color:#121D1F;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#A5EA15,#53EF97);padding:32px;text-align:center;">
              <span style="font-size:28px;font-weight:800;color:#061113;letter-spacing:-0.5px;">${APP_NAME}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:rgba(255,255,255,0.7);font-size:16px;line-height:1.5;">
                ${greeting}
              </p>
              <p style="margin:0 0 24px;color:rgba(255,255,255,0.7);font-size:16px;line-height:1.5;">
                Use the code below to link your Telegram account to your ${APP_NAME} account.
                This code expires in <strong style="color:#fff;">${expiryMinutes} minutes</strong>.
              </p>

              <!-- OTP Code -->
              <div style="background:#061113;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
                <span style="font-size:40px;font-weight:700;letter-spacing:8px;color:#A5EA15;font-family:'Courier New',monospace;">
                  ${otp}
                </span>
              </div>

              <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:13px;line-height:1.5;">
                If you didn't request this, you can safely ignore this email.
                Someone may have entered your email address by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 32px;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;text-align:center;">
                &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpEmailText({ otp, greeting, expiryMinutes }: TemplateVars): string {
  return `${greeting}

Your ${APP_NAME} verification code is: ${otp}

This code expires in ${expiryMinutes} minutes.

Use this code to link your Telegram account to your ${APP_NAME} account.

If you didn't request this, please ignore this email.

— The ${APP_NAME} Team
`;
}

// ---------------------------------------------------------------------------
// Sign-in link email templates
// ---------------------------------------------------------------------------

interface SignInTemplateVars {
  signInLink: string;
}

function buildSignInEmailHtml({ signInLink }: SignInTemplateVars): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sign in to ${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#061113;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#061113;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;background-color:#121D1F;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#A5EA15,#53EF97);padding:32px;text-align:center;">
              <span style="font-size:28px;font-weight:800;color:#061113;letter-spacing:-0.5px;">${APP_NAME}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;color:rgba(255,255,255,0.7);font-size:16px;line-height:1.5;">
                Hi there,
              </p>
              <p style="margin:0 0 24px;color:rgba(255,255,255,0.7);font-size:16px;line-height:1.5;">
                Click the button below to sign in to your ${APP_NAME} account.
                This link expires in <strong style="color:#fff;">10 minutes</strong>.
              </p>

              <!-- Sign-in Button -->
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${signInLink}"
                   style="display:inline-block;background:linear-gradient(135deg,#A5EA15,#53EF97);color:#061113;font-size:16px;font-weight:700;text-decoration:none;padding:16px 48px;border-radius:12px;">
                  Sign in to ${APP_NAME}
                </a>
              </div>

              <p style="margin:0 0 16px;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.5;text-align:center;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin:0 0 24px;color:#A5EA15;font-size:12px;line-height:1.5;word-break:break-all;text-align:center;">
                ${signInLink}
              </p>

              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;line-height:1.5;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 32px;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;text-align:center;">
                &copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSignInEmailText({ signInLink }: SignInTemplateVars): string {
  return `Sign in to ${APP_NAME}

Click the link below to sign in to your account. This link expires in 10 minutes.

${signInLink}

If you didn't request this, please ignore this email.

— The ${APP_NAME} Team
`;
}
