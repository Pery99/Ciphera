import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

type VoiceNotePlayerProps = {
  src: string;
  durationMs?: number | null;
  tone?: "mine" | "theirs";
};

export function VoiceNotePlayer({ src, durationMs, tone = "theirs" }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(Math.max(1, Math.round((durationMs ?? 0) / 1000)));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!audio.duration || Number.isNaN(audio.duration)) return;
      setProgress(audio.currentTime / audio.duration);
      setElapsed(Math.floor(audio.currentTime));
    };
    const onLoaded = () => {
      if (audio.duration && !Number.isNaN(audio.duration)) {
        setDuration(Math.max(1, Math.round(audio.duration)));
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setElapsed(0);
      audio.currentTime = 0;
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }

  const bars = useRef(Array.from({ length: 22 }, (_, index) => 30 + ((index * 19) % 54))).current;
  const activeBars = Math.floor(progress * bars.length);

  return (
    <div className={`voice-player voice-player--${tone}`}>
      <button type="button" className="voice-player-btn tap-spring" onClick={togglePlayback} aria-label={isPlaying ? "Pause voice note" : "Play voice note"}>
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className="voice-player-track" aria-hidden>
        {bars.map((height, index) => (
          <span
            key={index}
            className={`voice-player-bar ${index <= activeBars ? "active" : ""}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <span className="voice-player-time">{formatVoiceTime(isPlaying ? elapsed : duration)}</span>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}

function formatVoiceTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${String(remainingMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}