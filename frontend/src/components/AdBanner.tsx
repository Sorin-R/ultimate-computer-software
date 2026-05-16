import { useEffect, useState } from "react";

interface Ad {
  id: string;
  placement: string;
  deviceTarget?: "ALL" | "DESKTOP" | "MOBILE";
  displayName: string;
  content: string;
  width?: number;
  height?: number;
  isActive: boolean;
}

interface AdBannerProps {
  placement:
    | "home-top"
    | "homepage_1"
    | "homepage_2"
    | "homepage_3"
    | "homepage_4"
    | "article"
    | "category_1"
    | "category_2"
    | "dashboard"
    | "dashboard_sidebar"
    | "related_articles_1"
    | "related_articles_2"
    | "related_articles_3";
  className?: string;
  variant?: "default" | "card" | "flat";
}

const PLACEMENT_FALLBACKS: Record<string, string[]> = {
  "home-top": ["home-top"],
  homepage_1: ["homepage_1"],
  homepage_2: ["homepage_2"],
  homepage_3: ["homepage_3"],
  homepage_4: ["homepage_4"],
  dashboard_sidebar: ["dashboard_sidebar"],
};

export default function AdBanner({
  placement,
  className = "",
  variant = "default",
}: AdBannerProps) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [device, setDevice] = useState<"mobile" | "desktop">("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateDevice = () => {
      setDevice(mediaQuery.matches ? "mobile" : "desktop");
    };
    updateDevice();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateDevice);
      return () => mediaQuery.removeEventListener("change", updateDevice);
    }

    mediaQuery.addListener(updateDevice);
    return () => mediaQuery.removeListener(updateDevice);
  }, []);

  useEffect(() => {
    const fetchAds = async () => {
      try {
        const response = await fetch(`/api/config/adsense?device=${device}`);
        if (!response.ok) return;
        const data = await response.json();
        const placementCandidates = PLACEMENT_FALLBACKS[placement] ?? [placement];
        const placementsSet = new Set(placementCandidates);
        const candidates =
          (data.ads as Ad[] | undefined)?.filter((a) => placementsSet.has(a.placement)) ?? [];
        const preferredTarget = device === "mobile" ? "MOBILE" : "DESKTOP";
        const foundAd =
          candidates.find((candidate) => candidate.deviceTarget === preferredTarget) ||
          candidates.find((candidate) => candidate.deviceTarget === "ALL") ||
          null;
        setAd(foundAd);
      } catch {
        // Silently fail — missing ad should never break layout
        setAd(null);
      }
    };

    fetchAds();
  }, [placement, device]);

  if (!ad) return null;

  // C3: Always reserve space so the layout below the ad slot never shifts
  // when the ad appears or fails to load. `contain: "layout"` prevents the
  // ad's children from affecting the paint outside this box.
  return (
    <div
      style={{
        minHeight: variant === "card" ? (ad ? 260 : 0) : variant === "flat" ? 0 : 90,
        contain: "layout",
      }}
      className={className}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          margin: variant === "card" || variant === "flat" ? "0" : "20px 0",
          minHeight: variant === "card" ? 260 : undefined,
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: ad.content }}
          style={{
            display: "inline-block",
            width: ad.width ? `${ad.width}px` : "auto",
            height: ad.height ? `${ad.height}px` : "auto",
            maxWidth: "100%",
          }}
        />
      </div>
    </div>
  );
}
