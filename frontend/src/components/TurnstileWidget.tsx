import { useEffect, useRef } from "react";

type TurnstileTheme = "light" | "dark" | "auto";

interface TurnstileWidgetProps {
  onTokenChange: (token: string | null) => void;
  className?: string;
  theme?: TurnstileTheme;
}

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
  theme?: TurnstileTheme;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || "";

let turnstileScriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Turnstile")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export default function TurnstileWidget({
  onTokenChange,
  className,
  theme = "light",
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    onTokenChange(null);

    if (!TURNSTILE_SITE_KEY || !containerRef.current) {
      return;
    }

    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) {
          return;
        }

        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          callback: (token: string) => onTokenChange(token),
          "expired-callback": () => onTokenChange(null),
          "error-callback": () => onTokenChange(null),
        });

        widgetIdRef.current = widgetId;
      })
      .catch(() => {
        if (!cancelled) {
          onTokenChange(null);
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [onTokenChange, theme]);

  if (!TURNSTILE_SITE_KEY) {
    return (
      <div className={className}>
        <p className="text-xs text-neutral-500">Captcha is not configured for this environment.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div ref={containerRef} />
    </div>
  );
}
