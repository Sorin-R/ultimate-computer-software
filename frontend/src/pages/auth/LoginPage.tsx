import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import SEOHead from "../../components/SEOHead";
import api from "../../api/client";

export default function LoginPage() {
  const { login, verifyTwoFactorLogin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verificationPreviewUrl, setVerificationPreviewUrl] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setVerificationPreviewUrl("");
    setNeedsVerification(false);
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.requiresTwoFactor) {
        setTwoFactorToken(result.twoFactorToken || null);
        setTwoFactorCode("");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      const responseCode = err.response?.data?.code;
      if (responseCode === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
      }
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorToken) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await verifyTwoFactorLogin(twoFactorToken, twoFactorCode);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid two-factor code");
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!email.trim()) {
      setError("Enter your account email first.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await api.post("/auth/resend-verification", { email });
      setMessage(res.data?.message || "Verification email sent if the account exists.");
      setVerificationPreviewUrl(res.data?.verificationPreviewUrl || "");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to resend verification email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead title="Login" path="/login" noindex />
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-black/15 p-8">
          <h1 className="text-4xl font-bold text-center [font-family:Georgia,'Times_New_Roman',serif] mb-8">
            {twoFactorToken ? "Two-Factor Verification" : "Sign In"}
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-sm">
              <p>{message}</p>
              {verificationPreviewUrl && (
                <p className="mt-2 break-all">
                  Dev verification link:{" "}
                  <a href={verificationPreviewUrl} className="font-semibold underline">
                    {verificationPreviewUrl}
                  </a>
                </p>
              )}
            </div>
          )}

          {twoFactorToken ? (
            <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
                  Authentication code
                </label>
                <input
                  type="text"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                  placeholder="6-digit code or recovery code"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !twoFactorCode.trim()}
                className="w-full py-2.5 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-semibold uppercase tracking-[0.08em] text-sm"
              >
                {loading ? "Verifying..." : "Verify"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTwoFactorToken(null);
                  setTwoFactorCode("");
                  setPassword("");
                }}
                className="w-full py-2.5 border border-black/25 text-neutral-700 hover:bg-neutral-50 font-semibold uppercase tracking-[0.08em] text-sm"
              >
                Back
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
              </div>
              <div className="text-right">
                <Link to="/reset-password" className="text-xs text-[#b5121b] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-semibold uppercase tracking-[0.08em] text-sm"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              {needsVerification && (
                <button
                  type="button"
                  onClick={resendVerification}
                  disabled={loading}
                  className="w-full py-2.5 border border-black/25 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 font-semibold uppercase tracking-[0.08em] text-sm"
                >
                  Resend Verification Email
                </button>
              )}
            </form>
          )}

          {!twoFactorToken && (
            <p className="mt-6 text-center text-sm text-neutral-600">
              Don't have an account?{" "}
              <Link to="/register" className="text-[#b5121b] hover:underline">
                Create one
              </Link>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
