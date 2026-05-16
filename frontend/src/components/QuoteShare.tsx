/**
 * QuoteShare — shows a floating "Share quote" button when the user selects
 * text inside the article body. Clicking the button opens a pre-filled
 * Twitter / X share link with the selected text.
 *
 * Usage: wrap the article body with <QuoteShareWrapper> and pass the
 * article title / URL for the tweet text.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Share2, Copy, Check } from "lucide-react";

interface Pos { top: number; left: number }

interface Props {
  children: ReactNode;
  articleTitle: string;
  articleUrl: string;
}

const MAX_QUOTE = 220; // chars of selected text included in tweet

export function QuoteShareWrapper({ children, articleTitle, articleUrl }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<{ pos: Pos; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setPopup(null);
        return;
      }

      const text = sel.toString().trim();
      if (!text || text.length < 10) { setPopup(null); return; }

      // Only show if the selection is inside our wrapper
      if (wrapperRef.current && !wrapperRef.current.contains(sel.anchorNode)) {
        setPopup(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const wrapRect = wrapperRef.current!.getBoundingClientRect();

      setPopup({
        text,
        pos: {
          // Centre the popup above the selection, relative to wrapper
          top: rect.top - wrapRect.top - 48,
          left: rect.left - wrapRect.left + rect.width / 2,
        },
      });
      setCopied(false);
    };

    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  const handleTweet = () => {
    if (!popup) return;
    const quote = popup.text.length > MAX_QUOTE
      ? popup.text.slice(0, MAX_QUOTE) + "…"
      : popup.text;
    const tweet = `"${quote}" — ${articleTitle}\n${articleUrl}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`,
      "_blank",
      "noopener,noreferrer,width=560,height=480"
    );
  };

  const handleCopy = async () => {
    if (!popup) return;
    const text = `"${popup.text}"\n\n— ${articleTitle}\n${articleUrl}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      {children}

      {popup && (
        <div
          className="absolute z-30 flex items-center gap-1 bg-neutral-900 text-white rounded-lg shadow-lg px-2 py-1.5 -translate-x-1/2 pointer-events-auto"
          style={{ top: popup.pos.top, left: popup.pos.left }}
          // Prevent the popup itself from clearing the selection
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="text-xs text-neutral-400 mr-1 hidden sm:inline">Share quote</span>
          <button
            onClick={handleTweet}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title="Share on X / Twitter"
            aria-label="Share selected quote on Twitter"
          >
            <Share2 size={14} />
          </button>
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            title={copied ? "Copied!" : "Copy quote"}
            aria-label="Copy selected quote"
          >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
