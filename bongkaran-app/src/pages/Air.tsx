import { useMemo, useState } from 'react'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { Trash2 } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { TangkiBelumAda } from '@/components/bongkaran/stok-gate'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { airLengkap, literAir, statusAir, tangkiBerair, type AirRecord, type AirTangki } from '@/lib/air'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatLiter } from '@/lib/format'
import { statusHarian } from '@/lib/harian'
import { shiftLabel } from '@/lib/shift'
import { TANKS, tankName, type Tank } from '@/lib/tank'
import { useAir } from '@/lib/use-air'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

// Water content diisi di Kontrol Kualitas Harian (QqHarian); halaman ini hanya riwayatnya.
const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const namaTangki = (t: Tank) => `${tankName(t.tankNo)} · ${t.produk}`
const keteranganMm = (t: AirTangki | undefined, tank: Tank | undefined) => {
  const st = statusAir(t)
  if (st === 'kosong' || !t) return '-'
  if (st === 'nihil') return 'Nihil'
  const l = t.liter ?? literAir(tank, t.airMm)
  return `${t.airMm} mm${l ? ` ≈ ${formatLiter(l)}` : ''}`
}

/** Report > Riwayat Water Content: per bulan, temuan air disorot, foto stik pasta air. */
export function LaporanAir() {
  const app = useApp()
  const konfirmasi = useKonfirmasi()
  const toast = useToast()
  const hariIni = todayIso()
  const [bulan, setBulan] = useState(hariIni.slice(0, 7))
  const akhir = todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0))
  const { recs, error, muat } = useAir(`${bulan}-01`, akhir)
  const fotos = useMemo(() => (recs ?? []).flatMap((r) => Object.values(r.data.tangki).flatMap((t) => t.foto.slice(0, 1))), [recs])
  const srcOf = usePhotoSrc(fotos)
  if (!app.loaded) return <Loading />
  if (!TANKS.length) return <TangkiBelumAda className="animate-entrance-1" />
  const data = [...(recs ?? [])].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.shift - a.shift)
  const temuan = data.filter((r) => tangkiBerair(r, TANKS).length).length
  // Hari pada bulan ini yang sudah lewat batas 10:00 tanpa pemeriksaan (sekali sehari).
  const nHari = Number(akhir.slice(8))
  let wajib = 0
  let terlewat = 0
  for (let d = 1; d <= nHari; d++) {
    const t = `${bulan}-${String(d).padStart(2, '0')}`
    const st = statusHarian(t, data.some((r) => r.tanggal === t && airLengkap(r, TANKS)))
    if (st !== 'nanti') wajib++
    if (st === 'terlewat') terlewat++
  }
  const bolehHapus = app.role === 'abh' || app.role === 'pengawas'
  const hapus = async (r: AirRecord) => {
    if (!(await konfirmasi({ judul: 'Hapus water content?', pesan: <>Catatan water content <b>{formatTanggalIso(r.tanggal)} {shiftLabel(r.shift)}</b> akan dihapus dari riwayat.</> }))) return
    try {
      await app.backend.deleteAir(r.id)
      for (const t of Object.values(r.data.tangki)) for (const p of t.foto) void app.backend.deletePhoto(p).catch(() => {})
      toast('Catatan dihapus')
      void muat()
    } catch (e) {
      toast(pesan(e))
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <Field label="Bulan" htmlFor="lair-bulan">
          <Input id="lair-bulan" type="month" max={hariIni.slice(0, 7)} value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-space-xs text-center">
          <div className="rounded-md bg-surface-container-low p-space-xs">
            <span className="tabular block text-numeric-md font-bold text-on-surface">{data.length}</span>
            <span className="text-xs uppercase text-on-surface-variant">Pengecekan</span>
          </div>
          <div className={cn('rounded-md p-space-xs', temuan ? 'bg-error-container' : 'bg-surface-container-low')}>
            <span className={cn('tabular block text-numeric-md font-bold', temuan ? 'text-on-error-container' : 'text-on-surface')}>{temuan}</span>
            <span className="text-xs uppercase text-on-surface-variant">Ada air</span>
          </div>
          <div className="rounded-md bg-surface-container-low p-space-xs">
            <span className="tabular block text-numeric-md font-bold text-on-surface">
              {terlewat}/{wajib}
            </span>
            <span className="text-xs uppercase text-on-surface-variant">Hari terlewat</span>
          </div>
        </div>
        <ErrorBox text={error} />
      </GlassCard>

      <section aria-labelledby="lair-daftar" className="flex flex-col gap-space-sm">
        <SectionHeader id="lair-daftar" title={`Pengecekan (${data.length})`} />
        {recs === null ? (
          <Loading />
        ) : !data.length ? (
          <GlassCard level={1} className="p-space-md text-center text-body-md text-on-surface-variant">
            Belum ada pengecekan water content pada bulan ini.
          </GlassCard>
        ) : (
          data.map((r) => {
            const berair = tangkiBerair(r, TANKS).length > 0
            return (
              <GlassCard key={r.id} level={2} className={cn('flex flex-col gap-space-sm p-space-md', berair && 'border border-error/40')}>
                <div className="flex items-start justify-between gap-space-sm">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-md font-bold text-on-surface">
                      {formatTanggalIso(r.tanggal)} · {shiftLabel(r.shift).split(' (')[0]}
                      {r.data.terlambat ? ' · terlambat' : ''}
                    </span>
                    <span className="text-body-sm text-on-surface-variant">
                      {r.data.petugas || '-'} · {r.data.jam}
                      {r.data.catatan ? ` · ${r.data.catatan}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Pill tone={berair ? 'error' : 'success'}>{berair ? 'Ada air' : 'Nihil'}</Pill>
                    {bolehHapus && (
                      <Button variant="ghost" size="icon" aria-label="Hapus" onClick={() => void hapus(r)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-outline-variant/40 rounded-md bg-surface-container-low/60">
                  {TANKS.map((t) => {
                    const x = r.data.tangki[t.id]
                    const st = statusAir(x)
                    const foto = x?.foto[0]
                    const src = foto ? srcOf(foto) : undefined
                    return (
                      <div key={t.id} className="flex items-center gap-space-sm px-space-sm py-space-xs">
                        {src ? (
                          <a href={src} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={src} alt={`Pasta air ${namaTangki(t)}`} className="size-12 rounded-md object-cover" />
                          </a>
                        ) : (
                          <span className="size-12 shrink-0 rounded-md bg-surface-container" />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-body-sm font-semibold text-on-surface">{namaTangki(t)}</span>
                          {x?.tindakan && <span className="text-body-sm text-on-surface-variant">Tindakan: {x.tindakan}</span>}
                        </span>
                        <span className={cn('tabular shrink-0 text-body-sm font-bold', st === 'ada' ? 'text-error' : st === 'nihil' ? 'text-on-tertiary-fixed-variant' : 'text-on-surface-variant')}>{keteranganMm(x, t)}</span>
                      </div>
                    )
                  })}
                </div>
              </GlassCard>
            )
          })
        )}
      </section>
    </div>
  )
}
