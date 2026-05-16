import { NextFunction, Request, Response } from "express";
import { logAdminActivitySafe } from "../services/adminActivityService";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function upperSnake(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function inferTargetType(path: string): string {
  if (path.includes("/articles")) return "ARTICLE";
  if (path.includes("/comments")) return "COMMENT";
  if (path.includes("/reports")) return "REPORT";
  if (path.includes("/users")) return "USER";
  if (path.includes("/moderators")) return "MODERATOR";
  if (path.includes("/categories")) return "CATEGORY";
  if (path.includes("/adsense")) return "ADSENSE";
  if (path.includes("/admin/ads")) return "AD";
  return "ADMIN";
}

function inferAction(method: string, path: string): string {
  const normalizedMethod = method.toUpperCase();

  if (normalizedMethod === "PUT" && /\/articles\/[^/]+\/approve$/.test(path)) return "ARTICLE_APPROVE";
  if (normalizedMethod === "PUT" && /\/articles\/[^/]+\/reject$/.test(path)) return "ARTICLE_REJECT";
  if (normalizedMethod === "PUT" && /\/articles\/[^/]+\/hide$/.test(path)) return "ARTICLE_HIDE";
  if (normalizedMethod === "PUT" && /\/articles\/[^/]+\/unhide$/.test(path)) return "ARTICLE_UNHIDE";
  if (normalizedMethod === "DELETE" && /\/articles\/[^/]+$/.test(path)) return "ARTICLE_DELETE";

  if (normalizedMethod === "PUT" && /\/users\/[^/]+\/role$/.test(path)) return "USER_ROLE_UPDATE";
  if (normalizedMethod === "PUT" && /\/users\/[^/]+\/ban$/.test(path)) return "USER_BAN";
  if (normalizedMethod === "PUT" && /\/users\/[^/]+\/reactivate$/.test(path)) return "USER_REACTIVATE";
  if (normalizedMethod === "PUT" && /\/users\/[^/]+\/verify$/.test(path)) return "USER_VERIFY_TOGGLE";
  if (normalizedMethod === "DELETE" && /\/users\/[^/]+$/.test(path)) return "USER_DELETE";
  if (normalizedMethod === "POST" && /\/moderators$/.test(path)) return "MODERATOR_CREATE";

  if (normalizedMethod === "PUT" && /\/comments\/[^/]+\/hide$/.test(path)) return "COMMENT_HIDE";
  if (normalizedMethod === "PUT" && /\/comments\/[^/]+\/restore$/.test(path)) return "COMMENT_RESTORE";
  if (normalizedMethod === "DELETE" && /\/comments\/[^/]+$/.test(path)) return "COMMENT_DELETE";
  if (normalizedMethod === "PUT" && /\/comments\/reports\/[^/]+\/dismiss$/.test(path)) return "COMMENT_REPORT_DISMISS";

  if (normalizedMethod === "PUT" && /\/reports\/[^/]+$/.test(path)) return "REPORT_STATUS_UPDATE";
  if (normalizedMethod === "POST" && /\/users\/[^/]+\/policy-compliance$/.test(path)) {
    return "POLICY_COMPLIANCE_CREATE";
  }

  if (normalizedMethod === "PUT" && /\/categories\/[^/]+$/.test(path)) return "CATEGORY_UPDATE";
  if (normalizedMethod === "DELETE" && /\/categories\/[^/]+$/.test(path)) return "CATEGORY_DELETE";

  if (normalizedMethod === "POST" && /\/adsense$/.test(path)) return "ADSENSE_CREATE";
  if (normalizedMethod === "PUT" && /\/adsense\/[^/]+$/.test(path)) return "ADSENSE_UPDATE";
  if (normalizedMethod === "DELETE" && /\/adsense\/[^/]+$/.test(path)) return "ADSENSE_DELETE";

  if (normalizedMethod === "POST" && /\/admin\/ads$/.test(path)) return "AD_CREATE";
  if (normalizedMethod === "PUT" && /\/admin\/ads\/[^/]+\/toggle$/.test(path)) return "AD_TOGGLE";
  if (normalizedMethod === "PUT" && /\/admin\/ads\/[^/]+$/.test(path)) return "AD_UPDATE";
  if (normalizedMethod === "DELETE" && /\/admin\/ads\/[^/]+$/.test(path)) return "AD_DELETE";

  return `ADMIN_${normalizedMethod}_${upperSnake(inferTargetType(path))}`;
}

function summarizeDetails(action: string, body: unknown): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const payload = body as Record<string, unknown>;

  if (action === "USER_ROLE_UPDATE" && typeof payload.role === "string") {
    return `Changed role to ${payload.role.toUpperCase()}`;
  }
  if (action === "ARTICLE_REJECT" && typeof payload.instructions === "string") {
    return `Rejection instructions provided (${payload.instructions.trim().length} chars)`;
  }
  if (action === "REPORT_STATUS_UPDATE" && typeof payload.status === "string") {
    return `Set report status to ${payload.status.toUpperCase()}`;
  }

  const keys = Object.keys(payload).filter((key) => key !== "password" && key !== "content");
  if (keys.length === 0) return null;
  return `Updated fields: ${keys.join(", ")}`;
}

export function trackAdminActivity(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (!MUTATING_METHODS.has(method)) {
    next();
    return;
  }

  const startedAt = Date.now();
  const fullPath = `${req.baseUrl}${req.path}`;

  res.on("finish", () => {
    if (!req.user) return;
    if (res.statusCode < 200 || res.statusCode >= 400) return;

    const action = inferAction(method, fullPath);
    const targetType = inferTargetType(fullPath);
    const details = summarizeDetails(action, req.body);
    const targetId = typeof req.params?.id === "string" ? req.params.id : null;
    const durationMs = Date.now() - startedAt;

    void logAdminActivitySafe({
      actorId: req.user.userId,
      actorRole: req.user.role,
      action,
      targetType,
      targetId,
      targetLabel: null,
      details,
      metadata: {
        method,
        path: fullPath,
        statusCode: res.statusCode,
        durationMs,
      },
    });
  });

  next();
}
