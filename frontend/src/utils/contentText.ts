export function cleanExcerptText(text: string | null | undefined): string | null {
  if (!text) return null;

  let decoded = text;
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    decoded = textarea.value;
  }

  return decoded.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}
