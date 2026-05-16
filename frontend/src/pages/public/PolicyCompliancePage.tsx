import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";

interface Entry {
  id: string;
  actionType: string;
  publicReason: string;
  status: string;
  createdAt: string;
}

export default function PolicyCompliancePage() {
  const { id } = useParams<{ id: string }>();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [authorName, setAuthorName] = useState<string>("Author");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.get(`/users/${id}/policy-compliance`), api.get(`/users/${id}/profile`)])
      .then(([policyRes, profileRes]) => {
        setEntries(policyRes.data.entries || []);
        setAuthorName(profileRes.data?.author?.name || "Author");
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (notFound) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Profile Not Found</h1>
        <Link to="/" className="text-[#b5121b] hover:underline">Back to home</Link>
      </main>
    );
  }

  return (
    <>
      <SEOHead
        title={`${authorName} Policy Compliance`}
        description={`Public policy compliance log for ${authorName}.`}
        path={id ? `/author/${id}/policy-compliance` : undefined}
      />
      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-2">Policy Compliance</h1>
        <p className="text-neutral-600 mb-6">Public moderation and policy actions for {authorName}.</p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-neutral-500">No public policy actions recorded.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <article key={entry.id} className="bg-white border border-black/15 p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-semibold text-neutral-900">{entry.actionType.replace(/_/g, " ")}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                    {entry.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-sm text-neutral-700 mt-2">{entry.publicReason}</p>
                <p className="text-xs text-neutral-500 mt-2">{new Date(entry.createdAt).toLocaleDateString()}</p>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
