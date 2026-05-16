export type ArticleAudioStatus = "NONE" | "PROCESSING" | "READY" | "FAILED";

export type ArticleAudioFields = {
  audioUrl?: string | null;
  audioStatus?: ArticleAudioStatus | string | null;
};

export function hasReadyAudio(article: ArticleAudioFields): boolean {
  return article.audioStatus === "READY" && Boolean(article.audioUrl);
}
