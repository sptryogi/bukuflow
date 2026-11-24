import Link from "next/link";
import { requireRole } from "@/lib/session";
import { allProgramsBrief, getAssessSettings, getMaxStudents, listGurus, listInstitutionOptions } from "@/lib/q";
import { programState } from "@/lib/view";
import ProfileCard from "@/components/ProfileCard";
import SettingsCard from "@/components/SettingsCard";

export default async function AdminHome() {
  const me = await requireRole("admin");
  const [gurus, insts, programs, maxStudents, assess] = await Promise.all([listGurus(), listInstitutionOptions(), allProgramsBrief(), getMaxStudents(), getAssessSettings()]);
  const pending = gurus.filter((g) => g.status.startsWith("menunggu")).length;
  const running = programs.filter((p) => programState({ status: p.status, start_date: p.start_date, weeks: p.weeks, months: p.weeks / 4 }).phase === "berjalan").length;
  const waiting = programs.filter((p) => p.status === "menunggu_data").length;
  return (
    <>
      <section className="dash-hero">
        <p className="kicker">Panel Admin</p>
        <h1>Ringkasan</h1>
        <p className="sub">Profil admin, pengaturan, dan status keseluruhan program.</p>
      </section>
      <div className="stats">
        <Link href="/admin/institusi" className="stat"><div className="k">Institusi</div><div className="v">{insts.length}</div></Link>
        <Link href="/admin/guru" className="stat"><div className="k">Guru menunggu persetujuan</div><div className="v" style={{ color: pending ? "var(--warn)" : undefined }}>{pending}</div></Link>
        <div className="stat"><div className="k">Program berjalan</div><div className="v">{running}</div></div>
        <div className="stat"><div className="k">Program menunggu data murid</div><div className="v">{waiting}</div></div>
      </div>
      <SettingsCard maxStudents={maxStudents} printDay={assess.printDay} deadlineHours={assess.deadlineHours} />
      <ProfileCard user={me} />
    </>
  );
}
