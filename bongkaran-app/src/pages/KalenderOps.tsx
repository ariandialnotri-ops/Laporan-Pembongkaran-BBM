import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BrushCleaning, CalendarClock, ChevronRight, Wrench } from 'lucide-react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { GlassCard } from '@/components/ui/glass-card'
import { InfoPop } from '@/components/ui/info-pop'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useApp } from '@/lib/app-state'
import { addDays, formatTanggalIso, todayIso } from '@/lib/date'
import { formKategori, jatuhTempoAktivitas, judulForm, kepatuhanBulan, opsId, statusOps, STATUS_LABEL, type KepatuhanHari, type OpsStatus } from '@/lib/ops'
import { useOps } from '@/lib/use-ops'
import { cn } from '@/lib/utils'
import { OpsIsi } from '@/pages/Operasional'

type Kategori = 'hk' | 'rawat'
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const NADA: Record<OpsStatus, 'neutral' | 'primary' | 'success' | 'error' | 'info'> = { kosong: 'neutral', sebagian: 'info', lengkap: 'primary', temuan: 'error', paraf: 'success' }
const akhirBulan = (ym: string) => `${ym}-${String(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()).padStart(2, '0')}`

/** Warna sel kalender: hijau semua form lengkap, oranye sebagian, merah belum ada / sedikit. */
function warnaHari(h: KepatuhanHari) {
  if (h.nanti || !h.total) return 'bg-surface-container-low text-on-surface-variant'
  const p = h.lengkap / h.total
  if (p >= 1) return 'bg-emerald-500 text-white'
  if (p >= 0.5) return 'bg-amber-400 text-amber-950'
  if (h.lengkap + h.sebagian > 0) return 'bg-orange-200 text-orange-900'
  return 'bg-red-100 text-red-800'
}

/**
 * Operation > Perawatan & Housekeeping > Kalender progres: kepatuhan pengisian form harian per tanggal
 * dalam sebulan, ringkasan kepatuhan, dan aktivitas berkala yang jatuh tempo hari ini.
 */
export function KalenderOps() {
  const app = useApp()
  const [params, setParams] = useSearchParams()
  const hariIni = todayIso()
  const [bulan, setBulan] = useState(hariIni.slice(0, 7))
  const [buka, setBuka] = useState<string | null>(null)
  // Form yang dibuka sebagai pop up dari tanggal terpilih.
  const [isi, setIsi] = useState<string | null>(null)
  const pilihan = (['hk', 'rawat'] as Kategori[]).filter((k) => formKategori(app.role, app.settings, k).length)
  const kat = (params.get('kategori') as Kategori | null) ?? (app.role === 'cs' ? 'hk' : (pilihan[0] ?? 'rawat'))
  // Riwayat 2 bulan sebelumnya: untuk jadwal aktivitas berkala (mingguan) yang jatuh tempo.
  const dari = todayIso(addDays(new Date(`${bulan}-01T00:00:00`), -62))
  const { recs, error, muat } = useOps(dari, akhirBulan(bulan))
  const forms = useMemo(() => formKategori(app.role, app.settings, kat), [app.role, app.settings, kat])
  const k = useMemo(() => (recs ? kepatuhanBulan(forms, recs, bulan, hariIni) : null), [forms, recs, bulan, hariIni])
  const tempo = useMemo(() => (recs && bulan === hariIni.slice(0, 7) ? jatuhTempoAktivitas(forms, recs, hariIni) : []), [forms, recs, bulan, hariIni])
  if (!app.loaded) return <Loading />

  const awal = new Date(`${bulan}-01T00:00:00`)
  const kosongAwal = (awal.getDay() + 6) % 7
  const detail = buka && recs ? forms.map((id) => ({ id, st: statusOps(id, recs.find((r) => r.id === opsId(id, buka))) })) : []

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            {kat === 'hk' ? <BrushCleaning className="size-5" /> : <Wrench className="size-5" />}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-tag uppercase text-primary">Kalender progres</span>
            <span className="text-headline-md font-bold text-on-surface">{kat === 'hk' ? 'Housekeeping' : 'Perawatan peralatan'}</span>
          </div>
          <InfoPop judul={`Kalender progres ${kat === 'hk' ? 'housekeeping' : 'perawatan'}`}>
            <p>Setiap tanggal menampilkan persentase form harian yang terisi lengkap dan statusnya (hijau semua lengkap, amber ≥ 50%, oranye sebagian, merah belum diisi; titik merah = ada temuan).</p>
            <p>Ketuk tanggal untuk melihat daftar {kat === 'hk' ? 'area' : 'kartu'}, lalu ketuk salah satunya untuk mengisi form langsung di pop up.</p>
          </InfoPop>
        </div>
        {pilihan.length > 1 && (
          <ChipFilter
            label="Kategori"
            value={kat}
            onChange={(v) => setParams({ ...Object.fromEntries(params), kategori: v }, { replace: true })}
            options={[
              { value: 'hk' as const, label: 'Housekeeping' },
              { value: 'rawat' as const, label: 'Perawatan' },
            ]}
          />
        )}
        <Field label="Bulan" htmlFor="kal-bulan">
          <Input id="kal-bulan" type="month" max={hariIni.slice(0, 7)} value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
        </Field>
        <ErrorBox text={error} />
      </GlassCard>

      {!k ? (
        <Loading />
      ) : !forms.length ? (
        <GlassCard level={1} className="p-space-md text-body-md text-on-surface-variant">
          Tidak ada form {kat === 'hk' ? 'housekeeping' : 'perawatan'} harian untuk peran Anda di SPBU ini.
        </GlassCard>
      ) : (
        <>
          <section aria-label="Ringkasan kepatuhan" className="animate-entrance-2 grid grid-cols-2 gap-space-sm lg:grid-cols-4">
            {[
              ['Kepatuhan', `${k.persen}%`, `${forms.length} form × ${k.hariDinilai} hari`, k.persen < 80],
              ['Hari lengkap', `${k.hariLengkap}/${k.hariDinilai}`, 'semua form terisi', false],
              ['Temuan', String(k.temuan), 'form bertanda X', k.temuan > 0],
              ['Jatuh tempo', String(tempo.length), 'aktivitas berkala hari ini', tempo.length > 0],
            ].map(([l, v, sub, buruk]) => (
              <GlassCard key={String(l)} level={2} className="flex flex-col p-space-sm">
                <span className="text-tag uppercase text-on-surface-variant">{l}</span>
                <span className={cn('tabular text-headline-md font-bold', buruk ? 'text-amber-700' : 'text-on-surface')}>{v}</span>
                <span className="text-body-sm text-on-surface-variant">{sub}</span>
              </GlassCard>
            ))}
          </section>

          <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-xs p-space-md">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-on-surface-variant">
              {HARI.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: kosongAwal }, (_, i) => (
                <span key={`k${i}`} />
              ))}
              {k.hari.map((h) => {
                const pct = h.total ? Math.round((h.lengkap / h.total) * 100) : 0
                return (
                  <button
                    key={h.tanggal}
                    type="button"
                    disabled={h.nanti}
                    onClick={() => setBuka(h.tanggal)}
                    aria-label={`${formatTanggalIso(h.tanggal)}: ${h.nanti ? 'belum' : `${h.lengkap} dari ${h.total} form lengkap`}`}
                    className={cn('flex aspect-square flex-col items-center justify-center rounded-md text-body-sm font-bold transition-transform active:scale-95', warnaHari(h), h.tanggal === hariIni && 'ring-2 ring-primary ring-offset-1')}
                  >
                    <span>{Number(h.tanggal.slice(8))}</span>
                    {!h.nanti && <span className="tabular text-xs font-semibold opacity-90">{pct}%</span>}
                    {h.temuan > 0 && <span aria-hidden="true" className="mt-0.5 size-1.5 rounded-full bg-error" />}
                  </button>
                )
              })}
            </div>
            <div className="mt-space-xs flex flex-wrap gap-x-space-sm gap-y-1 text-body-sm text-on-surface-variant">
              {[
                ['bg-emerald-500', 'Semua lengkap'],
                ['bg-amber-400', '≥ 50%'],
                ['bg-orange-200', 'Sebagian'],
                ['bg-red-100', 'Belum diisi'],
              ].map(([w, l]) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={cn('size-3 rounded-sm', w)} />
                  {l}
                </span>
              ))}
            </div>
          </GlassCard>

          <section aria-labelledby="kal-tempo" className="flex flex-col gap-space-sm">
            <SectionHeader id="kal-tempo" title={`Jadwal berkala jatuh tempo hari ini (${tempo.length})`} />
            {!tempo.length ? (
              <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
                {bulan === hariIni.slice(0, 7) ? 'Semua aktivitas berkala (mingguan, 3 harian) sudah dikerjakan sesuai jadwal.' : 'Jatuh tempo hanya ditampilkan untuk bulan berjalan.'}
              </GlassCard>
            ) : (
              <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
                {tempo.map((x) => (
                  <Link key={`${x.form}-${x.i}`} to={`/ops/${x.form}?tanggal=${hariIni}`} className="flex items-center gap-space-sm bg-amber-50/60 px-space-md py-space-sm">
                    <CalendarClock aria-hidden="true" className="size-5 shrink-0 text-amber-700" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body-md font-semibold text-on-surface">{x.item}</span>
                      <span className="text-body-sm text-on-surface-variant">
                        {judulForm(x.form)} · {x.jadwal} · {x.terakhir ? `terakhir ${formatTanggalIso(x.terakhir)}` : 'belum tercatat'}
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
                  </Link>
                ))}
              </GlassCard>
            )}
          </section>
        </>
      )}

      <Sheet open={!!buka && !isi} onOpenChange={(o) => !o && setBuka(null)} title={buka ? formatTanggalIso(buka) : ''} description={`${kat === 'hk' ? 'Checklist housekeeping' : 'Kartu perawatan'} harian · ${detail.filter((x) => x.st !== 'kosong' && x.st !== 'sebagian').length}/${detail.length} lengkap · ketuk untuk mengisi`}>
        <div className="flex flex-col divide-y divide-outline-variant/40">
          {detail.map((x) => (
            <button key={x.id} type="button" onClick={() => setIsi(x.id)} className="flex min-h-12 items-center justify-between gap-space-sm py-space-sm text-left">
              <span className="text-body-md text-on-surface">{judulForm(x.id)}</span>
              <span className="flex items-center gap-1">
                <Pill tone={NADA[x.st]}>{STATUS_LABEL[x.st]}</Pill>
                <ChevronRight aria-hidden="true" className="size-5 text-on-surface-variant" />
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={!!buka && !!isi} onOpenChange={(o) => !o && setIsi(null)} title={isi ? judulForm(isi) : ''} description={buka ? formatTanggalIso(buka) : ''} className="h-[92dvh]">
        {buka && isi && (
          <OpsIsi
            key={`${isi}-${buka}`}
            sematan={{
              form: isi,
              tanggal: buka,
              onSelesai: () => {
                setIsi(null)
                void muat()
              },
            }}
          />
        )}
      </Sheet>
    </div>
  )
}
