import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

interface CaptchaResponse {
  success?: boolean;
}

export async function verifyCaptcha(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!env.CAPTCHA_REQUIRED) {
    next();
    return;
  }

  const token = (req.body as { captchaToken?: unknown })?.captchaToken;
  if (typeof token !== "string" || token.trim().length < 10) {
    res.status(400).json({ error: "Captcha verification is required" });
    return;
  }

  try {
    const verifyBody = new URLSearchParams({
      secret: env.CAPTCHA_SECRET,
      response: token.trim(),
    });
    if (req.ip) {
      verifyBody.set("remoteip", req.ip);
    }

    const response = await fetch(env.CAPTCHA_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: verifyBody.toString(),
    });

    const payload = (await response.json()) as CaptchaResponse;
    if (!response.ok || !payload.success) {
      res.status(400).json({ error: "Captcha verification failed" });
      return;
    }

    next();
  } catch (error) {
    console.error("Captcha verification error:", error);
    res.status(500).json({ error: "Captcha verification failed" });
  }
}
