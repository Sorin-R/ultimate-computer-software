import { Headphones } from "lucide-react";

type ArticleListenBadgeProps = {
  size?: "sm" | "md";
  className?: string;
};

export default function ArticleListenBadge({
  size = "md",
  className = "",
}: ArticleListenBadgeProps) {
  const compact = size === "sm";

  return (
    <span
      className={[
        "pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-black/75 font-semibold text-white shadow-sm backdrop-blur-sm",
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1.5 text-xs",
        className,
      ].join(" ")}
      aria-hidden="true"
    >
      <Headphones
        aria-hidden="true"
        className={compact ? "h-3 w-3" : "h-3.5 w-3.5"}
        strokeWidth={2.25}
      />
      <span>Listen</span>
    </span>
  );
}
