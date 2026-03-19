import avatarWoman1 from '@/assets/avatars/avatar-woman-1.png';
import avatarWoman2 from '@/assets/avatars/avatar-woman-2.png';
import avatarWoman3 from '@/assets/avatars/avatar-woman-3.png';
import avatarWoman4 from '@/assets/avatars/avatar-woman-4.png';
import avatarMan1 from '@/assets/avatars/avatar-man-1.png';
import avatarMan2 from '@/assets/avatars/avatar-man-2.png';
import avatarRobot1 from '@/assets/avatars/avatar-robot-1.png';
import avatarAnime1 from '@/assets/avatars/avatar-anime-1.png';
import avatarCat1 from '@/assets/avatars/avatar-cat-1.png';
import avatarAbstract1 from '@/assets/avatars/avatar-abstract-1.png';

const avatarMap: Record<string, string> = {
  '/src/assets/avatars/avatar-woman-1.png': avatarWoman1,
  '/src/assets/avatars/avatar-woman-2.png': avatarWoman2,
  '/src/assets/avatars/avatar-woman-3.png': avatarWoman3,
  '/src/assets/avatars/avatar-woman-4.png': avatarWoman4,
  '/src/assets/avatars/avatar-man-1.png': avatarMan1,
  '/src/assets/avatars/avatar-man-2.png': avatarMan2,
  '/src/assets/avatars/avatar-robot-1.png': avatarRobot1,
  '/src/assets/avatars/avatar-anime-1.png': avatarAnime1,
  '/src/assets/avatars/avatar-cat-1.png': avatarCat1,
  '/src/assets/avatars/avatar-abstract-1.png': avatarAbstract1,
};

export const defaultAvatar = avatarWoman1;

export function resolveAvatarUrl(dbUrl: string | null | undefined): string {
  if (!dbUrl) return defaultAvatar;
  if (dbUrl in avatarMap) return avatarMap[dbUrl];
  // If it's an absolute URL (e.g. uploaded to storage), use as-is
  if (dbUrl.startsWith('http')) return dbUrl;
  return defaultAvatar;
}
