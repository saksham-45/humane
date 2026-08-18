export const AVATAR_IDS = [
  "ink-0",
  "ink-1",
  "ink-2",
  "ink-3",
  "ink-4",
  "ink-5",
  "ink-6",
  "ink-7",
  "ink-8",
  "ink-9",
  "ink-10",
  "ink-11",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatar(id: string): id is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(id);
}

export const DEFAULT_AVATAR: AvatarId = "ink-0";
