import { useMemo } from "react";

/**
 * CreatorAvatar — round avatar showing the user's image if any, otherwise
 * stable colour-hashed initials. Same hue function as ArticleComments so a
 * given user gets the same colour everywhere.
 */
interface Props {
  name: string;
  avatarUrl?: string | null;
  size?: number; // pixels
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function CreatorAvatar({ name, avatarUrl, size = 40, className = "" }: Props) {
  const hue = useMemo(() => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }, [name]);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: `hsl(${hue} 55% 45%)`,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
