import { useEffect, useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import { useAuth } from "../../context/AuthContext";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { articles: number };
}

export default function AdminUsers() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get("/admin/users", { params: { page } })
      .then((res) => {
        setUsers(res.data.users);
        setTotalPages(res.data.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const handleDeleteForever = async (userId: string) => {
    if (!confirm("Delete this user forever? This will also permanently delete all of their articles.")) return;

    try {
      setProcessingUserId(userId);
      await api.delete(`/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to permanently delete user");
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleBan = async (userId: string) => {
    if (!confirm("Ban this user? They will not be able to log in until reactivated.")) return;
    try {
      setProcessingUserId(userId);
      const { data } = await api.put(`/admin/users/${userId}/ban`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: data.user.isActive } : u))
      );
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to ban user");
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
      alert(err.response?.data?.error || "Failed to reactivate user");
    } finally {
      setProcessingUserId(null);
    }
  };

  const handleAddPolicyEntry = async (userId: string) => {
    const actionType = prompt(
      "Action type (WARNING, CONTENT_REMOVED, TEMP_RESTRICTION, PERMANENT_BAN, APPEAL_ACCEPTED, APPEAL_REJECTED):",
      "WARNING"
    );
    if (!actionType) return;

    const publicReason = prompt("Public reason:");
    if (!publicReason || !publicReason.trim()) return;

    const status = prompt("Status (ACTIVE or RESOLVED):", "ACTIVE") || "ACTIVE";

    try {
      await api.post(`/admin/users/${userId}/policy-compliance`, {
        actionType: actionType.trim().toUpperCase(),
        publicReason: publicReason.trim(),
        status: status.trim().toUpperCase(),
        isPublic: true,
      });
      alert("Policy compliance entry created");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create policy entry");
    }
  };

  return (
    <>
      <SEOHead title="Manage Users" noindex />
      <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-6">
        Manage Users
      </h1>

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
                  <th className="w-[14%] text-left px-3 py-3 font-semibold">Name</th>
                  <th className="w-[22%] text-left px-3 py-3 font-semibold">Email</th>
                  <th className="w-[12%] text-left px-3 py-3 font-semibold">Role</th>
                  <th className="w-[10%] text-left px-3 py-3 font-semibold">Status</th>
                  <th className="w-[8%] text-left px-3 py-3 font-semibold">Articles</th>
                  <th className="w-[12%] text-left px-3 py-3 font-semibold">Joined</th>
                  <th className="w-[22%] text-left px-3 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-neutral-50 align-top">
                    <td className="px-3 py-3 font-medium text-neutral-900 break-words">{user.name}</td>
                    <td className="px-3 py-3 text-neutral-600 break-all">{user.email}</td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700">
                        {user.role}
                      </span>
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
                      <div className="flex flex-wrap items-center gap-2">
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
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteForever(user.id)}
                            disabled={processingUserId === user.id}
                            className="px-2 py-1 text-xs bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                        <button
                          onClick={() => handleAddPolicyEntry(user.id)}
                          disabled={processingUserId === user.id}
                          className="px-2 py-1 text-xs bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                          Policy
                        </button>
                      </div>
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
                      <span className="inline-block text-xs font-semibold uppercase tracking-[0.08em] text-neutral-700">
                        {user.role}
                      </span>
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

                  <div className="flex flex-wrap items-center gap-2">
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
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteForever(user.id)}
                        disabled={processingUserId === user.id}
                        className="px-2 py-1 text-xs bg-red-700 text-white hover:bg-red-800 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={() => handleAddPolicyEntry(user.id)}
                      disabled={processingUserId === user.id}
                      className="px-2 py-1 text-xs bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
                    >
                      Policy
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border border-black disabled:opacity-50 text-sm">Prev</button>
              <span className="px-4 py-2 text-sm text-neutral-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-4 py-2 border border-black disabled:opacity-50 text-sm">Next</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
