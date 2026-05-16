import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import { useAuth } from "../../context/AuthContext";

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
  recoveryCodes: string[];
}

export default function SecuritySettings() {
  const { user, refreshUser } = useAuth();

  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  const twoFactorEnabled = Boolean(user?.twoFactorEnabled);

  const sendResetEmail = async () => {
    if (!user?.email) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.post("/auth/password-reset/request", { email: user.email });
      setMessage(res.data?.message || "Password reset link requested.");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to request password reset");
    } finally {
      setLoading(false);
    }
  };

  const startSetup = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.post<SetupResponse>("/auth/2fa/setup");
      setSetup(res.data);
      setCode("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to start two-factor setup");
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.post("/auth/2fa/verify", { code });
      setMessage("Two-factor authentication has been enabled.");
      setSetup(null);
      setCode("");
      await refreshUser();
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const disableTwoFactor = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await api.post("/auth/2fa/disable", { code: disableCode });
      setMessage("Two-factor authentication has been disabled.");
      setDisableCode("");
      await refreshUser();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to disable two-factor authentication");
    } finally {
      setLoading(false);
    }
  };

  const recoveryCodeList = useMemo(() => setup?.recoveryCodes ?? [], [setup]);

  useEffect(() => {
    let cancelled = false;

    const buildQrCode = async () => {
      if (!setup?.otpauthUrl) {
        setQrCodeDataUrl("");
        return;
      }

      try {
        const dataUrl = await QRCode.toDataURL(setup.otpauthUrl, {
          width: 220,
          margin: 1,
          color: {
            dark: "#111111",
            light: "#FFFFFF",
          },
        });
        if (!cancelled) setQrCodeDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrCodeDataUrl("");
      }
    };

    buildQrCode();

    return () => {
      cancelled = true;
    };
  }, [setup?.otpauthUrl]);

  return (
    <>
      <SEOHead title="Security Settings" path="/dashboard/security" />
      <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-6">
        Security Settings
      </h1>

      {(error || message) && (
        <div
          className={`mb-4 p-3 border rounded text-sm ${
            error ? "bg-red-50 border-red-200 text-red-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="bg-white border border-black/15 p-5 mb-6">
        <h2 className="text-xl font-semibold mb-2">Two-Factor Authentication</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Status: <strong>{twoFactorEnabled ? "Enabled" : "Disabled"}</strong>
        </p>
        <div className="mb-4 border border-black/10 bg-neutral-50 p-4 text-sm text-neutral-700">
          <p className="font-semibold text-neutral-900 mb-2">How it works</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Click <strong>Enable 2FA</strong> to start setup.</li>
            <li>
              In your authenticator app (Google Authenticator, Microsoft Authenticator, Authy), add a new account
              using the setup key or authenticator URL shown below.
            </li>
            <li>Enter the current 6-digit code from the app, then click <strong>Verify &amp; Enable</strong>.</li>
            <li>
              Save your recovery codes in a safe place. Each recovery code works once and can be used if you lose
              access to your authenticator app.
            </li>
            <li>
              At login, after your email and password, you must enter a 6-digit authenticator code (or a recovery
              code) to complete sign-in.
            </li>
          </ol>
        </div>

        {twoFactorEnabled && (
          <div className="mb-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            2FA is active on your account. To turn it off, enter a current authenticator code or an unused recovery
            code below.
          </div>
        )}

        {!twoFactorEnabled && !setup && (
          <button
            onClick={startSetup}
            disabled={loading}
            className="px-4 py-2 bg-black text-white text-sm font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? "Starting..." : "Enable 2FA"}
          </button>
        )}

        {setup && !twoFactorEnabled && (
          <div className="space-y-4">
            <div className="p-3 border border-blue-200 bg-blue-50 text-sm text-blue-900">
              Setup in progress: add this account to your authenticator app, then enter the current 6-digit code to
              finish enabling 2FA.
            </div>

            <div className="p-3 border border-black/15 bg-neutral-50 text-sm">
              <p className="font-semibold mb-2">Scan QR code</p>
              <p className="text-neutral-600 mb-3">
                Open your authenticator app and scan this QR code for instant setup.
              </p>
              {qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="Two-factor authentication setup QR code"
                  className="w-[220px] h-[220px] border border-black/15 bg-white"
                />
              ) : (
                <p className="text-neutral-500">Generating QR code...</p>
              )}
            </div>

            <div className="p-3 border border-black/15 bg-neutral-50 text-sm">
              <p className="font-semibold mb-1">Setup key</p>
              <code className="break-all">{setup.secret}</code>
            </div>

            <div className="p-3 border border-black/15 bg-neutral-50 text-sm">
              <p className="font-semibold mb-1">Authenticator URL</p>
              <code className="break-all">{setup.otpauthUrl}</code>
            </div>

            <div className="p-3 border border-black/15 bg-amber-50 text-sm">
              <p className="font-semibold mb-2">Recovery codes (store safely)</p>
              <ul className="grid grid-cols-2 gap-2">
                {recoveryCodeList.map((recoveryCode) => (
                  <li key={recoveryCode}>
                    <code>{recoveryCode}</code>
                  </li>
                ))}
              </ul>
            </div>

            <div className="max-w-xs">
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
                Verification code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 border border-black/25 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                placeholder="6-digit code"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={verifySetup}
                disabled={loading || !code.trim()}
                className="px-4 py-2 bg-[#b5121b] text-white text-sm font-semibold uppercase tracking-[0.08em] hover:bg-[#8f0f16] disabled:opacity-50"
              >
                Verify & Enable
              </button>
              <button
                onClick={() => {
                  setSetup(null);
                  setCode("");
                }}
                disabled={loading}
                className="px-4 py-2 border border-black/25 text-sm font-semibold uppercase tracking-[0.08em] hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {twoFactorEnabled && (
          <div className="space-y-3 max-w-sm">
            <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
              Enter code to disable
            </label>
            <input
              type="text"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              className="w-full px-3 py-2 border border-black/25 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
              placeholder="6-digit code or recovery code"
            />
            <button
              onClick={disableTwoFactor}
              disabled={loading || !disableCode.trim()}
              className="px-4 py-2 bg-red-700 text-white text-sm font-semibold uppercase tracking-[0.08em] hover:bg-red-800 disabled:opacity-50"
            >
              Disable 2FA
            </button>
          </div>
        )}
      </section>

      <section className="bg-white border border-black/15 p-5">
        <h2 className="text-xl font-semibold mb-2">Password Reset</h2>
        <p className="text-sm text-neutral-600 mb-4">
          Send a secure password reset link to your account email.
        </p>
        <button
          onClick={sendResetEmail}
          disabled={loading || !user?.email}
          className="px-4 py-2 bg-black text-white text-sm font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800 disabled:opacity-50"
        >
          Send reset email
        </button>
      </section>
    </>
  );
}
