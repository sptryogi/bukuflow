"use client";

import { saveSettings } from "@/app/actions/admin";
import { ActionForm } from "@/components/ui";

export default function SettingsCard({ maxStudents }: { maxStudents: number }) {
  return (
    <div className="card" id="pengaturan">
      <h2>Pengaturan</h2>
      <p className="muted small">
        Batas jumlah murid per program. Berlaku untuk unggahan template murid (guru maupun admin) dan jumlah baris pada template Excel.
        Bila murid lebih banyak dari judul buku, sistem membagi rata judul ke murid (tidak ada murid yang menerima judul sama dua kali dalam satu program).
      </p>
      <ActionForm action={saveSettings} submitLabel="Simpan pengaturan">
        <div className="fields" style={{ marginBottom: 0 }}>
          <div>
            <label className="f" htmlFor="max_students">Maksimal murid per program</label>
            <input id="max_students" name="max_students" type="number" min={1} max={5000} defaultValue={maxStudents} className="input" required />
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
