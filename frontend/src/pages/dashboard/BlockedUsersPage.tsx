import { useEffect, useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

interface BlockedUserEntry {
  blockedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    isActive: boolean;
  };
}

export default function BlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/me/blocks");
      setBlockedUsers(res.data.blockedUsers || []);
    } catch {
      setBlockedUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const unblock = async (userId: string) => {
    setBusyUserId(userId);
    try {
      await api.delete(`/users/${userId}/block`);
      setBlockedUsers((prev) => prev.filter((entry) => entry.user.id !== userId));
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to unblock user");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <>
      <SEOHead title="Blocked Users" path="/dashboard/blocked-users" />
      <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-6">
        Blocked Users
      </h1>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : blockedUsers.length === 0 ? (
        <p className="text-neutral-500">You have not blocked any users.</p>
      ) : (
        <div className="bg-white border border-black/15 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Email</th>
                <th className="text-left px-4 py-3 font-semibold">Blocked at</th>
                <th className="text-left px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {blockedUsers.map((entry) => (
                <tr key={entry.user.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 text-neutral-900 font-medium">{entry.user.name}</td>
                  <td className="px-4 py-3 text-neutral-600">{entry.user.email}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {new Date(entry.blockedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => unblock(entry.user.id)}
                      disabled={busyUserId === entry.user.id}
                      className="px-3 py-1.5 bg-black text-white text-xs font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800 disabled:opacity-50"
                    >
                      Unblock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
