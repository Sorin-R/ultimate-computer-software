import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

interface ReadingListSummary {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
  followCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function MyReadingLists() {
  const [lists, setLists] = useState<ReadingListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPublic, setNewPublic] = useState(true);
  const [creating, setCreating] = useState(false);

  // Edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/reading-lists/me");
      setLists(res.data.lists);
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to load reading lists");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (newTitle.trim().length < 2) {
      setError("Title must be at least 2 characters");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await api.post("/reading-lists", {
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        isPublic: newPublic,
      });
      setNewTitle("");
      setNewDesc("");
      setNewPublic(true);
      setShowCreate(false);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to create list");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (list: ReadingListSummary) => {
    setEditId(list.id);
    setEditTitle(list.title);
    setEditDesc(list.description || "");
    setEditPublic(list.isPublic);
  };

  const handleSaveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/reading-lists/${editId}`, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        isPublic: editPublic,
      });
      setEditId(null);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/reading-lists/${id}`);
      setLists((prev) => prev.filter((l) => l.id !== id));
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to delete");
    }
  };

  return (
    <>
      <SEOHead title="My Reading Lists" path="/dashboard/reading-lists" />
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">My Reading Lists</h1>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="px-4 py-2 bg-black text-white hover:bg-neutral-800 text-xs font-semibold uppercase tracking-[0.08em]"
        >
          {showCreate ? "Cancel" : "New List"}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 bg-white border border-black/15 p-5 space-y-3">
          <h3 className="font-semibold text-sm">Create a new reading list</h3>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value.slice(0, 120))}
            placeholder="List title (e.g. Best of AI 2026)"
            className="w-full border border-black/20 px-3 py-2 text-sm focus:border-[#b5121b] focus:outline-none"
          />
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value.slice(0, 500))}
            placeholder="Description (optional)"
            rows={2}
            className="w-full border border-black/20 px-3 py-2 text-sm focus:border-[#b5121b] focus:outline-none resize-y"
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={newPublic}
              onChange={(e) => setNewPublic(e.target.checked)}
              className="accent-[#b5121b]"
            />
            Make this list public (others can see and follow it)
          </label>
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-[#b5121b] text-white text-sm font-semibold hover:bg-[#8f0f16] disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create List"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : lists.length === 0 ? (
        <p className="text-neutral-500 text-center py-10">
          No reading lists yet.{" "}
          <button onClick={() => setShowCreate(true)} className="text-[#b5121b] hover:underline">
            Create one
          </button>
        </p>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <div key={list.id} className="bg-white border border-black/15 p-4">
              {editId === list.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value.slice(0, 120))}
                    className="w-full border border-black/20 px-3 py-2 text-sm focus:border-[#b5121b] focus:outline-none"
                  />
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value.slice(0, 500))}
                    rows={2}
                    className="w-full border border-black/20 px-3 py-2 text-sm focus:border-[#b5121b] focus:outline-none resize-y"
                  />
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editPublic}
                      onChange={(e) => setEditPublic(e.target.checked)}
                      className="accent-[#b5121b]"
                    />
                    Public
                  </label>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditId(null)}
                      className="px-3 py-1.5 text-sm border border-black/20 text-neutral-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm bg-[#b5121b] text-white font-semibold hover:bg-[#8f0f16] disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] uppercase font-semibold tracking-wide px-2 py-0.5 rounded-full ${
                        list.isPublic ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {list.isPublic ? "Public" : "Private"}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {list.itemCount} article{list.itemCount !== 1 ? "s" : ""} · {list.followCount} follower{list.followCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <h3 className="font-semibold text-neutral-900">{list.title}</h3>
                    {list.description && (
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{list.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {list.isPublic && (
                      <Link
                        to={`/reading-list/${list.slug}`}
                        className="px-3 py-1.5 text-xs border border-black/20 text-neutral-600 hover:bg-neutral-50"
                        target="_blank"
                        rel="noopener"
                      >
                        View
                      </Link>
                    )}
                    <button
                      onClick={() => startEdit(list)}
                      className="px-3 py-1.5 text-xs border border-black/20 text-neutral-600 hover:bg-neutral-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(list.id, list.title)}
                      className="px-3 py-1.5 text-xs border border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lists.length > 0 && (
        <div className="mt-6 pt-4 border-t border-black/10">
          <Link to="/reading-lists" className="text-sm text-[#b5121b] hover:underline">
            Browse all public reading lists →
          </Link>
        </div>
      )}
    </>
  );
}
