"use client";

import { saveSettings } from "@/app/actions/admin";
import { ActionForm } from "@/components/ui";

export default function SettingsCard({ maxStudents, printDay, deadlineHours }: { maxStudents: number; printDay: number; deadlineHours: number }) {
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
          <div>
            <label className="f" htmlFor="assess_print_day">Cetak asesmen dibuka: hari ke-… sesudah rilis minggu</label>
            <input id="assess_print_day" name="assess_print_day" type="number" min={0} max={6} defaultValue={printDay} className="input" required />
            <div className="muted small" style={{ marginTop: 4 }}>3 = Kamis (bila program mulai Senin). 0 = langsung saat minggu dirilis, cocok untuk uji coba.</div>
          </div>
          <div>
            <label className="f" htmlFor="assess_deadline_hours">Batas unggah nilai: jam sesudah rilis minggu berikutnya</label>
            <input id="assess_deadline_hours" name="assess_deadline_hours" type="number" min={0} max={72} defaultValue={deadlineHours} className="input" required />
            <div className="muted small" style={{ marginTop: 4 }}>6 = Senin 08.00 WIB (rilis pukul 02.00).</div>
          </div>
        </div>
      </ActionForm>
    </div>
  );
}
