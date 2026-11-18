export type Result =
  | { ok: true; message?: string; warnings?: string[] }
  | { ok: false; error: string; details?: string[] };

export type Preview =
  | {
      ok: true;
      total: number;
      counts: { Pemula: number; Madya: number; Mahir: number };
      sample: { nis: string; name: string; level: string }[];
      errors: string[];
    }
  | { ok: false; error: string };
