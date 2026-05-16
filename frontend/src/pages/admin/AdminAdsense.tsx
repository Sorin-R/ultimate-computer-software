import { useEffect, useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

interface Ad {
  id: string;
  placement: string;
  deviceTarget: "ALL" | "DESKTOP" | "MOBILE";
  displayName: string;
  content: string;
  width?: number;
  height?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const MOCK_AD_TEMPLATES = {
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

export default function AdminAdsense() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [hoveredPreviewId, setHoveredPreviewId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    placement: "homepage_1",
    deviceTarget: "ALL" as "ALL" | "DESKTOP" | "MOBILE",
    displayName: "",
    content: "",
    width: "",
    height: "",
    isActive: true,
  });

  const placements: Array<{ value: string; label: string }> = [
    { value: "home-top", label: "Home-Top" },
    { value: "homepage_1", label: "Homepage-1" },
    { value: "homepage_2", label: "Homepage-2" },
    { value: "homepage_3", label: "Homepage-3" },
    { value: "homepage_4", label: "Homepage-4" },
    { value: "article", label: "Article" },
    { value: "category_1", label: "Category-1" },
    { value: "category_2", label: "Category-2" },
    { value: "dashboard", label: "Dashboard" },
    { value: "dashboard_sidebar", label: "Dashboard Sidebar" },
    { value: "related_articles_1", label: "Related Articles 1" },
    { value: "related_articles_2", label: "Related Articles 2" },
    { value: "related_articles_3", label: "Related Articles 3" },
  ];
  const deviceTargets: Array<{ value: "ALL" | "DESKTOP" | "MOBILE"; label: string }> = [
    { value: "ALL", label: "All Devices" },
    { value: "DESKTOP", label: "Desktop Only" },
    { value: "MOBILE", label: "Mobile Only" },
  ];
  const placementLabelByValue = new Map(placements.map((item) => [item.value, item.label]));
  const deviceTargetLabelByValue = new Map(deviceTargets.map((item) => [item.value, item.label]));

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      setLoading(true);
      const res = await api.get("/config/admin/ads");
      setAds(res.data.ads);
      setError("");
    } catch (err) {
      setError("Failed to load ads");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.displayName.trim() || !formData.content.trim()) {
      setError("Display name and content are required");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await api.put(`/config/admin/ads/${editingId}`, formData);
        setSuccess("Ad updated successfully");
      } else {
        await api.post("/config/admin/ads", formData);
        setSuccess("Ad created successfully");
      }

      resetForm();
      await fetchAds();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save ad");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ad: Ad) => {
    setFormData({
      placement: ad.placement,
      deviceTarget: ad.deviceTarget ?? "ALL",
      displayName: ad.displayName,
      content: ad.content,
      width: ad.width?.toString() || "",
      height: ad.height?.toString() || "",
      isActive: ad.isActive,
    });
    setEditingId(ad.id);
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this ad permanently?")) return;

    try {
      setError("");
      await api.delete(`/config/admin/ads/${id}`);
      setSuccess("Ad deleted successfully");
      await fetchAds();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete ad");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      setError("");
      await api.put(`/config/admin/ads/${id}/toggle`);
      setSuccess("Ad status updated");
      await fetchAds();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to toggle ad");
    }
  };

  const resetForm = () => {
    setFormData({
      placement: "homepage_1",
      deviceTarget: "ALL",
      displayName: "",
      content: "",
      width: "",
      height: "",
      isActive: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <>
      <SEOHead title="Manage Ads" path="/admin/adsense" noindex />

      <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-6">
        Google AdSense (Mock) Management
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded">
          {success}
        </div>
      )}

      {showForm && (
        <div className="mb-8 bg-white border border-black/15 p-6">
          <h2 className="text-2xl font-bold mb-6">
            {editingId ? "Edit Ad" : "Create New Ad"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-2">
                  Placement *
                </label>
                <select
                  value={formData.placement}
                  onChange={(e) =>
                    setFormData({ ...formData, placement: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-black/15 rounded"
                  required
                >
                  {placements.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Device Target *
                </label>
                <select
                  value={formData.deviceTarget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deviceTarget: e.target.value as "ALL" | "DESKTOP" | "MOBILE",
                    })
                  }
                  className="w-full px-3 py-2 border border-black/15 rounded"
                  required
                >
                  {deviceTargets.map((target) => (
                    <option key={target.value} value={target.value}>
                      {target.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">
                  Display Name *
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      displayName: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-black/15 rounded"
                  placeholder="e.g., Homepage Banner"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
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
                  className="w-full px-3 py-2 border border-black/15 rounded"
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
                  className="w-full px-3 py-2 border border-black/15 rounded"
                  placeholder="e.g., 90"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer w-full">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        isActive: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold">Active</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">
                HTML Content *
              </label>
              <textarea
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                className="w-full px-3 py-2 border border-black/15 rounded font-mono text-xs h-40"
                placeholder="Paste ad HTML here..."
                required
              />
              <div className="text-xs text-neutral-500 mt-2 space-x-1">
                <span>Quick templates:</span>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      content: MOCK_AD_TEMPLATES.standard,
                    })
                  }
                  className="px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded"
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      content: MOCK_AD_TEMPLATES.square,
                      width: "250",
                      height: "250",
                    })
                  }
                  className="px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded"
                >
                  Square
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      content: MOCK_AD_TEMPLATES.wide,
                      width: "728",
                      height: "90",
                    })
                  }
                  className="px-2 py-1 bg-neutral-200 hover:bg-neutral-300 rounded"
                >
                  Leaderboard
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 font-semibold uppercase"
              >
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-black hover:bg-black hover:text-white font-semibold uppercase"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 px-4 py-2 bg-black text-white hover:bg-neutral-800 font-semibold uppercase"
        >
          Add New Ad
        </button>
      )}

      <div>
        <h2 className="text-xl font-bold mb-4">
          {ads.length ? `Ads (${ads.length})` : "No ads yet"}
        </h2>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
          </div>
        ) : ads.length === 0 ? (
          <p className="text-neutral-500 text-center py-8">
            No ads created. Click "Add New Ad" to get started.
          </p>
        ) : (
          <div className="space-y-4">
            {ads.map((ad) => {
              const previewMaxWidth = 420;
              const adWidth = ad.width && ad.width > 0 ? ad.width : 0;
              const adHeight = ad.height && ad.height > 0 ? ad.height : 0;
              const hasFixedSize = adWidth > 0 && adHeight > 0;
              const previewScale = hasFixedSize ? Math.min(1, previewMaxWidth / adWidth) : 1;
              const scaledWidth = hasFixedSize ? Math.max(1, Math.round(adWidth * previewScale)) : 0;
              const scaledHeight = hasFixedSize ? Math.max(1, Math.round(adHeight * previewScale)) : 0;

              return (
                <div key={ad.id} className="bg-white border border-black/15 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-lg">
                          {ad.displayName}
                        </h3>
                        <span className="text-xs px-2 py-1 bg-neutral-100 rounded">
                          {placementLabelByValue.get(ad.placement) ?? ad.placement}
                        </span>
                        <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                          {deviceTargetLabelByValue.get(ad.deviceTarget) ?? ad.deviceTarget}
                        </span>
                        {!ad.isActive && (
                          <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mb-3">
                        {ad.width && ad.height
                          ? `${ad.width}×${ad.height}px`
                          : "Responsive"}
                      </p>
                      <div
                        className="relative mb-3"
                        onMouseEnter={() => setHoveredPreviewId(ad.id)}
                        onMouseLeave={() => setHoveredPreviewId((prev) => (prev === ad.id ? null : prev))}
                      >
                        <div className="bg-neutral-50 p-3 rounded border border-black/10 overflow-hidden">
                          <div className="w-full flex justify-center overflow-hidden">
                            {hasFixedSize ? (
                              <div
                                style={{
                                  width: `${scaledWidth}px`,
                                  height: `${scaledHeight}px`,
                                  maxWidth: "100%",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: ad.content,
                                  }}
                                  style={{
                                    width: `${adWidth}px`,
                                    height: `${adHeight}px`,
                                    transform: `scale(${previewScale})`,
                                    transformOrigin: "top left",
                                  }}
                                />
                              </div>
                            ) : (
                              <div
                                className="w-full max-w-[420px] overflow-hidden"
                                dangerouslySetInnerHTML={{
                                  __html: ad.content,
                                }}
                              />
                            )}
                          </div>
                        </div>
                        {hoveredPreviewId === ad.id && (
                          <div className="absolute left-1/2 top-full z-40 mt-2 w-max max-w-[90vw] -translate-x-1/2 rounded border border-black/20 bg-white p-3 shadow-2xl">
                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                              Full Size Preview
                            </p>
                            <div className="max-h-[70vh] max-w-[90vw] overflow-auto">
                              <div
                                dangerouslySetInnerHTML={{ __html: ad.content }}
                                style={{
                                  width: hasFixedSize ? `${adWidth}px` : "970px",
                                  height: hasFixedSize ? `${adHeight}px` : "auto",
                                  maxWidth: "90vw",
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
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
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
