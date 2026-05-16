import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";

const transporterBySender = new Map<string, Transporter>();

/**
 * Initialize email transporter
 */
function getTransporter(fromAddress: string): Transporter {
  const sender = fromAddress.trim().toLowerCase();
  const existing = transporterBySender.get(sender);
  if (existing) {
    return existing;
  }

  if (!env.SMTP_PASS) {
    console.error("Email service not configured. SMTP_PASS must be set.");
    throw new Error("Email configuration missing");
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // true for 465, false for other ports
    auth: {
      // One SMTP account per mailbox; this keeps sender identity aligned
      // with provider policy ("sender must be owned by authenticated user").
      user: sender,
      pass: env.SMTP_PASS,
    },
  });

  transporterBySender.set(sender, transporter);
  return transporter;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate HTML email template for data request confirmation
 */
function getConfirmationEmailTemplate(
  fullName: string,
  email: string,
  requestType: string,
  confirmationId: string
): string {
  const requestTypeLabels: Record<string, string> = {
    ACCESS: "Access My Data",
    DOWNLOAD: "Download My Data",
    DELETE: "Delete My Account",
    PORTABILITY: "Data Portability",
    OPTOUT: "Opt-Out of Marketing",
  };

  const label = requestTypeLabels[requestType] || requestType;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #b5121b; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-left: 4px solid #b5121b; }
          .confirmation-id { background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .id-label { font-size: 12px; color: #666; }
          .id-value { font-size: 18px; font-weight: bold; color: #b5121b; word-break: break-all; }
          .footer { font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Data Request Received</h1>
          </div>

          <p>Dear ${fullName},</p>

          <p>Thank you for submitting your data request to Ultimate Computer Software. We have received your submission and will process it according to applicable privacy laws.</p>

          <div class="content">
            <h3>Request Details</h3>
            <p><strong>Request Type:</strong> ${label}</p>
            <p><strong>Submitted Email:</strong> ${email}</p>
            <p><strong>Submission Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <div class="confirmation-id">
            <div class="id-label">Your Confirmation ID (save for your records):</div>
            <div class="id-value">${confirmationId}</div>
          </div>

          <h3>What Happens Next</h3>
          <p>We will process your request within <strong>30 days</strong> as required by law. You will receive an email with further instructions or your requested data at the email address you provided.</p>

          <p>If you have any questions, please contact us at <a href="mailto:privacy@ultimatecomputersoftware.com">privacy@ultimatecomputersoftware.com</a>.</p>

          <div class="footer">
            <p>This email is in response to your data request submitted on ${new Date().toLocaleDateString()}.</p>
            <p>Ultimate Computer Software | Privacy Team<br>
            <a href="https://www.ultimatecomputersoftware.com">www.ultimatecomputersoftware.com</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate HTML email template for admin notification
 */
function getAdminNotificationTemplate(
  fullName: string,
  email: string,
  requestType: string,
  confirmationId: string,
  details?: string
): string {
  const requestTypeLabels: Record<string, string> = {
    ACCESS: "Access My Data",
    DOWNLOAD: "Download My Data",
    DELETE: "Delete My Account",
    PORTABILITY: "Data Portability",
    OPTOUT: "Opt-Out of Marketing",
  };

  const label = requestTypeLabels[requestType] || requestType;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #333; color: white; padding: 20px; text-align: center; }
          .details { background-color: #f9f9f9; padding: 15px; margin: 15px 0; border-left: 4px solid #b5121b; }
          .footer { font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
          .urgent { color: #b5121b; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Data Request Submitted</h1>
          </div>

          <p><span class="urgent">⚠️ ACTION REQUIRED:</span> A new data request has been submitted and requires processing within 30 days.</p>

          <div class="details">
            <h3>Request Information</h3>
            <p><strong>Confirmation ID:</strong> ${confirmationId}</p>
            <p><strong>Request Type:</strong> ${label}</p>
            <p><strong>User Email:</strong> ${email}</p>
            <p><strong>User Name:</strong> ${fullName}</p>
            <p><strong>Submission Date:</strong> ${new Date().toLocaleString()}</p>
            ${details ? `<p><strong>Additional Details:</strong></p><p>${details.replace(/\n/g, "<br>")}</p>` : ""}
          </div>

          <h3>Processing Instructions</h3>
          <ul>
            <li>Verify the user's identity if required</li>
            <li>Process the request according to the type (Access, Download, Delete, Portability, or OptOut)</li>
            <li>Document all actions taken</li>
            <li>Send confirmation email to user with results</li>
            <li>Update request status in the system</li>
          </ul>

          <h3>Legal Requirements</h3>
          <p>This request falls under GDPR, CCPA, LGPD, PIPEDA, POPIA, and/or PDPA regulations. Ensure compliance with:</p>
          <ul>
            <li>30-day processing deadline</li>
            <li>Proper identity verification</li>
            <li>Complete data compilation (if applicable)</li>
            <li>Secure data delivery</li>
          </ul>

          <div class="footer">
            <p>This is an automated notification from Ultimate Computer Software Privacy Request System.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Send confirmation email to user
 */
export async function sendDataRequestConfirmation(
  fullName: string,
  email: string,
  requestType: string,
  confirmationId: string
): Promise<void> {
  try {
    const from = env.SMTP_FROM_PRIVACY;
    const transporter = getTransporter(from);

    await transporter.sendMail({
      from,
      to: email,
      subject: "Data Request Confirmation - Ultimate Computer Software",
      html: getConfirmationEmailTemplate(fullName, email, requestType, confirmationId),
    });

    console.log(`✓ Confirmation email sent to ${email}`);
  } catch (error) {
    console.error(`✗ Failed to send confirmation email to ${email}:`, error);
    // Don't rethrow - email failure shouldn't block the request
  }
}

/**
 * Send notification email to admin
 */
export async function sendDataRequestNotification(
  fullName: string,
  email: string,
  requestType: string,
  confirmationId: string,
  details?: string
): Promise<void> {
  try {
    const from = env.SMTP_FROM_PRIVACY;
    const transporter = getTransporter(from);

    await transporter.sendMail({
      from,
      to: env.SMTP_FROM_PRIVACY,
      subject: `[DATA REQUEST] ${requestType} - ${fullName} (${confirmationId})`,
      html: getAdminNotificationTemplate(fullName, email, requestType, confirmationId, details),
    });

    console.log(`✓ Admin notification sent for request ${confirmationId}`);
  } catch (error) {
    console.error(`✗ Failed to send admin notification for request ${confirmationId}:`, error);
    // Don't rethrow - email failure shouldn't block the request
  }
}

/**
 * Send password reset email.
 */
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string,
  expiresAt: Date
): Promise<void> {
  try {
    const from = env.SMTP_FROM_NOREPLY;
    const transporter = getTransporter(from);
    const safeName = name || "there";
    await transporter.sendMail({
      from,
      to: email,
      subject: "Reset your password - Ultimate Computer Software",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
            <h2>Password reset requested</h2>
            <p>Hello ${safeName},</p>
            <p>We received a request to reset your password.</p>
            <p>
              <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#b5121b;color:#fff;text-decoration:none;">
                Reset password
              </a>
            </p>
            <p>If the button does not work, use this link:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>This link expires on <strong>${expiresAt.toUTCString()}</strong>.</p>
            <p>If you did not request this, you can ignore this email.</p>
          </body>
        </html>
      `,
    });
  } catch (error) {
    console.error(`Failed to send password reset email to ${email}:`, error);
  }
}

/**
 * Send account email verification link.
 */
export async function sendEmailVerificationEmail(
  email: string,
  name: string,
  verificationUrl: string,
  expiresAt: Date
): Promise<void> {
  try {
    const from = env.SMTP_FROM_NOREPLY;
    const transporter = getTransporter(from);
    const safeName = name || "there";
    await transporter.sendMail({
      from,
      to: email,
      subject: "Verify your email - Ultimate Computer Software",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
            <h2>Confirm your email address</h2>
            <p>Hello ${safeName},</p>
            <p>Thanks for registering. Please confirm your email to activate your account.</p>
            <p>
              <a href="${verificationUrl}" style="display:inline-block;padding:10px 16px;background:#b5121b;color:#fff;text-decoration:none;">
                Verify Email
              </a>
            </p>
            <p>If the button does not work, use this link:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>This link expires on <strong>${expiresAt.toUTCString()}</strong>.</p>
            <p>If you did not create this account, you can ignore this email.</p>
          </body>
        </html>
      `,
    });
  } catch (error) {
    console.error(`Failed to send verification email to ${email}:`, error);
  }
}

/**
 * Notify author that an article has been submitted for editorial review.
 */
export async function sendArticleSubmittedForReviewEmail(
  email: string,
  name: string,
  articleTitle: string
): Promise<void> {
  try {
    const from = env.SMTP_FROM_NOREPLY;
    const transporter = getTransporter(from);
    const safeName = escapeHtml(name || "there");
    const safeTitle = escapeHtml(articleTitle || "Untitled Article");
    await transporter.sendMail({
      from,
      to: email,
      subject: "Article Received for Review - Ultimate Computer Software",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
            <h2>Your article is now under editorial review</h2>
            <p>Hello ${safeName},</p>
            <p>Thank you for your submission. Our editorial team has received your article and started the review process.</p>
            <p><strong>Article title:</strong> ${safeTitle}</p>
            <p>Reviews are typically completed within <strong>24 hours</strong>. You will receive another email as soon as a publication decision is made.</p>
            <p>We appreciate your contribution to Ultimate Computer Software.</p>
          </body>
        </html>
      `,
    });
  } catch (error) {
    console.error(`Failed to send review-submitted email to ${email}:`, error);
  }
}

/**
 * Notify author that an article has been published.
 */
export async function sendArticlePublishedEmail(
  email: string,
  name: string,
  articleTitle: string,
  articleSlug: string
): Promise<void> {
  try {
    const from = env.SMTP_FROM_NOREPLY;
    const transporter = getTransporter(from);
    const safeName = escapeHtml(name || "there");
    const safeTitle = escapeHtml(articleTitle || "Untitled Article");
    const safeSlug = encodeURIComponent(articleSlug || "");
    const baseUrl = env.FRONTEND_URL.replace(/\/$/, "");
    const articleUrl = `${baseUrl}/${safeSlug}`;

    await transporter.sendMail({
      from,
      to: email,
      subject: "Your Article Has Been Published - Ultimate Computer Software",
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
            <h2>Your article is now live</h2>
            <p>Hello ${safeName},</p>
            <p>Your article has been approved and published on Ultimate Computer Software.</p>
            <p><strong>Article title:</strong> ${safeTitle}</p>
            <p>
              <a href="${articleUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;">
                View Published Article
              </a>
            </p>
            <p>If the button does not work, use this link:</p>
            <p><a href="${articleUrl}">${articleUrl}</a></p>
          </body>
        </html>
      `,
    });
  } catch (error) {
    console.error(`Failed to send published email to ${email}:`, error);
  }
}

/**
 * Notify author that an article was rejected, including moderator feedback.
 * Throws on failure so moderation flow can decide whether to continue.
 */
export async function sendArticleRejectedEmail(
  email: string,
  name: string,
  articleTitle: string,
  instructions: string
): Promise<void> {
  const from = env.SMTP_FROM_NOREPLY;
  const transporter = getTransporter(from);
  const safeName = escapeHtml(name || "there");
  const safeTitle = escapeHtml(articleTitle || "Untitled Article");
  const safeInstructions = escapeHtml(instructions || "").replace(/\n/g, "<br>");

  await transporter.sendMail({
    from,
    to: email,
    subject: "Article Revision Required - Ultimate Computer Software",
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: Arial, sans-serif; color: #222; line-height: 1.6;">
          <h2>Your article needs revisions before publication</h2>
          <p>Hello ${safeName},</p>
          <p>Thank you for your submission. After editorial review, we need a few updates before we can publish your article.</p>
          <p><strong>Article title:</strong> ${safeTitle}</p>
          <h3 style="margin-top:20px;">Editorial feedback</h3>
          <div style="padding:12px;border-left:4px solid #b5121b;background:#f8fafc;">
            ${safeInstructions}
          </div>
          <p style="margin-top:16px;">Please update your article in your dashboard and submit it again for review.</p>
          <p>We appreciate your contribution to Ultimate Computer Software.</p>
        </body>
      </html>
    `,
  });
}
