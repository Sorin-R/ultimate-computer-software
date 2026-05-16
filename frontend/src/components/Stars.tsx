import { useState } from "react";
import { useTheme } from "../context/ThemeContext";

interface StarsProps {
  /** Current rating value (can be fractional, e.g. 4.3). 0–5 range. */
  value: number;
  /** Visual size in px (height/width of each star). Defaults to 18. */
  size?: number;
  /** Optional accessible label. */
  ariaLabel?: string;
  /** Optional CSS class on the wrapper. */
  className?: string;
}

interface InteractiveStarsProps {
  /** Currently selected rating, 0 = none. */
  value: number;
  /** Called when the user picks a rating (1–5). */
  onChange: (next: number) => void;
  size?: number;
  /** Visual size in px. Defaults to 28. */
  disabled?: boolean;
  className?: string;
}

/**
 * A single star path. Filled portion is controlled by a clip-path width.
 * Black-and-white: filled stars are solid black, empty stars are an outline.
 * In dark mode, colors are inverted to light.
 */
function StarSvg({
  fillRatio,
  size,
}: {
  fillRatio: number; // 0..1
  size: number;
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const starColor = isDark ? "#f5f5f5" : "#111111";

  // We render two overlaid stars: an outlined "empty" star, and a clipped
  // filled star on top whose width = fillRatio.
  const clipWidth = Math.max(0, Math.min(1, fillRatio)) * 100;
  const path =
    "M12 2.5l2.92 6.18 6.58.62-4.96 4.55 1.45 6.65L12 17.27l-6 3.23 1.45-6.65L2.5 9.3l6.58-.62L12 2.5z";

  return (
    <span
      style={{ width: size, height: size }}
      className="relative inline-block shrink-0"
      aria-hidden="true"
    >
      {/* Outlined empty star */}
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="absolute inset-0"
      >
        <path
          d={path}
          fill="none"
          stroke={starColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {/* Filled portion, clipped horizontally */}
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${clipWidth}%` }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className="block"
          preserveAspectRatio="xMinYMid meet"
        >
          <path d={path} fill={starColor} />
        </svg>
      </span>
    </span>
  );
}

/**
 * Read-only stars (used next to author + on each review).
 * Supports fractional values for the average rating.
 */
export function Stars({ value, size = 18, ariaLabel, className }: StarsProps) {
  const clamped = Math.max(0, Math.min(5, value));
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className ?? ""}`}
      role="img"
      aria-label={ariaLabel ?? `Rated ${clamped.toFixed(1)} out of 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <StarSvg key={i} size={size} fillRatio={Math.max(0, Math.min(1, clamped - i))} />
      ))}
    </span>
  );
}

/**
 * Interactive star picker (used in the rating form). Hover preview, click to
 * commit. Keyboard-accessible via the underlying buttons.
 */
export function InteractiveStars({
  value,
  onChange,
  size = 28,
  disabled,
  className,
}: InteractiveStarsProps) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div
      className={`inline-flex items-center gap-1 ${className ?? ""}`}
      onMouseLeave={() => setHover(0)}
      role="radiogroup"
      aria-label="Your rating"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onFocus={() => setHover(star)}
          onBlur={() => setHover(0)}
          aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
          aria-checked={value === star}
          role="radio"
          className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b5121b] disabled:cursor-not-allowed disabled:opacity-50 transition-transform hover:scale-110"
        >
          <StarSvg size={size} fillRatio={star <= display ? 1 : 0} />
        </button>
      ))}
    </div>
  );
}
