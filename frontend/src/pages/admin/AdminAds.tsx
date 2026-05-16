import { useEffect, useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

interface Ad {
  id: string;
  placement: string;
  displayName: string;
  content: string;
  width?: number;
  height?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminAds() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    placement: "",
    displayName: "",
    content: "",
    width: "",
    height: "",
    isActive: true,
  });

  const placements = [
    "homepage",
    "article",
    "category",
    "dashboard",
    "dashboard_sidebar",
    "sidebar",
    "related_articles_1",
    "related_articles_2",
    "related_articles_3",
  ];

  const MOCK_AD_CONTENT = {
    standard: `<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px; font-family: Arial, sans-serif;">
  <h3 style="margin: 0 0 10px 0;">Advertisement</h3>
  <p style="margin: 0; font-size: 14px;">Your ad space here - Google AdSense Mock</p>
</div>`,
    square: `<div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; text-align: center; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-family: Arial, sans-serif; height: 250px;">
  <div>
    <h4 style="margin: 0 0 8px 0; font-size: 16px;">Advertisement</h4>
    <p style="margin: 0; font-size: 12px;">250x250 Ad Space</p>
  </div>
</div>`,
    wide: `<div style="background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 20px; text-align: center; border-radius: 8px; font-family: Arial, sans-serif;">
  <h4 style="margin: 0 0 5px 0; font-size: 14px;">Advertisement</h4>
  <p style="margin: 0; font-size: 12px;">728x90 Leaderboard - Google AdSense Mock</p>
</div>`,
  };

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      setLoading(true);
      const response = await api.get("/config/admin/ads");
      setAds(response.data.ads);
    } catch (err) {
      console.error("Failed to fetch ads", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      placement: "",
      displayName: "",
      content: "",
      width: "",
      height: "",
      isActive: true,
    });
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        await api.put(`/config/admin/ads/${editingId}`, formData);
      } else {
        await api.post("/config/admin/ads", formData);
      }
      await fetchAds();
      resetForm();
      setFormVisible(false);
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save ad");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this ad?")) return;

    try {
      await api.delete(`/config/admin/ads/${id}`);
      await fetchAds();
    } catch (err) {
      alert("Failed to delete ad");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.put(`/config/admin/ads/${id}/toggle`);
      await fetchAds();
    } catch (err) {
      alert("Failed to toggle ad");
    }
  };

  const handleEdit = (ad: Ad) => {
    setFormData({
      placement: ad.placement,
      displayName: ad.displayName,
      content: ad.content,
      width: ad.width?.toString() || "",
      height: ad.height?.toString() || "",
      isActive: ad.isActive,
    });
    setEditingId(ad.id);
    setFormVisible(true);
  };

  return (
    <>
      <SEOHead title="Manage Ads" noindex />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
          Manage Google AdSense (Mock)
        </h1>
        <button
          onClick={() => {
            resetForm();
            setFormVisible(!formVisible);
          }}
          className="px-4 py-2 bg-black text-white hover:bg-neutral-800 text-sm font-semibold uppercase"
        >
          {formVisible ? "Cancel" : "Add New Ad"}
        </button>
      </div>

      {formVisible && (
        <div className="bg-white border border-black/15 p-6 mb-6 rounded">
          <h2 className="text-xl font-bold mb-4">
            {editingId ? "Edit Ad" : "Create New Ad"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Placement
                </label>
                <select
                  value={formData.placement}
                  onChange={(e) =>
                    setFormData({ ...formData, placement: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-black/25 bg-white text-sm"
                  required
                >
                  <option value="">Select placement...</option>
                  {placements.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-black/25 text-sm"
                  placeholder="e.g., Homepage Banner"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Width (px)
                </label>
                <input
                  type="number"
                  value={formData.width}
                  onChange={(e) =>
                    setFormData({ ...formData, width: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-black/25 text-sm"
                  placeholder="e.g., 728"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Height (px)
                </label>
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) =>
                    setFormData({ ...formData, height: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-black/25 text-sm"
                  placeholder="e.g., 90"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold">Active</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                HTML Content
              </label>
              <textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className="w-full px-3 py-2 border border-black/25 text-sm font-mono"
                rows={6}
                placeholder="Paste HTML content here..."
                required
              />
              <p className="text-xs text-neutral-500 mt-2">
                Or use templates:
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      content: MOCK_AD_CONTENT.standard,
                      width: "100",
                      height: "100",
                    })
                  }
                  className="ml-2 px-2 py-1 bg-neutral-200 hover:bg-neutral-300 text-xs"
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      content: MOCK_AD_CONTENT.square,
                      width: "250",
                      height: "250",
                    })
                  }
                  className="ml-1 px-2 py-1 bg-neutral-200 hover:bg-neutral-300 text-xs"
                >
                  Square (250x250)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      content: MOCK_AD_CONTENT.wide,
                      width: "728",
                      height: "90",
                    })
                  }
                  className="ml-1 px-2 py-1 bg-neutral-200 hover:bg-neutral-300 text-xs"
                >
                  Leaderboard (728x90)
                </button>
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setFormVisible(false);
                }}
                className="px-4 py-2 border border-black text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-black text-white hover:bg-neutral-800 text-sm font-semibold"
              >
                {editingId ? "Update Ad" : "Create Ad"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : ads.length === 0 ? (
        <div className="bg-white border border-black/15 p-6 text-center text-neutral-500">
          No ads created yet. Click "Add New Ad" to get started.
        </div>
      ) : (
        <div className="space-y-4">
          {ads.map((ad) => (
            <div key={ad.id} className="bg-white border border-black/15 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-lg">{ad.displayName}</h3>
                    <span className="text-xs px-2 py-1 bg-neutral-100 rounded">
                      {ad.placement}
                    </span>
                    {!ad.isActive && (
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mb-3">
                    {ad.width && ad.height
                      ? `${ad.width}x${ad.height}px`
                      : "Responsive"}
                  </p>
                  <div className="bg-neutral-50 p-3 rounded border border-black/10 max-w-md mb-3">
                    <div dangerouslySetInnerHTML={{ __html: ad.content }} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggle(ad.id)}
                    className={`px-3 py-1 text-xs font-semibold ${
                      ad.isActive
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {ad.isActive ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => handleEdit(ad)}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(ad.id)}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
