import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import { absoluteSiteUrl } from "../../utils/site";

interface ReferralRow {
  id: string;
  status: string;
  createdAt: string;
  rewardedAt: string | null;
  referredUser: { id: string; name: string; createdAt: string };
}

interface ReferralResponse {
  referralCode: string;
  referralCount: number;
  badge: {
    key: string;
    label: string;
    earned: boolean;
    awardedAt: string | null;
  };
  referrals: ReferralRow[];
}

export default function ReferralPage() {
  const [data, setData] = useState<ReferralResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/me/referrals")
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const referralLink = useMemo(() => {
    if (!data?.referralCode) return "";
    return absoluteSiteUrl(`/register?ref=${encodeURIComponent(data.referralCode)}`);
  }, [data?.referralCode]);

  const copyLink = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    alert("Referral link copied");
  };

  return (
    <>
      <SEOHead title="Referrals" path="/dashboard/referrals" />
      <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] mb-6">Referrals</h1>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
        </div>
      ) : !data ? (
        <p className="text-neutral-500">Unable to load referral details.</p>
      ) : (
        <div className="space-y-5">
          <section className="bg-white border border-black/15 p-5">
            <p className="text-xs uppercase tracking-[0.08em] text-neutral-500 mb-2">Your referral code</p>
            <p className="text-xl font-bold text-neutral-900 mb-3">{data.referralCode}</p>
            <p className="text-xs uppercase tracking-[0.08em] text-neutral-500 mb-2">Referral link</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={referralLink}
                readOnly
                className="flex-1 px-3 py-2 border border-black/20 bg-neutral-50 text-sm"
              />
              <button
                onClick={copyLink}
                className="px-4 py-2 bg-black text-white text-xs font-semibold uppercase tracking-[0.08em] hover:bg-neutral-800"
              >
                Copy
              </button>
            </div>
          </section>

          <section className="bg-white border border-black/15 p-5">
            <p className="text-sm text-neutral-700">
              Successful referrals: <strong>{data.referralCount}</strong>
            </p>
            <p className="text-sm text-neutral-700 mt-1">
              Badge: <strong>{data.badge.label}</strong> ({data.badge.earned ? "Awarded" : "Not awarded"})
            </p>
            {data.badge.awardedAt && (
              <p className="text-xs text-neutral-500 mt-1">Awarded at {new Date(data.badge.awardedAt).toLocaleString()}</p>
            )}
          </section>

          <section className="bg-white border border-black/15 p-5">
            <h2 className="text-lg font-semibold mb-3">Referred Users</h2>
            {data.referrals.length === 0 ? (
              <p className="text-sm text-neutral-500">No referrals yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.referrals.map((row) => (
                  <li key={row.id} className="text-sm text-neutral-700 border-b border-black/10 pb-2">
                    {row.referredUser.name} • {row.status} • Joined {new Date(row.createdAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
