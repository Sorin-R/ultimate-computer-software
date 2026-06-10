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
  imageSourceUrl?: string | null;
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
  imageSourceUrl,
  audioUrl,
  audioStatus,
  category,
  rating,
}: ArticleCardProps) {
  const cleanExcerpt = cleanExcerptText(excerpt);

  return (
    <article className="bg-white border border-black/15 overflow-hidden hover:border-black/35 transition-colors flex flex-col h-full">
      {imageUrl && (
        <>
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
          {imageSourceUrl && (
            <a
              href={imageSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="-mt-6 relative z-10 block text-right px-3 pb-1 text-[10px] text-neutral-500 hover:text-neutral-800"
            >
              Source: {imageSourceUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "")}
            </a>
          )}
        </>
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
            className="text-lg font-bold leading-snug line-clamp-2"
          >
            {title}
          </Link>
        </h2>
        {cleanExcerpt && (
          <p className="text-sm text-neutral-600 leading-relaxed line-clamp-2 mb-4 flex-grow">
            {cleanExcerpt}
          </p>
        )}
        <div className="flex items-center justify-between mt-auto">
          <div className="text-xs text-neutral-500">
            <span>{authorName}</span>
            {publishedAt && (
              <>
                <span className="mx-1.5">·</span>
                <time dateTime={publishedAt}>
                  {new Date(publishedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
              </>
            )}
          </div>
          {rating && rating.count > 0 && (
            <Stars value={rating.average} />
          )}
        </div>
      </div>
    </article>
  );
}
