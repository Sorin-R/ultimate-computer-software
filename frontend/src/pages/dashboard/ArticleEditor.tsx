import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ReactQuill, { Quill } from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import api from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import SEOHead from "../../components/SEOHead";
import { getImageUrl as resolveImageUrl } from "../../utils/imageUrl";
import { AxiosError } from "axios";

interface Category {
  id: string;
  name: string;
  slug: string;
  status?: "ACTIVE" | "PENDING";
}

interface Tag {
  id: string;
  name: string;
  slug: string;
  categoryId?: string | null;
}

interface TagApiError {
  error?: string;
  tag?: Tag;
}

interface ArticleVersion {
  id: string;
  version: number;
  title: string;
  excerpt: string | null;
  createdAt: string;
}

interface Series {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  members: { id: string; articleId: string; position: number; article: { id: string; title: string; slug: string; status: string } }[];
}

// ─── C7: Article Templates ────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "blank",
    label: "Blank",
    title: "",
    body: "<p></p>",
  },
  {
    id: "news",
    label: "📰 News Post",
    title: "",
    body: `<h2>Overview</h2>
<p>Write a brief overview of the news story here.</p>
<h2>Details</h2>
<p>Expand on the details — what happened, when, and why it matters.</p>
<h2>Industry Impact</h2>
<p>Explain how this news affects the technology industry or the reader.</p>
<h2>What's Next</h2>
<p>Describe what to expect going forward.</p>`,
  },
  {
    id: "tutorial",
    label: "🛠️ Tutorial",
    title: "",
    body: `<h2>Introduction</h2>
<p>Briefly explain what this tutorial covers and who it is for.</p>
<h2>Prerequisites</h2>
<ul>
  <li>Item one</li>
  <li>Item two</li>
</ul>
<h2>Step 1: Getting Started</h2>
<p>Describe step one here.</p>
<pre><code>// Example code here</code></pre>
<h2>Step 2: Next Step</h2>
<p>Describe step two here.</p>
<h2>Conclusion</h2>
<p>Summarise what was learned and point to further resources.</p>`,
  },
  {
    id: "opinion",
    label: "💬 Opinion",
    title: "",
    body: `<h2>The Argument</h2>
<p>State your main argument or point of view clearly.</p>
<h2>The Evidence</h2>
<p>Provide evidence or reasoning to support your position.</p>
<h2>Counter-Arguments</h2>
<p>Acknowledge opposing viewpoints and explain why you disagree.</p>
<h2>Conclusion</h2>
<p>Summarise your position and what you think should happen next.</p>`,
  },
  {
    id: "interview",
    label: "🎤 Interview",
    title: "",
    body: `<h2>About the Guest</h2>
<p>Introduce the person being interviewed and their background.</p>
<h2>Q: [First Question]</h2>
<p><strong>A:</strong> [Answer here]</p>
<h2>Q: [Second Question]</h2>
<p><strong>A:</strong> [Answer here]</p>
<h2>Q: [Third Question]</h2>
<p><strong>A:</strong> [Answer here]</p>
<h2>Closing Thoughts</h2>
<p>Final remarks from the guest or your own summary.</p>`,
  },
];

const quillToolbarContainer = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ script: "sub" }, { script: "super" }],
  [{ color: [] }, { background: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ indent: "-1" }, { indent: "+1" }, { align: [] }],
  [{ direction: "rtl" }],
  ["link", "image", "video", "blockquote", "code-block", "code"],
  ["clean"],
];

const quillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "script",
  "color",
  "background",
  "list",
  "indent",
  "align",
  "direction",
  "link",
  "image",
  "video",
  "blockquote",
  "code-block",
  "code",
  "tableEmbed",
];

// ─── Table support ────────────────────────────────────────────────────────────
// react-quill-new (Quill 2) ships no table blot, so it silently strips <table>
// markup when HTML is loaded into the editor and writes the table-less version
// back into React state. We register a read-only block embed that holds each
// table as a single atomic unit, plus a clipboard matcher so tables survive the
// HTML → Delta → HTML round trip at their original position. The wrapper is
// stripped again on save (see handleSubmit) so stored HTML stays clean.
/* eslint-disable @typescript-eslint/no-explicit-any */
const TABLE_EMBED_CLASS = "ql-table-embed";
const BlockEmbed: any = Quill.import("blots/block/embed");

class TableEmbed extends BlockEmbed {
  static create(value: string) {
    const node = super.create() as HTMLElement;
    node.setAttribute("contenteditable", "false");
    node.innerHTML = value ?? "";
    return node;
  }

  static value(node: HTMLElement) {
    return node.innerHTML;
  }
}
TableEmbed.blotName = "tableEmbed";
TableEmbed.tagName = "DIV";
TableEmbed.className = TABLE_EMBED_CLASS;

Quill.register(TableEmbed, true);

// Clipboard matcher: turn every <table> encountered while parsing pasted/loaded
// HTML into a single tableEmbed insert, discarding the per-cell delta the
// default matchers would otherwise produce.
function tableClipboardMatcher(node: Node) {
  const Delta: any = Quill.import("delta");
  return new Delta().insert({ tableEmbed: (node as HTMLElement).outerHTML });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const MIN_TITLE_LENGTH = 50;
const MAX_TITLE_LENGTH = 60;

function getPlainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Remove the read-only wrapper Quill renders around tables (see TableEmbed),
 * leaving the bare <table> markup. Uses DOM parsing rather than a regex so
 * tables that themselves contain <div> elements in their cells unwrap correctly.
 */
function unwrapTableEmbeds(html: string): string {
  if (!html || !html.includes(TABLE_EMBED_CLASS)) return html;
  const container = document.createElement("div");
  container.innerHTML = html;
  container.querySelectorAll(`div.${TABLE_EMBED_CLASS}`).forEach((wrapper) => {
    wrapper.replaceWith(...Array.from(wrapper.childNodes));
  });
  return container.innerHTML;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatVersionDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Build the localStorage key for a given article (or "new" for unsaved drafts). */
function draftKey(id?: string) {
  return id ? `draft_article_${id}` : "draft_article_new";
}

// Shared card styling for the sidebar / main panels.
const CARD = "bg-white border border-black/10 rounded-xl shadow-sm";

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isEdit = Boolean(id);
  const isAdmin = user?.role === "ADMIN";
  const isAdminArticleEdit = isAdmin && isEdit && location.pathname.startsWith("/admin/");
  const requiredStar = !isAdmin ? <span className="text-red-500">*</span> : null;

  // ─── Core form fields ─────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [originalSourceUrl, setOriginalSourceUrl] = useState("");
  const [mainKeyword, setMainKeyword] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [showNewTag, setShowNewTag] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageSourceUrl, setImageSourceUrl] = useState("");
  const [remoteImageUrl, setRemoteImageUrl] = useState("");
  const [embedMode, setEmbedMode] = useState(false);

  // Copyright confirmation modal
  const [copyrightModal, setCopyrightModal] = useState<{ show: boolean }>({ show: false });
  const copyrightCallbackRef = useRef<(() => void) | null>(null);

  // Embed image modal (body images)
  const [embedModal, setEmbedModal] = useState({ show: false, imgUrl: "", sourceUrl: "" });

  // YouTube modal
  const [youtubeModal, setYoutubeModal] = useState({ show: false, url: "" });

  // Image from URL modal
  const [imageUrlModal, setImageUrlModal] = useState({ show: false, url: "" });
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFeaturedImage, setIsDraggingFeaturedImage] = useState(false);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [isUploadingBodyMedia, setIsUploadingBodyMedia] = useState(false);
  const quillRef = useRef<ReactQuill | null>(null);
  const bodyImageInputRef = useRef<HTMLInputElement | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Floating inline toolbar — appears under the text inside the editor
  const [inlineToolbar, setInlineToolbar] = useState<{ show: boolean; top: number }>({ show: false, top: 0 });

  // Auto-expand: grow editor when cursor is within 5 lines of the bottom
  const [editorExtraHeight, setEditorExtraHeight] = useState(0);
  const LINE_HEIGHT = 24; // px per line in Quill

  // ─── C1: Auto-save state ──────────────────────────────────────────────────
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saved" | "unsaved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [showRestorePrompt, setShowRestorePrompt] = useState(false);

  // ─── C1: Version history panel ────────────────────────────────────────────
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);

  // ─── C2: Scheduled publishing ─────────────────────────────────────────────
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  // ─── C3: Series ───────────────────────────────────────────────────────────
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [showNewSeries, setShowNewSeries] = useState(false);
  const [newSeriesTitle, setNewSeriesTitle] = useState("");
  const [newSeriesDesc, setNewSeriesDesc] = useState("");
  const [creatingSeries, setCreatingSeries] = useState(false);

  // ─── C7: Template selector ────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [templateApplied, setTemplateApplied] = useState(false);

  // ─── C8: Cross-posting mode ───────────────────────────────────────────────
  const [isCrossPost, setIsCrossPost] = useState(false);

  // ─── K3: AMA / Discussion type ────────────────────────────────────────────
  const [articleType, setArticleType] = useState<"ARTICLE" | "AMA" | "DISCUSSION">("ARTICLE");
  const [amaExpiresAt, setAmaExpiresAt] = useState(""); // datetime-local value

  // Collapsible help panel (new articles only)
  const [showGuide, setShowGuide] = useState(false);

  const selectedCategory = categories.find((cat) => cat.id === categoryId);

  // ─── Load initial data ────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError("");

    const requests: Promise<unknown>[] = [
      api.get("/categories/mine"),
      api.get("/categories/tags"),
      api.get("/series"),
    ];
    if (isEdit && id) {
      requests.push(api.get(`/articles/mine/${id}`));
    }

    Promise.all(requests)
      .then((responses) => {
        const [catRes, tagRes, seriesRes, articleRes] = responses as [
          { data: { categories: Category[] } },
          { data: { tags: Tag[] } },
          { data: { series: Series[] } },
          { data: { article: Record<string, unknown> } } | undefined,
        ];

        setCategories(catRes.data.categories);
        setTags(tagRes.data.tags);
        setSeries(seriesRes.data.series || []);

        if (articleRes?.data?.article) {
          const a = articleRes.data.article as {
            title?: string;
            body?: string;
            categoryId?: string;
            category?: { id?: string };
            authorName?: string;
            originalSourceUrl?: string | null;
            imageUrl?: string | null;
            imageSourceUrl?: string | null;
            mainKeyword?: string;
            tags?: { tag?: { id?: string }; tagId?: string }[];
            scheduledAt?: string | null;
          };

          setTitle(a.title || "");
          setBody(a.body || "");
          setCategoryId(a.categoryId || a.category?.id || "");
          setAuthorName(a.authorName || "");
          setOriginalSourceUrl(a.originalSourceUrl || "");
          setIsCrossPost(Boolean(a.originalSourceUrl));
          setMainKeyword(a.mainKeyword || "");
          setImageUrl(a.imageUrl || "");
          setImageSourceUrl(a.imageSourceUrl || "");
          setSelectedTags(a.tags?.map((t) => t.tag?.id || t.tagId || "").filter(Boolean) as string[]);
          if (a.scheduledAt) {
            setScheduleMode(true);
            // Convert to local datetime-local format
            const d = new Date(a.scheduledAt);
            const pad = (n: number) => String(n).padStart(2, "0");
            setScheduledAt(
              `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
            );
          }
          setTemplateApplied(true); // don't show template picker when editing
        } else {
          // New article: check localStorage for a draft
          const saved = localStorage.getItem(draftKey());
          if (saved) {
            setShowRestorePrompt(true);
          }
        }
      })
      .catch((err: unknown) => {
        const errorResponse = (err as AxiosError<{ error?: string }>).response;
        setError(errorResponse?.data?.error || "Failed to load article editor data.");
      })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // ─── C1: Auto-save to localStorage every 10s ─────────────────────────────
  const autoSaveRef = useRef({ title, body, mainKeyword, categoryId, authorName, originalSourceUrl });
  useEffect(() => {
    autoSaveRef.current = { title, body, mainKeyword, categoryId, authorName, originalSourceUrl };
  });

  useEffect(() => {
    if (loading) return;
    const interval = setInterval(() => {
      const { title: t, body: b, mainKeyword: k, categoryId: c, authorName: a, originalSourceUrl: u } = autoSaveRef.current;
      // Only save if there's meaningful content
      if (!t && !getPlainTextFromHtml(b)) return;
      const data = { title: t, body: b, mainKeyword: k, categoryId: c, authorName: a, originalSourceUrl: u, savedAt: new Date().toISOString() };
      localStorage.setItem(draftKey(id), JSON.stringify(data));
      setAutoSaveStatus("saved");
      setLastSavedAt(new Date());
    }, 10_000);
    return () => clearInterval(interval);
  }, [id, loading]);

  // Mark "unsaved" whenever content changes
  useEffect(() => {
    if (!loading) setAutoSaveStatus("unsaved");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body]);

  // ─── Restore prompt handlers ──────────────────────────────────────────────
  const handleRestoreDraft = () => {
    const saved = localStorage.getItem(draftKey());
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      setTitle(data.title || "");
      setBody(data.body || "");
      setMainKeyword(data.mainKeyword || "");
      setCategoryId(data.categoryId || "");
      setAuthorName(data.authorName || "");
      setOriginalSourceUrl(data.originalSourceUrl || "");
    } catch { /* ignore corrupt data */ }
    setShowRestorePrompt(false);
    localStorage.removeItem(draftKey());
  };

  // ─── C1: Version history ──────────────────────────────────────────────────
  const loadVersions = async () => {
    if (!id) return;
    setVersionsLoading(true);
    try {
      const { data } = await api.get(`/articles/${id}/versions`);
      setVersions(data.versions || []);
    } catch { /* silently ignore */ }
    finally { setVersionsLoading(false); }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!id) return;
    setRestoringVersionId(versionId);
    try {
      const { data } = await api.get(`/articles/${id}/versions/${versionId}`);
      const v = data.version;
      setTitle(v.title || "");
      setBody(v.body || "");
      setShowVersionHistory(false);
    } catch { setError("Failed to restore version"); }
    finally { setRestoringVersionId(null); }
  };

  // ─── C3: Series handlers ──────────────────────────────────────────────────
  const handleCreateSeries = async () => {
    if (!newSeriesTitle.trim()) return;
    setCreatingSeries(true);
    try {
      const { data } = await api.post("/series", {
        title: newSeriesTitle.trim(),
        description: newSeriesDesc.trim() || undefined,
      });
      setSeries((prev) => [data.series, ...prev]);
      setSelectedSeriesId(data.series.id);
      setNewSeriesTitle("");
      setNewSeriesDesc("");
      setShowNewSeries(false);
    } catch (err: unknown) {
      const e = err as AxiosError<{ error?: string }>;
      setError(e.response?.data?.error || "Failed to create series");
    } finally {
      setCreatingSeries(false);
    }
  };

  // ─── Category / tag handlers ──────────────────────────────────────────────
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const { data } = await api.post("/categories", { name: newCategoryName });
      setCategories((prev) => [...prev, data.category]);
      setCategoryId(data.category.id);
      setNewCategoryName("");
      setShowNewCategory(false);
    } catch (err: unknown) {
      const e = err as AxiosError<{ error?: string }>;
      setError(e.response?.data?.error || "Failed to create category");
    }
  };

  const handleCreateTag = async () => {
    const normalizedName = newTagName.trim();
    if (!normalizedName) return;
    setError("");
    setCreatingTag(true);

    try {
      const { data } = await api.post("/categories/tags", {
        name: normalizedName,
        categoryId: categoryId || undefined,
      });
      const createdTag = data.tag as Tag;
      setTags((prev) =>
        [...prev, createdTag].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSelectedTags((prev) =>
        prev.includes(createdTag.id) ? prev : [...prev, createdTag.id]
      );
      setNewTagName("");
      setShowNewTag(false);
    } catch (err: unknown) {
      const errorResponse = (err as AxiosError<TagApiError>).response;
      const existingTag = errorResponse?.data?.tag;

      if (errorResponse?.status === 409 && existingTag) {
        setSelectedTags((prev) =>
          prev.includes(existingTag.id) ? prev : [...prev, existingTag.id]
        );
        setNewTagName("");
        setShowNewTag(false);
      } else {
        setError(errorResponse?.data?.error || "Failed to create tag");
      }
    } finally {
      setCreatingTag(false);
    }
  };

  // ─── Image upload from URL ───────────────────────────────────────────────
  // ─── Copyright confirmation before uploading images ─────────────────────
  const requireCopyrightConfirm = (onConfirm: () => void) => {
    copyrightCallbackRef.current = onConfirm;
    setCopyrightModal({ show: true });
  };

  const handleCopyrightConfirm = () => {
    setCopyrightModal({ show: false });
    const cb = copyrightCallbackRef.current;
    copyrightCallbackRef.current = null;
    cb?.();
  };

  const handleCopyrightCancel = () => {
    setCopyrightModal({ show: false });
    copyrightCallbackRef.current = null;
  };

  const handleUploadFromUrl = () => {
    const trimmed = remoteImageUrl.trim();
    if (!trimmed) {
      setError("Please enter an image URL.");
      return;
    }

    // Basic client-side validation
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("Only http and https URLs are allowed.");
        return;
      }
    } catch {
      setError("Please enter a valid URL (e.g. https://example.com/image.jpg).");
      return;
    }

    requireCopyrightConfirm(async () => {
      setIsUploading(true);
      setError("");

      try {
        const { data } = await api.post("/upload/from-url", { imageUrl: trimmed });

        if (!data?.imageUrl) {
          throw new Error("No imageUrl in response");
        }

        setImageUrl(data.imageUrl);
        setRemoteImageUrl("");
      } catch (err: unknown) {
        const e = err as AxiosError<{ error?: string }> & { message?: string };
        setError(e.response?.data?.error || e.message || "Failed to load image from URL");
      } finally {
        setIsUploading(false);
      }
    });
  };

  // ─── Image upload ─────────────────────────────────────────────────────────
  const validateFeaturedImageFile = (file: File): string | null => {
    if (!file.type.startsWith("image/")) {
      return "Please select a valid image file (JPEG, PNG, WebP, or GIF)";
    }

    if (!isAdmin && file.size > 3 * 1024 * 1024) {
      return "Image file size must be under 3MB";
    }
    return null;
  };

  const uploadFeaturedImageFile = async (file: File) => {
    const validationError = validateFeaturedImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("image", file);

    try {
      const { data } = await api.post("/upload/article-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!data?.imageUrl) {
        throw new Error("No imageUrl in response");
      }

      setImageUrl(data.imageUrl);
    } catch (err: unknown) {
      const e = err as AxiosError<{ error?: string }> & { message?: string };
      setError(e.response?.data?.error || e.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    requireCopyrightConfirm(() => {
      uploadFeaturedImageFile(file);
    });
  };

  const handleFeaturedImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    e.preventDefault();
    setIsDraggingFeaturedImage(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (!file) {
      setError("Only image files can be dropped for Article Photo.");
      return;
    }
    requireCopyrightConfirm(() => {
      uploadFeaturedImageFile(file);
    });
  };

  const handleFeaturedImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    e.preventDefault();
    setIsDraggingFeaturedImage(true);
  };

  const handleFeaturedImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFeaturedImage(false);
  };

  // ─── Body media (drag-drop, paste, Quick Insert) ──────────────────────────
  const validateBodyImageFile = (file: File): string | null => {
    if (!file.type.startsWith("image/")) {
      return "Please choose a valid image file (JPEG, PNG, WebP, or GIF).";
    }
    if (!isAdmin && file.size > 3 * 1024 * 1024) {
      return "Image file size must be under 3MB.";
    }
    return null;
  };

  const uploadBodyImageFile = async (file: File): Promise<string | null> => {
    const validationError = validateBodyImageFile(file);
    if (validationError) {
      setError(validationError);
      return null;
    }
    setIsUploadingBodyMedia(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await api.post("/upload/article-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!data?.imageUrl) throw new Error("Upload failed");
      return resolveImageUrl(data.imageUrl) || data.imageUrl;
    } catch (err: unknown) {
      const e = err as AxiosError<{ error?: string }> & { message?: string };
      setError(e.response?.data?.error || e.message || "Failed to upload image");
      return null;
    } finally {
      setIsUploadingBodyMedia(false);
    }
  };

  // Saved cursor position — captured before modals steal focus from Quill
  const savedCursorRef = useRef<number | null>(null);

  const insertImageIntoBody = (url: string) => {
    const editor = quillRef.current?.getEditor?.();
    if (editor) {
      // Use saved cursor from before modal, or current selection, or end of doc
      const index = savedCursorRef.current ?? editor.getSelection()?.index ?? editor.getLength();
      savedCursorRef.current = null;
      editor.insertEmbed(index, "image", url, "user");
      editor.insertText(index + 1, "\n", "user");
      editor.setSelection(index + 2, 0);
    } else {
      setBody((prev) => `${prev}<p><img src="${url}" alt="" /></p>`);
    }
  };

  const insertVideoIntoBody = (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError("Please paste a full YouTube URL starting with https://");
      return;
    }
    const editor = quillRef.current?.getEditor?.();
    if (editor) {
      const index = savedCursorRef.current ?? editor.getSelection()?.index ?? editor.getLength();
      savedCursorRef.current = null;
      editor.insertEmbed(index, "video", url, "user");
      editor.insertText(index + 1, "\n", "user");
      editor.setSelection(index + 2, 0);
    } else {
      setBody((prev) => `${prev}<p><a href="${url}">${url}</a></p>`);
    }
  };

  const promptForYouTube = () => {
    setYoutubeModal({ show: true, url: "" });
  };

  const handleYoutubeModalInsert = () => {
    const url = youtubeModal.url.trim();
    if (!url) {
      setError("Please enter a YouTube URL.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setError("Please enter a full YouTube URL starting with https://");
      return;
    }
    insertVideoIntoBody(url);
    setYoutubeModal({ show: false, url: "" });
    setError("");
  };

  const handleYoutubeModalCancel = () => {
    setYoutubeModal({ show: false, url: "" });
  };

  // ─── Insert image from URL (body media) — styled modal ───────────────────
  const promptForImageUrl = () => {
    setImageUrlModal({ show: true, url: "" });
  };

  const handleImageUrlModalSubmit = () => {
    const trimmed = imageUrlModal.url.trim();
    if (!trimmed) {
      setError("Please enter an image URL.");
      return;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("Only http and https URLs are supported.");
        return;
      }
    } catch {
      setError("Please enter a valid URL.");
      return;
    }

    // Close the URL modal first, then show copyright confirmation
    setImageUrlModal({ show: false, url: "" });

    requireCopyrightConfirm(() => {
      setIsUploadingBodyMedia(true);
      setError("");

      api.post("/upload/from-url", { imageUrl: trimmed })
        .then(({ data }) => {
          if (!data?.imageUrl) throw new Error("No imageUrl in response");
          const finalUrl = resolveImageUrl(data.imageUrl) || data.imageUrl;
          insertImageIntoBody(finalUrl);
        })
        .catch((err: AxiosError<{ error?: string }> & { message?: string }) => {
          setError(err.response?.data?.error || err.message || "Failed to load image from URL");
        })
        .finally(() => setIsUploadingBodyMedia(false));
    });
  };

  const handleImageUrlModalCancel = () => {
    setImageUrlModal({ show: false, url: "" });
  };

  // ─── Embed image via URL (body media) — styled modal ───────────────────
  const promptForEmbedImage = () => {
    setEmbedModal({ show: true, imgUrl: "", sourceUrl: "" });
  };

  const handleEmbedModalInsert = () => {
    const trimmedImg = embedModal.imgUrl.trim();
    if (!trimmedImg) {
      setError("Please enter an image URL.");
      return;
    }

    try {
      const parsed = new URL(trimmedImg);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setError("Only http and https URLs are supported.");
        return;
      }
    } catch {
      setError("Please enter a valid image URL.");
      return;
    }

    const sourceUrl = embedModal.sourceUrl.trim();
    const sourceDomain = sourceUrl
      ? (() => { try { return new URL(sourceUrl).hostname; } catch { return sourceUrl; } })()
      : "";

    // Insert at saved cursor position or end of document
    const editor = quillRef.current?.getEditor?.();
    if (editor) {
      const index = savedCursorRef.current ?? editor.getSelection()?.index ?? editor.getLength();
      savedCursorRef.current = null;

      editor.insertEmbed(index, "image", trimmedImg, "user");
      if (sourceUrl) {
        editor.insertText(index + 1, "\n", "user");
        editor.insertText(index + 2, sourceDomain, "link", sourceUrl, "user");
        editor.insertText(index + 2 + sourceDomain.length, "\n", "user");
        editor.setSelection(index + 3 + sourceDomain.length, 0);
      } else {
        editor.insertText(index + 1, "\n", "user");
        editor.setSelection(index + 2, 0);
      }
    } else {
      const html = sourceUrl
        ? `<img src="${trimmedImg}" alt="" /><p><a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">${sourceDomain}</a></p>`
        : `<img src="${trimmedImg}" alt="" />`;
      setBody((prev) => `${prev}${html}`);
    }

    setEmbedModal({ show: false, imgUrl: "", sourceUrl: "" });
    setError("");
  };

  const handleEmbedModalCancel = () => {
    setEmbedModal({ show: false, imgUrl: "", sourceUrl: "" });
  };

  const triggerBodyImageDialog = () => {
    bodyImageInputRef.current?.click();
  };

  const handleBodyImageInput = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    requireCopyrightConfirm(() => {
      (async () => {
        for (const file of files) {
          const url = await uploadBodyImageFile(file);
          if (url) insertImageIntoBody(url);
        }
      })();
    });
  };

  const handleEditorDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    e.preventDefault();
    setIsDraggingMedia(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) {
      setError("Only image files can be dropped here.");
      return;
    }

    requireCopyrightConfirm(() => {
      (async () => {
        for (const file of files) {
          const url = await uploadBodyImageFile(file);
          if (url) insertImageIntoBody(url);
        }
      })();
    });
  };

  const handleEditorDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    e.preventDefault();
    setIsDraggingMedia(true);
  };

  const handleEditorDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingMedia(false);
  };

  const quillModules = useMemo(
    () => ({
      toolbar: {
        container: quillToolbarContainer,
        handlers: {
          image: triggerBodyImageDialog,
          video: promptForYouTube,
        },
      },
      clipboard: {
        matchVisual: false,
        matchers: [["table", tableClipboardMatcher]] as [string, typeof tableClipboardMatcher][],
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin]
  );

  // ─── Floating inline toolbar — appears at cursor position ─────────────
  useEffect(() => {
    const quill = quillRef.current?.getEditor?.();
    if (!quill) return;

    let editorOffsetTop = 0;

    const updateToolbar = () => {
      // Show only when there's actual text content
      const text = quill.getText().trim();
      if (!text) {
        setInlineToolbar({ show: false, top: 0 });
        return;
      }

      // Compute editor offset once
      if (!editorOffsetTop) {
        const editorEl = quill.root as HTMLElement;
        const wrapperEl = editorContainerRef.current;
        if (editorEl && wrapperEl) {
          editorOffsetTop = editorEl.getBoundingClientRect().top - wrapperEl.getBoundingClientRect().top;
        }
      }

      // Position at the CURSOR (selection), not at end of content
      const selection = quill.getSelection();
      const cursorIndex = selection ? selection.index : quill.getLength() - 1;
      const bounds = quill.getBounds(Math.max(0, cursorIndex));
      if (!bounds) {
        setInlineToolbar({ show: false, top: 0 });
        return;
      }

      setInlineToolbar({
        show: true,
        top: editorOffsetTop + bounds.top + bounds.height + 10,
      });

      // Auto-expand editor: when end of content is within 5 lines of bottom
      const editorEl = quill.root as HTMLElement;
      const editorHeight = editorEl.clientHeight;
      const endBounds = quill.getBounds(Math.max(0, quill.getLength() - 1));
      if (endBounds) {
        const endBottom = endBounds.top + endBounds.height;
        const threshold = 5 * LINE_HEIGHT;
        if (endBottom > editorHeight - threshold) {
          setEditorExtraHeight((prev) => prev + threshold);
        }
      }
    };

    quill.on("selection-change", updateToolbar);
    quill.on("text-change", updateToolbar);

    // Initial call
    updateToolbar();

    return () => {
      quill.off("selection-change", updateToolbar);
      quill.off("text-change", updateToolbar);
    };
  }, [body]); // re-bind when body content changes (e.g. template applied)

  // ─── C7: Apply template ───────────────────────────────────────────────────
  const handleApplyTemplate = () => {
    const tpl = TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!tpl) return;
    setBody(tpl.body);
    setTemplateApplied(true);
  };

  // ─── Submit handler ───────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (status?: "DRAFT" | "SUBMITTED" | "SCHEDULED") => {
    setError("");
    const plainBody = getPlainTextFromHtml(body);
    const trimmedTitle = title.trim();
    const titleLength = trimmedTitle.length;

    if (!isAdmin && (titleLength < MIN_TITLE_LENGTH || titleLength > MAX_TITLE_LENGTH)) {
      setError(`Article title must be between ${MIN_TITLE_LENGTH} and ${MAX_TITLE_LENGTH} characters.`);
      return;
    }

    if (
      !isAdmin &&
      (
        !trimmedTitle ||
        !mainKeyword.trim() ||
        !plainBody ||
        !categoryId ||
        !authorName.trim() ||
        !originalSourceUrl.trim() ||
        selectedTags.length === 0
      )
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!isAdmin && originalSourceUrl.trim() && !isValidHttpUrl(originalSourceUrl.trim())) {
      setError("Please enter a valid Source URL from your Website (http or https).");
      return;
    }

    if (status === "SCHEDULED" && !scheduledAt) {
      setError("Please pick a date and time to schedule the article.");
      return;
    }

    if (status === "SCHEDULED" && scheduledAt && new Date(scheduledAt) <= new Date()) {
      setError("Scheduled time must be in the future.");
      return;
    }

    setSaving(true);
    try {
      // Tables are held inside read-only <div class="ql-table-embed"> wrappers
      // while in the editor (see TableEmbed). Unwrap them so the stored HTML
      // contains bare <table> markup exactly as authored.
      const savedBody = unwrapTableEmbeds(body);

      const payload: Record<string, unknown> = {
        title: trimmedTitle,
        body: savedBody,
        categoryId,
        authorName: authorName.trim(),
        originalSourceUrl: originalSourceUrl.trim() || null,
        mainKeyword: mainKeyword.trim(),
        imageUrl,
        imageSourceUrl: imageSourceUrl || null,
        tagIds: selectedTags,
      };

      if (status) {
        payload.status = status;
      }

      if (status === "SCHEDULED" && scheduledAt) {
        payload.scheduledAt = new Date(scheduledAt).toISOString();
      }

      if (selectedSeriesId) {
        payload.seriesId = selectedSeriesId;
      }

      // K3: Article type
      payload.articleType = articleType;
      if (articleType === "AMA" && amaExpiresAt) {
        payload.amaExpiresAt = new Date(amaExpiresAt).toISOString();
      }

      if (isEdit && id) {
        await api.put(`/articles/${id}`, payload);
      } else {
        await api.post("/articles", payload);
      }

      // Clear the localStorage draft after a successful save
      localStorage.removeItem(draftKey(id));
      navigate(isAdminArticleEdit ? "/admin/articles" : "/dashboard/articles");
    } catch (err: unknown) {
      const e = err as AxiosError<{
        error?: string;
        details?: Array<{ field?: string; message?: string }>;
      }>;
      const validationDetails = e.response?.data?.details
        ?.map((detail) => [detail.field, detail.message].filter(Boolean).join(": "))
        .filter(Boolean)
        .join("; ");
      setError(validationDetails || e.response?.data?.error || "Failed to save article");
    } finally {
      setSaving(false);
    }
  }, [body, title, isAdmin, mainKeyword, categoryId, authorName, originalSourceUrl, selectedTags, scheduledAt, selectedSeriesId, imageUrl, imageSourceUrl, isEdit, id, navigate, articleType, amaExpiresAt, isAdminArticleEdit]);

  // ─── Writer stats (word count / reading time) + SEO derivations ───────────
  const plainBody = useMemo(() => getPlainTextFromHtml(body), [body]);
  const wordCount = useMemo(
    () => (plainBody ? plainBody.split(/\s+/).filter(Boolean).length : 0),
    [plainBody]
  );
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));
  const permalink = mainKeyword
    ? mainKeyword.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    : "";
  const trimmedTitleLen = title.trim().length;
  const titleOk = isAdmin
    ? trimmedTitleLen > 0
    : trimmedTitleLen >= MIN_TITLE_LENGTH && trimmedTitleLen <= MAX_TITLE_LENGTH;
  const keywordInTitle =
    mainKeyword.trim().length > 0 && title.toLowerCase().includes(mainKeyword.trim().toLowerCase());
  const seoDescription = plainBody.slice(0, 160);

  // ─── Cmd/Ctrl+S → quick save (Draft, or Save Changes in admin edit) ──────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (saving) return;
        if (isAdminArticleEdit) handleSubmit();
        else handleSubmit("DRAFT");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSubmit, isAdminArticleEdit, saving]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  // ─── Primary action buttons (identical workflow, shared by header & footer) ─
  const actionButtons = (
    <>
      {isAdminArticleEdit ? (
        <>
          <button
            onClick={() => handleSubmit()}
            disabled={saving}
            className="px-5 py-2 bg-[#b5121b] text-white rounded-lg hover:bg-[#8f0f16] text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {scheduleMode && scheduledAt && (
            <button
              onClick={() => handleSubmit("SCHEDULED")}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Scheduling..." : "Schedule Publication"}
            </button>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => handleSubmit("DRAFT")}
            disabled={saving}
            className="px-5 py-2 border border-black/25 rounded-lg hover:bg-neutral-50 text-neutral-700 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Draft"}
          </button>
          {!(isAdmin && scheduleMode && scheduledAt) && (
            <button
              onClick={() => handleSubmit("SUBMITTED")}
              disabled={saving}
              className="px-5 py-2 bg-[#b5121b] text-white rounded-lg hover:bg-[#8f0f16] text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit for Review"}
            </button>
          )}
          {isAdmin && scheduleMode && scheduledAt && (
            <button
              onClick={() => handleSubmit("SCHEDULED")}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Scheduling..." : "Schedule Publication"}
            </button>
          )}
        </>
      )}
    </>
  );

  // ─── Publish checklist (guidance only — never blocks saving) ──────────────
  const checklist = [
    { ok: titleOk, label: isAdmin ? "Title added" : `Title is ${MIN_TITLE_LENGTH}–${MAX_TITLE_LENGTH} characters` },
    { ok: mainKeyword.trim().length > 0, label: "Main keyword set" },
    { ok: keywordInTitle, label: "Keyword appears in the title" },
    { ok: wordCount >= 300, label: "At least 300 words" },
    { ok: Boolean(imageUrl), label: "Featured image added" },
    { ok: Boolean(categoryId), label: "Category selected" },
    { ok: selectedTags.length > 0, label: "At least one tag" },
    ...(!isAdmin ? [{ ok: originalSourceUrl.trim().length > 0, label: "Source backlink provided" }] : []),
  ];
  const checklistDone = checklist.filter((c) => c.ok).length;

  return (
    <>
      {editorExtraHeight > 0 && (
        <style>{`.ql-editor { min-height: ${320 + editorExtraHeight}px !important; }`}</style>
      )}
      <SEOHead title={isEdit ? "Edit Article" : "New Article"} />

      {/* ─── Sticky action header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 mb-6 px-4 sm:px-6 py-3 bg-white/90 backdrop-blur border-b border-black/10 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(isAdminArticleEdit ? "/admin/articles" : "/dashboard/articles")}
            className="shrink-0 h-9 w-9 grid place-items-center rounded-lg border border-black/15 text-neutral-500 hover:bg-neutral-50"
            title="Back to articles"
          >
            ←
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold [font-family:Georgia,'Times_New_Roman',serif] text-neutral-900 truncate">
              {isEdit ? "Edit Article" : "Create New Article"}
            </h1>
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <span
                className={`inline-flex items-center gap-1 ${
                  autoSaveStatus === "saved" ? "text-emerald-600" : autoSaveStatus === "unsaved" ? "text-amber-600" : ""
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${
                  autoSaveStatus === "saved" ? "bg-emerald-500" : autoSaveStatus === "unsaved" ? "bg-amber-500" : "bg-neutral-300"
                }`} />
                {autoSaveStatus === "saved" && lastSavedAt
                  ? `Draft auto-saved ${lastSavedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                  : autoSaveStatus === "unsaved"
                  ? "Unsaved changes"
                  : "Autosave on"}
              </span>
              <span className="text-neutral-300">·</span>
              <span>{wordCount.toLocaleString()} words · {readingMinutes} min read</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {isEdit && id && (
            <button
              type="button"
              onClick={() => { setShowVersionHistory(true); loadVersions(); }}
              className="px-3 py-2 text-xs border border-black/20 rounded-lg hover:bg-neutral-50 text-neutral-700 font-medium"
            >
              🕓 <span className="hidden sm:inline">Version History</span>
            </button>
          )}
          {actionButtons}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* C1: Restore unsaved draft prompt */}
      {showRestorePrompt && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-center justify-between gap-4">
          <p className="text-sm text-amber-800 font-medium">
            📝 You have an unsaved draft from a previous session. Would you like to restore it?
          </p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={() => { localStorage.removeItem(draftKey()); setShowRestorePrompt(false); }}
              className="px-3 py-1.5 border border-amber-300 text-amber-800 text-xs rounded-lg hover:bg-amber-100"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* C7: Template selector — only for new articles */}
      {!isEdit && !templateApplied && (
        <div className={`${CARD} mb-6 p-5`}>
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">Choose a starting template</h3>
          <p className="text-xs text-neutral-500 mb-3">Templates pre-fill the editor with a helpful structure. You can change everything afterwards.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setSelectedTemplate(tpl.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  selectedTemplate === tpl.id
                    ? "bg-[#b5121b] text-white border-[#b5121b]"
                    : "bg-white text-neutral-700 border-black/20 hover:border-[#b5121b]/50"
                }`}
              >
                {tpl.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleApplyTemplate}
            className="px-4 py-2 bg-neutral-900 text-white text-sm rounded-lg hover:bg-neutral-700"
          >
            Use this template →
          </button>
        </div>
      )}

      {/* How-to guide — collapsible for new articles */}
      {!isEdit && (
        <details
          open={showGuide}
          onToggle={(e) => setShowGuide((e.target as HTMLDetailsElement).open)}
          className="mb-6 rounded-lg bg-blue-50 border border-blue-200 overflow-hidden"
        >
          <summary className="cursor-pointer select-none px-4 sm:px-5 py-3 font-semibold text-blue-900 text-sm marker:content-['']">
            {showGuide ? "▾" : "▸"} 📝 How to write a great article — guidelines &amp; requirements
          </summary>
          <div className="px-4 sm:px-5 pb-5">
            <div className="text-sm text-blue-800 space-y-2">
              <p><span className="font-semibold">1. Article Title:</span> Write a clear, compelling headline (50-60 characters). This will appear as the main heading on your article page.</p>
              <p><span className="font-semibold">2. Main Keyword:</span> Enter the primary topic keyword (e.g., "AI automation tools"). This creates your article's URL/permalink automatically.</p>
              <p><span className="font-semibold">3. Article Content:</span> Write your article using the visual editor or paste HTML. Include images, links, and formatting to enhance readability.</p>
              <p><span className="font-semibold">4. Category &amp; Tags:</span> Select an appropriate technology category and add relevant topic tags to help readers discover your article.</p>
              <p><span className="font-semibold">5. Author Name:</span> Enter your name as the article author.</p>
              <p><span className="font-semibold">6. Featured Photo:</span> Upload a compelling featured image {isAdmin ? "(any size)" : "(max 3MB)"} that represents your article topic. Image will be optimized to <span className="font-mono font-semibold">896×504px</span> (16:9 landscape) and converted to WebP format.</p>
              <p><span className="font-semibold">7. Source URL from Your Website (MANDATORY):</span> You MUST add a backlink to this article on your own website/social network before submitting. In the "Source URL" field, provide the link to your website/social network page that includes a backlink pointing back to our website (ultimatecomputersoftware.com/your-article). This is a required condition for article publication.</p>
              <p><span className="font-semibold">8. Submit:</span> Click "Submit for Review" when ready. Your article will be reviewed by moderators before publishing.</p>
            </div>

            <div className="mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-2">⚠️ Content Guidelines</h3>
              <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                <li><span className="font-semibold">Technology Only:</span> Articles must focus on technology topics</li>
                <li><span className="font-semibold">No Politics:</span> Do not publish political content</li>
                <li><span className="font-semibold">No Inappropriate Content:</span> Avoid offensive or harmful material</li>
                <li><span className="font-semibold">Factual &amp; Relevant:</span> Ensure accuracy and relevance</li>
                <li><span className="font-semibold">No Spam:</span> No promotional or misleading content</li>
                <li><span className="font-semibold">No Copyright Infringement:</span> Write original content and cite sources</li>
                <li><span className="font-semibold">Respect Intellectual Property:</span> Use only original or properly licensed images</li>
                <li><span className="font-semibold">Mandatory Link Required:</span> You MUST have a backlink on your website before submitting</li>
              </ul>
            </div>

            <div className="mt-4 p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-xs text-orange-800 mb-2">
                <span className="font-semibold">📧 Intellectual Property Removal:</span> If you believe your copyrighted content has been published without permission, contact:
              </p>
              <p className="text-sm font-semibold text-orange-900">
                <a href="mailto:copyright@ultimatecomputersoftware.com" className="text-blue-600 hover:underline">
                  copyright@ultimatecomputersoftware.com
                </a>
              </p>
            </div>
          </div>
        </details>
      )}

      {/* ─── Two-column workspace ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">

        {/* ── MAIN COLUMN ── */}
        <div className="space-y-6 min-w-0">

          {/* Title + permalink */}
          <section className={`${CARD} p-5 sm:p-6`}>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Article title…"
              required={!isAdmin}
              minLength={isAdmin ? undefined : MIN_TITLE_LENGTH}
              maxLength={isAdmin ? 255 : MAX_TITLE_LENGTH}
              className="w-full bg-transparent text-2xl sm:text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] text-neutral-900 placeholder:text-neutral-300 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className={`text-xs ${
                  !isAdmin && !titleOk ? "text-red-500" : "text-neutral-500"
                }`}
              >
                {trimmedTitleLen}/{isAdmin ? 255 : MAX_TITLE_LENGTH} characters
                {!isAdmin ? ` (min ${MIN_TITLE_LENGTH})` : " (optional for admin)"}
              </span>
              {titleOk && trimmedTitleLen > 0 && <span className="text-xs text-emerald-600">✓ good length</span>}
            </div>

            <div className="mt-4 border-t border-black/10 pt-4">
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Main Keyword <span className="font-normal text-neutral-400">(SEO permalink)</span> {requiredStar}
              </label>
              <input
                type="text"
                value={mainKeyword}
                onChange={(e) => setMainKeyword(e.target.value)}
                placeholder="e.g. ai automation tools"
                required={!isAdmin}
                className="w-full px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
              />
              {permalink && (
                <p className="text-xs text-neutral-500 mt-1.5">
                  Permalink: <span className="font-mono text-emerald-700">/{permalink}</span>
                </p>
              )}
            </div>
          </section>

          {/* Body editor */}
          <section className={`${CARD} p-5 sm:p-6`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <label className="block text-sm font-semibold text-neutral-800">
                Article Body {requiredStar}
              </label>
              <button
                type="button"
                onClick={() => setIsHtmlMode((prev) => !prev)}
                className="text-xs px-3 py-1.5 rounded-lg border border-black/25 text-neutral-700 hover:bg-neutral-50"
              >
                {isHtmlMode ? "◱ Visual Editor" : "⟨⟩ HTML Source"}
              </button>
            </div>

            {isHtmlMode ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write or paste full HTML markup..."
                className="w-full min-h-[420px] px-4 py-3 border border-black/25 rounded-lg bg-neutral-50 text-neutral-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
              />
            ) : (
              <div
                ref={editorContainerRef}
                className="relative"
                style={{
                  ...((editorExtraHeight > 0) ? { ["--ql-min-height" as string]: `${320 + editorExtraHeight}px` } : {}),
                }}
                onDragOver={handleEditorDragOver}
                onDragLeave={handleEditorDragLeave}
                onDrop={handleEditorDrop}
              >
                <ReactQuill
                  ref={quillRef}
                  theme="snow"
                  value={body}
                  onChange={setBody}
                  modules={quillModules}
                  formats={quillFormats}
                  placeholder="Write your article. Drag images here or use the Quick Insert buttons below…"
                />

                {/* Floating inline insert toolbar — appears at cursor */}
                {inlineToolbar.show && !isDraggingMedia && !isUploadingBodyMedia && !copyrightModal.show && !youtubeModal.show && !imageUrlModal.show && !embedModal.show && (
                  <div
                    className="absolute left-8 z-20 flex items-center gap-0.5 pointer-events-auto bg-white border border-black/20 rounded-lg shadow-lg px-1 py-1"
                    style={{ top: inlineToolbar.top }}
                  >
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); savedCursorRef.current = quillRef.current?.getEditor()?.getSelection()?.index ?? null; }}
                      onClick={triggerBodyImageDialog}
                      title="Insert Image"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:text-[#b5121b] hover:bg-[#b5121b]/5 rounded-md transition-colors"
                    >
                      <span>📷</span> Image
                    </button>
                    <span className="w-px h-5 bg-black/10 mx-0.5" />
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); savedCursorRef.current = quillRef.current?.getEditor()?.getSelection()?.index ?? null; }}
                      onClick={promptForImageUrl}
                      title="Image from URL"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <span>🌐</span> URL
                    </button>
                    <span className="w-px h-5 bg-black/10 mx-0.5" />
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); savedCursorRef.current = quillRef.current?.getEditor()?.getSelection()?.index ?? null; }}
                      onClick={promptForEmbedImage}
                      title="Embed Image"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                    >
                      <span>🔗</span> Embed
                    </button>
                    <span className="w-px h-5 bg-black/10 mx-0.5" />
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); savedCursorRef.current = quillRef.current?.getEditor()?.getSelection()?.index ?? null; }}
                      onClick={promptForYouTube}
                      title="YouTube Video"
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-neutral-700 hover:text-[#b5121b] hover:bg-[#b5121b]/5 rounded-md transition-colors"
                    >
                      <span>▶️</span> Video
                    </button>
                  </div>
                )}

                {(isDraggingMedia || isUploadingBodyMedia) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none rounded-lg border-4 border-dashed border-[#b5121b] bg-[#b5121b]/10 backdrop-blur-[1px]">
                    <div className="text-center px-6 py-4 bg-white/95 rounded-xl shadow-lg pointer-events-none">
                      {isUploadingBodyMedia ? (
                        <>
                          <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-[#b5121b] border-t-transparent animate-spin" />
                          <p className="text-sm font-semibold text-neutral-800">Uploading image…</p>
                          <p className="text-xs text-neutral-500 mt-1">Optimising to 16:9 WebP</p>
                        </>
                      ) : (
                        <>
                          <div className="text-4xl mb-1">📥</div>
                          <p className="text-base font-bold text-[#b5121b]">Drop image to upload</p>
                          <p className="text-xs text-neutral-600 mt-1">
                            Auto-optimised to 16:9 WebP{!isAdmin ? " · max 3MB" : ""}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <input
              ref={bodyImageInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleBodyImageInput}
              className="hidden"
            />

            {/* Quick Insert buttons */}
            {!isHtmlMode && (
              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={triggerBodyImageDialog}
                  disabled={isUploadingBodyMedia}
                  className="group flex items-center gap-3 p-3 border-2 border-dashed border-black/25 rounded-xl bg-white hover:border-[#b5121b] hover:bg-[#b5121b]/5 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#b5121b]/10 text-xl group-hover:bg-[#b5121b]/20">📷</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-neutral-900">Insert Image</span>
                    <span className="block text-[11px] text-neutral-500 mt-0.5">Click or drag &amp; drop</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={promptForImageUrl}
                  disabled={isUploadingBodyMedia}
                  className="group flex items-center gap-3 p-3 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50/30 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xl group-hover:bg-blue-200">🌐</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-neutral-900">Image from URL</span>
                    <span className="block text-[11px] text-neutral-500 mt-0.5">Paste an image URL</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={promptForEmbedImage}
                  className="group flex items-center gap-3 p-3 border-2 border-dashed border-emerald-300 rounded-xl bg-emerald-50/30 hover:border-emerald-400 hover:bg-emerald-50 transition-colors text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xl group-hover:bg-emerald-200">🔗</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-neutral-900">Embed Image</span>
                    <span className="block text-[11px] text-neutral-500 mt-0.5">Hotlink + attribution</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={promptForYouTube}
                  className="group flex items-center gap-3 p-3 border-2 border-dashed border-black/25 rounded-xl bg-white hover:border-[#b5121b] hover:bg-[#b5121b]/5 transition-colors text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#b5121b]/10 text-xl group-hover:bg-[#b5121b]/20">▶️</span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-neutral-900">YouTube Video</span>
                    <span className="block text-[11px] text-neutral-500 mt-0.5">Embeds as 16:9 player</span>
                  </span>
                </button>
              </div>
            )}

            {/* Editor footer: word count + media tips */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-3 text-[11px] text-neutral-500">
              <span>{wordCount.toLocaleString()} words · ~{readingMinutes} min read</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Images: <span className="font-mono text-neutral-700">896×504 WebP (16:9)</span></span>
                {!isAdmin && <span>Max upload: <span className="font-mono text-neutral-700">3 MB</span></span>}
              </div>
            </div>

            {!isHtmlMode && (
              <details className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50">
                <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-semibold text-neutral-800 marker:content-['']">
                  ▸ How to add media &amp; tables
                </summary>
                <div className="px-4 pb-4">
                  <ol className="mt-1 space-y-1 text-xs text-neutral-700">
                    <li className="flex gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">1</span><span><span className="font-semibold">Drag &amp; drop</span> images directly onto the editor.</span></li>
                    <li className="flex gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">2</span><span>Use the <span className="font-semibold">Quick Insert buttons</span> above for images, image URLs, or YouTube.</span></li>
                    <li className="flex gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">3</span><span>Use <span className="font-semibold">code-block</span> from the toolbar for syntax-highlighted code.</span></li>
                    <li className="flex gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">4</span><span><span className="font-semibold">Tables</span> are preserved as protected blocks — switch to <span className="font-semibold">HTML Source</span> to edit their cells.</span></li>
                  </ol>
                  <p className="text-xs text-neutral-500 mt-3 pt-3 border-t border-neutral-200">
                    HTML source mode preserves advanced tags like <code>&lt;section&gt;</code>, <code>&lt;article&gt;</code>, <code>&lt;abbr&gt;</code>, <code>&lt;dl&gt;</code>, <code>&lt;img&gt;</code>, and <code>&lt;hr&gt;</code>.
                  </p>
                </div>
              </details>
            )}
          </section>
        </div>

        {/* ── SIDEBAR ── */}
        <aside className="space-y-5 lg:sticky lg:top-[84px] self-start">

          {/* Publish / post settings */}
          <section className={`${CARD} p-5`}>
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Publish</h3>

            {/* Publish checklist */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-600">Checklist</span>
                <span className="text-xs text-neutral-500">{checklistDone}/{checklist.length}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden mb-2">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${(checklistDone / checklist.length) * 100}%` }}
                />
              </div>
              <ul className="space-y-1">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-xs">
                    <span className={c.ok ? "text-emerald-600" : "text-neutral-300"}>{c.ok ? "✓" : "○"}</span>
                    <span className={c.ok ? "text-neutral-600" : "text-neutral-500"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Article type */}
            <div className="border-t border-black/10 pt-3">
              <label className="block text-xs font-semibold text-neutral-700 mb-2">Article Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(["ARTICLE", "AMA", "DISCUSSION"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setArticleType(type)}
                    className={`px-2 py-2 text-xs border rounded-lg font-medium transition-colors ${
                      articleType === type
                        ? "bg-[#b5121b] text-white border-[#b5121b]"
                        : "border-black/20 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    {type === "ARTICLE" ? "📄 Article" : type === "AMA" ? "🎤 AMA" : "💬 Discuss"}
                  </button>
                ))}
              </div>
              {articleType === "AMA" && (
                <div className="mt-3 space-y-1">
                  <label className="text-xs text-neutral-600">AMA ends at (optional)</label>
                  <input
                    type="datetime-local"
                    value={amaExpiresAt}
                    onChange={(e) => setAmaExpiresAt(e.target.value)}
                    min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
                    className="w-full px-3 py-2 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[11px] text-neutral-500">After this time, the AMA thread is marked ended. Leave empty for open-ended.</p>
                </div>
              )}
              {articleType === "DISCUSSION" && (
                <p className="mt-2 text-[11px] text-neutral-500">
                  Discussion posts are lightweight posts focused on community conversation rather than long-form content.
                </p>
              )}
            </div>

            {/* C2: Scheduled publishing toggle (admin) */}
            {isAdmin && (
              <div className="border-t border-black/10 pt-3 mt-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={scheduleMode}
                    onChange={(e) => { setScheduleMode(e.target.checked); if (!e.target.checked) setScheduledAt(""); }}
                    className="accent-[#b5121b] h-4 w-4"
                  />
                  <span className="text-xs font-medium text-neutral-700">Schedule for later publication</span>
                </label>
                {scheduleMode && (
                  <div className="mt-2">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                      className="w-full px-3 py-2 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                    />
                    <p className="text-[11px] text-neutral-500 mt-1">The article will automatically publish at this date/time.</p>
                  </div>
                )}
              </div>
            )}

            {/* Inline actions (mirror the sticky header) */}
            <div className="border-t border-black/10 pt-3 mt-3 flex flex-wrap gap-2">
              {actionButtons}
            </div>
            <p className="text-[11px] text-neutral-400 mt-2">Tip: press <kbd className="px-1 py-0.5 rounded border border-black/15 bg-neutral-50 font-mono text-[10px]">⌘/Ctrl + S</kbd> to save quickly.</p>
          </section>

          {/* Featured image */}
          <section className={`${CARD} p-5`}>
            <h3 className="text-sm font-semibold text-neutral-900 mb-1">Featured Photo {requiredStar}</h3>

            <div className="flex gap-0 mb-3 border-b border-black/15">
              <button
                type="button"
                onClick={() => setEmbedMode(false)}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                  !embedMode ? "bg-white border border-black/15 border-b-white text-neutral-900" : "bg-neutral-50 text-neutral-500 hover:text-neutral-700"
                }`}
              >
                📤 Upload
              </button>
              <button
                type="button"
                onClick={() => setEmbedMode(true)}
                className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                  embedMode ? "bg-white border border-black/15 border-b-white text-neutral-900" : "bg-neutral-50 text-neutral-500 hover:text-neutral-700"
                }`}
              >
                🔗 Embed
              </button>
            </div>

            {!embedMode ? (
              <>
                <p className="text-[11px] text-neutral-500 mb-2">
                  Uploaded or fetched images are copied &amp; optimised on our servers (896×504 WebP). Best for images you have rights to.
                </p>

                {/* Upload from URL */}
                <div className="mb-3">
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={remoteImageUrl}
                      onChange={(e) => setRemoteImageUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleUploadFromUrl(); }}
                      placeholder="Paste image URL…"
                      disabled={isUploading}
                      className="flex-1 min-w-0 px-3 py-2 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handleUploadFromUrl}
                      disabled={isUploading || !remoteImageUrl.trim()}
                      className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {isUploading ? "…" : "Fetch"}
                    </button>
                  </div>
                </div>

                <div
                  onDrop={handleFeaturedImageDrop}
                  onDragOver={handleFeaturedImageDragOver}
                  onDragLeave={handleFeaturedImageDragLeave}
                  className="rounded-lg"
                >
                  {imageUrl ? (
                    <div>
                      <div className={`relative rounded-lg transition ${isDraggingFeaturedImage ? "ring-2 ring-[#b5121b] ring-offset-2 ring-offset-white" : ""}`}>
                        <img src={imageUrl} alt="Article preview" className="w-full h-auto rounded-lg border border-black/15" />
                        <button
                          type="button"
                          onClick={() => { setImageUrl(""); setImageSourceUrl(""); }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-2">Click ✕ to remove, or drag &amp; drop a new image to replace.</p>
                    </div>
                  ) : (
                    <div className={`border-2 border-dashed rounded-lg p-5 text-center transition ${isDraggingFeaturedImage ? "border-[#b5121b] bg-[#b5121b]/5" : "border-black/25 hover:border-black/40"}`}>
                      <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} className="hidden" id="article-image-input" />
                      <label htmlFor="article-image-input" className="cursor-pointer block">
                        <p className="text-2xl mb-1">🖼️</p>
                        <p className="text-xs font-medium text-neutral-700 mb-1">
                          {isUploading ? "Uploading..." : isDraggingFeaturedImage ? "Drop image to upload" : "Click or drag & drop"}
                        </p>
                        <p className="text-[11px] text-neutral-500">JPEG, PNG, WebP, GIF {isAdmin ? "(any size)" : "(max 3MB)"}</p>
                      </label>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-neutral-600">
                  The image stays on the external server — we only display it.
                  <span className="font-semibold"> Provide the source link</span> for copyright compliance.
                </p>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Image URL <span className="text-red-500">*</span></label>
                  <input
                    type="url"
                    value={embedMode ? imageUrl : ""}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full px-3 py-2 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Source / Attribution Link <span className="text-neutral-400">(optional)</span></label>
                  <input
                    type="url"
                    value={imageSourceUrl}
                    onChange={(e) => setImageSourceUrl(e.target.value)}
                    placeholder="https://example.com/original-page"
                    className="w-full px-3 py-2 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">Shown as attribution below the photo.</p>
                </div>
                {imageUrl && embedMode && (
                  <div className="relative">
                    <img
                      src={imageUrl}
                      alt="Embed preview"
                      className="w-full h-auto rounded-lg border border-black/15"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <button
                      type="button"
                      onClick={() => { setImageUrl(""); setImageSourceUrl(""); }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Category */}
          <section className={`${CARD} p-5`}>
            <h3 className="text-sm font-semibold text-neutral-900 mb-2">Category {requiredStar}</h3>
            {!showNewCategory ? (
              <div className="flex flex-col gap-2">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required={!isAdmin}
                  className="w-full px-3 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}{cat.status === "PENDING" ? " (Pending Approval)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCategory(true)}
                  className="self-start px-3 py-1.5 text-xs border border-black/25 rounded-lg hover:bg-neutral-50"
                >
                  + New category
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  className="w-full px-3 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreateCategory} className="px-3 py-2 bg-[#b5121b] text-white rounded-lg text-xs">Add</button>
                  <button onClick={() => setShowNewCategory(false)} className="px-3 py-2 text-xs border border-black/25 rounded-lg">Cancel</button>
                </div>
              </div>
            )}
            {selectedCategory?.status === "PENDING" && (
              <p className="mt-2 text-xs text-red-600">This category is pending approval.</p>
            )}
          </section>

          {/* Tags */}
          <section className={`${CARD} p-5`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-neutral-900">Tags {requiredStar}</h3>
              {!showNewTag && categoryId && (
                <button
                  type="button"
                  onClick={() => setShowNewTag(true)}
                  className="px-2.5 py-1 text-xs border border-black/25 rounded-lg hover:bg-neutral-50 whitespace-nowrap"
                >
                  + New
                </button>
              )}
            </div>

            <p className="text-[11px] text-neutral-500 mb-2">
              {selectedCategory
                ? <>Suggestions for <span className="font-semibold text-neutral-800">{selectedCategory.name}</span>. Pick the ones that apply.</>
                : "Pick a category first — tag suggestions are tailored to it."}
            </p>

            {showNewTag && (
              <div className="flex flex-col gap-2 mb-3">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder={selectedCategory ? `Custom tag for ${selectedCategory.name}` : "Custom tag name"}
                  className="w-full px-3 py-2 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={handleCreateTag} disabled={creatingTag} className="px-3 py-2 bg-[#b5121b] text-white rounded-lg text-xs disabled:opacity-50">
                    {creatingTag ? "Adding..." : "Add"}
                  </button>
                  <button type="button" onClick={() => { setShowNewTag(false); setNewTagName(""); }} className="px-3 py-2 text-xs border border-black/25 rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {(() => {
              const suggested = categoryId ? tags.filter((t) => t.categoryId === categoryId) : [];
              const selectedFromOtherCategories = tags.filter(
                (t) => selectedTags.includes(t.id) && t.categoryId !== categoryId
              );
              const renderTagButton = (tag: Tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    setSelectedTags((prev) =>
                      prev.includes(tag.id) ? prev.filter((t) => t !== tag.id) : [...prev, tag.id]
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                    selectedTags.includes(tag.id)
                      ? "bg-[#b5121b] text-white"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  {tag.name}
                </button>
              );
              return (
                <div className="border border-black/15 rounded-lg p-3 max-h-56 overflow-y-auto space-y-3">
                  {!categoryId && (
                    <div className="text-center py-6 text-xs text-neutral-500">Select a category above to see tag suggestions.</div>
                  )}
                  {categoryId && selectedFromOtherCategories.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">Already attached</p>
                      <div className="flex flex-wrap gap-2">{selectedFromOtherCategories.map(renderTagButton)}</div>
                    </div>
                  )}
                  {categoryId && suggested.length > 0 && (
                    <div>
                      {selectedFromOtherCategories.length > 0 && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">Suggested for {selectedCategory?.name}</p>
                      )}
                      <div className="flex flex-wrap gap-2">{suggested.map(renderTagButton)}</div>
                    </div>
                  )}
                  {categoryId && suggested.length === 0 && selectedFromOtherCategories.length === 0 && (
                    <div className="text-center py-4 text-xs text-neutral-500">
                      No tags exist for this category yet. Use <span className="font-semibold">+ New</span> to add one.
                    </div>
                  )}
                </div>
              );
            })()}
            {selectedTags.length > 0 && (
              <p className="mt-2 text-[11px] text-neutral-500">{selectedTags.length} tag{selectedTags.length === 1 ? "" : "s"} selected</p>
            )}
          </section>

          {/* Author + Source URL */}
          <section className={`${CARD} p-5 space-y-4`}>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 mb-2">Author Name {requiredStar}</h3>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder={user?.name || "Your name"}
                required={!isAdmin}
                className="w-full px-3 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
              />
            </div>

            <div className="border-t border-black/10 pt-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-neutral-900">Source URL {requiredStar}</h3>
              </div>
              <label className="flex items-start gap-2 cursor-pointer select-none mb-2">
                <input
                  type="checkbox"
                  checked={isCrossPost}
                  onChange={(e) => { setIsCrossPost(e.target.checked); if (!e.target.checked) setOriginalSourceUrl(""); }}
                  className="accent-[#b5121b] h-4 w-4 mt-0.5"
                />
                <span className="text-xs text-neutral-600">I'm cross-posting from my website/social network</span>
              </label>

              {isCrossPost ? (
                <>
                  <input
                    type="url"
                    value={originalSourceUrl}
                    onChange={(e) => setOriginalSourceUrl(e.target.value)}
                    placeholder="https://yourwebsite.com/your-article"
                    required={!isAdmin}
                    className="w-full px-3 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                  />
                  <p className="text-[11px] text-amber-700 mt-1.5 bg-amber-50 px-2 py-1 rounded">
                    ⚠️ You MUST include a backlink to ultimatecomputersoftware.com on that page. Articles without a verified backlink are rejected.
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-neutral-600 bg-neutral-50 border border-black/10 rounded-lg p-2.5">
                  Mandatory: add a backlink to this article on your own website/social network, then paste that page's URL here. This is a required condition for publication.
                </p>
              )}
            </div>
          </section>

          {/* Series */}
          <section className={`${CARD} p-5`}>
            <h3 className="text-sm font-semibold text-neutral-900 mb-1">Article Series <span className="text-neutral-400 font-normal text-xs">(optional)</span></h3>
            <p className="text-[11px] text-neutral-500 mb-2">Group this article into a multi-part series for easy navigation.</p>
            {!showNewSeries ? (
              <div className="flex flex-col gap-2">
                <select
                  value={selectedSeriesId}
                  onChange={(e) => setSelectedSeriesId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                >
                  <option value="">None — standalone article</option>
                  {series.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewSeries(true)}
                  className="self-start px-3 py-1.5 text-xs border border-black/25 rounded-lg hover:bg-neutral-50"
                >
                  + New Series
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newSeriesTitle}
                  onChange={(e) => setNewSeriesTitle(e.target.value)}
                  placeholder="Series title"
                  className="w-full px-3 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
                <textarea
                  value={newSeriesDesc}
                  onChange={(e) => setNewSeriesDesc(e.target.value)}
                  placeholder="Short description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b] resize-none"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={handleCreateSeries} disabled={creatingSeries} className="px-3 py-2 bg-[#b5121b] text-white text-xs rounded-lg disabled:opacity-50">
                    {creatingSeries ? "Creating…" : "Create Series"}
                  </button>
                  <button type="button" onClick={() => { setShowNewSeries(false); setNewSeriesTitle(""); setNewSeriesDesc(""); }} className="px-3 py-2 text-xs border border-black/25 rounded-lg">Cancel</button>
                </div>
              </div>
            )}
          </section>

          {/* SEO preview */}
          <section className={`${CARD} p-5`}>
            <h3 className="text-sm font-semibold text-neutral-900 mb-1">Search Preview</h3>
            <p className="text-[11px] text-neutral-500 mb-3">How this article may appear in Google search results.</p>
            <div className="border border-black/10 rounded-lg p-3 bg-white">
              <p className="text-[11px] text-neutral-600 truncate">
                ultimatecomputersoftware.com{permalink ? ` › ${permalink}` : ""}
              </p>
              <p className="text-[15px] leading-snug text-[#1a0dab] truncate mt-0.5">
                {title.trim() || "Your article title appears here"}
              </p>
              <p className="text-xs text-neutral-600 mt-0.5 line-clamp-2">
                {seoDescription || "Start writing — the first sentences of your article become the search description."}
              </p>
            </div>
          </section>
        </aside>
      </div>

      {/* C1: Version History panel */}
      {showVersionHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setShowVersionHistory(false)} />
          <div className="w-80 bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
              <h2 className="font-semibold text-neutral-900">Version History</h2>
              <button onClick={() => setShowVersionHistory(false)} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {versionsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-b-2 border-[#b5121b] rounded-full" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-8">No saved versions yet.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="border border-black/10 rounded-lg p-3 hover:border-[#b5121b]/40 transition-colors">
                    <p className="text-sm font-medium text-neutral-900 line-clamp-2">{v.title}</p>
                    <p className="text-xs text-neutral-500 mt-1">{formatVersionDate(v.createdAt)}</p>
                    {v.excerpt && <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{v.excerpt}</p>}
                    <button
                      type="button"
                      disabled={restoringVersionId === v.id}
                      onClick={() => handleRestoreVersion(v.id)}
                      className="mt-2 text-xs text-[#b5121b] hover:underline disabled:opacity-50"
                    >
                      {restoringVersionId === v.id ? "Restoring…" : "Restore this version"}
                    </button>
                  </div>
                ))
              )}
            </div>
            <p className="px-4 py-3 text-[11px] text-neutral-400 border-t border-black/10">
              Restoring replaces the current title &amp; body in the editor. Save to make it permanent.
            </p>
          </div>
        </div>
      )}

      {/* YouTube modal */}
      {youtubeModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white border border-black/15 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <h3 className="text-base font-bold text-neutral-900 mb-1">▶️ Insert YouTube Video</h3>
              <p className="text-xs text-neutral-500 mb-4">Paste a YouTube URL to embed a 16:9 player in the article.</p>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">YouTube URL <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  value={youtubeModal.url}
                  onChange={(e) => setYoutubeModal((prev) => ({ ...prev, url: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleYoutubeModalInsert(); }}
                  placeholder="https://www.youtube.com/watch?v=…"
                  autoFocus
                  className="w-full px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
                <p className="text-[11px] text-neutral-500 mt-1">Supports youtube.com, youtu.be, and youtube-nocookie.com URLs.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-neutral-50 border-t border-black/10">
              <button type="button" onClick={handleYoutubeModalCancel} className="px-5 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 border border-black/15 rounded-lg bg-white">Cancel</button>
              <button type="button" onClick={handleYoutubeModalInsert} disabled={!youtubeModal.url.trim()} className="px-5 py-2 text-sm font-medium text-white bg-[#b5121b] hover:bg-[#8f0f16] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Insert Video</button>
            </div>
          </div>
        </div>
      )}

      {/* Image from URL modal */}
      {imageUrlModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white border border-black/15 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <h3 className="text-base font-bold text-neutral-900 mb-1">🌐 Insert Image from URL</h3>
              <p className="text-xs text-neutral-500 mb-4">Paste an image URL — it'll be fetched, optimized to 896×504 WebP, and stored on our servers.</p>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Image URL <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  value={imageUrlModal.url}
                  onChange={(e) => setImageUrlModal((prev) => ({ ...prev, url: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleImageUrlModalSubmit(); }}
                  placeholder="https://example.com/photo.jpg"
                  autoFocus
                  className="w-full px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-neutral-500 mt-1">The image will be downloaded and hosted on our servers — you'll be asked to confirm copyright before it proceeds.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-neutral-50 border-t border-black/10">
              <button type="button" onClick={handleImageUrlModalCancel} className="px-5 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 border border-black/15 rounded-lg bg-white">Cancel</button>
              <button type="button" onClick={handleImageUrlModalSubmit} disabled={!imageUrlModal.url.trim()} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Next: Confirm Rights</button>
            </div>
          </div>
        </div>
      )}

      {/* Embed image modal (body images) */}
      {embedModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white border border-black/15 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <h3 className="text-base font-bold text-neutral-900 mb-1">🔗 Embed Image via URL</h3>
              <p className="text-xs text-neutral-500 mb-4">The image stays on the external server — no copy is made.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Image URL <span className="text-red-500">*</span></label>
                  <input
                    type="url"
                    value={embedModal.imgUrl}
                    onChange={(e) => setEmbedModal((prev) => ({ ...prev, imgUrl: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEmbedModalInsert(); }}
                    placeholder="https://example.com/photo.jpg"
                    autoFocus
                    className="w-full px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Source / Attribution Link <span className="text-neutral-400">(optional)</span></label>
                  <input
                    type="url"
                    value={embedModal.sourceUrl}
                    onChange={(e) => setEmbedModal((prev) => ({ ...prev, sourceUrl: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEmbedModalInsert(); }}
                    placeholder="https://example.com/original-page"
                    className="w-full px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1">Shown as attribution below the image for copyright compliance.</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-neutral-50 border-t border-black/10">
              <button type="button" onClick={handleEmbedModalCancel} className="px-5 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 border border-black/15 rounded-lg bg-white">Cancel</button>
              <button type="button" onClick={handleEmbedModalInsert} disabled={!embedModal.imgUrl.trim()} className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">Insert Image</button>
            </div>
          </div>
        </div>
      )}

      {/* Copyright confirmation modal */}
      {copyrightModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white border border-black/15 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <span className="text-3xl flex-shrink-0">⚠️</span>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 mb-2">Do you have the rights to use this image?</h3>
                  <p className="text-sm text-neutral-600 leading-relaxed">
                    By uploading, you confirm that you own the image or have permission to use it. Unauthorized use may violate copyright law.
                  </p>
                  <p className="mt-3 text-sm text-neutral-600">
                    If you're not sure, use the <span className="font-semibold">🔗 Embed via URL</span> tab instead — the image stays on the external server and no copy is made.
                  </p>
                  <p className="mt-3 text-xs text-neutral-500">
                    Please review our{" "}
                    <a href="/copyright" target="_blank" rel="noopener noreferrer" className="text-[#b5121b] underline hover:text-[#8f0f16] font-medium">Copyright Policy</a>
                    {" "}for more information.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-neutral-50 border-t border-black/10">
              <button type="button" onClick={handleCopyrightCancel} className="px-5 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 border border-black/15 rounded-lg bg-white">Cancel</button>
              <button type="button" onClick={handleCopyrightConfirm} className="px-5 py-2 text-sm font-medium text-white bg-[#b5121b] hover:bg-[#8f0f16] rounded-lg">I have the rights</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
