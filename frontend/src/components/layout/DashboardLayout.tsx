import { useState, useEffect } from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  FileText,
  PlusCircle,
  LayoutDashboard,
  Users,
  UserCog,
  BarChart3,
  Bookmark,
  History,
  List,
  Hash,
  Flame,
  ShieldCheck,
  ShieldBan,
  Flag,
  BadgeCheck,
  Menu,
  X,
} from "lucide-react";
import AdBanner from "../AdBanner";

export default function DashboardLayout() {
  const { user } = useAuth();
  const location = useLocation();
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
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/dashboard/articles", label: "My Articles", icon: FileText },
    { to: "/dashboard/articles/new", label: "New Article", icon: PlusCircle },
    { to: "/dashboard/bookmarks", label: "Bookmarks", icon: Bookmark },
    { to: "/dashboard/history", label: "History", icon: History },
    { to: "/dashboard/streaks", label: "Streak & Badges", icon: Flame },
    { to: "/dashboard/reading-lists", label: "Reading Lists", icon: List },
    { to: "/dashboard/tag-feed", label: "Tag Feed", icon: Hash },
    { to: "/dashboard/subscriptions", label: "Subscriptions", icon: Users },
    { to: "/dashboard/reports", label: "My Reports", icon: Flag },
    { to: "/dashboard/referrals", label: "Referrals", icon: BadgeCheck },
    { to: "/dashboard/blocked-users", label: "Blocked Users", icon: ShieldBan },
    { to: "/dashboard/security", label: "Security", icon: ShieldCheck },
    { to: "/dashboard/profile", label: "Profile", icon: UserCog },
    { to: "/dashboard/creator-stats", label: "Creator Stats", icon: BarChart3 },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Mobile Menu Button - Sticky */}
        <div className="md:hidden sticky top-16 z-40 mb-4 px-4 pt-0 pb-0">
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
            <h2 className="font-bold text-neutral-900 text-lg [font-family:Georgia,'Times_New_Roman',serif]">{user?.name}</h2>
            <p className="text-sm text-neutral-500 break-all">{user?.email}</p>
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
          <div className="mt-6 px-4 md:px-0 flex justify-center">
            <div className="w-[250px] h-[250px] max-w-full overflow-hidden">
              <AdBanner
                placement="dashboard_sidebar"
                variant="flat"
                className="w-full h-full flex items-center justify-center"
              />
            </div>
          </div>
        </aside>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
