import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, ChevronRight, Fuel, HandCoins, Zap, type LucideIcon } from 'lucide-react'
import { KpiFinance, KpiHsse } from '@/components/dashboard/kpi-highlight'
import { KartuStopPenyaluran } from '@/components/insiden/henti'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { tambahBulan } from '@/lib/berlaku'
import { labelSelisih, ringkasClosing, rupiah, type ClosingData } from '@/lib/closing'
import { formatBulanTahun, formatTanggalIso, todayIso } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import { SELANG_BULAN, type GroundingData } from '@/lib/grounding'
import { bolehLihatAnggaran, perluSettlement, type PettyRecord } from '@/lib/petty'
import { shiftLabel, type Shift } from '@/lib/shift'
import { jualPerProduk, type TotalizerData } from '@/lib/totalizer'
import { useCatatan } from '@/lib/use-catatan'
import { cn } from '@/lib/utils'
import { KartuProteksi } from '@/pages/Dashboard'
import { KartuGuardTour, KartuInsiden } from '@/pages/DashboardPeran'

const akhirBulan = (bulan: string) => todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0))

function Kartu({ icon: Icon, judul, sub, ke, aksi, children, className }: { icon: LucideIcon; judul: string; sub?: string; ke?: string; aksi?: string; children: ReactNode; className?: string }) {
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
          <Link to={ke} className="touch-44 flex shrink-0 items-center gap-0.5 text-body-sm font-semibold text-primary">
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
    <div className={cn('grid gap-space-xs', items.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3')}>
      {items.map(([l, v, buruk]) => (
        <div key={l} className={cn('rounded-md p-space-xs text-center', buruk ? 'bg-amber-50' : 'bg-surface-container-low')}>
          <span className={cn('tabular block text-numeric-md font-bold', buruk ? 'text-amber-800' : 'text-on-surface')}>{v}</span>
          <span className="text-xs uppercase text-on-surface-variant">{l}</span>
        </div>
      ))}
    </div>
  )
}

/** Pengukuran grounding: terakhir diukur dan jadwal ukur ulang (tiap 6 bulan). */
function KartuGrounding() {
  const { recs } = useCatatan<GroundingData>('grounding', '2000-01-01', '2999-12-31')
  const hariIni = todayIso()
  const terakhir = (recs ?? []).map((r) => r.tanggal).sort().at(-1)
  const jatuh = terakhir ? tambahBulan(terakhir, SELANG_BULAN) : ''
  const lewat = !terakhir || jatuh < hariIni
  return (
    <Kartu icon={Zap} judul="Pengukuran grounding" sub={`Ukur ulang tiap ${SELANG_BULAN} bulan`} ke="/grounding" aksi="Riwayat">
      {recs === null ? (
        <span className="text-body-sm text-on-surface-variant">Memuat…</span>
      ) : (
        <div className={cn('flex items-center justify-between gap-space-sm rounded-md p-space-sm', lewat ? 'bg-error-container/60' : 'bg-surface-container-low')}>
          <span className="text-body-sm text-on-surface">{terakhir ? `Terakhir ${formatTanggalIso(terakhir)}` : 'Belum ada pengukuran'}</span>
          <Pill tone={lewat ? 'error' : 'success'}>{terakhir ? `Ulang ${formatTanggalIso(jatuh)}` : 'Perlu diukur'}</Pill>
        </div>
      )}
    </Kartu>
  )
}

/** Dashboard HSSE & Guard Patrol: stop penyaluran, proteksi kebakaran, guard tour, insiden, grounding. */
export function DashboardHsse() {
  const app = useApp()
  useSyncOnOpen()
  if (!app.loaded) return <Loading />
  return (
    <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2 lg:items-start">
      <KpiHsse className="animate-entrance-1 lg:col-span-2" />
      <KartuStopPenyaluran className="animate-entrance-1 lg:col-span-2" />
      <KartuProteksi className="animate-entrance-2" />
      {/* Data sampling guard tour hanya terbaca ABH, pengawas, dan security (RLS bbm_gts). */}
      {['abh', 'pengawas', 'security'].includes(app.role ?? '') && <KartuGuardTour className="animate-entrance-2" />}
      <KartuInsiden />
      <KartuGrounding />
    </div>
  )
}

/** Dashboard Sales / Finance: penjualan BBM (totalizer × harga), closing shift, dan petty cash bulan terpilih. */
export function DashboardSales() {
  const app = useApp()
  const [bulan, setBulan] = useState(todayIso().slice(0, 7))
  const dari = `${bulan}-01`
  const sampai = akhirBulan(bulan)
  const { recs: tot } = useCatatan<TotalizerData>('totalizer', dari, sampai)
  const { recs: closing } = useCatatan<ClosingData>('closing', dari, sampai)
  const [petty, setPetty] = useState<{ kunci: string; recs: PettyRecord[] } | null>(null)
  const kunci = `${app.spbuId}|${bulan}`
  useEffect(() => {
    app.backend.listPetty(dari, sampai).then(
      (recs) => setPetty({ kunci, recs }),
      () => setPetty({ kunci, recs: [] }),
    )
  }, [app.backend, dari, sampai, kunci])
  if (!app.loaded) return <Loading />

  const harga = app.settings.hargaProduk ?? {}
  const jual = jualPerProduk(tot ?? []).map((x) => ({ ...x, rupiah: harga[x.produk] ? Math.round(x.liter * harga[x.produk]!) : null }))
  const totalLiter = jual.reduce((a, x) => a + x.liter, 0)
  const totalRp = jual.reduce((a, x) => a + (x.rupiah ?? 0), 0)
  const hariIni = todayIso()
  const jualHariIni = jualPerProduk((tot ?? []).filter((r) => r.tanggal === hariIni)).reduce((a, x) => a + x.liter, 0)
  const cl = [...(closing ?? [])].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.shift - a.shift)
  const ringkas = cl.map((r) => ({ r, k: ringkasClosing(r.data) }))
  const kurang = ringkas.filter((x) => x.k.selisih !== null && x.k.selisih < 0)
  const setoran = ringkas.reduce((a, x) => a + x.r.data.cash + x.k.nonTunai, 0)
  const pr = petty?.kunci === kunci ? petty.recs : null
  const disetujui = (pr ?? []).filter((r) => r.status === 'Disetujui')
  const lihatRp = bolehLihatAnggaran(app.role)

  return (
    <div className="flex flex-col gap-space-md">
      <KpiFinance className="animate-entrance-1" />
      <GlassCard level={2} className="animate-entrance-1 p-space-md">
        <Field label="Bulan" htmlFor="ds-bulan">
          <Input id="ds-bulan" type="month" max={todayIso().slice(0, 7)} value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
        </Field>
      </GlassCard>
      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2 lg:items-start">
        <Kartu icon={Fuel} judul="Penjualan BBM" sub={`${formatBulanTahun(new Date(`${bulan}-01T00:00:00`))} · dari totalizer × harga jual`} ke="/laporan/totalizer" aksi="Totalizer" className="animate-entrance-2">
          {tot === null ? (
            <span className="text-body-sm text-on-surface-variant">Memuat…</span>
          ) : (
            <>
              <Angka
                items={[
                  ['Volume bulan ini', `${formatNumber(totalLiter, 0)} L`],
                  ['Nilai penjualan', totalRp ? rupiah(totalRp) : '-'],
                  ['Hari ini', `${formatNumber(jualHariIni, 0)} L`],
                ]}
              />
              {jual.map((x) => (
                <div key={x.produk} className="flex items-center justify-between gap-space-sm rounded-md bg-surface-container-low px-space-sm py-space-xs text-body-sm">
                  <span className="font-semibold text-on-surface">{x.produk}</span>
                  <span className="tabular text-on-surface">
                    {formatNumber(x.liter, 0)} L{x.rupiah !== null ? ` · ${rupiah(x.rupiah)}` : ' · harga belum diatur'}
                  </span>
                </div>
              ))}
              {!jual.length && <span className="text-body-sm text-on-surface-variant">Belum ada totalizer lengkap pada bulan ini.</span>}
            </>
          )}
        </Kartu>

        <Kartu icon={Banknote} judul="Closing shift" sub="Hitung buta kepala shift: setoran & selisih" ke="/finance/closing" aksi="Closing" className="animate-entrance-2">
          {closing === null ? (
            <span className="text-body-sm text-on-surface-variant">Memuat…</span>
          ) : (
            <>
              <Angka
                items={[
                  ['Shift closing', cl.length],
                  ['Setoran', setoran ? rupiah(setoran) : '-'],
                  ['Selisih kurang', kurang.length, kurang.length > 0],
                ]}
              />
              {ringkas.slice(0, 5).map(({ r, k }) => (
                <div key={r.id} className="flex items-center justify-between gap-space-sm rounded-md bg-surface-container-low px-space-sm py-space-xs">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-sm font-semibold text-on-surface">
                      {formatTanggalIso(r.tanggal)} · {shiftLabel(r.shift as Shift).split(' (')[0]}
                    </span>
                    <span className="text-xs text-on-surface-variant">{r.data.petugas || '-'}</span>
                  </span>
                  <Pill tone={k.selisih === null ? 'neutral' : k.selisih < 0 ? 'error' : 'success'}>{labelSelisih(k.selisih)}</Pill>
                </div>
              ))}
              {!cl.length && <span className="text-body-sm text-on-surface-variant">Belum ada closing shift pada bulan ini.</span>}
            </>
          )}
        </Kartu>

        <Kartu icon={HandCoins} judul="Petty cash" sub="Pengajuan, settlement & realisasi bulan ini" ke={lihatRp ? '/finance/petty/realisasi' : '/finance/petty'} aksi={lihatRp ? 'Realisasi' : 'Lihat'} className="animate-entrance-3 lg:col-span-2">
          {pr === null ? (
            <span className="text-body-sm text-on-surface-variant">Memuat…</span>
          ) : (
            <Angka
              items={[
                ['Menunggu persetujuan', pr.filter((r) => r.status.startsWith('Menunggu')).length, pr.some((r) => r.status.startsWith('Menunggu'))],
                ['Menunggu settlement', pr.filter(perluSettlement).length, pr.some(perluSettlement)],
                ['Belum direalisasi', disetujui.filter((r) => !r.data.realisasi && !perluSettlement(r)).length],
                lihatRp ? ['Realisasi', rupiah(disetujui.reduce((a, r) => a + (r.data.realisasi?.nominal ?? 0), 0))] : ['Disetujui', disetujui.length],
              ]}
            />
          )}
        </Kartu>
      </div>
    </div>
  )
}
