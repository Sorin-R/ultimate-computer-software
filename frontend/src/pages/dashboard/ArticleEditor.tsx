import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ReactQuill from "react-quill-new";
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
];

const MIN_TITLE_LENGTH = 50;
const MAX_TITLE_LENGTH = 60;

function getPlainTextFromHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFeaturedImage, setIsDraggingFeaturedImage] = useState(false);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [isUploadingBodyMedia, setIsUploadingBodyMedia] = useState(false);
  const quillRef = useRef<ReactQuill | null>(null);
  const bodyImageInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadFeaturedImageFile(file);
  };

  const handleFeaturedImageDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (!Array.from(e.dataTransfer?.types || []).includes("Files")) return;
    e.preventDefault();
    setIsDraggingFeaturedImage(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith("image/"));
    if (!file) {
      setError("Only image files can be dropped for Article Photo.");
      return;
    }
    await uploadFeaturedImageFile(file);
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

  const insertImageIntoBody = (url: string) => {
    const editor = quillRef.current?.getEditor?.();
    if (editor) {
      const range = editor.getSelection(true) || { index: editor.getLength(), length: 0 };
      editor.insertEmbed(range.index, "image", url, "user");
      editor.insertText(range.index + 1, "\n", "user");
      editor.setSelection(range.index + 2, 0);
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
      const range = editor.getSelection(true) || { index: editor.getLength(), length: 0 };
      editor.insertEmbed(range.index, "video", url, "user");
      editor.insertText(range.index + 1, "\n", "user");
      editor.setSelection(range.index + 2, 0);
    } else {
      setBody((prev) => `${prev}<p><a href="${url}">${url}</a></p>`);
    }
  };

  const promptForYouTube = () => {
    const url = window.prompt(
      "Paste a YouTube URL (e.g. https://www.youtube.com/watch?v=… or https://youtu.be/…):"
    );
    if (url) insertVideoIntoBody(url);
  };

  // ─── C5: Insert CodeSandbox embed ─────────────────────────────────────────
  const promptForCodeSandbox = () => {
    const url = window.prompt(
      "Paste a CodeSandbox URL (e.g. https://codesandbox.io/s/your-sandbox-id):"
    );
    if (!url?.trim()) return;
    // The backend will convert /s/<id> to /embed/<id> during sanitization.
    // We just insert a bare link in the body — the sanitizer auto-upgrades it.
    const trimmed = url.trim();
    setBody((prev) => `${prev}<p><a href="${trimmed}">${trimmed}</a></p>`);
  };

  // ─── C5: Insert GitHub Gist link ─────────────────────────────────────────
  const promptForGist = () => {
    const url = window.prompt(
      "Paste a GitHub Gist URL (e.g. https://gist.github.com/username/id):"
    );
    if (!url?.trim()) return;
    const trimmed = url.trim();
    setBody((prev) => `${prev}<p><a href="${trimmed}">${trimmed}</a></p>`);
  };

  const triggerBodyImageDialog = () => {
    bodyImageInputRef.current?.click();
  };

  const handleBodyImageInput = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    for (const file of files) {
      const url = await uploadBodyImageFile(file);
      if (url) insertImageIntoBody(url);
    }
  };

  const handleEditorDrop = async (e: React.DragEvent<HTMLDivElement>) => {
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
    for (const file of files) {
      const url = await uploadBodyImageFile(file);
      if (url) insertImageIntoBody(url);
    }
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
      clipboard: { matchVisual: false },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin]
  );

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
      const payload: Record<string, unknown> = {
        title: trimmedTitle,
        body,
        categoryId,
        authorName: authorName.trim(),
        originalSourceUrl: originalSourceUrl.trim() || null,
        mainKeyword: mainKeyword.trim(),
        imageUrl,
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
  }, [body, title, isAdmin, mainKeyword, categoryId, authorName, originalSourceUrl, selectedTags, scheduledAt, selectedSeriesId, imageUrl, isEdit, id, navigate, articleType, amaExpiresAt, isAdminArticleEdit]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black" />
      </div>
    );
  }

  return (
    <>
      <SEOHead title={isEdit ? "Edit Article" : "New Article"} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold [font-family:Georgia,'Times_New_Roman',serif] text-neutral-900">
          {isEdit ? "Edit Article" : "Create New Article"}
        </h1>

        {/* C1: Auto-save status + Version History button */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">
            {autoSaveStatus === "saved" && lastSavedAt
              ? `Auto-saved ${lastSavedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
              : autoSaveStatus === "unsaved"
              ? "Unsaved changes"
              : null}
          </span>
          {isEdit && id && (
            <button
              type="button"
              onClick={() => {
                setShowVersionHistory(true);
                loadVersions();
              }}
              className="px-3 py-1.5 text-xs border border-black/25 rounded-lg hover:bg-neutral-50 text-neutral-700 font-medium"
            >
              🕓 Version History
            </button>
          )}
        </div>
      </div>

      {/* C1: Version History panel */}
      {showVersionHistory && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setShowVersionHistory(false)}
          />
          <div className="w-80 bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/10">
              <h2 className="font-semibold text-neutral-900">Version History</h2>
              <button
                onClick={() => setShowVersionHistory(false)}
                className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
              >
                ✕
              </button>
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
                  <div
                    key={v.id}
                    className="border border-black/10 rounded-lg p-3 hover:border-[#b5121b]/40 transition-colors"
                  >
                    <p className="text-sm font-medium text-neutral-900 line-clamp-2">{v.title}</p>
                    <p className="text-xs text-neutral-500 mt-1">{formatVersionDate(v.createdAt)}</p>
                    {v.excerpt && (
                      <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{v.excerpt}</p>
                    )}
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
              onClick={() => {
                localStorage.removeItem(draftKey());
                setShowRestorePrompt(false);
              }}
              className="px-3 py-1.5 border border-amber-300 text-amber-800 text-xs rounded-lg hover:bg-amber-100"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {/* C7: Template selector — only for new articles */}
      {!isEdit && !templateApplied && (
        <div className="mb-6 p-4 bg-white border border-black/15 rounded-lg">
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">Choose a starting template</h3>
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

      {!isEdit && (
        <div className="mb-6 p-4 sm:p-5 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="font-semibold text-blue-900 mb-3">📝 How to Create an Article</h2>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              <span className="font-semibold">1. Article Title:</span> Write a clear, compelling headline (50-60 characters). This will appear as the main heading on your article page.
            </p>
            <p>
              <span className="font-semibold">2. Main Keyword:</span> Enter the primary topic keyword (e.g., "AI automation tools"). This creates your article's URL/permalink automatically.
            </p>
            <p>
              <span className="font-semibold">3. Article Content:</span> Write your article using the visual editor or paste HTML. Include images, links, and formatting to enhance readability.
            </p>
            <p>
              <span className="font-semibold">4. Category &amp; Tags:</span> Select an appropriate technology category and add relevant topic tags to help readers discover your article.
            </p>
            <p>
              <span className="font-semibold">5. Author Name:</span> Enter your name as the article author.
            </p>
            <p>
              <span className="font-semibold">6. Featured Photo:</span> Upload a compelling featured image {isAdmin ? "(any size)" : "(max 3MB)"} that represents your article topic. Image will be optimized to <span className="font-mono font-semibold">896×504px</span> (16:9 landscape) and converted to WebP format.
            </p>
            <p>
              <span className="font-semibold">7. Source URL from Your Website (MANDATORY):</span> You MUST add a backlink to this article on your own website/social network before submitting. In the "Source URL" field, provide the link to your website/social network page that includes a backlink pointing back to our website (ultimatecomputersoftware.com/your-article). This is a required condition for article publication.
            </p>
            <p>
              <span className="font-semibold">8. Submit:</span> Click "Submit for Review" when ready. Your article will be reviewed by moderators before publishing.
            </p>
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
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6 bg-white border border-black/15 p-6 sm:p-8">

        {/* Featured Photo */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Article Photo {requiredStar}
          </label>
          <p className="text-xs text-neutral-500 mb-2">
            Supports JPEG, PNG, WebP, GIF {isAdmin ? "(any size)" : "(max 3MB)"} — will be optimized to <span className="font-mono font-semibold">896×504px</span> (16:9 landscape) and converted to WebP
          </p>
          <div
            onDrop={handleFeaturedImageDrop}
            onDragOver={handleFeaturedImageDragOver}
            onDragLeave={handleFeaturedImageDragLeave}
            className="rounded-lg"
          >
            {imageUrl ? (
              <div className="mb-4">
                <div
                  className={`relative inline-block rounded-lg transition ${
                    isDraggingFeaturedImage
                      ? "ring-2 ring-[#b5121b] ring-offset-2 ring-offset-white"
                      : ""
                  }`}
                >
                  <img
                    src={imageUrl}
                    alt="Article preview"
                    className="max-w-xs h-auto rounded-lg border border-black/15"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-neutral-500 mt-2">
                  Click ✕ to remove the photo, or drag &amp; drop a new image to replace it
                </p>
              </div>
            ) : (
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
                  isDraggingFeaturedImage
                    ? "border-[#b5121b] bg-[#b5121b]/5"
                    : "border-black/25 hover:border-black/40"
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={isUploading}
                  className="hidden"
                  id="article-image-input"
                />
                <label htmlFor="article-image-input" className="cursor-pointer block">
                  <p className="text-sm font-medium text-neutral-700 mb-1">
                    {isUploading
                      ? "Uploading..."
                      : isDraggingFeaturedImage
                      ? "Drop image to upload"
                      : "Click or drag & drop article photo"}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Supports JPEG, PNG, WebP, GIF {isAdmin ? "(any size)" : "(max 3MB)"} — will be optimized to 896×504px
                  </p>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Article Title */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Article Title (H1) {requiredStar}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter your article title"
            required={!isAdmin}
            minLength={isAdmin ? undefined : MIN_TITLE_LENGTH}
            maxLength={isAdmin ? 255 : MAX_TITLE_LENGTH}
            className="w-full px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
          />
          <p
            className={`mt-1 text-xs ${
              !isAdmin && (title.trim().length < MIN_TITLE_LENGTH || title.trim().length > MAX_TITLE_LENGTH)
                ? "text-red-500"
                : "text-neutral-500"
            }`}
          >
            {title.trim().length}/{isAdmin ? 255 : MAX_TITLE_LENGTH} characters
            {!isAdmin ? ` (min ${MIN_TITLE_LENGTH})` : " (optional for admin)"}
          </p>
        </div>

        {/* Main Keyword */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">
            Main Keyword (used for SEO permalink) {requiredStar}
          </label>
          <input
            type="text"
            value={mainKeyword}
            onChange={(e) => setMainKeyword(e.target.value)}
            placeholder="e.g. ai automation tools"
            required={!isAdmin}
            className="w-full px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
          />
          {mainKeyword && (
            <p className="text-xs text-neutral-500 mt-1">
              Permalink: /{mainKeyword.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}
            </p>
          )}
        </div>

        {/* Article Body */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-1">
            <label className="block text-sm font-medium text-neutral-700">
              Article Body {requiredStar}
            </label>
            <button
              type="button"
              onClick={() => setIsHtmlMode((prev) => !prev)}
              className="text-xs px-3 py-1.5 rounded-lg border border-black/25 text-neutral-700 hover:bg-neutral-50"
            >
              {isHtmlMode ? "Use Visual Editor" : "Use HTML Source"}
            </button>
          </div>
          {isHtmlMode ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write or paste full HTML markup..."
              className="w-full min-h-[320px] px-4 py-3 border border-black/25 rounded-lg bg-white text-neutral-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
            />
          ) : (
            <div
              className="relative"
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
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={triggerBodyImageDialog}
                disabled={isUploadingBodyMedia}
                className="group flex items-center gap-3 p-3 border-2 border-dashed border-black/25 rounded-xl bg-white hover:border-[#b5121b] hover:bg-[#b5121b]/5 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#b5121b]/10 text-xl group-hover:bg-[#b5121b]/20">📷</span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-neutral-900">Insert Image</span>
                  <span className="block text-[11px] text-neutral-500 mt-0.5">Click or drag & drop</span>
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
              <button
                type="button"
                onClick={promptForCodeSandbox}
                className="group flex items-center gap-3 p-3 border-2 border-dashed border-black/25 rounded-xl bg-white hover:border-[#b5121b] hover:bg-[#b5121b]/5 transition-colors text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#b5121b]/10 text-xl group-hover:bg-[#b5121b]/20">🧩</span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-neutral-900">CodeSandbox</span>
                  <span className="block text-[11px] text-neutral-500 mt-0.5">Live code embed</span>
                </span>
              </button>
              <button
                type="button"
                onClick={promptForGist}
                className="group flex items-center gap-3 p-3 border-2 border-dashed border-black/25 rounded-xl bg-white hover:border-[#b5121b] hover:bg-[#b5121b]/5 transition-colors text-left"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#b5121b]/10 text-xl group-hover:bg-[#b5121b]/20">📄</span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-neutral-900">GitHub Gist</span>
                  <span className="block text-[11px] text-neutral-500 mt-0.5">Linked code snippet</span>
                </span>
              </button>
            </div>
          )}

          {!isHtmlMode && (
            <div className="mt-3 rounded-lg border border-neutral-300 bg-white p-4">
              <h4 className="text-sm font-semibold text-neutral-900">How to add media</h4>
              <ol className="mt-2 space-y-1 text-xs text-neutral-700">
                <li className="flex gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">1</span><span><span className="font-semibold">Drag &amp; drop</span> images directly onto the editor.</span></li>
                <li className="flex gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">2</span><span>Use <span className="font-semibold">Quick Insert buttons</span> above for images, YouTube, CodeSandbox, or GitHub Gist.</span></li>
                <li className="flex gap-2"><span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold text-white">3</span><span>Use <span className="font-semibold">code-block</span> from the toolbar for syntax-highlighted code.</span></li>
              </ol>
              <div className="mt-3 pt-3 border-t border-neutral-200 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-500">
                <span>Format: <span className="font-mono text-neutral-700">896 × 504 WebP</span></span>
                <span>Aspect ratio: <span className="font-mono text-neutral-700">16:9</span></span>
                {!isAdmin && <span>Max size: <span className="font-mono text-neutral-700">3 MB</span></span>}
              </div>
            </div>
          )}

          <p className="text-xs text-neutral-500 mt-2">
            HTML source mode preserves advanced tags like <code>&lt;section&gt;</code>, <code>&lt;article&gt;</code>, <code>&lt;abbr&gt;</code>, <code>&lt;dl&gt;</code>, <code>&lt;img&gt;</code>, and <code>&lt;hr&gt;</code>.
          </p>
        </div>

        {/* Category + Author */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Category {requiredStar}
            </label>
            {!showNewCategory ? (
              <div className="flex gap-2">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  required={!isAdmin}
                  className="flex-1 px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
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
                  className="px-3 py-2 text-sm border border-black/25 rounded-lg hover:bg-neutral-50 whitespace-nowrap"
                >
                  + New
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name"
                  className="flex-1 px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
                <button onClick={handleCreateCategory} className="px-3 py-2 bg-[#b5121b] text-white rounded-lg text-sm">Add</button>
                <button onClick={() => setShowNewCategory(false)} className="px-3 py-2 text-sm border border-black/25 rounded-lg">Cancel</button>
              </div>
            )}
            {selectedCategory?.status === "PENDING" && (
              <p className="mt-1 text-xs text-red-600">This category is pending approval.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Author Name {requiredStar}
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder={user?.name || "Your name"}
              required={!isAdmin}
              className="w-full px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
            />
          </div>
        </div>

        {/* C8: Source URL with cross-posting toggle */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <label className="block text-sm font-medium text-neutral-700">
              Source URL from Your Website {requiredStar}
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCrossPost}
                onChange={(e) => {
                  setIsCrossPost(e.target.checked);
                  if (!e.target.checked) setOriginalSourceUrl("");
                }}
                className="accent-[#b5121b] h-4 w-4"
              />
              <span className="text-xs text-neutral-600">
                I'm cross-posting from my website/social network
              </span>
            </label>
          </div>

          {isCrossPost ? (
            <>
              <input
                type="url"
                value={originalSourceUrl}
                onChange={(e) => setOriginalSourceUrl(e.target.value)}
                placeholder="https://yourwebsite.com/your-article"
                required={!isAdmin}
                className="w-full px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Source URL from Your Website (MANDATORY): You MUST add a backlink to this article on your own website/social network before submitting. In the "Source URL" field, provide the link to your website/social network page that includes a backlink pointing back to our website (ultimatecomputersoftware.com/your-article). This is a required condition for article publication.
              </p>
              <p className="text-xs text-amber-700 mt-1 bg-amber-50 px-2 py-1 rounded">
                ⚠️ Articles without a verified backlink to our site will be rejected.
              </p>
            </>
          ) : (
            <div className="p-3 border border-black/10 rounded-lg bg-neutral-50">
              <p className="text-sm text-neutral-600">
                Source URL from Your Website (MANDATORY): You MUST add a backlink to this article on your own website/social network before submitting. In the "Source URL" field, provide the link to your website/social network page that includes a backlink pointing back to our website (ultimatecomputersoftware.com/your-article). This is a required condition for article publication.
              </p>
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="block text-sm font-medium text-neutral-700">
              Tags {requiredStar}
            </label>
            {!showNewTag && categoryId && (
              <button
                type="button"
                onClick={() => setShowNewTag(true)}
                className="px-3 py-1.5 text-sm border border-black/25 rounded-lg hover:bg-neutral-50 whitespace-nowrap"
              >
                + New Tag
              </button>
            )}
          </div>

          <p className="text-xs text-neutral-500 mb-2">
            {selectedCategory
              ? <>Suggested topics for <span className="font-semibold text-neutral-800">{selectedCategory.name}</span>. Pick the ones that apply, or add a custom tag.</>
              : "Pick a category first — tag suggestions are tailored to the chosen category."}
          </p>

          {showNewTag && (
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder={selectedCategory ? `Custom tag for ${selectedCategory.name}` : "Custom tag name"}
                className="flex-1 px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
              />
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={creatingTag}
                className="px-3 py-2 bg-[#b5121b] text-white rounded-lg text-sm disabled:opacity-50"
              >
                {creatingTag ? "Adding..." : "Add"}
              </button>
              <button
                type="button"
                onClick={() => { setShowNewTag(false); setNewTagName(""); }}
                className="px-3 py-2 text-sm border border-black/25 rounded-lg"
              >
                Cancel
              </button>
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
              <div className="border border-black/25 rounded-lg p-3 max-h-56 overflow-y-auto space-y-3">
                {!categoryId && (
                  <div className="text-center py-6 text-xs text-neutral-500">
                    Select a category above to see tag suggestions.
                  </div>
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
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                        Suggested for {selectedCategory?.name}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">{suggested.map(renderTagButton)}</div>
                  </div>
                )}
                {categoryId && suggested.length === 0 && selectedFromOtherCategories.length === 0 && (
                  <div className="text-center py-4 text-xs text-neutral-500">
                    No tags exist for this category yet. Use <span className="font-semibold">+ New Tag</span> to add one.
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* C3: Article Series */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-2">
            Article Series <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <p className="text-xs text-neutral-500 mb-2">
            Group this article as part of a multi-part series so readers can navigate between parts.
          </p>
          {!showNewSeries ? (
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedSeriesId}
                onChange={(e) => setSelectedSeriesId(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
              >
                <option value="">None — standalone article</option>
                {series.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewSeries(true)}
                className="px-4 py-2 text-sm border border-black/25 rounded-lg hover:bg-neutral-50 whitespace-nowrap"
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
                placeholder="Series title (e.g. Introduction to Machine Learning)"
                className="w-full px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
              />
              <textarea
                value={newSeriesDesc}
                onChange={(e) => setNewSeriesDesc(e.target.value)}
                placeholder="Short description (optional)"
                rows={2}
                className="w-full px-4 py-2 border border-black/25 rounded-lg bg-white text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#b5121b] resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateSeries}
                  disabled={creatingSeries}
                  className="px-4 py-2 bg-[#b5121b] text-white text-sm rounded-lg disabled:opacity-50"
                >
                  {creatingSeries ? "Creating…" : "Create Series"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewSeries(false); setNewSeriesTitle(""); setNewSeriesDesc(""); }}
                  className="px-3 py-2 text-sm border border-black/25 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* K3: Article type selector */}
        <div>
          <label className="block text-sm font-semibold text-neutral-800 mb-2">
            Article Type
          </label>
          <div className="flex gap-2 flex-wrap">
            {(["ARTICLE", "AMA", "DISCUSSION"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setArticleType(type)}
                className={`px-4 py-2 text-sm border rounded-lg font-medium transition-colors ${
                  articleType === type
                    ? "bg-[#b5121b] text-white border-[#b5121b]"
                    : "border-black/25 text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {type === "ARTICLE" ? "📄 Article" : type === "AMA" ? "🎤 AMA" : "💬 Discussion"}
              </button>
            ))}
          </div>
          {articleType === "AMA" && (
            <div className="mt-3 space-y-2">
              <label className="text-sm text-neutral-600">AMA ends at (optional)</label>
              <input
                type="datetime-local"
                value={amaExpiresAt}
                onChange={(e) => setAmaExpiresAt(e.target.value)}
                min={new Date(Date.now() + 3_600_000).toISOString().slice(0, 16)}
                className="px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <p className="text-xs text-neutral-500">
                After this time, the AMA thread will be marked as ended. Leave empty for open-ended.
              </p>
            </div>
          )}
          {articleType === "DISCUSSION" && (
            <p className="mt-2 text-xs text-neutral-500">
              Discussion posts are lightweight posts focused on community conversation rather than long-form content.
            </p>
          )}
        </div>

        {/* C2: Scheduled publishing toggle */}
        {isAdmin && (
          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none mb-2">
              <input
                type="checkbox"
                checked={scheduleMode}
                onChange={(e) => {
                  setScheduleMode(e.target.checked);
                  if (!e.target.checked) setScheduledAt("");
                }}
                className="accent-[#b5121b] h-4 w-4"
              />
              <span className="text-sm font-medium text-neutral-700">Schedule for later publication</span>
            </label>
            {scheduleMode && (
              <div>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  className="px-4 py-2.5 border border-black/25 rounded-lg bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#b5121b]"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  The article will automatically be published at this date/time.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-black/15">
          {isAdminArticleEdit ? (
            <>
              <button
                onClick={() => handleSubmit()}
                disabled={saving}
                className="px-6 py-2.5 bg-[#b5121b] text-white rounded-lg hover:bg-[#8f0f16] font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              {scheduleMode && scheduledAt && (
                <button
                  onClick={() => handleSubmit("SCHEDULED")}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
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
                className="px-6 py-2.5 border border-black/25 rounded-lg hover:bg-neutral-50 text-neutral-700 font-medium disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
              {!(isAdmin && scheduleMode && scheduledAt) && (
                <button
                  onClick={() => handleSubmit("SUBMITTED")}
                  disabled={saving}
                  className="px-6 py-2.5 bg-[#b5121b] text-white rounded-lg hover:bg-[#8f0f16] font-medium disabled:opacity-50"
                >
                  {saving ? "Submitting..." : "Submit for Review"}
                </button>
              )}
              {isAdmin && scheduleMode && scheduledAt && (
                <button
                  onClick={() => handleSubmit("SCHEDULED")}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {saving ? "Scheduling..." : "Schedule Publication"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
