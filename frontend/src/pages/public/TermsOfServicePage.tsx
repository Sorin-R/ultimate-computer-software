import SEOHead from "../../components/SEOHead";

export default function TermsOfServicePage() {
  return (
    <>
      <SEOHead
        title="Terms of Service"
        description="Read our terms of service and conditions for using Ultimate Computer Software."
        path="/terms-of-service"
      />

      <main className="bg-[#f6f6f4] text-[#111111]">
        <section className="bg-white border-b border-black/15">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
            <h1 className="text-4xl sm:text-5xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
              Terms of Service
            </h1>
            <p className="text-sm text-neutral-600">
              Last Updated: May 6, 2026 | Effective Date: May 6, 2026
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            {/* Agreement */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                User Agreement
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                These Terms of Service ("Terms") constitute a binding agreement between you ("User") and Ultimate Computer Software ("Company", "we", "us", or "our"). By accessing and using our website at www.ultimatecomputersoftware.com (the "Site"), you agree to comply with these Terms.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                If you do not agree to these Terms, you are prohibited from using or accessing this Site. We reserve the right to modify these Terms at any time. Your continued use of the Site following the posting of revised Terms means you accept and agree to the changes.
              </p>
            </div>

            {/* Age Restriction */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Age Restriction
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                You must be at least 13 years old to use this Site. If you are under 13, do not create an account or submit content. We do not knowingly allow persons under 13 to use our services. If we discover that someone under 13 has created an account, we will delete that account immediately.
              </p>
            </div>

            {/* User Responsibilities */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                User Responsibilities
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                As a registered user, you agree to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li>Provide accurate and truthful information when creating your account</li>
                <li>Maintain the confidentiality of your login credentials</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
                <li>Comply with all applicable laws and regulations</li>
                <li>Not engage in any unlawful or harmful activities</li>
              </ul>
            </div>

            {/* Content Guidelines */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Content Guidelines
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                <span className="font-semibold text-[#b5121b]">IMPORTANT:</span> All articles submitted to Ultimate Computer Software must adhere to the following guidelines:
              </p>

              <h3 className="text-lg font-semibold mb-3 text-[#b5121b]">✅ Acceptable Content</h3>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mb-4">
                <li>Technology news, innovations, and developments</li>
                <li>AI, robotics, cybersecurity, cloud computing topics</li>
                <li>Software development and programming</li>
                <li>Consumer electronics and gadgets</li>
                <li>Space technology and exploration</li>
                <li>Biotechnology and medical technology</li>
                <li>Green technology and renewable energy</li>
                <li>Original research and analysis</li>
                <li>Technology opinion pieces on tech-related topics</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3 text-red-600">❌ Prohibited Content</h3>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mb-4">
                <li><span className="font-semibold">Political Content:</span> No articles about politics, politicians, political parties, or political opinions</li>
                <li><span className="font-semibold">Inappropriate Content:</span> No offensive language, hate speech, violence, adult content, or discriminatory material</li>
                <li><span className="font-semibold">Misinformation:</span> No false, misleading, or unverified claims</li>
                <li><span className="font-semibold">Spam:</span> No promotional spam or low-quality filler content</li>
                <li><span className="font-semibold">Copyright Infringement:</span> No copied text or plagiarized content</li>
                <li><span className="font-semibold">Illegal Content:</span> No content that violates any laws or regulations</li>
              </ul>

              <p className="text-neutral-700 leading-relaxed">
                Articles not adhering to these guidelines will be rejected. Repeated violations may result in account suspension or permanent ban.
              </p>
            </div>

            {/* Intellectual Property Rights */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Intellectual Property Rights
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                The Site and its content (excluding user-submitted articles) are owned or controlled by Ultimate Computer Software and are protected by international copyright, trademark, and other intellectual property laws. All rights are reserved.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Users retain ownership of articles they submit. By submitting content to our Site, you grant Ultimate Computer Software a non-exclusive, royalty-free, worldwide license to use, reproduce, and distribute your content on our platform.
              </p>
            </div>

            {/* No Copyright Infringement */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                No Copyright Infringement
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                <span className="font-semibold text-[#b5121b]">MANDATORY:</span> When you submit an article to Ultimate Computer Software:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mb-4">
                <li>You guarantee that the article is original work or properly licensed</li>
                <li>You guarantee that you have permission to use all images, photos, and media</li>
                <li>You will not submit content that violates anyone's intellectual property rights</li>
                <li>You will cite sources and provide proper attribution for borrowed content</li>
              </ul>
              <p className="text-neutral-700 leading-relaxed">
                Any article found to infringe copyright or intellectual property rights will be removed immediately, and the author's account may be suspended or terminated.
              </p>
            </div>

            {/* Mandatory Backlink Requirement */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4 text-red-900">
                🔗 Mandatory Link Requirement
              </h2>
              <p className="text-red-900 leading-relaxed mb-3 font-semibold">
                CRITICAL: This is a MANDATORY requirement for all article submissions.
              </p>
              <p className="text-neutral-700 leading-relaxed mb-3">
                A backlink from your website to <code className="bg-gray-100 px-2 py-1 rounded text-sm">https://www.ultimatecomputersoftware.com/your-article</code> is a mandatory requirement before submitting your article to Ultimate Computer Software.
              </p>
              <p className="text-neutral-700 leading-relaxed mb-3">
                <span className="font-semibold">What this means:</span> You must include a link back to the corresponding article page on our website. This ensures fair distribution of traffic and maintains the integrity of our content network.
              </p>
              <p className="text-red-900 leading-relaxed font-semibold">
                ⚠️ Articles submitted without a reciprocal backlink to Ultimate Computer Software will be REJECTED. No exceptions.
              </p>
            </div>

            {/* Limitation of Liability */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Limitation of Liability
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                To the fullest extent permitted by law, Ultimate Computer Software shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including lost profits or loss of data, even if we have been advised of the possibility of such damages.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Our total liability to you for any claim arising from or related to these Terms shall not exceed the amount paid by you, if any, to use the Site.
              </p>
            </div>

            {/* Termination */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Termination of Account
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                We may, at our sole discretion, suspend or terminate your account and access to the Site if:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li>You violate these Terms of Service</li>
                <li>You violate our Content Guidelines</li>
                <li>You infringe intellectual property rights</li>
                <li>You engage in unlawful or harmful behavior</li>
                <li>You submit content that violates our policies</li>
              </ul>
              <p className="text-neutral-700 leading-relaxed mt-3">
                Upon termination, your right to use the Site immediately ceases.
              </p>
            </div>

            {/* Third-Party Links */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Third-Party Links
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                Our Site may contain links to third-party websites. We are not responsible for the content, accuracy, or practices of these external sites. Your use of third-party websites is governed by their own terms and policies. We encourage you to review their privacy policies and terms before providing any information.
              </p>
            </div>

            {/* Dispute Resolution */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Dispute Resolution
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                If you have a dispute with Ultimate Computer Software, you agree to attempt to resolve it through good-faith negotiation. If negotiations fail, disputes will be governed by the laws applicable to our jurisdiction.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                You agree to the non-exclusive jurisdiction of the courts in our operating jurisdiction for any legal action or proceeding.
              </p>
            </div>

            {/* Severability */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Severability
              </h2>
              <p className="text-neutral-700 leading-relaxed">
                If any provision of these Terms is found to be invalid or unenforceable, that provision shall be modified to the minimum extent necessary to make it valid and enforceable, and the remaining provisions shall continue in full effect.
              </p>
            </div>

            {/* Contact Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Contact Us
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                If you have questions about these Terms of Service, please contact us at:
              </p>
              <div className="space-y-2 text-neutral-700">
                <p>
                  <span className="font-semibold">Email:</span>{" "}
                  <a href="mailto:support@ultimatecomputersoftware.com" className="text-[#b5121b] hover:underline">
                    support@ultimatecomputersoftware.com
                  </a>
                </p>
                <p>
                  <span className="font-semibold">Website:</span>{" "}
                  <a href="https://www.ultimatecomputersoftware.com" className="text-[#b5121b] hover:underline">
                    https://www.ultimatecomputersoftware.com
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
