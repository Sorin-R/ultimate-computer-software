import { Link } from "react-router-dom";
import { cleanExcerptText } from "../utils/contentText";
import { hasReadyAudio, type ArticleAudioStatus } from "../utils/articleAudio";
import { getImageUrl } from "../utils/imageUrl";
import ArticleListenBadge from "./ArticleListenBadge";
import { Stars } from "./Stars";

interface ArticleCardProps {
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  publishedAt: string | null;
  imageUrl: string | null;
  audioUrl?: string | null;
  audioStatus?: ArticleAudioStatus | string | null;
  category?: { name: string; slug: string };
  rating?: { average: number; count: number };
  views?: { totalViews: number; uniqueViews?: number };
}

export default function ArticleCard({
  title,
  slug,
  excerpt,
  authorName,
  publishedAt,
  imageUrl,
  audioUrl,
  audioStatus,
  category,
  rating,
  views,
}: ArticleCardProps) {
  const cleanExcerpt = cleanExcerptText(excerpt);

  return (
    <article className="bg-white border border-black/15 overflow-hidden hover:border-black/35 transition-colors flex flex-col h-full">
      {imageUrl && (
        <Link
          to={`/${slug}`}
          className="relative block w-full overflow-hidden bg-neutral-200"
          style={{ aspectRatio: "16/9" }}
          aria-label={title}
        >
          {hasReadyAudio({ audioUrl, audioStatus }) && <ArticleListenBadge />}
          <img
            src={getImageUrl(imageUrl) || imageUrl}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </Link>
      )}
      <div className="p-5 flex flex-col flex-grow">
        {category && (
          <Link
            to={`/category/${category.slug}`}
            className="text-[11px] font-bold text-[#b5121b] uppercase tracking-[0.12em]"
          >
            {category.name}
          </Link>
        )}
        <h2 className="mt-2 mb-3">
          <Link
            to={`/${slug}`}
            className="text-xl font-bold leading-tight text-neutral-900 hover:text-[#b5121b] [font-family:Georgia,'Times_New_Roman',serif] line-clamp-2"
          >
            {title}
          </Link>
        </h2>
        {cleanExcerpt && (
          <p className="text-neutral-700 text-sm mb-4 line-clamp-3 flex-grow">{cleanExcerpt}</p>
        )}

        {/* Rating and Reads Row */}
        {(rating || views) && (
          <div className="flex items-center gap-4 text-xs text-neutral-500 border-t border-black/10 pt-3 mb-3">
            {rating && (
              <div className="flex items-center gap-1">
                <Stars value={rating.average} size={14} />
                <span className="font-semibold text-neutral-700">
                  {rating.average.toFixed(1)} ({rating.count})
                </span>
              </div>
            )}
            {views && (
              <div className="text-neutral-500">
                {views.totalViews.toLocaleString()} reads
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-neutral-500 border-t border-black/10 pt-3 mt-auto">
          <span className="uppercase tracking-[0.05em]">{authorName}</span>
          {publishedAt && (
            <time dateTime={publishedAt}>
              {new Date(publishedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </time>
          )}
        </div>
      </div>
    </article>
  );
}
