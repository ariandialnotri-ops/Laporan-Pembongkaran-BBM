import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, CircleCheck, Clock, FireExtinguisher, MapPin, ScanLine, Search, TriangleAlert } from 'lucide-react'
import { QrScanner } from '@/components/apar/qr'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { kondisiSemua, statusKedaluwarsa, tipeLabel, unitDariKode, unitDariPindai, type KondisiUnit } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { AparRecord } from '@/lib/daily'
import { formatBulanTahun, formatTanggalIso, todayIso } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { StatusIsi } from '@/lib/status-isi'

type Saring = 'belum' | 'sudah' | 'semua'

/**
 * Input > APAR & APAB > Inspeksi: petugas mendatangi unit, memindai label QR
 * (atau mengetik kode bila label rusak), lalu mengirim inspeksi unit itu saja.
 */
export function InspeksiApar() {
  const app = useApp()
  const navigate = useNavigate()
  useSyncOnOpen()
  const [scan, setScan] = useState(false)
  const [kode, setKode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saring, setSaring] = useState<Saring>('belum')
  const records = useMemo(() => app.daily.filter((d): d is AparRecord => d.kind === 'apar'), [app.daily])
  if (!app.loaded) return <Loading />

  const s = app.settings
  const today = todayIso()
  const kondisi = kondisiSemua(s, records, today)
  const units = kondisi.map((k) => k.unit)
  const sudah = kondisi.filter((k) => k.bulanIni)
  const rows = saring === 'belum' ? kondisi.filter((k) => !k.bulanIni) : saring === 'sudah' ? sudah : kondisi
  const temuan = kondisi.filter((k) => k.status === 'temuan').length
  const lewat = kondisi.filter((k) => k.isiUlang === 'lewat' || k.instansi === 'lewat').length
  const segera = kondisi.filter((k) => k.isiUlang === 'segera' || k.instansi === 'segera').length

  const buka = (unitId: string) => navigate(`/apar/inspeksi/${encodeURIComponent(unitId)}`)
  const cariKode = (k: string) => {
    const u = unitDariKode(k, units)
    if (!u) return `Kode "${k.trim()}" tidak ada di data utama. Periksa tulisan kode pada tabung.`
    buka(u.id)
    return null
  }

  return (
    <div className="flex flex-col gap-space-md">
      {/* Ringkasan bulan ini + aksi pindai (kartu merah gaya HSSE). */}
      <section aria-label="Ringkasan inspeksi bulan ini" className="animate-entrance-1 relative flex flex-col gap-space-sm overflow-hidden rounded-2xl bg-gradient-to-br from-[#9f1d1d] to-[#d03b3b] p-space-md text-white shadow-[0_12px_28px_-14px_rgba(159,29,29,0.7)]">
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-space-sm">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/75">Inspeksi APAR & APAB</span>
            <span className="text-headline-md font-bold">{formatBulanTahun(new Date(`${today.slice(0, 7)}-01T00:00:00`))}</span>
            <span className="text-body-sm text-white/85">
              {sudah.length} dari {kondisi.length} unit diperiksa
            </span>
          </span>
          {/* Cincin progres */}
          <span className="relative flex size-16 shrink-0 items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 36 36" className="absolute size-16 -rotate-90">
              <circle cx={18} cy={18} r={15} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={4} />
              <circle cx={18} cy={18} r={15} fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" strokeDasharray={`${kondisi.length ? (sudah.length / kondisi.length) * 94.2 : 0} 94.2`} />
            </svg>
            <span className="tabular text-body-sm font-bold">{kondisi.length ? Math.round((sudah.length / kondisi.length) * 100) : 0}%</span>
          </span>
        </div>
        <div className="relative grid grid-cols-4 gap-space-xs">
          {[
            ['Belum', kondisi.length - sudah.length],
            ['Temuan', temuan],
            ['Lewat masa', lewat],
            ['≤ 30 hari', segera],
          ].map(([l, n]) => (
            <span key={l} className="flex flex-col rounded-lg bg-white/15 px-2 py-1.5 ring-1 ring-inset ring-white/20">
              <span className="tabular text-body-lg font-bold leading-tight">{n}</span>
              <span className="text-xs leading-tight text-white/85">{l}</span>
            </span>
          ))}
        </div>
        <button type="button" onClick={() => setScan(true)} disabled={!units.length} className="relative flex min-h-12 items-center justify-center gap-2 rounded-full bg-white text-body-md font-bold text-[#9f1d1d] shadow-md active:scale-[0.98] disabled:opacity-60">
          <ScanLine aria-hidden="true" className="size-5" />
          Pindai QR unit
        </button>
      </section>

      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <div className="grid grid-cols-[1fr_auto] items-end gap-space-xs">
          <Field label="Label QR rusak? Ketik kode unit" htmlFor="apar-kode">
            <Input
              id="apar-kode"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Mis. APAR-01"
              value={kode}
              onChange={(e) => (setError(null), setKode(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setError(cariKode(kode))
                }
              }}
            />
          </Field>
          <Button variant="soft" disabled={!kode.trim()} onClick={() => setError(cariKode(kode))}>
            <Search aria-hidden="true" />
            Buka
          </Button>
        </div>
        {error && (
          <span role="alert" className="flex items-start gap-1.5 text-body-sm font-semibold text-error">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </span>
        )}
      </GlassCard>

      {units.length === 0 ? (
        <GlassCard level={1} className="flex flex-col items-center gap-space-sm p-space-md text-center">
          <span className="text-body-sm text-on-surface-variant">Belum ada unit APAR/APAB di data utama. Minta ABH mendaftarkan unit dan mencetak label QR.</span>
          {app.can('/apar/data') && (
            <Link to="/apar/data" className={buttonVariants({ size: 'pill' })}>
              Data utama
            </Link>
          )}
        </GlassCard>
      ) : (
        <section aria-label="Daftar unit" className="animate-entrance-2 flex flex-col gap-space-sm">
          <ChipFilter
            label="Saring unit"
            value={saring}
            onChange={setSaring}
            options={[
              { value: 'belum' as const, label: `Belum ${kondisi.length - sudah.length}` },
              { value: 'sudah' as const, label: `Sudah ${sudah.length}` },
              { value: 'semua' as const, label: `Semua ${kondisi.length}` },
            ]}
          />
          {rows.length === 0 && <p className="glass-1 rounded-lg p-space-md text-center text-body-sm text-on-surface-variant">{saring === 'belum' ? 'Semua unit sudah diinspeksi bulan ini.' : 'Belum ada unit diinspeksi bulan ini.'}</p>}
          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
            {rows.map((k) => (
              <KartuUnit key={k.unit.id} k={k} today={today} ke={app.can('/apar/unit/') ? `/apar/unit/${encodeURIComponent(k.unit.id)}` : undefined} />
            ))}
          </div>
          <span className="text-center text-body-sm text-on-surface-variant">Inspeksi dibuka dari label QR atau kode unit, agar dilakukan di lokasi unit. Ketuk kartu untuk data & riwayat unit.</span>
        </section>
      )}

      <QrScanner
        open={scan}
        onClose={() => setScan(false)}
        onKode={cariKode}
        onResult={(text) => {
          const { unit, pesan } = unitDariPindai(text, units)
          setScan(false)
          if (unit) buka(unit.id)
          else setError(pesan)
        }}
      />
    </div>
  )
}

/** Status unit bulan ini: hijau sudah, oranye belum, merah bila inspeksi bulan lalu juga terlewat. */
function statusUnit(k: KondisiUnit, today: string): StatusIsi {
  if (k.bulanIni) return 'sudah'
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00`)
  d.setMonth(d.getMonth() - 1)
  const awalBulanLalu = todayIso(d)
  return k.terakhir && k.terakhir.tanggal < awalBulanLalu ? 'terlewat' : 'belum'
}

const NADA_UNIT: Record<StatusIsi, { teks: string; ikon: string; label: string; Ikon: typeof CircleCheck }> = {
  sudah: { teks: 'bg-emerald-50 text-emerald-700', ikon: 'bg-emerald-100 text-emerald-700', label: 'Sudah', Ikon: CircleCheck },
  belum: { teks: 'bg-amber-100 text-amber-900', ikon: 'bg-amber-100 text-amber-800', label: 'Belum', Ikon: Clock },
  terlewat: { teks: 'bg-error-container text-on-error-container', ikon: 'bg-error-container text-error', label: 'Terlewat', Ikon: TriangleAlert },
  nanti: { teks: 'bg-surface-container-high text-on-surface-variant', ikon: 'bg-surface-container-high text-on-surface-variant', label: 'Nanti', Ikon: Clock },
}

/** Kartu informasi satu unit: kode & tipe, lokasi, status bulan ini, pemeriksaan terakhir, masa isi ulang & instansi. */
function KartuUnit({ k, today, ke }: { k: KondisiUnit; today: string; ke?: string }) {
  const t = k.terakhir
  const st = statusUnit(k, today)
  const n = NADA_UNIT[st]
  const chip = (label: string, s: ReturnType<typeof statusKedaluwarsa> | 'belum', batas?: string) =>
    s && s !== 'ok' ? (
      <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', s === 'lewat' ? 'bg-error-container text-on-error-container' : s === 'segera' ? 'bg-amber-100 text-amber-900' : 'bg-surface-container-high text-on-surface-variant')}>
        <CalendarClock aria-hidden="true" className="size-3" />
        {label} {s === 'lewat' ? 'lewat' : s === 'segera' ? `s/d ${batas ? formatTanggalIso(batas) : '≤ 30 hari'}` : 'belum dicatat'}
      </span>
    ) : null
  const isi = (
    <>
      <div className="flex items-start gap-space-sm">
        <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', n.ikon)}>
          <FireExtinguisher className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-1.5">
            <span className="tabular text-body-lg font-bold text-on-surface">{k.unit.kode || '-'}</span>
            <span className="truncate text-xs font-semibold uppercase text-on-surface-variant">{tipeLabel(k.tipe, k.unit.cadangan)}</span>
          </span>
          <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{k.unit.lokasi || 'Tanpa lokasi'}</span>
          </span>
        </span>
        <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold', n.teks)}>
          <n.Ikon aria-hidden="true" className="size-3.5" />
          {n.label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="tabular text-xs text-on-surface-variant">
          {t ? `Terakhir ${formatTanggalIso(t.tanggal)} · ${t.petugas || '-'}` : 'Belum pernah diinspeksi'}
        </span>
        {k.status === 'temuan' && (
          <span className="flex items-center gap-1 rounded-full bg-[#fde3d8] px-2 py-0.5 text-xs font-semibold text-[#8a2f0b]">
            <TriangleAlert aria-hidden="true" className="size-3" />
            Ada temuan
          </span>
        )}
        {chip('Isi ulang', k.isiUlang, k.unit.kedaluwarsa)}
        {chip('Instansi', k.instansi)}
      </div>
    </>
  )
  const kelas = cn('flex flex-col gap-space-xs rounded-xl border bg-surface-container-lowest p-space-sm shadow-sm', st === 'terlewat' ? 'border-error/40' : st === 'belum' ? 'border-amber-300' : 'border-outline-variant/40')
  return ke ? (
    <Link to={ke} className={cn(kelas, 'transition-transform active:scale-[0.99]')}>
      {isi}
    </Link>
  ) : (
    <div className={kelas}>{isi}</div>
  )
}
