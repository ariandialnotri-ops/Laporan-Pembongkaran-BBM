import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarClock, ClipboardCheck, Database, Printer, TriangleAlert } from 'lucide-react'
import { QrImg } from '@/components/apar/qr'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { aparUnitUrl, kondisiSemua, riwayatUnit, tipeLabel } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { AparRecord } from '@/lib/daily'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

/** Halaman satu unit APAR/APAB (tujuan label QR): data, kondisi terakhir, foto, dan riwayat. */
export function AparUnit() {
  const app = useApp()
  useSyncOnOpen()
  const { id = '' } = useParams()
  const records = useMemo(() => app.daily.filter((d): d is AparRecord => d.kind === 'apar'), [app.daily])
  const riwayat = useMemo(() => riwayatUnit(id, records), [id, records])
  const srcOf = usePhotoSrc(riwayat[0]?.cek.foto ?? [])
  if (!app.loaded) return <Loading />

  const k = kondisiSemua(app.settings, records, todayIso()).find((x) => x.unit.id === id)
  if (!k)
    return (
      <GlassCard level={1} className="flex flex-col items-center gap-space-sm p-space-md text-center">
        <span className="text-body-md font-semibold text-on-surface">Unit tidak ditemukan</span>
        <span className="text-body-sm text-on-surface-variant">Label QR ini tidak terdaftar di data utama (mungkin unitnya sudah dihapus).</span>
        <Link to="/apar" className={buttonVariants({ size: 'pill' })}>
          Ke dashboard APAR
        </Link>
      </GlassCard>
    )

  const u = k.unit
  const t = k.terakhir
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-md">
          <QrImg text={aparUnitUrl(u.id)} size={104} alt={`QR ${u.kode}`} className="rounded-sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="tabular text-headline-md font-bold text-on-surface">{u.kode || '-'}</span>
            <span className="text-body-sm font-semibold text-primary">{tipeLabel(k.tipe, u.cadangan)}</span>
            <span className="text-body-sm text-on-surface">
              {u.jenis}, {u.kapasitasKg || '-'} kg
            </span>
            <span className="text-body-sm text-on-surface-variant">{u.lokasi || 'Lokasi belum diatur'}</span>
          </div>
        </div>
        {u.kedaluwarsa && (
          <span
            className={cn(
              'tabular flex items-center gap-1.5 rounded-md px-space-sm py-space-xs text-body-sm font-semibold',
              k.isiUlang === 'lewat' ? 'bg-error-container/60 text-error' : k.isiUlang === 'segera' ? 'bg-amber-50 text-amber-700' : 'bg-surface-container-low text-on-surface',
            )}
          >
            <CalendarClock aria-hidden="true" className="size-4" />
            Isi ulang {formatTanggalIso(u.kedaluwarsa)}
            {k.isiUlang === 'lewat' ? ', sudah lewat' : k.isiUlang === 'segera' ? ', kurang dari 30 hari' : ''}
          </span>
        )}
        <Link to={`/apar/inspeksi?unit=${encodeURIComponent(u.id)}`} className={buttonVariants({ size: 'lg' })}>
          <ClipboardCheck aria-hidden="true" />
          Inspeksi unit ini
        </Link>
        <div className="grid grid-cols-2 gap-space-xs">
          <Link to={`/apar/label?unit=${encodeURIComponent(u.id)}`} className={buttonVariants({ variant: 'glass', size: 'sm' })}>
            <Printer aria-hidden="true" />
            Cetak label
          </Link>
          <Link to="/apar/data" className={buttonVariants({ variant: 'glass', size: 'sm' })}>
            <Database aria-hidden="true" />
            Data utama
          </Link>
        </div>
      </GlassCard>

      <section aria-labelledby="unit-kondisi" className="animate-entrance-2 flex flex-col gap-space-xs">
        <SectionHeader
          id="unit-kondisi"
          title="Kondisi terakhir"
          action={t?.status === 'temuan' ? <Pill tone="error">Ada temuan</Pill> : t ? <Pill tone="success">Baik</Pill> : <Pill>Belum diperiksa</Pill>}
        />
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          {!t ? (
            <span className="text-body-sm text-on-surface-variant">Unit ini belum pernah diinspeksi.</span>
          ) : (
            <>
              <span className="tabular text-body-sm text-on-surface">
                Diperiksa {formatTanggalIso(t.tanggal)} oleh {t.petugas || '-'}
                {!t.selesai && <span className="text-on-surface-variant"> (inspeksi belum diselesaikan)</span>}
                {!k.bulanIni && <span className="font-semibold text-amber-700">. Belum diperiksa bulan ini.</span>}
              </span>
              {t.temuan.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {t.temuan.map((x) => (
                    <li key={x} className="flex items-start gap-1.5 text-body-sm font-semibold text-error">
                      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      {x}
                    </li>
                  ))}
                </ul>
              )}
              {t.cek.catatan && <span className="text-body-sm text-on-surface">Catatan: {t.cek.catatan}</span>}
              {t.cek.foto.length > 0 && (
                <div className="flex gap-space-xs overflow-x-auto">
                  {t.cek.foto.map((p) => {
                    const src = srcOf(p)
                    return src ? (
                      <a key={p.id} href={src} target="_blank" rel="noreferrer" className="shrink-0">
                        <img src={src} alt={`Foto ${u.kode}`} className="size-28 rounded-md object-cover" />
                      </a>
                    ) : (
                      <span key={p.id} className="size-28 shrink-0 animate-pulse rounded-md bg-surface-container" />
                    )
                  })}
                </div>
              )}
            </>
          )}
        </GlassCard>
      </section>

      {riwayat.length > 0 && (
        <section aria-labelledby="unit-riwayat" className="animate-entrance-3 flex flex-col gap-space-xs">
          <SectionHeader id="unit-riwayat" title="Riwayat inspeksi" />
          <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
            {riwayat.slice(0, 12).map((r) => (
              <Link key={r.tanggal} to={`/apar/inspeksi?tanggal=${r.tanggal}&unit=${encodeURIComponent(u.id)}`} className="flex min-h-12 items-center gap-space-sm px-space-sm py-space-xs">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="tabular text-body-sm font-semibold text-on-surface">{formatTanggalIso(r.tanggal)}</span>
                  <span className="truncate text-body-sm text-on-surface-variant">{r.temuan.length ? r.temuan.join('; ') : `Semua butir baik, ${r.petugas || '-'}`}</span>
                </span>
                {r.status === 'temuan' ? <Pill tone="error">Temuan</Pill> : <Pill tone="success">Baik</Pill>}
              </Link>
            ))}
          </GlassCard>
        </section>
      )}
    </div>
  )
}
