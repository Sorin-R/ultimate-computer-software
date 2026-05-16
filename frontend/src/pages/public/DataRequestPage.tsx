import { useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import { useAuth } from "../../context/AuthContext";
import TurnstileWidget from "../../components/TurnstileWidget";

export default function DataRequestPage() {
  const { user } = useAuth();
  const turnstileEnabled = Boolean(
    (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim()
  );
  const [requestType, setRequestType] = useState("access");
  const [email, setEmail] = useState(user?.email || "");
  const [fullName, setFullName] = useState(user?.name || "");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [confirmationId, setConfirmationId] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !fullName.trim()) {
      setError("Email and full name are required");
      return;
    }

    if (turnstileEnabled && !captchaToken) {
      setError("Please complete the captcha challenge");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/contact/data-request", {
        requestType,
        email: email.trim(),
        fullName: fullName.trim(),
        details: details.trim(),
        captchaToken,
      });

      setConfirmationId(response.data.confirmationId || "");
      setSubmitted(true);
      setEmail("");
      setFullName("");
      setDetails("");
      setRequestType("access");
      setCaptchaToken(null);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <>
        <SEOHead
          title="Data Request Submitted"
          description="Your data request has been submitted successfully."
          path="/data-request"
        />

        <main className="bg-[#f6f6f4] text-[#111111]">
          <section className="bg-white">
            <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
              <div className="text-center">
                <div className="mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full">
                    <svg className="w-8 h-8 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>

                <h1 className="text-3xl sm:text-4xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                  Request Submitted Successfully
                </h1>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 mb-6">
                  <p className="text-neutral-700 leading-relaxed mb-3">
                    Thank you for submitting your data request. We have received your submission and will process it within 30 days.
                  </p>

                  {confirmationId && (
                    <div className="bg-white p-4 rounded border border-emerald-200 mb-3">
                      <p className="text-sm text-neutral-600 mb-1">
                        <span className="font-semibold">Confirmation ID:</span>
                      </p>
                      <p className="text-lg font-mono font-semibold text-neutral-900">{confirmationId}</p>
                      <p className="text-xs text-neutral-500 mt-2">
                        Keep this ID for your records. You may need it for follow-up inquiries.
                      </p>
                    </div>
                  )}

                  <p className="text-sm text-neutral-700">
                    We will process your request in accordance with applicable privacy laws (GDPR, CCPA, LGPD, and others). You will receive an email at <span className="font-semibold">{email}</span> with instructions or your requested data.
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-neutral-600">
                    <span className="font-semibold">Request Type:</span> {requestType === "access" && "Access My Data"}
                    {requestType === "download" && "Download My Data"}
                    {requestType === "delete" && "Delete My Account"}
                    {requestType === "portability" && "Data Portability"}
                    {requestType === "optout" && "Opt-Out of Marketing"}
                  </p>
                </div>

                <div className="mt-8 pt-8 border-t border-black/15">
                  <a
                    href="/"
                    className="inline-flex px-6 py-3 bg-[#b5121b] text-white font-semibold rounded hover:bg-[#8f0f16] transition-colors"
                  >
                    Return to Home
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <SEOHead
        title="Data Request"
        description="Submit a request to access, download, or delete your personal data in compliance with GDPR and privacy laws."
        path="/data-request"
      />

      <main className="bg-[#f6f6f4] text-[#111111]">
        <section className="bg-white border-b border-black/15">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
            <h1 className="text-4xl sm:text-5xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
              Data Request Form
            </h1>
            <p className="text-neutral-600">
              Submit a request to access, download, delete, or export your personal data
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            {/* Information Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-3">ℹ️ About Data Requests</h2>
              <p className="text-blue-800 text-sm leading-relaxed mb-3">
                Under international privacy laws (GDPR, CCPA, LGPD, PIPEDA, POPIA, and PDPA), you have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-blue-800 text-sm">
                <li><span className="font-semibold">Access Your Data:</span> Request a copy of your personal information</li>
                <li><span className="font-semibold">Download Your Data:</span> Receive your data in a portable format</li>
                <li><span className="font-semibold">Delete Your Account:</span> Request permanent deletion of your account (right to be forgotten)</li>
                <li><span className="font-semibold">Data Portability:</span> Transfer your data to another service</li>
                <li><span className="font-semibold">Opt-Out:</span> Stop receiving marketing communications</li>
              </ul>
              <p className="text-blue-800 text-sm mt-3">
                We will process your request within <span className="font-semibold">30 days</span> (or as required by applicable law).
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Request Type */}
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Request Type *
                </label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full px-4 py-3 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                  required
                >
                  <option value="access">Access My Data</option>
                  <option value="download">Download My Data (Portable Format)</option>
                  <option value="delete">Delete My Account & Data (Right to be Forgotten)</option>
                  <option value="portability">Data Portability</option>
                  <option value="optout">Opt-Out of Marketing</option>
                </select>
                <p className="text-xs text-neutral-500 mt-1">
                  Select the type of request you want to submit
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-3 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                  required
                />
                <p className="text-xs text-neutral-500 mt-1">
                  We will send the response to this email address
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full px-4 py-3 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                  required
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Must match the name on your account
                </p>
              </div>

              {/* Details */}
              <div>
                <label className="block text-sm font-semibold text-neutral-900 mb-2">
                  Additional Details (Optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide any additional information about your request..."
                  rows={5}
                  className="w-full px-4 py-3 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b] resize-none"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  For example, specify which data you're interested in, or provide context for your request
                </p>
              </div>

              {/* Terms Checkbox */}
              <div className="bg-neutral-50 border border-black/15 rounded-lg p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    required
                    className="mt-1 w-5 h-5 text-[#b5121b] rounded border-black/25 focus:ring-2 focus:ring-[#b5121b]"
                  />
                  <span className="text-sm text-neutral-700">
                    I confirm that I am the owner of this email address and account, and I understand that this request will be processed according to applicable privacy laws
                  </span>
                </label>
              </div>

              <TurnstileWidget onTokenChange={setCaptchaToken} className="flex justify-center" />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-[#b5121b] text-white font-semibold rounded-lg hover:bg-[#8f0f16] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Submitting..." : "Submit Data Request"}
              </button>
            </form>

            {/* Footer Info */}
            <div className="border-t border-black/15 pt-8">
              <h3 className="font-semibold text-neutral-900 mb-3">Privacy & Security</h3>
              <p className="text-sm text-neutral-700 leading-relaxed mb-3">
                Your data request is processed securely and in compliance with international privacy regulations including GDPR, CCPA, LGPD, PIPEDA, POPIA, and PDPA.
              </p>
              <p className="text-sm text-neutral-700 leading-relaxed">
                For questions about your data request, contact us at{" "}
                <a href="mailto:privacy@ultimatecomputersoftware.com" className="text-[#b5121b] hover:underline">
                  privacy@ultimatecomputersoftware.com
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
