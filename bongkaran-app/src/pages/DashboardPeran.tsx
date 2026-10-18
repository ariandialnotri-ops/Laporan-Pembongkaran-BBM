import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CalendarDays, ChevronRight, ClipboardCheck, PiggyBank, Route, ScanEye, ShieldAlert, Sparkles, Truck } from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { InsidenRecord } from '@/lib/daily'
import { addDays, formatTanggalIso, todayIso } from '@/lib/date'
import { JUMLAH_SLOT, slotKini, statusSlot, type GtsRecord } from '@/lib/gts'
import { JENIS_INSIDEN, jenisLabel, statusMeta } from '@/lib/insiden'
import { formKategori, jatuhTempoAktivitas, judulForm, kepatuhanBulan } from '@/lib/ops'
import { labelStatus, rupiah, type PettyRecord } from '@/lib/petty'
import { LO_STATUS, loStatus } from '@/lib/plan'
import type { Role } from '@/lib/roles'
import { useOps } from '@/lib/use-ops'
import { cn } from '@/lib/utils'
import { KartuBertugas } from '@/pages/Personil'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

function Kartu({ icon: Icon, judul, sub, ke, aksi, children, className }: { icon: typeof Truck; judul: string; sub?: string; ke?: string; aksi?: string; children: ReactNode; className?: string }) {
  return (
    <GlassCard level={2} className={cn('flex flex-col gap-space-sm p-space-md', className)}>
      <div className="flex items-start gap-space-sm">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-md font-bold text-on-surface">{judul}</span>
          {sub && <span className="text-body-sm text-on-surface-variant">{sub}</span>}
        </div>
        {ke && (
          <Link to={ke} className="flex shrink-0 items-center gap-0.5 text-body-sm font-semibold text-primary">
            {aksi ?? 'Lihat'}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </div>
      {children}
    </GlassCard>
  )
}

function Angka({ items }: { items: [string, string | number, boolean?][] }) {
  return (
    <div className={cn('grid gap-space-xs', items.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
      {items.map(([l, v, buruk]) => (
        <div key={l} className={cn('rounded-md p-space-xs text-center', buruk ? 'bg-amber-50' : 'bg-surface-container-low')}>
          <span className={cn('tabular block text-headline-md font-bold', buruk ? 'text-amber-800' : 'text-on-surface')}>{v}</span>
          <span className="text-[11px] uppercase text-on-surface-variant">{l}</span>
        </div>
      ))}
    </div>
  )
}

/** Laporan insiden, near miss & kerusakan: jumlah per status dan laporan terbaru. */
function KartuInsiden() {
  const app = useApp()
  const semua = app.daily.filter((d): d is InsidenRecord => d.kind === 'insiden').sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.updatedAt - a.updatedAt)
  const n = (s: string) => semua.filter((r) => r.data.status === s).length
  return (
    <Kartu icon={ShieldAlert} judul="Laporan kerusakan, insiden & near miss" sub={JENIS_INSIDEN.map((j) => `${semua.filter((r) => r.data.jenis === j.value).length} ${j.label.toLowerCase()}`).join(' · ')} ke="/laporan/insiden" aksi="Riwayat">
      <Angka
        items={[
          ['Terbuka', n('terbuka'), n('terbuka') > 0],
          ['Ditindaklanjuti', n('proses')],
          ['Selesai', n('selesai')],
        ]}
      />
      {semua.slice(0, 4).map((r) => (
        <Link key={r.id} to={`/laporan/insiden/${encodeURIComponent(r.id)}`} className="flex items-center gap-space-sm rounded-md bg-surface-container-low px-space-sm py-space-xs">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-tag uppercase text-on-surface-variant">
              {jenisLabel(r.data.jenis)} · {formatTanggalIso(r.tanggal)}
            </span>
            <span className="truncate text-body-sm font-semibold text-on-surface">{r.data.kategori}</span>
          </span>
          <Pill tone={statusMeta(r.data.status).tone}>{statusMeta(r.data.status).label}</Pill>
        </Link>
      ))}
    </Kartu>
  )
}

/** Pengajuan petty cash dari peran ini saja (RLS: data.peran = peran pengguna / milik sendiri). */
function KartuPetty({ role }: { role: Role }) {
  const app = useApp()
  const [recs, setRecs] = useState<PettyRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const uid = app.session.user?.id ?? null
  useEffect(() => {
    const dari = todayIso(new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1))
    app.backend.listPetty(dari, todayIso()).then(
      (r) => setRecs(r.filter((x) => x.data.peran === role || (!!uid && x.createdBy === uid))),
      (e) => setError(pesan(e)),
    )
  }, [app.backend, app.spbuId, role, uid])
  const data = recs ?? []
  const n = (f: (r: PettyRecord) => boolean) => data.filter(f).length
  return (
    <Kartu icon={PiggyBank} judul={`Pengajuan petty cash ${role === 'cs' ? 'Cleaning Service' : 'Security'}`} sub="3 bulan terakhir, hanya pengajuan dari peran Anda" ke="/finance/petty/pengajuan" aksi="Ajukan / lihat">
      {error ? (
        <span className="text-body-sm text-error">{error}</span>
      ) : recs === null ? (
        <span className="text-body-sm text-on-surface-variant">Memuat…</span>
      ) : (
        <>
          <Angka
            items={[
              ['Menunggu', n((r) => r.status.startsWith('Menunggu')), n((r) => r.status.startsWith('Menunggu')) > 0],
              ['Disetujui', n((r) => r.status === 'Disetujui')],
              ['Ditolak', n((r) => r.status === 'Ditolak')],
            ]}
          />
          {data.slice(0, 4).map((r) => (
            <Link key={r.id} to={`/finance/petty/pengajuan/${encodeURIComponent(r.id)}`} className="flex items-center gap-space-sm rounded-md bg-surface-container-low px-space-sm py-space-xs">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="tabular text-tag uppercase text-on-surface-variant">
                  {r.no} · {formatTanggalIso(r.tanggal)}
                </span>
                <span className="truncate text-body-sm font-semibold text-on-surface">{r.data.uraian}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="tabular text-body-sm font-bold">{rupiah(r.total)}</span>
                <Pill tone={labelStatus(r) === 'Ditolak' ? 'error' : labelStatus(r).startsWith('Menunggu') ? 'cyan' : 'success'}>{labelStatus(r)}</Pill>
              </span>
            </Link>
          ))}
          {!data.length && <span className="text-body-sm text-on-surface-variant">Belum ada pengajuan.</span>}
        </>
      )}
    </Kartu>
  )
}

/** Dashboard Cleaning Service: progres & kepatuhan housekeeping, petty cash CS, laporan kejadian. */
export function DashboardCs() {
  const app = useApp()
  useSyncOnOpen()
  const hariIni = todayIso()
  const bulan = hariIni.slice(0, 7)
  const { recs } = useOps(todayIso(addDays(new Date(`${bulan}-01T00:00:00`), -62)), hariIni)
  const forms = useMemo(() => formKategori(app.role, app.settings, 'hk'), [app.role, app.settings])
  const k = useMemo(() => (recs ? kepatuhanBulan(forms, recs, bulan, hariIni) : null), [recs, forms, bulan, hariIni])
  const tempo = useMemo(() => (recs ? jatuhTempoAktivitas(forms, recs, hariIni) : []), [recs, forms, hariIni])
  if (!app.loaded) return <Loading />
  const hari = k?.hari.find((h) => h.tanggal === hariIni)
  const pekan = k?.hari.filter((h) => !h.nanti).slice(-14) ?? []
  return (
    <div className="flex flex-col gap-space-md">
      <KartuBertugas className="animate-entrance-1" />
      <Kartu icon={Sparkles} judul="Progres housekeeping hari ini" sub={`${forms.length} area checklist harian`} ke="/ops?grup=operasional" aksi="Isi checklist" className="animate-entrance-1">
        {!k || !hari ? (
          <span className="text-body-sm text-on-surface-variant">Memuat…</span>
        ) : (
          <>
            <div className="flex items-end justify-between gap-space-sm">
              <span className="tabular text-headline-lg font-bold text-on-surface">
                {hari.lengkap}/{hari.total}
              </span>
              <span className="text-body-sm text-on-surface-variant">area lengkap hari ini</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-container-high" role="img" aria-label={`${hari.lengkap} dari ${hari.total} area lengkap`}>
              <div className={cn('h-full rounded-full', hari.lengkap === hari.total ? 'bg-emerald-500' : 'bg-amber-400')} style={{ width: `${hari.total ? (hari.lengkap / hari.total) * 100 : 0}%` }} />
            </div>
          </>
        )}
      </Kartu>
      <Kartu icon={CalendarDays} judul="Kepatuhan housekeeping bulan ini" sub="Form harian terisi lengkap per tanggal" ke="/ops/kalender?kategori=hk" aksi="Kalender">
        {!k ? (
          <span className="text-body-sm text-on-surface-variant">Memuat…</span>
        ) : (
          <>
            <Angka
              items={[
                ['Kepatuhan', `${k.persen}%`, k.persen < 80],
                ['Hari lengkap', `${k.hariLengkap}/${k.hariDinilai}`],
                ['Temuan', k.temuan, k.temuan > 0],
              ]}
            />
            <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1" role="img" aria-label="Kepatuhan 14 hari terakhir">
              {pekan.map((h) => (
                <span
                  key={h.tanggal}
                  title={`${formatTanggalIso(h.tanggal)}: ${h.lengkap}/${h.total}`}
                  className={cn('aspect-square rounded-[4px]', !h.total ? 'bg-surface-container-low' : h.lengkap === h.total ? 'bg-emerald-500' : h.lengkap / h.total >= 0.5 ? 'bg-amber-400' : h.lengkap + h.sebagian ? 'bg-orange-200' : 'bg-red-200')}
                />
              ))}
            </div>
          </>
        )}
      </Kartu>
      <Kartu icon={CalendarClock} judul={`Jadwal pembersihan berkala (${tempo.length})`} sub="Aktivitas mingguan / 3 harian yang jatuh tempo hari ini">
        {!tempo.length ? (
          <span className="text-body-sm text-on-surface-variant">Semua sesuai jadwal.</span>
        ) : (
          tempo.slice(0, 6).map((x) => (
            <Link key={`${x.form}-${x.i}`} to={`/ops/${x.form}?tanggal=${hariIni}`} className="flex items-center gap-space-sm rounded-md bg-amber-50 px-space-sm py-space-xs text-body-sm">
              <span className="min-w-0 flex-1">
                <b className="text-on-surface">{x.item}</b> <span className="text-on-surface-variant">· {judulForm(x.form)} · {x.jadwal}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
            </Link>
          ))
        )}
      </Kartu>
      <KartuPetty role="cs" />
      <KartuInsiden />
    </div>
  )
}

/** Dashboard Security: pembongkaran, tracking LO, kepatuhan guard tour, laporan kejadian, petty cash security. */
export function DashboardSecurity() {
  const app = useApp()
  useSyncOnOpen()
  const hariIni = todayIso()
  const [gts, setGts] = useState<GtsRecord[] | null>(null)
  const kini = slotKini()
  useEffect(() => {
    app.backend.listGts(todayIso(addDays(new Date(), -7)), hariIni).then(setGts, () => setGts([]))
  }, [app.backend, app.spbuId, hariIni])
  if (!app.loaded) return <Loading />

  const bulan = hariIni.slice(0, 8)
  const bongkar = [...app.reports].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.updatedAt - a.updatedAt)
  const bulanIni = bongkar.filter((r) => r.tanggal >= `${bulan}01`)
  const los = app.plans.flatMap((p) => p.los.map((lo) => ({ lo, p, st: loStatus(lo, app.usedLoIds) })))
  // Kepatuhan guard tour: slot 2 jam yang sudah lewat dengan sampling JBT & JBKP lengkap.
  const hari7 = Array.from({ length: 7 }, (_, i) => todayIso(addDays(new Date(`${kini.tanggal}T00:00:00`), -6 + i)))
  const patuh = hari7.map((t) => {
    const st = Array.from({ length: JUMLAH_SLOT }, (_, s) => statusSlot(t, s, gts ?? [], kini))
    const dinilai = st.filter((x) => x !== 'nanti')
    return { t, sudah: st.filter((x) => x === 'sudah').length, dinilai: dinilai.length, st }
  })
  const tot = patuh.reduce((a, h) => a + h.dinilai, 0)
  const ok = patuh.reduce((a, h) => a + h.sudah, 0)
  const hari = patuh[patuh.length - 1]
  return (
    <div className="flex flex-col gap-space-md">
      <KartuBertugas className="animate-entrance-1" />
      <Kartu icon={ScanEye} judul="Kepatuhan guard tour (sampling JBT/JBKP)" sub="Slot 2 jam lengkap JBT & JBKP, 7 hari terakhir" ke="/gts" aksi="Sampling" className="animate-entrance-1">
        {gts === null ? (
          <span className="text-body-sm text-on-surface-variant">Memuat…</span>
        ) : (
          <>
            <Angka
              items={[
                ['Kepatuhan 7 hari', `${tot ? Math.round((ok / tot) * 100) : 0}%`, tot > 0 && ok / tot < 0.9],
                ['Hari ini', `${hari.sudah}/${hari.dinilai}`, hari.sudah < hari.dinilai],
                ['Slot terlewat', hari.st.filter((x) => x === 'terlewat').length, hari.st.includes('terlewat')],
              ]}
            />
            <div className="grid grid-cols-12 gap-1" role="img" aria-label="Status 12 slot hari ini">
              {hari.st.map((x, i) => (
                <span key={i} title={`Slot ${i + 1}`} className={cn('h-3 rounded-sm', x === 'sudah' ? 'bg-emerald-500' : x === 'terlewat' ? 'bg-red-400' : x === 'belum' ? 'bg-amber-400' : 'bg-surface-container-high')} />
              ))}
            </div>
          </>
        )}
      </Kartu>
      <Kartu icon={Truck} judul="Laporan pembongkaran" sub={`${bulanIni.length} bongkaran bulan ini · ${bongkar.filter((r) => r.status === 'draft').length} sedang berjalan`} ke="/laporan/bongkaran" aksi="Riwayat">
        {bongkar.slice(0, 4).map((r) => (
          <div key={r.id} className="flex items-center gap-space-sm rounded-md bg-surface-container-low px-space-sm py-space-xs">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="tabular text-tag uppercase text-on-surface-variant">
                {formatTanggalIso(r.tanggal)} {r.jam} · {r.produk}
              </span>
              <span className="truncate text-body-sm font-semibold text-on-surface">
                {r.nopol || '-'} · LO {r.noLOs.join(', ') || '-'}
              </span>
            </span>
            <Pill tone={r.status === 'draft' ? 'primary' : r.status === 'anomali' ? 'error' : 'success'}>{r.status === 'draft' ? 'Berjalan' : r.status === 'anomali' ? 'Anomali' : 'Selesai'}</Pill>
          </div>
        ))}
        {!bongkar.length && <span className="text-body-sm text-on-surface-variant">Belum ada pembongkaran.</span>}
      </Kartu>
      <Kartu icon={Route} judul="Tracking LO" sub="Status SO & LO dari plan sampai closed" ke="/laporan/lo" aksi="Tracking">
        <div className="grid grid-cols-3 gap-space-xs">
          {LO_STATUS.filter((s) => !['deleted', 'alih'].includes(s.key)).map((s) => (
            <div key={s.key} className="rounded-md bg-surface-container-low p-space-xs text-center">
              <span className="tabular block text-headline-md font-bold text-on-surface">{los.filter((x) => x.st === s.key).length}</span>
              <span className="text-[11px] uppercase text-on-surface-variant">{s.label}</span>
            </div>
          ))}
        </div>
      </Kartu>
      <KartuInsiden />
      <KartuPetty role="security" />
      <Link to="/ops?grup=lingkungan" className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low px-space-md py-space-sm text-body-md font-semibold text-on-surface">
        <span className="flex items-center gap-space-xs">
          <ClipboardCheck aria-hidden="true" className="size-5 text-primary" />
          Sumur pantau & oil catcher
        </span>
        <ChevronRight aria-hidden="true" className="size-5 text-on-surface-variant" />
      </Link>
    </div>
  )
}
