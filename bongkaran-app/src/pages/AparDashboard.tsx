import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronRight, ClipboardCheck, Database, FireExtinguisher, MapPin, QrCode, ScanLine, TriangleAlert } from 'lucide-react'
import { QrScanner } from '@/components/apar/qr'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { aparRecordId, hasilCek, kondisiSemua, tipeLabel, unitIdDariQr, type KondisiUnit } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { AparRecord } from '@/lib/daily'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { cn } from '@/lib/utils'

type Filter = 'semua' | 'temuan' | 'belum' | 'isi'

/** Input > APAR & APAB: kondisi semua unit, jadwal isi ulang, per area, dan akses inspeksi/QR. */
export function AparDashboard() {
  const app = useApp()
  const navigate = useNavigate()
  useSyncOnOpen()
  const [filter, setFilter] = useState<Filter>('semua')
  const [scan, setScan] = useState(false)
  const records = useMemo(() => app.daily.filter((d): d is AparRecord => d.kind === 'apar'), [app.daily])
  if (!app.loaded) return <Loading />

  const today = todayIso()
  const s = app.settings
  const kondisi = kondisiSemua(s, records, today)
  const hariIni = records.find((r) => r.id === aparRecordId(today))
  const sedang = hariIni && !hariIni.data.selesaiAt
  const diperiksaHariIni = hariIni ? hariIni.data.units.filter((u) => !hasilCek(u).kosong.length && u.foto.length).length : 0
  const n = {
    total: kondisi.length,
    baik: kondisi.filter((k) => k.status === 'baik').length,
    temuan: kondisi.filter((k) => k.status === 'temuan').length,
    belum: kondisi.filter((k) => !k.bulanIni).length,
    isi: kondisi.filter((k) => k.isiUlang === 'lewat' || k.isiUlang === 'segera').length,
  }
  const lewat = kondisi.filter((k) => k.isiUlang === 'lewat').length
  const rows = kondisi.filter((k) => (filter === 'temuan' ? k.status === 'temuan' : filter === 'belum' ? !k.bulanIni : filter === 'isi' ? k.isiUlang === 'lewat' || k.isiUlang === 'segera' : true))

  // Per area (urutan: pulau, lalu area data utama, lalu lainnya).
  const urutan = [...Array.from({ length: s.jumlahPulau || 0 }, (_, i) => `Pulau pompa ${i + 1}`), ...(s.aparArea ?? [])]
  const areas = [...new Set([...urutan.filter((a) => kondisi.some((k) => k.unit.lokasi === a)), ...kondisi.map((k) => k.unit.lokasi || 'Tanpa lokasi')])]

  const bukaKode = (kode: string) => {
    const k = kondisi.find((x) => x.unit.kode.trim().toLowerCase() === kode.trim().toLowerCase())
    if (!k) return `Kode "${kode}" tidak ada di data utama.`
    navigate(`/apar/unit/${encodeURIComponent(k.unit.id)}`)
    return null
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-error-container text-error">
            <FireExtinguisher className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="text-headline-md font-bold text-on-surface">Proteksi Kebakaran</h2>
            <span className="tabular text-body-sm text-on-surface-variant">
              {s.jumlahPulau || 0} pulau pompa, {kondisi.filter((k) => k.tipe === 'apar' && !k.unit.cadangan).length} APAR terpasang, {kondisi.filter((k) => k.unit.cadangan).length} cadangan,{' '}
              {kondisi.filter((k) => k.tipe === 'apab').length} APAB
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-space-xs">
          <Link to="/apar/inspeksi" className={cn(buttonVariants({ size: 'lg' }), 'col-span-2')}>
            <ClipboardCheck aria-hidden="true" />
            {sedang ? `Lanjutkan inspeksi (${diperiksaHariIni}/${n.total})` : hariIni ? 'Lihat inspeksi hari ini' : 'Mulai inspeksi'}
          </Link>
          <Button variant="glass" onClick={() => setScan(true)}>
            <ScanLine aria-hidden="true" />
            Pindai QR
          </Button>
          <Link to="/apar/label" className={buttonVariants({ variant: 'glass' })}>
            <QrCode aria-hidden="true" />
            Label QR
          </Link>
          <Link to="/apar/data" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'col-span-2')}>
            <Database aria-hidden="true" />
            Data utama (pulau, area, unit)
          </Link>
        </div>
      </GlassCard>

      {n.total === 0 ? (
        <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
          Belum ada unit. Buka Data utama untuk mengisi jumlah pulau, area, APAR, APAR cadangan, dan APAB.
        </GlassCard>
      ) : (
        <>
          <section aria-label="Ringkasan kondisi" className="animate-entrance-2 grid grid-cols-2 gap-space-xs sm:grid-cols-4">
            <Tile label="Kondisi baik" value={`${n.baik}/${n.total}`} sub="Pemeriksaan terakhir" tone="ok" />
            <Tile label="Ada temuan" value={String(n.temuan)} sub="Perlu tindak lanjut" tone={n.temuan ? 'bad' : undefined} />
            <Tile label="Belum bulan ini" value={String(n.belum)} sub="Unit belum diperiksa" tone={n.belum ? 'wait' : undefined} />
            <Tile label="Isi ulang" value={String(n.isi)} sub={lewat ? `${lewat} sudah lewat` : 'Lewat / ≤ 30 hari'} tone={lewat ? 'bad' : n.isi ? 'wait' : undefined} />
          </section>

          <section aria-labelledby="apar-area" className="animate-entrance-3 flex flex-col gap-space-xs">
            <SectionHeader id="apar-area" title="Per area" />
            <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
              {areas.map((a) => {
                const ks = kondisi.filter((k) => (k.unit.lokasi || 'Tanpa lokasi') === a)
                const t = ks.filter((k) => k.status === 'temuan').length
                const b = ks.filter((k) => !k.bulanIni).length
                return (
                  <div key={a} className="flex min-h-12 items-center gap-space-sm px-space-sm py-space-xs">
                    <MapPin aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body-sm font-semibold text-on-surface">{a}</span>
                      <span className="truncate text-body-sm text-on-surface-variant">{ks.map((k) => k.unit.kode).join(', ')}</span>
                    </span>
                    {t ? <Pill tone="error">{t} temuan</Pill> : b ? <Pill>{b} belum</Pill> : <Pill tone="success">Baik</Pill>}
                  </div>
                )
              })}
            </GlassCard>
          </section>

          <section aria-labelledby="apar-daftar" className="animate-entrance-3 flex flex-col gap-space-xs">
            <SectionHeader id="apar-daftar" title="Daftar unit" />
            <ChipFilter
              label="Saring unit"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'semua' as const, label: `Semua ${n.total}` },
                { value: 'temuan' as const, label: `Temuan ${n.temuan}` },
                { value: 'belum' as const, label: `Belum bulan ini ${n.belum}` },
                { value: 'isi' as const, label: `Isi ulang ${n.isi}` },
              ]}
            />
            <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
              {rows.length === 0 && <p className="p-space-md text-center text-body-sm text-on-surface-variant">Tidak ada unit pada saringan ini.</p>}
              {rows.map((k) => (
                <UnitRow key={k.unit.id} k={k} />
              ))}
            </GlassCard>
          </section>
        </>
      )}

      <QrScanner
        open={scan}
        onClose={() => setScan(false)}
        onKode={bukaKode}
        onResult={(text) => {
          const id = unitIdDariQr(text)
          setScan(false)
          if (id) navigate(`/apar/unit/${encodeURIComponent(id)}`)
          else window.alert('QR ini bukan label APAR/APAB FLOQ.')
        }}
      />
    </div>
  )
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'ok' | 'bad' | 'wait' }) {
  return (
    <div className={cn('flex min-w-0 flex-col rounded-md p-space-sm', tone === 'ok' ? 'bg-emerald-50' : tone === 'bad' ? 'bg-error-container/60' : tone === 'wait' ? 'bg-amber-50' : 'bg-surface-container-lowest/80')}>
      <span className="text-tag uppercase text-on-surface-variant">{label}</span>
      <span className={cn('tabular text-numeric-lg font-bold', tone === 'bad' ? 'text-error' : tone === 'ok' ? 'text-emerald-700' : tone === 'wait' ? 'text-amber-700' : 'text-on-surface')}>{value}</span>
      <span className="truncate text-body-sm text-on-surface-variant">{sub}</span>
    </div>
  )
}

function UnitRow({ k }: { k: KondisiUnit }) {
  return (
    <Link to={`/apar/unit/${encodeURIComponent(k.unit.id)}`} className="flex min-h-14 items-center gap-space-sm px-space-sm py-space-xs">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 text-body-sm font-semibold text-on-surface">
          <span className="tabular">{k.unit.kode || '-'}</span>
          <span className="font-normal text-on-surface-variant">{tipeLabel(k.tipe, k.unit.cadangan)}</span>
        </span>
        <span className="truncate text-body-sm text-on-surface-variant">
          {k.unit.lokasi || 'Tanpa lokasi'}, {k.terakhir ? `diperiksa ${formatTanggalIso(k.terakhir.tanggal)}` : 'belum pernah diperiksa'}
        </span>
        {(k.isiUlang === 'lewat' || k.isiUlang === 'segera') && (
          <span className={cn('tabular flex items-center gap-1 text-body-sm font-semibold', k.isiUlang === 'lewat' ? 'text-error' : 'text-amber-700')}>
            <CalendarClock aria-hidden="true" className="size-3.5" />
            Isi ulang {formatTanggalIso(k.unit.kedaluwarsa)}
            {k.isiUlang === 'lewat' ? ' (lewat)' : ''}
          </span>
        )}
      </span>
      {k.status === 'temuan' ? (
        <Pill tone="error">
          <TriangleAlert aria-hidden="true" />
          Temuan
        </Pill>
      ) : k.status === 'baik' ? (
        <Pill tone="success">Baik</Pill>
      ) : (
        <Pill>Belum</Pill>
      )}
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
    </Link>
  )
}
