import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const res = await api.post("/auth/password-reset/request", { email });
      setMessage(res.data?.message || "If that email exists, a reset link has been sent.");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to request reset link");
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/password-reset/confirm", { token, password });
      setMessage("Password has been reset. You can now log in with your new password.");
      setPassword("");
      setConfirm("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead title="Reset Password" path="/reset-password" noindex />
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-black/15 p-8">
          <h1 className="text-3xl font-bold text-center [font-family:Georgia,'Times_New_Roman',serif] mb-6">
            {token ? "Set a New Password" : "Reset Password"}
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-sm">
              {message}
            </div>
          )}

          {token ? (
            <form onSubmit={confirmReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-semibold uppercase tracking-[0.08em] text-sm"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          ) : (
            <form onSubmit={requestReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
                  Account email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-semibold uppercase tracking-[0.08em] text-sm"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-neutral-600">
            <Link to="/login" className="text-[#b5121b] hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
