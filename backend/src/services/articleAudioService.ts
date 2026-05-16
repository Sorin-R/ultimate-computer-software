import { promises as fs } from "fs";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";
import prisma from "../config/db";
import { env } from "../config/env";
import { stripHtml } from "../utils/sanitize";

type ArticleAudioSource = {
  id: string;
  title: string;
  body: string;
};

const AUDIO_UPLOAD_SUBDIR = "audio/articles";
const OPENROUTER_SPEECH_URL = "https://openrouter.ai/api/v1/audio/speech";
const FFMPEG_ERROR_DETAIL_CHARS = 1600;
const MP3_REENCODE_ARGS = [
  "-vn",
  "-af",
  "aformat=sample_fmts=s16:sample_rates=24000:channel_layouts=mono",
  "-acodec",
  "libmp3lame",
  "-q:a",
  "4",
];
const execFileAsync = promisify(execFile);

function normalizeArticleText(article: ArticleAudioSource): string {
  const spacedHtml = article.body
    .replace(/>\s*</g, "> <")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ");
  const bodyText = stripHtml(spacedHtml).replace(/\s+/g, " ").trim();
  return [article.title.trim(), bodyText].filter(Boolean).join(".\n\n");
}

function splitTextForTts(text: string): string[] {
  const maxChars = Math.max(500, env.OPENROUTER_TTS_CHUNK_CHARS || 3500);
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const sentenceBoundary = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf("\n")
    );
    const softBoundary = window.lastIndexOf(" ");
    const splitAt = sentenceBoundary > maxChars * 0.45 ? sentenceBoundary + 1 : softBoundary;

    if (splitAt <= 0) {
      chunks.push(window.trim());
      remaining = remaining.slice(maxChars).trim();
    } else {
      chunks.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function callOpenRouterTts(input: string, signal: AbortSignal): Promise<Buffer> {
  const response = await fetch(OPENROUTER_SPEECH_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.SITE_URL,
      "X-OpenRouter-Title": "Ultimate Computer Software",
    },
    body: JSON.stringify({
      input,
      model: env.OPENROUTER_TTS_MODEL,
      voice: env.OPENROUTER_TTS_VOICE,
      response_format: env.OPENROUTER_TTS_RESPONSE_FORMAT,
    }),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? JSON.stringify(await response.json())
      : await response.text();
    throw new Error(`OpenRouter TTS failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("audio/")) {
    throw new Error(`OpenRouter TTS returned unexpected content type: ${contentType || "unknown"}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function runFfmpeg(args: string[], cwd: string): Promise<void> {
  try {
    await execFileAsync("ffmpeg", args, {
      cwd,
      timeout: Math.max(30_000, env.OPENROUTER_TTS_TIMEOUT_MS),
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    const stderr =
      typeof (error as { stderr?: unknown }).stderr === "string"
        ? (error as { stderr: string }).stderr.trim()
        : "";
    const message = error instanceof Error ? error.message : String(error);
    const details = (stderr || message).replace(/\r/g, "\n").trim();
    const usefulDetails =
      details.length > FFMPEG_ERROR_DETAIL_CHARS
        ? details.slice(-FFMPEG_ERROR_DETAIL_CHARS)
        : details;
    throw new Error(`ffmpeg failed while preparing article audio: ${usefulDetails}`);
  }
}

async function writePlayableMp3(buffers: Buffer[], targetPath: string): Promise<void> {
  const targetDir = path.dirname(targetPath);
  const tempDir = await fs.mkdtemp(path.join(targetDir, `${path.basename(targetPath, ".mp3")}-tts-`));

  try {
    const outputName = "article.mp3";
    const outputPath = path.join(tempDir, outputName);

    if (buffers.length === 1) {
      await fs.writeFile(path.join(tempDir, "chunk-000.mp3"), buffers[0]);
      await runFfmpeg(["-y", "-i", "chunk-000.mp3", ...MP3_REENCODE_ARGS, outputName], tempDir);
    } else {
      const listLines: string[] = [];
      for (const [index, buffer] of buffers.entries()) {
        const chunkName = `chunk-${String(index).padStart(3, "0")}.mp3`;
        await fs.writeFile(path.join(tempDir, chunkName), buffer);
        listLines.push(`file '${chunkName}'`);
      }

      await fs.writeFile(path.join(tempDir, "chunks.txt"), `${listLines.join("\n")}\n`);
      await runFfmpeg(
        [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          "chunks.txt",
          ...MP3_REENCODE_ARGS,
          outputName,
        ],
        tempDir
      );
    }

    await fs.rename(outputPath, targetPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function markAudioFailed(articleId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.article.update({
    where: { id: articleId },
    data: {
      audioStatus: "FAILED",
      audioError: message.slice(0, 2000),
    },
  });
}

export async function generateArticleAudio(article: ArticleAudioSource): Promise<void> {
  if (!env.ARTICLE_AUDIO_ENABLED) return;

  if (env.ARTICLE_AUDIO_PROVIDER !== "openrouter-kokoro") {
    await markAudioFailed(article.id, `Unsupported ARTICLE_AUDIO_PROVIDER: ${env.ARTICLE_AUDIO_PROVIDER}`);
    return;
  }

  if (!env.OPENROUTER_API_KEY) {
    await markAudioFailed(article.id, "OPENROUTER_API_KEY is not configured.");
    return;
  }

  const responseFormat = env.OPENROUTER_TTS_RESPONSE_FORMAT.toLowerCase();
  if (responseFormat !== "mp3") {
    await markAudioFailed(article.id, "Only OPENROUTER_TTS_RESPONSE_FORMAT=mp3 is supported for article audio.");
    return;
  }

  const text = normalizeArticleText(article);
  if (text.length < 20) {
    await markAudioFailed(article.id, "Article does not contain enough text to generate audio.");
    return;
  }

  await prisma.article.update({
    where: { id: article.id },
    data: {
      audioStatus: "PROCESSING",
      audioError: null,
    },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(10_000, env.OPENROUTER_TTS_TIMEOUT_MS));

  try {
    const chunks = splitTextForTts(text);
    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      buffers.push(await callOpenRouterTts(chunk, controller.signal));
    }

    const audioDir = path.join(process.cwd(), "uploads", AUDIO_UPLOAD_SUBDIR);
    await fs.mkdir(audioDir, { recursive: true });

    const targetPath = path.join(audioDir, `${article.id}.mp3`);
    await writePlayableMp3(buffers, targetPath);

    await prisma.article.update({
      where: { id: article.id },
      data: {
        audioUrl: `/uploads/${AUDIO_UPLOAD_SUBDIR}/${article.id}.mp3`,
        audioStatus: "READY",
        audioGeneratedAt: new Date(),
        audioError: null,
      },
    });
  } catch (error) {
    await markAudioFailed(article.id, error);
  } finally {
    clearTimeout(timeout);
  }
}

export function queueArticleAudioGeneration(article: ArticleAudioSource): void {
  generateArticleAudio(article).catch((error) => {
    console.error("[articleAudio] generation failed:", error);
  });
}
