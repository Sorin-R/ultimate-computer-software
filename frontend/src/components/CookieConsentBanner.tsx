import { useState, useEffect } from "react";
import { X, Settings } from "lucide-react";

export default function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true, // Always true
    analytics: false,
    advertising: false,
  });

  useEffect(() => {
    // Check if user has already made a choice
    const savedConsent = localStorage.getItem("cookie_consent");
    if (!savedConsent) {
      setIsVisible(true);
    } else {
      // Load saved preferences
      const saved = localStorage.getItem("cookie_preferences");
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    }
  }, []);

  const handleAcceptAll = () => {
    const newPrefs = {
      essential: true,
      analytics: true,
      advertising: true,
    };
    localStorage.setItem("cookie_consent", "all");
    localStorage.setItem("cookie_preferences", JSON.stringify(newPrefs));
    setPreferences(newPrefs);
    setIsVisible(false);

    // Load Google Analytics if consented
    loadGoogleAnalytics();
    loadGoogleAdSense();
  };

  const handleReject = () => {
    const newPrefs = {
      essential: true,
      analytics: false,
      advertising: false,
    };
    localStorage.setItem("cookie_consent", "rejected");
    localStorage.setItem("cookie_preferences", JSON.stringify(newPrefs));
    setPreferences(newPrefs);
    setIsVisible(false);
  };

  const handleSaveSettings = () => {
    const newPrefs = {
      essential: true,
      analytics: preferences.analytics,
      advertising: preferences.advertising,
    };
    localStorage.setItem("cookie_consent", "custom");
    localStorage.setItem("cookie_preferences", JSON.stringify(newPrefs));
    setIsVisible(false);
    setShowSettings(false);

    if (newPrefs.analytics) loadGoogleAnalytics();
    if (newPrefs.advertising) loadGoogleAdSense();
  };

  const loadGoogleAnalytics = () => {
    if (document.querySelector('script[src*="googletagmanager"]')) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=YOUR-GA-ID";
    document.head.appendChild(script);

    const analyticsWindow = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
    analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
    analyticsWindow.gtag = (...args: unknown[]) => {
      analyticsWindow.dataLayer!.push(args);
    };
    analyticsWindow.gtag("js", new Date());
    analyticsWindow.gtag("config", "YOUR-GA-ID");
  };

  const loadGoogleAdSense = () => {
    if (document.querySelector('script[src*="pagead2"]')) return;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-YOUR-CLIENT-ID";
    script.setAttribute("crossorigin", "anonymous");
    document.head.appendChild(script);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/15 shadow-2xl z-50">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Content */}
          <div className="flex-1">
            {!showSettings ? (
              <>
                <h3 className="font-bold text-neutral-900 mb-2">
                  🍪 Cookie Consent
                </h3>
                <p className="text-sm text-neutral-700 leading-relaxed">
                  We use cookies to enhance your browsing experience, analyze site usage, and display personalized advertisements.
                  Essential cookies are always enabled. You can choose to accept all cookies or customize your preferences.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-bold text-neutral-900 mb-4">
                  Cookie Preferences
                </h3>
                <div className="space-y-3">
                  {/* Essential Cookies */}
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="w-4 h-4 text-[#b5121b] rounded opacity-50 cursor-not-allowed"
                    />
                    <span className="text-sm text-neutral-700">
                      <span className="font-semibold">Essential Cookies</span>
                      <span className="text-neutral-500"> (always enabled)</span>
                    </span>
                  </label>

                  {/* Analytics Cookies */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          analytics: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-[#b5121b] rounded border-black/25 focus:ring-2 focus:ring-[#b5121b]"
                    />
                    <span className="text-sm text-neutral-700">
                      <span className="font-semibold">Analytics Cookies</span>
                      <span className="text-neutral-500"> (Google Analytics)</span>
                    </span>
                  </label>

                  {/* Advertising Cookies */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.advertising}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          advertising: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-[#b5121b] rounded border-black/25 focus:ring-2 focus:ring-[#b5121b]"
                    />
                    <span className="text-sm text-neutral-700">
                      <span className="font-semibold">Advertising Cookies</span>
                      <span className="text-neutral-500"> (Google AdSense)</span>
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 sm:flex-shrink-0">
            {!showSettings ? (
              <>
                <button
                  onClick={handleReject}
                  className="px-4 py-2 text-sm font-semibold border border-black text-neutral-900 hover:bg-neutral-50 rounded whitespace-nowrap"
                >
                  Reject
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-4 py-2 text-sm font-semibold border border-black text-neutral-900 hover:bg-neutral-50 rounded whitespace-nowrap flex items-center gap-2 justify-center"
                >
                  <Settings size={16} />
                  Settings
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-2 text-sm font-semibold bg-[#b5121b] text-white hover:bg-[#8f0f16] rounded whitespace-nowrap"
                >
                  Accept All
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-sm font-semibold border border-black text-neutral-900 hover:bg-neutral-50 rounded whitespace-nowrap"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="px-4 py-2 text-sm font-semibold bg-[#b5121b] text-white hover:bg-[#8f0f16] rounded whitespace-nowrap"
                >
                  Save Settings
                </button>
              </>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={handleReject}
            className="absolute top-4 right-4 p-1 text-neutral-500 hover:text-neutral-700"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Footer Link */}
        <div className="mt-4 pt-4 border-t border-black/15">
          <a
            href="/cookies-policy"
            className="text-xs text-[#b5121b] hover:underline"
          >
            Read our full Cookies Policy →
          </a>
        </div>
      </div>
    </div>
  );
}
