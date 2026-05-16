import { useEffect, useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: "USER" | "MODERATOR" | "ADMIN";
  isActive: boolean;
  createdAt: string;
  _count: { articles: number };
}

export default function AdminModerators() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "MODERATOR" as "MODERATOR" | "ADMIN",
  });

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get("/admin/moderators", { params: { page } })
      .then((res) => {
        setUsers(res.data.users || []);
        setTotalPages(res.data.totalPages || 1);
      })
      .catch((err) => setError(err.response?.data?.error || "Failed to load moderators"))
      .finally(() => setLoading(false));
  }, [page]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const { data } = await api.post("/admin/moderators", formData);
      setUsers((prev) => [
        { ...data.user, _count: { articles: 0 } },
        ...prev,
      ]);
      setFormData({ name: "", email: "", password: "", role: "MODERATOR" });
      setSuccess("Staff account created successfully.");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create staff account");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const { data } = await api.put(`/admin/users/${userId}/role`, { role });
      const updatedRole = data.user.role as StaffUser["role"];
      if (updatedRole === "USER") {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: updatedRole } : u))
        );
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update role");
    }
  };

  const handleBan = async (userId: string) => {
    if (!confirm("Ban this account?")) return;
    try {
      setProcessingUserId(userId);
      const { data } = await api.put(`/admin/users/${userId}/ban`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: data.user.isActive } : u))
      );
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to ban account");
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleReactivate = async (userId: string) => {
    try {
      setProcessingUserId(userId);
      const { data } = await api.put(`/admin/users/${userId}/reactivate`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: data.user.isActive } : u))
      );
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to reactivate account");
    } finally {
      setProcessingUserId(null);
    }
  };

  return (
    <>
      <SEOHead title="Moderators" noindex />
      <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-6">
        Moderators & Admins
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-sm">
          {success}
        </div>
      )}

      <div className="bg-white border border-black/15 p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Create Staff Account</h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Full name"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            className="px-3 py-2 border border-black/20"
            required
            minLength={2}
          />
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
            className="px-3 py-2 border border-black/20"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            className="px-3 py-2 border border-black/20"
            required
            minLength={8}
          />
          <select
            value={formData.role}
            onChange={(e) =>
              setFormData((p) => ({ ...p, role: e.target.value as "MODERATOR" | "ADMIN" }))
            }
            className="px-3 py-2 border border-black/20"
          >
            <option value="MODERATOR">MODERATOR</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-500">
          Password must be at least 8 chars and include uppercase, lowercase, and a number.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : (
        <>
          <div className="bg-white border border-black/15 overflow-hidden">
            <table className="hidden lg:table w-full table-fixed text-sm">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="w-[18%] text-left px-3 py-3 font-semibold">Name</th>
                  <th className="w-[25%] text-left px-3 py-3 font-semibold">Email</th>
                  <th className="w-[14%] text-left px-3 py-3 font-semibold">Role</th>
                  <th className="w-[10%] text-left px-3 py-3 font-semibold">Status</th>
                  <th className="w-[10%] text-left px-3 py-3 font-semibold">Articles</th>
                  <th className="w-[12%] text-left px-3 py-3 font-semibold">Joined</th>
                  <th className="w-[11%] text-left px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50 align-top">
                    <td className="px-3 py-3 font-medium text-neutral-900 break-words">{user.name}</td>
                    <td className="px-3 py-3 text-neutral-600 break-all">{user.email}</td>
                    <td className="px-3 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={processingUserId === user.id}
                        className="w-full px-2 py-1 text-xs border border-black/25 bg-white disabled:opacity-50"
                      >
                        <option value="MODERATOR">MODERATOR</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="USER">USER</option>
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {user.isActive ? "ACTIVE" : "BANNED"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-neutral-600">{user._count.articles}</td>
                    <td className="px-3 py-3 text-neutral-600">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-3">
                      {user.isActive ? (
                        <button
                          onClick={() => handleBan(user.id)}
                          disabled={processingUserId === user.id}
                          className="px-2 py-1 text-xs bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          Ban
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(user.id)}
                          disabled={processingUserId === user.id}
                          className="px-2 py-1 text-xs bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="lg:hidden divide-y divide-black/10">
              {users.map((user) => (
                <article key={user.id} className="p-4 space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">Name</p>
                    <p className="text-sm font-medium text-neutral-900 break-words">{user.name}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500">Email</p>
                    <p className="text-sm text-neutral-700 break-all">{user.email}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 mb-1">Role</p>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={processingUserId === user.id}
                        className="w-full px-2 py-1 text-xs border border-black/25 bg-white disabled:opacity-50"
                      >
                        <option value="MODERATOR">MODERATOR</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="USER">USER</option>
                      </select>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.08em] text-neutral-500 mb-1">Status</p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}
                      >
                        {user.isActive ? "ACTIVE" : "BANNED"}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-neutral-700">
                    <p><span className="text-neutral-500">Articles:</span> {user._count.articles}</p>
                    <p><span className="text-neutral-500">Joined:</span> {new Date(user.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    {user.isActive ? (
                      <button
                        onClick={() => handleBan(user.id)}
                        disabled={processingUserId === user.id}
                        className="px-2 py-1 text-xs bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        Ban
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(user.id)}
                        disabled={processingUserId === user.id}
                        className="px-2 py-1 text-xs bg-green-700 text-white hover:bg-green-800 disabled:opacity-50"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border border-black disabled:opacity-50 text-sm"
              >
                Prev
              </button>
              <span className="px-4 py-2 text-sm text-neutral-500">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border border-black disabled:opacity-50 text-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
