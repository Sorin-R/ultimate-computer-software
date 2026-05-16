import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import SEOHead from "../../components/SEOHead";
import api from "../../api/client";

export default function RegisterPage() {
  const { register } = useAuth();
  const [searchParams] = useSearchParams();

  const referral = (searchParams.get("ref") || "").trim();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [verificationPreviewUrl, setVerificationPreviewUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setErrors([]);
    setMessage("");
    setVerificationPreviewUrl("");
    setLoading(true);
    try {
      const result = await register(name, email, password, referral || undefined);
      setMessage(result.message);
      setVerificationPreviewUrl(result.verificationPreviewUrl || "");
      setPassword("");
    } catch (err: any) {
      if (err.response?.data?.details) {
        setErrors(err.response.data.details);
      }
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const resendVerification = async () => {
    if (!email.trim()) {
      setError("Enter your email first, then click resend.");
      return;
    }
    setError("");
    setErrors([]);
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
      <SEOHead title="Register" path="/register" noindex />
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md bg-white border border-black/15 p-8">
          <h1 className="text-4xl font-bold text-center [font-family:Georgia,'Times_New_Roman',serif] mb-8">
            Create Account
          </h1>

          {referral && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-sm">
              Referral applied: <strong>{referral}</strong>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              {error}
              {errors.length > 0 && (
                <ul className="mt-2 list-disc pl-4">
                  {errors.map((entry, index) => (
                    <li key={index}>
                      {entry.field}: {entry.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {message && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-sm">
              <p>{message}</p>
              <p className="mt-2">
                <Link to="/login" className="font-semibold hover:underline">
                  Go to login
                </Link>
              </p>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
              />
            </div>
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
                minLength={8}
                className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Minimum 8 characters, with uppercase, lowercase, and a number
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-semibold uppercase tracking-[0.08em] text-sm"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
            <button
              type="button"
              onClick={resendVerification}
              disabled={loading}
              className="w-full py-2.5 border border-black/20 text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 font-semibold uppercase tracking-[0.08em] text-sm"
            >
              Resend Verification Email
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-600">
            Already have an account?{" "}
            <Link to="/login" className="text-[#b5121b] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
