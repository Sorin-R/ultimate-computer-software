import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => (searchParams.get("token") || "").trim(), [searchParams]);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [verificationPreviewUrl, setVerificationPreviewUrl] = useState("");
  const showResendForm = !token || Boolean(error);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError("");
      setMessage("");
      setVerificationPreviewUrl("");
      try {
        const res = await api.post("/auth/verify-email", { token });
        if (!cancelled) {
          setMessage(res.data?.message || "Email verified successfully. You can now sign in.");
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.error || "Failed to verify email.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setVerificationPreviewUrl("");
    setLoading(true);

    try {
      const res = await api.post("/auth/resend-verification", { email });
      setMessage(res.data?.message || "Verification email sent if the account exists.");
      setVerificationPreviewUrl(res.data?.verificationPreviewUrl || "");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to resend verification email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead title="Verify Email" path="/verify-email" noindex />
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-black/15 p-8">
          <h1 className="text-3xl font-bold text-center [font-family:Georgia,'Times_New_Roman',serif] mb-6">
            Verify Email
          </h1>

          {loading && (
            <div className="mb-4 p-3 bg-neutral-50 border border-neutral-200 text-neutral-700 rounded text-sm">
              Processing...
            </div>
          )}

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
                  Dev verification link: {" "}
                  <a href={verificationPreviewUrl} className="font-semibold underline">
                    {verificationPreviewUrl}
                  </a>
                </p>
              )}
            </div>
          )}

          {showResendForm && (
            <form onSubmit={resend} className="space-y-4">
              <p className="text-sm text-neutral-600">
                Enter your account email to receive a new verification link.
              </p>
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
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-semibold uppercase tracking-[0.08em] text-sm"
              >
                {loading ? "Sending..." : "Send Verification Email"}
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
