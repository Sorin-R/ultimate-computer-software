import { Router, Request, Response } from "express";
import nodemailer from "nodemailer";
import { env } from "../config/env";
import prisma from "../config/db";
import {
  sendDataRequestConfirmation,
  sendDataRequestNotification,
} from "../utils/email";
import { dataRequestRateLimiter, contactInquiryRateLimiter } from "../middleware/rateLimiters";
import { verifyCaptcha } from "../middleware/captcha";
import { stripHtml } from "../utils/sanitize";

const router = Router();

interface DataRequest {
  requestType: string;
  email: string;
  fullName: string;
  details?: string;
}

// Generate a simple confirmation ID
function generateConfirmationId(): string {
  return `DR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

// POST /api/contact/data-request
router.post(
  "/data-request",
  dataRequestRateLimiter,
  verifyCaptcha,
  async (req: Request, res: Response): Promise<void> => {
  try {
    const { requestType, email, fullName, details } = req.body as DataRequest;

    // Validation
    if (!email || !email.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    if (!fullName || !fullName.trim()) {
      res.status(400).json({ error: "Full name is required" });
      return;
    }

    const validRequestTypes = ["access", "download", "delete", "portability", "optout"];
    if (!requestType || !validRequestTypes.includes(requestType)) {
      res.status(400).json({ error: "Invalid request type" });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    const safeEmail = email.trim().toLowerCase();
    const safeFullName = stripHtml(fullName).trim().slice(0, 200);
    const safeRequestType = requestType.toLowerCase();
    // Generate confirmation ID
    const confirmationId = generateConfirmationId();

    // Store request in database
    const safeDetails = details ? stripHtml(details).trim().slice(0, 2000) : null;
    await prisma.dataRequest.create({
      data: {
        requestType: requestType.toUpperCase() as any,
        email: safeEmail,
        fullName: safeFullName,
        details: safeDetails,
        status: "PENDING",
        confirmationId,
      },
    });

    console.log(`✓ Data request stored in database: ${confirmationId}`);

    // Send confirmation email to user (async, don't wait for completion)
    sendDataRequestConfirmation(safeFullName, safeEmail, safeRequestType, confirmationId).catch(
      (error) => {
        console.error(`✗ Failed to send confirmation email: ${error}`);
      }
    );

    // Send notification email to admin (async, don't wait for completion)
    sendDataRequestNotification(
      safeFullName,
      safeEmail,
      safeRequestType,
      confirmationId,
      safeDetails ?? undefined
    ).catch(
      (error) => {
        console.error(`✗ Failed to send admin notification: ${error}`);
      }
    );

    // Security-first flow: do NOT auto-process account actions from a public endpoint.
    // Requests stay in moderation/admin workflow until manually verified.
    console.log(`ℹ️ Data request queued for manual review: ${confirmationId}`);

    res.json({
      success: true,
      message: "Data request submitted successfully",
      confirmationId,
      expectedProcessingTime: "30 days",
      nextSteps: "You will receive an email with instructions or your requested data",
    });
  } catch (error) {
    console.error("Error processing data request:", error);
    res.status(500).json({ error: "Failed to process data request" });
  }
});

// POST /api/contact/inquiry - Contact form for general inquiries
interface ContactInquiry {
  inquiryType: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}

function getDepartmentMailbox(inquiryType: string): string {
  if (inquiryType === "privacy") return env.SMTP_FROM_PRIVACY;
  if (inquiryType === "copyright") return env.SMTP_FROM_COPYRIGHT;
  return env.SMTP_FROM_SUPPORT;
}

router.post(
  "/inquiry",
  contactInquiryRateLimiter,
  verifyCaptcha,
  async (req: Request, res: Response): Promise<void> => {
  try {
    const { inquiryType, name, email, subject, message } = req.body as ContactInquiry;

    // Validation
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    if (!email || !email.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    if (!subject || !subject.trim()) {
      res.status(400).json({ error: "Subject is required" });
      return;
    }

    if (!message || !message.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const validTypes = ["general", "privacy", "support", "copyright"];
    if (!inquiryType || !validTypes.includes(inquiryType)) {
      res.status(400).json({ error: "Invalid inquiry type" });
      return;
    }

    // Route inquiry to the matching department mailbox.
    const recipientEmail = getDepartmentMailbox(inquiryType);

    // Send email to appropriate department
    const safeName = stripHtml(name).trim().slice(0, 200);
    const safeSubject = stripHtml(subject).trim().slice(0, 300);
    const safeMessage = stripHtml(message).trim().slice(0, 5000);

    await sendContactInquiryEmail(
      safeName,
      email.trim(),
      safeSubject,
      safeMessage,
      inquiryType,
      recipientEmail
    );

    console.log(`✓ Contact inquiry submitted: ${inquiryType} from ${safeName} (${email.trim()})`);

    res.json({
      success: true,
      message: "Your inquiry has been received. We'll respond within 24-48 hours.",
    });
  } catch (error) {
    console.error("Error processing contact inquiry:", error);
    res.status(500).json({ error: "Failed to submit inquiry" });
  }
});

// Email function for contact inquiries
async function sendContactInquiryEmail(
  name: string,
  email: string,
  subject: string,
  message: string,
  inquiryType: string,
  recipientEmail: string
): Promise<void> {
  try {
    if (!env.SMTP_PASS) {
      throw new Error("Email configuration missing: SMTP_PASS");
    }

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        // Match SMTP auth user to sender mailbox to satisfy host policy.
        user: recipientEmail,
        pass: env.SMTP_PASS,
      },
    });

    const inquiryTypeLabels: Record<string, string> = {
      general: "General Inquiry",
      privacy: "Privacy Concern",
      support: "Technical Support",
      copyright: "Copyright Issue",
    };

    // Email to recipient
    await transporter.sendMail({
      from: recipientEmail,
      to: recipientEmail,
      replyTo: email,
      subject: `[${inquiryTypeLabels[inquiryType]}] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #b5121b; color: white; padding: 20px; text-align: center;">
            <h1>${inquiryTypeLabels[inquiryType]}</h1>
          </div>

          <div style="padding: 20px; background-color: #f9f9f9;">
            <p><strong>From:</strong> ${name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Type:</strong> ${inquiryTypeLabels[inquiryType]}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div style="padding: 20px; border-left: 4px solid #b5121b;">
            <h3>Message:</h3>
            <p style="white-space: pre-wrap; line-height: 1.6;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
          </div>

          <div style="padding: 20px; background-color: #f9f9f9; font-size: 12px; color: #666; border-top: 1px solid #ddd;">
            <p>This email was submitted through the contact form on Ultimate Computer Software website.</p>
            <p>Reply directly to this email or contact the sender at ${email}</p>
          </div>
        </div>
      `,
    });

    // Confirmation email to user
    await transporter.sendMail({
      from: recipientEmail,
      to: email,
      replyTo: recipientEmail,
      subject: "We received your inquiry - Ultimate Computer Software",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #b5121b; color: white; padding: 20px; text-align: center;">
            <h1>Inquiry Received</h1>
          </div>

          <div style="padding: 20px;">
            <p>Hi ${name},</p>

            <p>Thank you for contacting Ultimate Computer Software. We have received your ${inquiryTypeLabels[inquiryType].toLowerCase()} and will respond within 24-48 business hours.</p>

            <div style="background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #b5121b;">
              <p><strong>Your Inquiry Details:</strong></p>
              <p><strong>Type:</strong> ${inquiryTypeLabels[inquiryType]}</p>
              <p><strong>Subject:</strong> ${subject}</p>
              <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
            </div>

            <p>If you need immediate assistance, you can reach us directly at:</p>
            <ul style="list-style: none; padding: 0;">
              <li>• General inquiries: support@ultimatecomputersoftware.com</li>
              <li>• Privacy concerns: privacy@ultimatecomputersoftware.com</li>
              <li>• Technical support: support@ultimatecomputersoftware.com</li>
              <li>• Copyright issues: copyright@ultimatecomputersoftware.com</li>
            </ul>

            <p>Best regards,<br/>Ultimate Computer Software Team</p>
          </div>

          <div style="padding: 20px; background-color: #f9f9f9; font-size: 12px; color: #666; border-top: 1px solid #ddd; text-align: center;">
            <p>© ${new Date().getFullYear()} Ultimate Computer Software. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    console.log(`✓ Contact inquiry emails sent for: ${subject}`);
  } catch (error) {
    console.error("✗ Failed to send contact inquiry email:", error);
    // Don't rethrow - email failure shouldn't block the submission
  }
}

export default router;
