import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import NotificationBell from "../NotificationBell";
import { Menu, X, Search, ChevronDown, Sun, Moon } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isActive = (path: string): boolean => {
    return location.pathname === path;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    setSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <header className="bg-white border-b border-black sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="relative flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <picture>
                <source media="(max-width: 639px)" srcSet={theme === "dark" ? "/logo-dark.svg" : "/logo.svg"} />
                <img
                  src={theme === "dark" ? "/logo-dark.svg" : "/logo.svg"}
                  alt="Ultimate Computer Software"
                  className="h-10 sm:h-11 w-auto shrink-0"
                />
              </picture>
              <span className="sr-only">Ultimate Computer Software</span>
            </Link>
          </div>

          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-6">
            <Link to="/" className={`text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${isActive("/") ? "text-[#b5121b]" : "text-neutral-800 hover:text-[#b5121b]"}`}>
              Home
            </Link>
            <Link to="/latest" className={`text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${isActive("/latest") ? "text-[#b5121b]" : "text-neutral-800 hover:text-[#b5121b]"}`}>
              Latest
            </Link>
            <div className="relative group">
              <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-neutral-800 hover:text-[#b5121b]">
                Explore <ChevronDown size={14} />
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-56 bg-white shadow-lg border border-black/20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <Link to="/categories" className="block px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-neutral-800 hover:bg-neutral-100">
                  All Categories
                </Link>
                <Link to="/tags" className="block px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-neutral-800 hover:bg-neutral-100">
                  Topics & Tags
                </Link>
                <Link to="/reading-lists" className="block px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-neutral-800 hover:bg-neutral-100">
                  Reading Lists
                </Link>
                <Link to="/requests" className="block px-4 py-2 text-xs font-medium uppercase tracking-[0.08em] text-neutral-800 hover:bg-neutral-100">
                  Article Wishlist
                </Link>
              </div>
            </div>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="p-2 text-neutral-600 hover:text-[#b5121b]"
              aria-label="Open search"
            >
              <Search size={20} />
            </button>

            <button
              onClick={toggleTheme}
              className="p-2 text-neutral-600 hover:text-[#b5121b]"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {user ? (
              <div className="hidden md:flex items-center gap-3">
                <NotificationBell />
                <Link to="/dashboard" className={`text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${isActive("/dashboard") ? "text-[#b5121b]" : "text-neutral-800 hover:text-[#b5121b]"}`}>
                  Dashboard
                </Link>
                {(user.role === "ADMIN" || user.role === "MODERATOR") && (
                  <Link to="/admin" className={`text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${isActive("/admin") ? "text-[#b5121b]" : "text-neutral-800 hover:text-[#b5121b]"}`}>
                    Admin
                  </Link>
                )}
                <button
                  onClick={logout}
                  className="text-xs font-semibold uppercase tracking-[0.1em] text-red-700 hover:text-red-800"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-800 hover:text-[#b5121b]"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="text-xs px-3 py-2 bg-[#b5121b] text-white font-semibold uppercase tracking-[0.08em] hover:bg-[#8f0f16]"
                >
                  Register
                </Link>
              </div>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-neutral-700"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <form onSubmit={handleSearch} className="pb-3 border-t border-black/15 pt-3">
            <div className="flex">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="flex-1 px-4 py-2 border border-black/30 rounded-l-md bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                autoFocus
              />
              <button
                type="submit"
                className="px-4 py-2 bg-black text-white rounded-r-md hover:bg-neutral-800 text-sm font-medium"
              >
                Search
              </button>
            </div>
          </form>
        )}

        {mobileOpen && (
          <nav className="md:hidden pb-4 border-t border-black/15 pt-3 flex flex-col gap-2">
            <Link to="/" onClick={() => setMobileOpen(false)} className={`px-3 py-2 rounded transition-colors ${isActive("/") ? "bg-[#b5121b] text-white" : "text-neutral-800 hover:bg-neutral-100"}`}>Home</Link>
            <Link to="/latest" onClick={() => setMobileOpen(false)} className={`px-3 py-2 rounded transition-colors ${isActive("/latest") ? "bg-[#b5121b] text-white" : "text-neutral-800 hover:bg-neutral-100"}`}>Latest</Link>
            <Link to="/categories" onClick={() => setMobileOpen(false)} className={`px-3 py-2 rounded transition-colors ${isActive("/categories") ? "bg-[#b5121b] text-white" : "text-neutral-800 hover:bg-neutral-100"}`}>Categories</Link>
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className={`px-3 py-2 rounded transition-colors ${isActive("/dashboard") ? "bg-[#b5121b] text-white" : "text-neutral-800 hover:bg-neutral-100"}`}>Dashboard</Link>
                {(user.role === "ADMIN" || user.role === "MODERATOR") && (
                  <Link to="/admin" onClick={() => setMobileOpen(false)} className={`px-3 py-2 rounded transition-colors ${isActive("/admin") ? "bg-[#b5121b] text-white" : "text-neutral-800 hover:bg-neutral-100"}`}>Admin</Link>
                )}
                <button onClick={() => { logout(); setMobileOpen(false); }} className="text-left px-3 py-2 text-red-700 hover:bg-red-50 rounded">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="px-3 py-2 text-neutral-800 hover:bg-neutral-100 rounded">Login</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="px-3 py-2 bg-[#b5121b] text-white rounded text-center">Register</Link>
              </>
            )}
          </nav>
        )}

      </div>
    </header>
  );
}
