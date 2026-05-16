/**
 * Tiny inline badge rendered next to a creator's name when their follower
 * count crosses one of the thresholds defined on the backend (C5):
 *   - tier="verified" (10+ followers) → blue check
 *   - tier="top"      (100+ followers) → red star
 *
 * Pure presentational component — pass null/undefined to render nothing.
 */
interface Props {
  tier: "verified" | "top" | null | undefined;
  size?: number; // pixel height
  className?: string;
}

export default function VerifiedBadge({ tier, size = 14, className = "" }: Props) {
  if (!tier) return null;

  if (tier === "top") {
    return (
      <span
        title="Top Creator (100+ followers)"
        className={`inline-flex items-center text-[#b5121b] ${className}`}
        style={{ width: size, height: size }}
        aria-label="Top creator"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </span>
    );
  }

  // verified
  return (
    <span
      title="Verified Creator (10+ followers)"
      className={`inline-flex items-center text-[#1d4ed8] ${className}`}
      style={{ width: size, height: size }}
      aria-label="Verified creator"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
        <path d="M12 2l2.39 2.45 3.42-.32.32 3.42L20.55 9.6 18.13 12l2.42 2.4-2.42 2.42-.32 3.42-3.42-.32L12 22l-2.39-2.45-3.42.32-.32-3.42L3.45 14.4 5.87 12 3.45 9.6l2.42-2.42.32-3.42 3.42.32L12 2zm-1.1 13.4l5.95-5.95-1.41-1.41-4.54 4.54-2.13-2.12-1.41 1.41 3.54 3.53z" />
      </svg>
    </span>
  );
}
