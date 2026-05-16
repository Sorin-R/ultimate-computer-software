import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import api from "../../api/client";
import SEOHead from "../../components/SEOHead";
import ArticleCard from "../../components/ArticleCard";
import TagFollowButton from "../../components/TagFollowButton";
import type { ArticleAudioStatus } from "../../utils/articleAudio";
import { absoluteSiteUrl } from "../../utils/site";

interface TagDetail {
  id: string;
  name: string;
  slug: string;
  // M1: Optional editorial description for SEO and archive page display
  description?: string | null;
  category: { name: string; slug: string } | null;
  followCount: number;
  articleCount: number;
  isFollowing: boolean;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  imageUrl: string | null;
  audioUrl?: string | null;
  audioStatus?: ArticleAudioStatus | string | null;
  publishedAt: string | null;
  category: { name: string; slug: string };
  tags?: { tag: { name: string; slug: string } }[];
}

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tag, setTag] = useState<TagDetail | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    api
      .get(`/tags/${slug}`, { params: { page, limit: 18 } })
      .then((res) => {
        setTag(res.data.tag);
        setArticles(res.data.articles);
        setTotalPages(res.data.totalPages);
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug, page]);

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">Tag Not Found</h1>
        <Link to="/tags" className="text-[#b5121b] hover:underline">
          Browse all tags →
        </Link>
      </div>
    );
  }

  const tagUrl = absoluteSiteUrl(`/tag/${slug}`);

  // M1: Use the editorial description when available, otherwise generate a default.
  const tagDescription = tag
    ? (tag.description || `Browse all technology articles tagged #${tag.name}.`)
    : undefined;

  // JSON-LD CollectionPage schema for the tag
  const tagSchema = tag
    ? {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `#${tag.name} — Ultimate Computer Software`,
        description: tagDescription,
        url: tagUrl,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: absoluteSiteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Tags", item: absoluteSiteUrl("/tags") },
            { "@type": "ListItem", position: 3, name: `#${tag.name}`, item: tagUrl },
          ],
        },
      }
    : null;

  return (
    <>
      <SEOHead
        title={tag ? `#${tag.name} Articles` : "Tag"}
        description={tagDescription}
        path={`/tag/${slug}`}
      />
      {tag && (
        <Helmet>
          {/* M6: Clean canonical URL (no ?page=N) so paginated pages don't split authority */}
          <link rel="canonical" href={tagUrl} />
          {tagSchema && (
            <script type="application/ld+json">{JSON.stringify(tagSchema)}</script>
          )}
          {/* L4: ItemList schema for visible articles improves rich result eligibility */}
          {articles.length > 0 && (
            <script type="application/ld+json">{JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              itemListElement: articles.slice(0, 10).map((article, index) => ({
                "@type": "ListItem",
                position: index + 1,
                url: absoluteSiteUrl(`/${article.slug}`),
                name: article.title,
              })),
            })}</script>
          )}
          <link
            rel="alternate"
            type="application/rss+xml"
            title={`#${tag.name} RSS Feed`}
            href={`/rss/tag/${encodeURIComponent(tag.slug)}.xml`}
          />
        </Helmet>
      )}

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <nav className="text-xs text-neutral-500 mb-6 flex items-center gap-1.5" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-neutral-800">Home</Link>
          <span>/</span>
          <Link to="/tags" className="hover:text-neutral-800">Tags</Link>
          <span>/</span>
          <span className="text-neutral-800 font-semibold">#{tag?.name ?? slug}</span>
        </nav>

        <div className="mb-8 border-b border-black/15 pb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold [font-family:Georgia,'Times_New_Roman',serif]">
              #{tag?.name ?? slug}
            </h1>
            {tag?.category && (
              <Link
                to={`/category/${tag.category.slug}`}
                className="mt-2 inline-block text-sm text-neutral-500 hover:underline"
              >
                in {tag.category.name}
              </Link>
            )}
            {/* M1: Show editorial tag description when available */}
            {tag?.description && (
              <p className="text-neutral-600 mt-2 max-w-xl">{tag.description}</p>
            )}
            {tag && (
              <p className="text-sm text-neutral-500 mt-1">
                {tag.articleCount} article{tag.articleCount !== 1 ? "s" : ""} ·{" "}
                {tag.followCount} follower{tag.followCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {tag && (
            <TagFollowButton
              tagSlug={tag.slug}
              tagName={tag.name}
              initialFollowing={tag.isFollowing}
              followCount={tag.followCount}
            />
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
          </div>
        ) : articles.length === 0 ? (
          <p className="text-center py-16 text-neutral-500">No articles with this tag yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  title={article.title}
                  slug={article.slug}
                  excerpt={article.excerpt}
                  authorName={article.authorName}
                  publishedAt={article.publishedAt}
                  imageUrl={article.imageUrl}
                  audioUrl={article.audioUrl}
                  audioStatus={article.audioStatus}
                  category={{ name: article.category.name, slug: article.category.slug }}
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-black text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-neutral-600 text-sm">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-black text-sm font-semibold uppercase tracking-[0.08em] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
