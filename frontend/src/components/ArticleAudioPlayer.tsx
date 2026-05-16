import { Pause, Play, RotateCcw } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";

type ArticleAudioPlayerProps = {
  src: string;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function ArticleAudioPlayer({ src }: ArticleAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setError("");
  }, [src]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const tick = () => {
      const audio = audioRef.current;
      if (audio) setCurrentTime(audio.currentTime);
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current != null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isPlaying]);

  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const rangeStyle = { "--audio-progress": `${progress}%` } as CSSProperties;

  const syncDuration = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        setError("");
        await audio.play();
      } catch {
        setError("Audio playback could not start.");
      }
    } else {
      audio.pause();
    }
  };

  const restart = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setCurrentTime(0);
  };

  const seek = (nextTime: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const boundedTime = duration > 0 ? Math.min(duration, Math.max(0, nextTime)) : 0;
    audio.currentTime = boundedTime;
    setCurrentTime(boundedTime);
  };

  return (
    <div className="article-audio-custom-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={syncDuration}
        onDurationChange={syncDuration}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className="article-audio-button"
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button
          type="button"
          onClick={restart}
          className="article-audio-secondary-button"
          aria-label="Restart audio"
        >
          <RotateCcw size={16} />
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={duration > 0 ? Math.min(currentTime, duration) : 0}
            onChange={(event) => seek(Number(event.target.value))}
            className="article-audio-range"
            style={rangeStyle}
            aria-label="Audio progress"
          />
          <div className="mt-1 flex items-center justify-between text-xs tabular-nums text-neutral-600">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
