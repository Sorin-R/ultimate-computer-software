import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider, Helmet } from "react-helmet-async";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/layout/DashboardLayout";
import AdminLayout from "./components/layout/AdminLayout";
import CookieConsentBanner from "./components/CookieConsentBanner";
import { SITE_URL } from "./utils/site";

const HomePage = lazy(() => import("./pages/public/HomePage"));
const ArticlePage = lazy(() => import("./pages/public/ArticlePage"));
const CategoriesPage = lazy(() => import("./pages/public/CategoriesPage"));
const CategoryPage = lazy(() => import("./pages/public/CategoryPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/public/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/public/TermsOfServicePage"));
const CookiesPolicyPage = lazy(() => import("./pages/public/CookiesPolicyPage"));
const DataRequestPage = lazy(() => import("./pages/public/DataRequestPage"));
const ContactPage = lazy(() => import("./pages/public/ContactPage"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const VerifyEmailPage = lazy(() => import("./pages/auth/VerifyEmailPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const MyArticles = lazy(() => import("./pages/dashboard/MyArticles"));
const ArticleEditor = lazy(() => import("./pages/dashboard/ArticleEditor"));
const MySubscriptions = lazy(() => import("./pages/dashboard/MySubscriptions"));
const ProfileEditor = lazy(() => import("./pages/dashboard/ProfileEditor"));
const CreatorStats = lazy(() => import("./pages/dashboard/CreatorStats"));
const MyBookmarks = lazy(() => import("./pages/dashboard/MyBookmarks"));
const ReadingHistory = lazy(() => import("./pages/dashboard/ReadingHistory"));
const AdminHome = lazy(() => import("./pages/admin/AdminHome"));
const AdminArticles = lazy(() => import("./pages/admin/AdminArticles"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminModerators = lazy(() => import("./pages/admin/AdminModerators"));
const AdminAdsense = lazy(() => import("./pages/admin/AdminAdsense"));
const AdminComments = lazy(() => import("./pages/admin/AdminComments"));
const AuthorPage = lazy(() => import("./pages/public/AuthorPage"));
const ArticleRequestsPage = lazy(() => import("./pages/public/ArticleRequestsPage"));
const ReadingListsPage = lazy(() => import("./pages/public/ReadingListsPage"));
const ReadingListPage = lazy(() => import("./pages/public/ReadingListPage"));
const TagsPage = lazy(() => import("./pages/public/TagsPage"));
const SearchPage = lazy(() => import("./pages/public/SearchPage"));
const MyReadingLists = lazy(() => import("./pages/dashboard/MyReadingLists"));
const TagFeed = lazy(() => import("./pages/dashboard/TagFeed"));
const StreakPage = lazy(() => import("./pages/dashboard/StreakPage"));
const SecuritySettings = lazy(() => import("./pages/dashboard/SecuritySettings"));
const BlockedUsersPage = lazy(() => import("./pages/dashboard/BlockedUsersPage"));
const MyReportsPage = lazy(() => import("./pages/dashboard/MyReportsPage"));
const ReferralPage = lazy(() => import("./pages/dashboard/ReferralPage"));
const StatsPage = lazy(() => import("./pages/public/StatsPage"));
const PolicyCompliancePage = lazy(() => import("./pages/public/PolicyCompliancePage"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminActivity = lazy(() => import("./pages/admin/AdminActivity"));
const TagPage = lazy(() => import("./pages/public/TagPage"));

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "Ultimate Computer Software",
  url: SITE_URL,
  description: "Your trusted source for worldwide technology news.",
  publisher: { "@id": `${SITE_URL}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Ultimate Computer Software",
  url: SITE_URL,
  description: "Your trusted source for worldwide technology news.",
  logo: {
    "@type": "ImageObject",
    url: `${SITE_URL}/logo-google.png`,
    width: 600,
    height: 60,
  },
};

function RouteLoader() {
  return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
    </div>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(websiteSchema)}</script>
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
      </Helmet>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <div className="min-h-screen flex flex-col bg-[#f6f6f4]">
              <Navbar />
              <div className="flex-1">
                <Suspense fallback={<RouteLoader />}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/latest" element={<HomePage />} />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/category/:slug" element={<CategoryPage />} />
                    <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                    <Route path="/terms-of-service" element={<TermsOfServicePage />} />
                    <Route path="/cookies-policy" element={<CookiesPolicyPage />} />
                    <Route path="/data-request" element={<DataRequestPage />} />
                    <Route path="/contact" element={<ContactPage />} />
                    <Route path="/requests" element={<ArticleRequestsPage />} />
                    <Route path="/reading-lists" element={<ReadingListsPage />} />
                    <Route path="/reading-list/:slug" element={<ReadingListPage />} />
                    <Route path="/tags" element={<TagsPage />} />
                    <Route path="/tag/:slug" element={<TagPage />} />
                    <Route path="/search" element={<SearchPage />} />
                    <Route path="/stats" element={<StatsPage />} />

                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />

                    <Route
                      path="/dashboard"
                      element={
                        <ProtectedRoute>
                          <DashboardLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<DashboardHome />} />
                      <Route path="articles" element={<MyArticles />} />
                      <Route path="articles/new" element={<ArticleEditor />} />
                      <Route path="articles/edit/:id" element={<ArticleEditor />} />
                      <Route path="subscriptions" element={<MySubscriptions />} />
                      <Route path="profile" element={<ProfileEditor />} />
                      <Route path="creator-stats" element={<CreatorStats />} />
                      <Route path="bookmarks" element={<MyBookmarks />} />
                      <Route path="history" element={<ReadingHistory />} />
                      <Route path="reading-lists" element={<MyReadingLists />} />
                      <Route path="tag-feed" element={<TagFeed />} />
                      <Route path="streaks" element={<StreakPage />} />
                      <Route path="security" element={<SecuritySettings />} />
                      <Route path="blocked-users" element={<BlockedUsersPage />} />
                      <Route path="reports" element={<MyReportsPage />} />
                      <Route path="referrals" element={<ReferralPage />} />
                    </Route>

                    <Route
                      path="/admin"
                      element={
                        <ProtectedRoute roles={["ADMIN", "MODERATOR"]}>
                          <AdminLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<AdminHome />} />
                      <Route path="articles" element={<AdminArticles />} />
                      <Route
                        path="articles/edit/:id"
                        element={
                          <ProtectedRoute roles={["ADMIN"]}>
                            <ArticleEditor />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="comments" element={<AdminComments />} />
                      <Route path="reports" element={<AdminReports />} />
                      <Route
                        path="activity"
                        element={
                          <ProtectedRoute roles={["ADMIN"]}>
                            <AdminActivity />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="categories"
                        element={
                          <ProtectedRoute roles={["ADMIN"]}>
                            <AdminCategories />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="users" element={<AdminUsers />} />
                      <Route
                        path="moderators"
                        element={
                          <ProtectedRoute roles={["ADMIN"]}>
                            <AdminModerators />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="adsense"
                        element={
                          <ProtectedRoute roles={["ADMIN"]}>
                            <AdminAdsense />
                          </ProtectedRoute>
                        }
                      />
                    </Route>

                    <Route path="/author/:id" element={<AuthorPage />} />
                    <Route path="/author/:id/policy-compliance" element={<PolicyCompliancePage />} />

                    <Route path="/:slug" element={<ArticlePage />} />
                  </Routes>
                </Suspense>
              </div>
              <Footer />
            </div>
            <CookieConsentBanner />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
