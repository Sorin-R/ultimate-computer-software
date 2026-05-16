import { useState, useEffect } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { BarChart3, FileText, FolderOpen, Users, Megaphone, MessageSquare, ShieldAlert, History, Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function AdminLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu when navigating and prevent scroll
  useEffect(() => {
    setMenuOpen(false);
    // Prevent the browser from scrolling when navigating
    const scrollPos = window.scrollY;
    window.scrollTo(0, scrollPos);
  }, [location.pathname]);

  const handleMenuToggle = () => {
    const scrollPos = window.scrollY;
    setMenuOpen(!menuOpen);
    // Restore scroll position to prevent jumping
    setTimeout(() => {
      window.scrollTo(0, scrollPos);
    }, 0);
  };

  const links = [
    { to: "/admin", label: "Overview", icon: BarChart3 },
    { to: "/admin/articles", label: "Articles", icon: FileText },
    { to: "/admin/comments", label: "Comments", icon: MessageSquare },
    { to: "/admin/reports", label: "Reports", icon: ShieldAlert },
    { to: "/admin/users", label: "Users", icon: Users },
    ...(user?.role === "ADMIN" ? [{ to: "/admin/activity", label: "Activity", icon: History }] : []),
    ...(user?.role === "ADMIN" ? [{ to: "/admin/categories", label: "Categories", icon: FolderOpen }] : []),
    ...(user?.role === "ADMIN" ? [{ to: "/admin/moderators", label: "Moderators", icon: Users }] : []),
    ...(user?.role === "ADMIN" ? [{ to: "/admin/adsense", label: "AdSense", icon: Megaphone }] : []),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Mobile Menu Button - Sticky */}
        <div className="md:hidden sticky top-16 z-40 mb-4 px-4 pt-0 pb-0 -mx-4">
          <button
            onClick={handleMenuToggle}
            className="w-full flex items-center justify-between px-4 py-2 bg-black text-white font-semibold uppercase tracking-[0.08em] text-sm"
          >
            <span>Menu</span>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <aside className={`w-full md:w-64 flex-shrink-0 md:relative ${!menuOpen ? "hidden md:block" : "bg-white overflow-y-auto md:overflow-visible md:bg-transparent"}`}>
          <div className="mb-6 pb-4 border-b border-black/15 px-4 md:px-0 pt-4 md:pt-0">
            <h2 className="font-bold text-neutral-900 text-lg [font-family:Georgia,'Times_New_Roman',serif]">Admin Panel</h2>
          </div>
          <nav className="flex flex-col gap-1 px-4 md:px-0">
            {links.map((link) => {
              const Icon = link.icon;
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition border ${
                    active
                      ? "bg-black text-white border-black"
                      : "text-neutral-700 border-transparent hover:border-black/20 hover:bg-white"
                  }`}
                >
                  <Icon size={18} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
