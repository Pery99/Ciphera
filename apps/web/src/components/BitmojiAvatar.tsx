import { useMemo } from "react";
import type { UserProfile } from "@ciphera/types";
import { buildBitmojiConfig } from "../bitmojiSeed.ts";

type BitmojiAvatarProps = {
  user: Pick<UserProfile, "id" | "username" | "name">;
  size?: number;
  large?: boolean;
  className?: string;
};

export function BitmojiAvatar({ user, size, large = false, className = "" }: BitmojiAvatarProps) {
  const config = useMemo(() => buildBitmojiConfig(user.id || user.username), [user.id, user.username]);
  const dimension = size ?? (large ? 74 : 52);

  return (
    <span className={`avatar bitmoji-avatar ${large ? "large" : ""} ${className}`.trim()} style={{ width: dimension, height: dimension }}>
      <svg viewBox="6 6 108 108" aria-hidden>
        <defs>
          <clipPath id={`bitmoji-clip-${user.id}`}>
            <circle cx="60" cy="60" r="54" />
          </clipPath>
        </defs>
        <g clipPath={`url(#bitmoji-clip-${user.id})`}>
          <rect width="120" height="120" fill={config.outfit} />
          <path d="M24 78c2-28 18-46 36-46s34 18 36 46c1 14-10 24-36 24S23 92 24 78Z" fill={config.outfit} />
          <path d="M34 74c1-18 12-30 26-30s25 12 26 30c1 10-8 17-26 17S33 84 34 74Z" fill={config.skin} />
          {renderHair(config)}
          <circle cx="48" cy="66" r="5.5" fill="#fff" />
          <circle cx="72" cy="66" r="5.5" fill="#fff" />
          <circle cx="49" cy="67" r="2.8" fill="#1A1A1A" />
          <circle cx="73" cy="67" r="2.8" fill="#1A1A1A" />
          <circle cx="50" cy="65.5" r="1" fill="#fff" />
          <circle cx="74" cy="65.5" r="1" fill="#fff" />
          {config.hasGlasses && (
            <>
              <circle cx="48" cy="66" r="10" stroke="#1A1A1A" strokeWidth="2.2" fill="none" />
              <circle cx="72" cy="66" r="10" stroke="#1A1A1A" strokeWidth="2.2" fill="none" />
              <path d="M58 66h4" stroke="#1A1A1A" strokeWidth="2.2" />
            </>
          )}
          {renderMouth(config)}
          <ellipse cx="41" cy="73" rx="4.5" ry="3" fill="#FFB4A2" opacity="0.55" />
          <ellipse cx="79" cy="73" rx="4.5" ry="3" fill="#FFB4A2" opacity="0.55" />
          {config.hasFreckles && (
            <>
              <circle cx="44" cy="70" r="1.1" fill="#C96B45" opacity="0.55" />
              <circle cx="52" cy="72" r="1.1" fill="#C96B45" opacity="0.55" />
              <circle cx="68" cy="72" r="1.1" fill="#C96B45" opacity="0.55" />
              <circle cx="76" cy="70" r="1.1" fill="#C96B45" opacity="0.55" />
            </>
          )}
        </g>
      </svg>
    </span>
  );
}

function renderHair(config: ReturnType<typeof buildBitmojiConfig>) {
  if (config.hairStyle === 0) {
    return <path d="M42 48c0-10 8-18 18-18s18 8 18 18c0 6-14 8-18 8s-18-2-18-8Z" fill={config.hair} />;
  }
  if (config.hairStyle === 1) {
    return (
      <>
        <path d="M38 52c0-14 10-24 22-24s22 10 22 24c-6 2-12 3-22 3S44 54 38 52Z" fill={config.hair} />
        <path d="M40 40c8-8 32-8 40 0" stroke={config.hair} strokeWidth="8" strokeLinecap="round" />
      </>
    );
  }
  if (config.hairStyle === 2) {
    return (
      <>
        <path d="M40 50c2-12 12-20 20-20s18 8 20 20" fill={config.hair} />
        <circle cx="44" cy="42" r="7" fill={config.hair} />
        <circle cx="76" cy="42" r="7" fill={config.hair} />
      </>
    );
  }
  return (
    <>
      <path d="M42 46c0-12 8-20 18-20s18 8 18 20v6H42z" fill={config.hair} />
      <path d="M60 30c-2 0-4-2-4-5s2-6 4-6 4 3 4 6-2 5-4 5Z" fill={config.hair} />
    </>
  );
}

function renderMouth(config: ReturnType<typeof buildBitmojiConfig>) {
  if (config.mouthStyle === 0) {
    return <path d="M46 78c6 7 22 7 28 0" stroke="#C96B45" strokeWidth="3.2" strokeLinecap="round" />;
  }
  if (config.mouthStyle === 1) {
    return <path d="M48 79h24" stroke="#C96B45" strokeWidth="3.2" strokeLinecap="round" />;
  }
  return (
    <>
      <path d="M48 77c8 10 16 10 24 0" stroke="#C96B45" strokeWidth="3" strokeLinecap="round" />
      <path d="M54 81c4 2 8 2 12 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
    </>
  );
}
