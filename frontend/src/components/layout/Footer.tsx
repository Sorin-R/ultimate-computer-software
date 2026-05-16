import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer bg-neutral-900 text-neutral-300 mt-auto border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 py-16">
        {/* MOBILE LAYOUT - About above, 4 blocks in 2+2 */}
        <div className="md:hidden mb-12">
          <div className="text-center mb-12">
            <h3 className="text-white font-bold text-xl mb-3 [font-family:Georgia,'Times_New_Roman',serif]">
              Ultimate Computer Software
            </h3>
            <p className="text-xs leading-relaxed text-neutral-400 max-w-md mx-auto">
              Global tech journal with deep reporting on AI, cybersecurity, cloud infrastructure, and enterprise software.
            </p>
          </div>

          <div className="border-t border-neutral-700 pt-8 mb-8" />

          <div className="grid grid-cols-2 gap-6 mb-12 justify-items-center">

            {/* Quick Links */}
            <div className="text-left">
              <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-[0.12em]">Explore</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/" className="text-neutral-400 hover:text-white transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/latest" className="text-neutral-400 hover:text-white transition-colors">
                    Latest Articles
                  </Link>
                </li>
                <li>
                  <Link to="/categories" className="text-neutral-400 hover:text-white transition-colors">
                    Categories
                  </Link>
                </li>
                <li>
                  <Link to="/stats" className="text-neutral-400 hover:text-white transition-colors">
                    Community Stats
                  </Link>
                </li>
              </ul>
            </div>

            {/* Account */}
            <div className="text-left">
              <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-[0.12em]">Account</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/login" className="text-neutral-400 hover:text-white transition-colors">
                    Login
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="text-neutral-400 hover:text-white transition-colors">
                    Register
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard" className="text-neutral-400 hover:text-white transition-colors">
                    Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div className="text-left border-t border-neutral-700 pt-6">
              <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-[0.12em]">Legal</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/privacy-policy" className="text-neutral-400 hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms-of-service" className="text-neutral-400 hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/cookies-policy" className="text-neutral-400 hover:text-white transition-colors">
                    Cookies Policy
                  </Link>
                </li>
                <li>
                  <Link to="/data-request" className="text-neutral-400 hover:text-white transition-colors">
                    Data Request
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div className="text-left border-t border-neutral-700 pt-6">
              <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-[0.12em]">Contact</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link to="/contact" className="text-neutral-400 hover:text-white transition-colors">
                    Contact Form
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:privacy@ultimatecomputersoftware.com"
                    className="text-neutral-400 hover:text-white transition-colors"
                  >
                    Privacy
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:support@ultimatecomputersoftware.com"
                    className="text-neutral-400 hover:text-white transition-colors"
                  >
                    Support
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:copyright@ultimatecomputersoftware.com"
                    className="text-neutral-400 hover:text-white transition-colors"
                  >
                    Copyright
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* DESKTOP LAYOUT - Original 5 column layout */}
        <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4 mb-12 md:justify-items-end">
          {/* About Section */}
          <div className="lg:col-span-1 text-center md:text-left">
            <h3 className="text-white font-bold text-xl mb-3 [font-family:Georgia,'Times_New_Roman',serif]">
              Ultimate Computer Software
            </h3>
            <p className="text-xs leading-relaxed text-neutral-400">
              Global tech journal with deep reporting on AI, cybersecurity, cloud infrastructure, and enterprise software.
            </p>
          </div>

          {/* Quick Links */}
          <div className="text-left">
            <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-[0.12em]">Explore</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/" className="text-neutral-400 hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/latest" className="text-neutral-400 hover:text-white transition-colors">
                  Latest Articles
                </Link>
              </li>
              <li>
                <Link to="/categories" className="text-neutral-400 hover:text-white transition-colors">
                  Categories
                </Link>
              </li>
              <li>
                <Link to="/stats" className="text-neutral-400 hover:text-white transition-colors">
                  Community Stats
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div className="text-left">
            <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-[0.12em]">Account</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/login" className="text-neutral-400 hover:text-white transition-colors">
                  Login
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-neutral-400 hover:text-white transition-colors">
                  Register
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-neutral-400 hover:text-white transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="text-left">
            <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-[0.12em]">Legal</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/privacy-policy" className="text-neutral-400 hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms-of-service" className="text-neutral-400 hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/cookies-policy" className="text-neutral-400 hover:text-white transition-colors">
                  Cookies Policy
                </Link>
              </li>
              <li>
                <Link to="/data-request" className="text-neutral-400 hover:text-white transition-colors">
                  Data Request
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="text-left">
            <h4 className="text-white font-semibold mb-4 text-xs uppercase tracking-[0.12em]">Contact</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link to="/contact" className="text-neutral-400 hover:text-white transition-colors">
                  Contact Form
                </Link>
              </li>
              <li>
                <a
                  href="mailto:privacy@ultimatecomputersoftware.com"
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  Privacy
                </a>
              </li>
              <li>
                <a
                  href="mailto:support@ultimatecomputersoftware.com"
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  Support
                </a>
              </li>
              <li>
                <a
                  href="mailto:copyright@ultimatecomputersoftware.com"
                  className="text-neutral-400 hover:text-white transition-colors"
                >
                  Copyright
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-700 my-8" />

        {/* Footer Bottom */}
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.08em] text-neutral-500 mb-2">
            © {new Date().getFullYear()} Ultimate Computer Software. All rights reserved.
          </p>
          <p className="text-xs text-neutral-600">
            Worldwide Tech Journal Platform
          </p>
        </div>
      </div>
    </footer>
  );
}
