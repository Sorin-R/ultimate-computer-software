import SEOHead from "../../components/SEOHead";

export default function PrivacyPolicyPage() {
  return (
    <>
      <SEOHead
        title="Privacy Policy"
        description="Learn how we collect, use, and protect your personal data at Ultimate Computer Software."
        path="/privacy-policy"
      />

      <main className="bg-[#f6f6f4] text-[#111111]">
        <section className="bg-white border-b border-black/15">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
            <h1 className="text-4xl sm:text-5xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
              Privacy Policy
            </h1>
            <p className="text-sm text-neutral-600">
              Last Updated: May 6, 2026 | Effective Date: May 6, 2026
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            {/* Introduction */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Introduction
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                Ultimate Computer Software ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website at www.ultimatecomputersoftware.com (the "Site").
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Please read this Privacy Policy carefully. If you do not agree with our policies and practices, please do not use our Site. By accessing and using our Site, you acknowledge that you have read, understood, and agree to be bound by all the provisions of this Privacy Policy.
              </p>
            </div>

            {/* Information We Collect */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Information We Collect
              </h2>
              <h3 className="text-lg font-semibold mb-3">Personal Information You Provide</h3>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mb-4">
                <li>Email address</li>
                <li>Full name</li>
                <li>Account credentials (passwords - hashed and encrypted)</li>
                <li>Author name and bio (for article submissions)</li>
                <li>Contact information from data request forms</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">Information Collected Automatically</h3>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mb-4">
                <li>IP address</li>
                <li>Browser type and version</li>
                <li>Device type and operating system</li>
                <li>Pages visited and time spent on pages</li>
                <li>Referral source</li>
                <li>Cookie data</li>
                <li>Analytics data via Google Analytics</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">Information from Articles & Content</h3>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li>Article titles and content (submitted by users)</li>
                <li>Article metadata (category, tags, keywords)</li>
                <li>Featured images</li>
                <li>Source URLs provided by authors</li>
              </ul>
            </div>

            {/* How We Use Your Information */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                How We Use Your Information
              </h2>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li>Account creation and authentication</li>
                <li>Processing and publishing article submissions</li>
                <li>Sending transactional emails (password resets, submissions)</li>
                <li>Providing customer support</li>
                <li>Website analytics and performance improvement</li>
                <li>Preventing fraud and ensuring security</li>
                <li>Complying with legal obligations</li>
                <li>Conducting research and product development</li>
              </ul>
            </div>

            {/* Cookies and Tracking */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Cookies and Tracking Technologies
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                We use cookies and similar tracking technologies to track activity on our Site and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Types of cookies we use:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mt-2">
                <li><span className="font-semibold">Session Cookies:</span> Temporary cookies that expire when you close your browser</li>
                <li><span className="font-semibold">Authentication Cookies:</span> Used to keep you logged in</li>
                <li><span className="font-semibold">Analytics Cookies:</span> Google Analytics tracking (anonymized data)</li>
                <li><span className="font-semibold">Advertising Cookies:</span> Google AdSense for personalized ads</li>
                <li><span className="font-semibold">Preference Cookies:</span> Remember your settings and preferences</li>
              </ul>
            </div>

            {/* Third-Party Services */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Third-Party Services
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                We use the following third-party services that may collect information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li><span className="font-semibold">Google Analytics:</span> Tracks website analytics and user behavior (anonymized)</li>
                <li><span className="font-semibold">Google AdSense:</span> Displays personalized advertisements</li>
                <li><span className="font-semibold">Database Provider:</span> Stores user data and articles</li>
              </ul>
              <p className="text-neutral-700 leading-relaxed mt-3">
                These third parties have their own privacy policies. We encourage you to review their privacy policies before providing your information.
              </p>
            </div>

            {/* Your Privacy Rights */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Your Privacy Rights
              </h2>

              <h3 className="text-lg font-semibold mb-3">For GDPR (EU/EEA Residents)</h3>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mb-4">
                <li><span className="font-semibold">Right to Access:</span> Request a copy of your personal data</li>
                <li><span className="font-semibold">Right to Rectification:</span> Correct inaccurate data</li>
                <li><span className="font-semibold">Right to Erasure:</span> Delete your personal data (right to be forgotten)</li>
                <li><span className="font-semibold">Right to Restrict Processing:</span> Limit how we use your data</li>
                <li><span className="font-semibold">Right to Data Portability:</span> Download your data in a portable format</li>
                <li><span className="font-semibold">Right to Object:</span> Opt-out of processing for certain purposes</li>
                <li><span className="font-semibold">Right to Lodge a Complaint:</span> Contact your local data protection authority</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">For CCPA (California Residents)</h3>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mb-4">
                <li><span className="font-semibold">Right to Know:</span> Request what personal information we collect</li>
                <li><span className="font-semibold">Right to Delete:</span> Request deletion of personal information</li>
                <li><span className="font-semibold">Right to Opt-Out:</span> Opt-out of data sales (we do not sell data)</li>
                <li><span className="font-semibold">Right to Non-Discrimination:</span> No discrimination for exercising CCPA rights</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">For LGPD (Brazil), PIPEDA (Canada), POPIA (South Africa), PDPA (Singapore)</h3>
              <p className="text-neutral-700 leading-relaxed">
                You have similar rights under these regulations, including access, correction, deletion, and portability of your personal data. Contact us using the information below to exercise these rights.
              </p>
            </div>

            {/* Data Security */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Data Security & Protection
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                We implement comprehensive security measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li>SSL/TLS encryption for data in transit</li>
                <li>Bcrypt/Argon2 password hashing</li>
                <li>Secure database access controls</li>
                <li>Regular security updates and patches</li>
                <li>Limited access to sensitive data (admin only)</li>
              </ul>
              <p className="text-neutral-700 leading-relaxed mt-3">
                While we use industry-standard security measures, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security of your information.
              </p>
            </div>

            {/* Data Retention */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Data Retention
              </h2>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li><span className="font-semibold">User Accounts:</span> Retained until account deletion requested</li>
                <li><span className="font-semibold">Published Articles:</span> Retained indefinitely (public content)</li>
                <li><span className="font-semibold">Draft/Submitted Articles:</span> Retained for 2 years after submission</li>
                <li><span className="font-semibold">Analytics Data:</span> Retained for 26 months (Google Analytics default)</li>
                <li><span className="font-semibold">Log Files:</span> Retained for 90 days for security purposes</li>
                <li><span className="font-semibold">Data Request Records:</span> Retained for 7 years (legal compliance)</li>
              </ul>
            </div>

            {/* Children's Privacy */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Children's Privacy
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                Our Site is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we learn we have collected personal information from a child under 13, we will delete such information immediately. If you believe we have collected information from a child under 13, please contact us immediately.
              </p>
            </div>

            {/* International Data Transfers */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                International Data Transfers
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                Your information may be transferred to, stored in, and processed in countries other than your country of residence. These countries may have data protection laws that differ from your home country. When we transfer information internationally, we implement appropriate safeguards including Standard Contractual Clauses and Privacy Shield mechanisms where applicable.
              </p>
            </div>

            {/* Changes to Policy */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Changes to This Privacy Policy
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes by updating the "Last Updated" date at the top of this policy. Your continued use of the Site following the posting of revised Privacy Policy means that you accept and agree to the changes.
              </p>
            </div>

            {/* Contact Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Contact Us
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                If you have questions about this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <div className="space-y-2 text-neutral-700">
                <p>
                  <span className="font-semibold">Email:</span>{" "}
                  <a href="mailto:privacy@ultimatecomputersoftware.com" className="text-[#b5121b] hover:underline">
                    privacy@ultimatecomputersoftware.com
                  </a>
                </p>
                <p>
                  <span className="font-semibold">Website:</span>{" "}
                  <a href="https://www.ultimatecomputersoftware.com" className="text-[#b5121b] hover:underline">
                    https://www.ultimatecomputersoftware.com
                  </a>
                </p>
              </div>
              <p className="text-neutral-700 leading-relaxed mt-4">
                We will respond to any requests or concerns within 30 days (or as required by applicable law).
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
