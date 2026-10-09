import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronRight, ClipboardCheck, Database, FireExtinguisher, History, MapPin, QrCode, ScanLine, ShieldCheck, TriangleAlert } from 'lucide-react'
import { QrScanner } from '@/components/apar/qr'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { berlakuInstansi, kondisiSemua, tipeLabel, unitDariKode, unitIdDariQr, type KondisiUnit } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { AparRecord } from '@/lib/daily'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { cn } from '@/lib/utils'

type Filter = 'semua' | 'temuan' | 'belum' | 'isi' | 'instansi'

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
  const n = {
    total: kondisi.length,
    baik: kondisi.filter((k) => k.status === 'baik').length,
    temuan: kondisi.filter((k) => k.status === 'temuan').length,
    belum: kondisi.filter((k) => !k.bulanIni).length,
    isi: kondisi.filter((k) => k.isiUlang === 'lewat' || k.isiUlang === 'segera').length,
    // Pemeriksaan instansi berwenang (maks. 12 bulan): lewat, ≤ 30 hari, atau belum dicatat.
    instansi: kondisi.filter((k) => k.instansi !== 'ok').length,
    instansiLewat: kondisi.filter((k) => k.instansi === 'lewat').length,
    instansiBelum: kondisi.filter((k) => k.instansi === 'belum').length,
  }
  const lewat = kondisi.filter((k) => k.isiUlang === 'lewat').length
  const rows = kondisi.filter((k) => (filter === 'temuan' ? k.status === 'temuan' : filter === 'belum' ? !k.bulanIni : filter === 'isi' ? k.isiUlang === 'lewat' || k.isiUlang === 'segera' : filter === 'instansi' ? k.instansi !== 'ok' : true))

  // Per area (urutan: pulau, lalu area data utama, lalu lainnya).
  const urutan = [...Array.from({ length: s.jumlahPulau || 0 }, (_, i) => `Pulau pompa ${i + 1}`), ...(s.aparArea ?? [])]
  const areas = [...new Set([...urutan.filter((a) => kondisi.some((k) => k.unit.lokasi === a)), ...kondisi.map((k) => k.unit.lokasi || 'Tanpa lokasi')])]

  const bukaKode = (kode: string) => {
    const u = unitDariKode(
      kode,
      kondisi.map((k) => k.unit),
    )
    if (!u) return `Kode "${kode}" tidak ada di data utama.`
    navigate(`/apar/unit/${encodeURIComponent(u.id)}`)
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
          {app.can('/apar/inspeksi') && (
            <Link to="/apar/inspeksi" className={cn(buttonVariants({ size: 'lg' }), 'col-span-2')}>
              <ClipboardCheck aria-hidden="true" />
              Inspeksi unit ({n.total - n.belum}/{n.total} bulan ini)
            </Link>
          )}
          <Button variant="glass" className={cn(!app.can('/apar/label') && !app.can('/laporan/apar') && 'col-span-2')} onClick={() => setScan(true)}>
            <ScanLine aria-hidden="true" />
            Pindai QR
          </Button>
          {app.can('/apar/label') ? (
            <Link to="/apar/label" className={buttonVariants({ variant: 'glass' })}>
              <QrCode aria-hidden="true" />
              Label QR
            </Link>
          ) : app.can('/laporan/apar') ? (
            <Link to="/laporan/apar" className={buttonVariants({ variant: 'glass' })}>
              <History aria-hidden="true" />
              Riwayat
            </Link>
          ) : null}
          {app.can('/apar/data') && (
            <Link to="/apar/data" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'col-span-2')}>
              <Database aria-hidden="true" />
              Data utama (area & unit)
            </Link>
          )}
        </div>
      </GlassCard>

      {n.total === 0 ? (
        <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
          Belum ada unit. ABH mengisi jumlah pulau di Pengaturan SPBU, lalu area, APAR, APAR cadangan, dan APAB di Data utama.
        </GlassCard>
      ) : (
        <>
          <section aria-label="Ringkasan kondisi" className="animate-entrance-2 grid grid-cols-2 gap-space-xs sm:grid-cols-5">
            <Tile label="Kondisi baik" value={`${n.baik}/${n.total}`} sub="Pemeriksaan terakhir" tone="ok" />
            <Tile label="Ada temuan" value={String(n.temuan)} sub="Perlu tindak lanjut" tone={n.temuan ? 'bad' : undefined} />
            <Tile label="Belum bulan ini" value={String(n.belum)} sub="Unit belum diperiksa" tone={n.belum ? 'wait' : undefined} />
            <Tile label="Isi ulang" value={String(n.isi)} sub={lewat ? `${lewat} sudah lewat` : 'Lewat / ≤ 30 hari'} tone={lewat ? 'bad' : n.isi ? 'wait' : undefined} />
            <Tile
              className="col-span-2 sm:col-span-1"
              label="Uji instansi (12 bln)"
              value={String(n.instansi)}
              sub={n.instansiLewat ? `${n.instansiLewat} lewat masa berlaku` : n.instansiBelum ? `${n.instansiBelum} belum dicatat` : 'Semua masih berlaku'}
              tone={n.instansiLewat ? 'bad' : n.instansi ? 'wait' : 'ok'}
            />
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
                { value: 'instansi' as const, label: `Uji instansi ${n.instansi}` },
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

function Tile({ label, value, sub, tone, className }: { label: string; value: string; sub: string; tone?: 'ok' | 'bad' | 'wait'; className?: string }) {
  return (
    <div
      className={cn(
        className,
        'flex min-w-0 flex-col rounded-md p-space-sm',
        tone === 'ok' ? 'bg-emerald-50' : tone === 'bad' ? 'bg-error-container/60' : tone === 'wait' ? 'bg-amber-50' : 'bg-surface-container-lowest/80',
      )}
    >
      <span className="text-tag uppercase text-on-surface-variant">{label}</span>
      <span className={cn('tabular text-numeric-lg font-bold', tone === 'bad' ? 'text-error' : tone === 'ok' ? 'text-emerald-700' : tone === 'wait' ? 'text-amber-700' : 'text-on-surface')}>
        {value}
      </span>
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
        {(k.instansi === 'lewat' || k.instansi === 'segera') && (
          <span className={cn('tabular flex items-center gap-1 text-body-sm font-semibold', k.instansi === 'lewat' ? 'text-error' : 'text-amber-700')}>
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Uji instansi s/d {formatTanggalIso(berlakuInstansi(k.unit.periksaInstansi))}
            {k.instansi === 'lewat' ? ' (lewat)' : ''}
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
