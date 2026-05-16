import { useEffect, useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  _count: { articles: number };
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/admin/categories")
      .then((res) => setCategories(res.data.categories))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.put(`/admin/categories/${id}`, { status: "ACTIVE" });
      setCategories((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: "ACTIVE" } : c))
      );
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed");
    }
  };

  const handleDelete = async (id: string, status: string) => {
    const message =
      status === "PENDING"
        ? "Reject this pending category?"
        : "Delete this category? Existing articles will be moved to another active category automatically.";
    if (!confirm(message)) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed");
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async (id: string) => {
    const nextName = editingName.trim();
    if (!nextName) {
      alert("Category name is required");
      return;
    }

    try {
      setSaving(true);
      const res = await api.put(`/admin/categories/${id}`, { name: nextName });
      setCategories((prev) =>
        prev.map((cat) => (cat.id === id ? { ...cat, ...res.data.category } : cat))
      );
      cancelEdit();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SEOHead title="Manage Categories" noindex />
      <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-6">
        Manage Categories
      </h1>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : (
        <div className="bg-white border border-black/15 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Name</th>
                <th className="text-left px-4 py-3 font-semibold">Slug</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Articles</th>
                <th className="text-left px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {editingId === cat.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full px-2 py-1 border border-black/25 bg-white"
                      />
                    ) : (
                      cat.name
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{cat.slug}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        cat.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {cat.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{cat._count.articles}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {cat.status === "PENDING" && (
                        <button
                          onClick={() => handleApprove(cat.id)}
                          className="px-2 py-1 text-xs bg-green-700 text-white hover:bg-green-800"
                        >
                          Approve
                        </button>
                      )}
                      {editingId === cat.id ? (
                        <>
                          <button
                            onClick={() => saveEdit(cat.id)}
                            disabled={saving}
                            className="px-2 py-1 text-xs bg-black text-white hover:bg-neutral-800 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="px-2 py-1 text-xs bg-neutral-600 text-white hover:bg-neutral-700 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(cat)}
                          className="px-2 py-1 text-xs bg-[#b5121b] text-white hover:bg-[#8f0f16]"
                        >
                          Edit
                        </button>
                      )}
                      {editingId !== cat.id && (
                        <button
                          onClick={() => handleDelete(cat.id, cat.status)}
                          className="px-2 py-1 text-xs bg-red-700 text-white hover:bg-red-800"
                        >
                          {cat.status === "PENDING" ? "Reject" : "Delete"}
                        </button>
                      )}
                    </div>
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
