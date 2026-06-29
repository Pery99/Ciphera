export type BitmojiConfig = {
  skin: string;
  hair: string;
  outfit: string;
  hairStyle: 0 | 1 | 2 | 3;
  mouthStyle: 0 | 1 | 2;
  hasGlasses: boolean;
  hasFreckles: boolean;
};

const SKINS = ["#FFCC9A", "#F5B07A", "#E8A065", "#C68655", "#8D5524"];
const HAIRS = ["#3D2314", "#1A1A1A", "#5C3D2E", "#D4A056", "#8B4513", "#2C1810", "#6B4423", "#4A3728"];
const OUTFITS = ["#7C5CFF", "#FF6B8A", "#00B894", "#0984E3", "#FDCB6E", "#E17055", "#6C5CE7", "#00CEC9"];

export function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick<T>(hash: number, slot: number, options: T[]) {
  return options[(hash + slot * 97) % options.length];
}

export function buildBitmojiConfig(seed: string): BitmojiConfig {
  const hash = hashSeed(seed);
  return {
    skin: pick(hash, 1, SKINS),
    hair: pick(hash, 2, HAIRS),
    outfit: pick(hash, 3, OUTFITS),
    hairStyle: (hash % 4) as BitmojiConfig["hairStyle"],
    mouthStyle: ((hash >> 3) % 3) as BitmojiConfig["mouthStyle"],
    hasGlasses: (hash & 8) === 0,
    hasFreckles: (hash & 16) === 0
  };
}