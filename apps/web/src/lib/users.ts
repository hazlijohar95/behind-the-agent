import { type Profile, profileRepo } from "@btc/db";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  banned: boolean;
};

export type RecentMember = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  createdAt: number;
};

const toAdminUser = (p: Profile): AdminUser => ({
  id: p.id,
  name: p.name,
  email: p.email,
  image: p.image,
  role: p.role,
  banned: p.banned,
});

export async function listUsers(limit = 200): Promise<AdminUser[]> {
  return (await profileRepo.listProfiles(limit)).map(toAdminUser);
}

export async function listRecentMembers(limit = 5): Promise<RecentMember[]> {
  return (await profileRepo.listProfiles(limit)).map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    image: p.image,
    role: p.role,
    createdAt: p.createdAt,
  }));
}

export const countAdmins = profileRepo.countAdmins;
export const setUserRole = profileRepo.setRole;
export const setUserBanned = profileRepo.setBanned;
