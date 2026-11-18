import type { Level } from "./engine";

export type Role = "admin" | "guru";
export type UserStatus = "menunggu_email" | "menunggu_acc" | "aktif" | "ditolak";

export type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  institution_id: number | null;
  school_name: string | null;
  approved_via: "email" | "admin" | null;
  created_at: string;
};

export type Program = {
  id: number;
  institution_id: number;
  months: number;
  weeks: number;
  start_date: string; // YYYY-MM-DD (Senin)
  mode: "awal_bulan" | "lanjutan";
  continues_from: number | null;
  week_offset: number;
  status: "menunggu_data" | "siap";
  copies: number;
  alloc_error: string | null;
};

export type RosterRow = { id: number; nis: string; name: string; level: Level };

export const STATUS_LABEL: Record<UserStatus, string> = {
  menunggu_email: "Menunggu konfirmasi email",
  menunggu_acc: "Menunggu persetujuan admin",
  aktif: "Aktif",
  ditolak: "Ditolak",
};
