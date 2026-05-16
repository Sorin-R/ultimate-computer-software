/**
 * K3: AMA Banner — shown on the homepage when there are active AMA threads.
 * Displays up to 3 active AMAs with a countdown and link to the article.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

interface AmaItem {
  id: string;
  title: string;
  slug: string;
  authorName: string;
  amaExpiresAt: string | null;
  isPinnedToHome: boolean;
  commentCount: number;
  user: { id: string; name: string; isVerified: boolean };
  category: { name: string; slug: string };
}

function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return "Open-ended";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)}d left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export default function AmaBanner() {
  const [amas, setAmas] = useState<AmaItem[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    api
      .get("/articles/amas")
      .then((res) => setAmas(res.data.amas ?? []))
      .catch(() => {});
  }, []);

  // Update countdown every minute
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (amas.length === 0) return null;

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="animate-pulse inline-block w-2 h-2 bg-amber-500 rounded-full" />
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-amber-700">
          Live AMA{amas.length > 1 ? "s" : ""}
        </span>
        <span className="text-xs text-amber-600">— Ask your questions now</span>
      </div>
      <ul className="space-y-3">
        {amas.slice(0, 3).map((ama) => (
          <li key={ama.id} className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                {ama.isPinnedToHome && (
                  <span className="text-[10px] uppercase tracking-wide bg-amber-200 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                    📌 Pinned
                  </span>
                )}
                {ama.user.isVerified && (
                  <span className="text-[10px] text-amber-700 font-semibold">✓ Verified</span>
                )}
                <span className="text-xs text-amber-600">{ama.commentCount} questions</span>
              </div>
              <Link
                to={`/${ama.slug}`}
                className="font-bold text-neutral-900 hover:text-amber-800 leading-snug block"
              >
                {ama.title}
              </Link>
              <p className="text-xs text-neutral-500 mt-0.5">
                by <strong>{ama.user.name}</strong>
                {ama.amaExpiresAt && (
                  <> · <span className="text-amber-700 font-medium">{timeLeft(ama.amaExpiresAt)}</span></>
                )}
              </p>
            </div>
            <Link
              to={`/${ama.slug}#comments`}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 rounded transition-colors"
            >
              Ask a question →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
