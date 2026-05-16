import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import TurnstileWidget from "../../components/TurnstileWidget";

interface ContactFormData {
  inquiryType: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function ContactPage() {
  const turnstileEnabled = Boolean(
    (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim()
  );
  const [formData, setFormData] = useState<ContactFormData>({
    inquiryType: "general",
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const inquiryTypes = [
    { value: "general", label: "General Inquiry" },
    { value: "privacy", label: "Privacy Concern" },
    { value: "support", label: "Technical Support" },
    { value: "copyright", label: "Copyright Issue" },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validation
    if (!formData.name.trim()) {
      setError("Name is required");
      setLoading(false);
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      setLoading(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setError("Invalid email format");
      setLoading(false);
      return;
    }

    if (!formData.subject.trim()) {
      setError("Subject is required");
      setLoading(false);
      return;
    }

    if (!formData.message.trim()) {
      setError("Message is required");
      setLoading(false);
      return;
    }

    if (turnstileEnabled && !captchaToken) {
      setError("Please complete the captcha challenge");
      setLoading(false);
      return;
    }

    try {
      await api.post("/contact/inquiry", {
        ...formData,
        captchaToken,
      });
      setSuccess(true);
      setFormData({
        inquiryType: "general",
        name: "",
        email: "",
        subject: "",
        message: "",
      });
      setCaptchaToken(null);

      // Hide success message after 5 seconds
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to submit inquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        title="Contact Us"
        description="Get in touch with Ultimate Computer Software. Submit inquiries about privacy, support, copyright, or general questions."
        path="/contact"
      />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4 text-center">
          Contact Us
        </h1>
        <p className="text-center text-neutral-600 mb-12 max-w-2xl mx-auto">
          Have a question or concern? We'd love to hear from you. Fill out the form below and we'll get back to you as soon as possible.
        </p>

        <div className="bg-white border border-black/15 p-8 md:p-10">
          {success && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded">
              <p className="text-emerald-700 font-semibold">✓ Message sent successfully!</p>
              <p className="text-emerald-600 text-sm mt-1">We've received your inquiry and will respond within 24-48 hours.</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-700 font-semibold">✗ Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Inquiry Type */}
            <div>
              <label htmlFor="inquiryType" className="block text-sm font-semibold text-neutral-900 mb-2">
                Inquiry Type <span className="text-red-600">*</span>
              </label>
              <select
                id="inquiryType"
                name="inquiryType"
                value={formData.inquiryType}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 focus:outline-none focus:border-black/50"
              >
                {inquiryTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-neutral-900 mb-2">
                Your Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-black/50"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-neutral-900 mb-2">
                Email Address <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your.email@example.com"
                className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-black/50"
              />
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="subject" className="block text-sm font-semibold text-neutral-900 mb-2">
                Subject <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                value={formData.subject}
                onChange={handleChange}
                placeholder="What is your inquiry about?"
                className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-black/50"
              />
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-semibold text-neutral-900 mb-2">
                Message <span className="text-red-600">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Please provide details about your inquiry..."
                rows={6}
                className="w-full px-4 py-2.5 border border-black/25 bg-white text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-black/50 resize-none"
              />
            </div>

            {/* Submit Button */}
            <TurnstileWidget onTokenChange={setCaptchaToken} className="flex justify-center" />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-3 font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Sending..." : "Send Message"}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-8 pt-8 border-t border-black/10">
            <p className="text-sm text-neutral-600 mb-4">
              <strong>Expected response time:</strong> We'll respond to your inquiry within 24-48 business hours.
            </p>
            <p className="text-sm text-neutral-600">
              <strong>Direct emails:</strong>
            </p>
            <ul className="text-sm text-neutral-600 mt-2 space-y-1 ml-4">
              <li>• Privacy concerns: privacy@ultimatecomputersoftware.com</li>
              <li>• Technical support: support@ultimatecomputersoftware.com</li>
              <li>• Copyright issues: copyright@ultimatecomputersoftware.com</li>
              <li>• General inquiries: support@ultimatecomputersoftware.com</li>
            </ul>
          </div>
        </div>

        {/* Legal Links */}
        <div className="text-center mt-12">
          <p className="text-sm text-neutral-600 mb-4">
            Need something specific? Check our policies and forms:
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/privacy-policy" className="text-sm text-[#b5121b] hover:text-[#8f0f16] underline">
              Privacy Policy
            </Link>
            <Link to="/data-request" className="text-sm text-[#b5121b] hover:text-[#8f0f16] underline">
              Data Request
            </Link>
            <Link to="/terms-of-service" className="text-sm text-[#b5121b] hover:text-[#8f0f16] underline">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
