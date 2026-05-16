import SEOHead from "../../components/SEOHead";

export default function CookiesPolicyPage() {
  return (
    <>
      <SEOHead
        title="Cookies Policy"
        description="Learn about the cookies we use on Ultimate Computer Software and how to manage them."
        path="/cookies-policy"
      />

      <main className="bg-[#f6f6f4] text-[#111111]">
        <section className="bg-white border-b border-black/15">
          <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
            <h1 className="text-4xl sm:text-5xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
              Cookies Policy
            </h1>
            <p className="text-sm text-neutral-600">
              Last Updated: May 6, 2026 | Effective Date: May 6, 2026
            </p>
          </div>
        </section>

        <section className="bg-white">
          <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
            {/* What Are Cookies */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                What Are Cookies?
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                Cookies are small text files that are stored on your device (computer, tablet, or mobile phone) when you visit a website. They contain information about your browsing activity and preferences and are sent back to the website each time you visit.
              </p>
              <p className="text-neutral-700 leading-relaxed">
                Cookies allow websites to recognize you, remember your preferences, and provide a better user experience. They are not harmful and do not contain viruses or malware.
              </p>
            </div>

            {/* Types of Cookies */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Types of Cookies We Use
              </h2>

              <div className="space-y-4">
                <div className="border-l-4 border-[#b5121b] pl-4">
                  <h3 className="text-lg font-semibold mb-2">1. Essential / Session Cookies</h3>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Purpose:</span> Required for the website to function properly
                  </p>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Examples:</span> Authentication cookies, login sessions, CSRF protection
                  </p>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Duration:</span> Session (expires when you close browser)
                  </p>
                  <p className="text-neutral-700">
                    <span className="font-semibold">Can be disabled:</span> No (site will not function properly)
                  </p>
                </div>

                <div className="border-l-4 border-blue-500 pl-4">
                  <h3 className="text-lg font-semibold mb-2">2. Analytics Cookies</h3>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Purpose:</span> Track website usage and performance
                  </p>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Provider:</span> Google Analytics
                  </p>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Information Tracked:</span> Pages visited, time spent, referral source, device type
                  </p>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Duration:</span> Up to 26 months
                  </p>
                  <p className="text-neutral-700">
                    <span className="font-semibold">Can be disabled:</span> Yes, via cookie consent banner
                  </p>
                </div>

                <div className="border-l-4 border-green-500 pl-4">
                  <h3 className="text-lg font-semibold mb-2">3. Advertising / Marketing Cookies</h3>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Purpose:</span> Display personalized advertisements
                  </p>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Provider:</span> Google AdSense
                  </p>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Information Tracked:</span> Ad preferences, browsing behavior, interests
                  </p>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Duration:</span> Up to 2 years
                  </p>
                  <p className="text-neutral-700">
                    <span className="font-semibold">Can be disabled:</span> Yes, via cookie consent banner
                  </p>
                </div>

                <div className="border-l-4 border-purple-500 pl-4">
                  <h3 className="text-lg font-semibold mb-2">4. Preference Cookies</h3>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Purpose:</span> Remember your settings and preferences
                  </p>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Examples:</span> Cookie consent preferences, theme settings
                  </p>
                  <p className="text-neutral-700 mb-2">
                    <span className="font-semibold">Duration:</span> Up to 1 year
                  </p>
                  <p className="text-neutral-700">
                    <span className="font-semibold">Can be disabled:</span> Yes, but may affect functionality
                  </p>
                </div>
              </div>
            </div>

            {/* Cookie Duration */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Cookie Duration
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                Cookies fall into two categories based on duration:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li><span className="font-semibold">Session Cookies:</span> Temporary cookies that expire when you close your browser</li>
                <li><span className="font-semibold">Persistent Cookies:</span> Cookies that remain on your device for a specified period (days, months, or years)</li>
              </ul>
              <p className="text-neutral-700 leading-relaxed mt-3">
                You can view, manage, and delete cookies through your browser settings. When you delete cookies, any preferences or login information will also be deleted.
              </p>
            </div>

            {/* Third-Party Cookies */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Third-Party Cookies
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                In addition to our own cookies, we allow third-party services to place cookies on your device:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mb-3">
                <li><span className="font-semibold">Google Analytics:</span> Analyzes website traffic and user behavior</li>
                <li><span className="font-semibold">Google AdSense:</span> Displays targeted advertisements</li>
              </ul>
              <p className="text-neutral-700 leading-relaxed">
                These third parties have their own privacy policies and cookie practices. We recommend reviewing their policies on their respective websites.
              </p>
            </div>

            {/* Cookie Consent */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Cookie Consent
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                When you first visit our Site, a cookie consent banner appears. You can:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mb-3">
                <li><span className="font-semibold">Accept All:</span> Accept all cookies including analytics and advertising cookies</li>
                <li><span className="font-semibold">Reject:</span> Reject all non-essential cookies (only essential cookies will be used)</li>
                <li><span className="font-semibold">Settings:</span> Choose which types of cookies to allow</li>
              </ul>
              <p className="text-neutral-700 leading-relaxed">
                Your preference is saved and respected. You can change your cookie settings at any time by dismissing the banner or through your browser settings.
              </p>
            </div>

            {/* User Opt-Out Options */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                How to Opt-Out of Cookies
              </h2>

              <h3 className="text-lg font-semibold mb-3">Option 1: Cookie Consent Banner</h3>
              <p className="text-neutral-700 leading-relaxed mb-4">
                Click the "Settings" button on the cookie consent banner at the bottom of our website to manage your cookie preferences.
              </p>

              <h3 className="text-lg font-semibold mb-3">Option 2: Browser Settings</h3>
              <p className="text-neutral-700 leading-relaxed mb-3">
                Most browsers allow you to control cookies through settings:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700 mb-4">
                <li><span className="font-semibold">Chrome:</span> Settings → Privacy and Security → Cookies and other site data</li>
                <li><span className="font-semibold">Firefox:</span> Settings → Privacy & Security → Cookies and Site Data</li>
                <li><span className="font-semibold">Safari:</span> Preferences → Privacy → Manage Website Data</li>
                <li><span className="font-semibold">Edge:</span> Settings → Privacy and Services → Cookies and other site data</li>
              </ul>

              <h3 className="text-lg font-semibold mb-3">Option 3: Google Analytics Opt-Out</h3>
              <p className="text-neutral-700 leading-relaxed mb-4">
                Download the{" "}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#b5121b] hover:underline"
                >
                  Google Analytics Opt-Out Browser Add-on
                </a>
                {" "}to prevent your data from being sent to Google Analytics.
              </p>

              <h3 className="text-lg font-semibold mb-3">Option 4: Google Ad Settings</h3>
              <p className="text-neutral-700 leading-relaxed">
                Visit{" "}
                <a
                  href="https://adssettings.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#b5121b] hover:underline"
                >
                  Google Ad Settings
                </a>
                {" "}to control personalized ad preferences.
              </p>
            </div>

            {/* Impact of Disabling Cookies */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                ⚠️ Impact of Disabling Cookies
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                If you disable cookies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li>You may not be able to log into your account</li>
                <li>The website may not function properly</li>
                <li>Your preferences and settings will not be saved</li>
                <li>You may see the cookie consent banner every time you visit</li>
              </ul>
              <p className="text-neutral-700 leading-relaxed mt-3">
                We recommend keeping at least essential cookies enabled for the best user experience.
              </p>
            </div>

            {/* GDPR Compliance */}
            <div>
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                GDPR & International Compliance
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                We comply with GDPR and other international privacy laws regarding cookies:
              </p>
              <ul className="list-disc list-inside space-y-2 text-neutral-700">
                <li><span className="font-semibold">Consent First:</span> We ask for your consent before using non-essential cookies</li>
                <li><span className="font-semibold">Transparency:</span> We clearly disclose what cookies we use</li>
                <li><span className="font-semibold">Control:</span> You have full control over your cookie preferences</li>
                <li><span className="font-semibold">Withdrawal:</span> You can withdraw consent at any time</li>
              </ul>
            </div>

            {/* Contact Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h2 className="text-2xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-4">
                Questions About Cookies?
              </h2>
              <p className="text-neutral-700 leading-relaxed mb-3">
                If you have questions about our use of cookies, please contact us at:
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
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
