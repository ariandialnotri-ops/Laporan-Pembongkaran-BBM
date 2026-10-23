import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, ChevronRight, FireExtinguisher, Fuel, HandCoins, ShieldAlert, TrendingUp, Zap, type LucideIcon } from 'lucide-react'
import { BarChart, DonutChart, KATEGORI, STATUS_WARNA, warnaProduk } from '@/components/dashboard/charts'
import { KpiFinance, KpiHsse } from '@/components/dashboard/kpi-highlight'
import { kelompokPeriode } from '@/components/dashboard/periode'
import { KartuStopPenyaluran } from '@/components/insiden/henti'
import { Loading } from '@/components/bongkaran/load-state'
import { GlassCard } from '@/components/ui/glass-card'
import { Pill } from '@/components/ui/pill'
import { kondisiSemua } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { tambahBulan } from '@/lib/berlaku'
import type { AparRecord, InsidenRecord } from '@/lib/daily'
import { labelSelisih, ringkasClosing, rupiah, type ClosingData } from '@/lib/closing'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import { SELANG_BULAN, type GroundingData } from '@/lib/grounding'
import type { Periode } from '@/lib/kpi'
import { bolehLihatAnggaran, perluSettlement, type PettyRecord } from '@/lib/petty'
import { shiftLabel, type Shift } from '@/lib/shift'
import { jualPerProduk, type TotalizerData } from '@/lib/totalizer'
import { useCatatan } from '@/lib/use-catatan'
import { cn } from '@/lib/utils'
import { KartuGuardTour, KartuInsiden } from '@/pages/DashboardPeran'

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
export function DashboardHsse({ periode }: { periode: Periode }) {
  const app = useApp()
  useSyncOnOpen()
  if (!app.loaded) return <Loading />
  const apar = kondisiSemua(app.settings, app.daily.filter((d): d is AparRecord => d.kind === 'apar'), todayIso())
  // Satu kategori per unit (prioritas: lewat masa berlaku > temuan > belum diperiksa > baik).
  const katApar = (k: (typeof apar)[number]) => (k.isiUlang === 'lewat' || k.instansi === 'lewat' ? 'lewat' : k.status === 'temuan' ? 'temuan' : !k.bulanIni ? 'belum' : 'baik')
  const nApar = (x: string) => apar.filter((k) => katApar(k) === x).length
  const ins = app.daily.filter((d): d is InsidenRecord => d.kind === 'insiden' && d.data.jenis !== 'henti' && d.tanggal >= periode.dari && d.tanggal <= periode.sampai)
  const batangIns = kelompokPeriode(periode, ins.map((r) => ({ tanggal: r.tanggal, value: 1 })))
  return (
    <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2 lg:items-start">
      <KpiHsse periode={periode} className="animate-entrance-1 lg:col-span-2" />
      {apar.length > 0 && (
        <Kartu icon={FireExtinguisher} judul="Kondisi APAR & APAB" sub={`${apar.length} unit · status saat ini`} ke="/apar" aksi="APAR" className="animate-entrance-2">
          <DonutChart
            label="Kondisi APAR & APAB"
            subTengah="unit"
            tengah={String(apar.length)}
            satuan=" unit"
            data={[
              { label: 'Baik', value: nApar('baik'), warna: STATUS_WARNA.baik },
              { label: 'Belum diperiksa bulan ini', value: nApar('belum'), warna: STATUS_WARNA.peringatan },
              { label: 'Ada temuan', value: nApar('temuan'), warna: STATUS_WARNA.serius },
              { label: 'Isi ulang / uji lewat', value: nApar('lewat'), warna: STATUS_WARNA.kritis },
            ]}
          />
        </Kartu>
      )}
      <Kartu icon={ShieldAlert} judul="Laporan insiden & near miss" sub={`${ins.length} laporan pada periode`} ke="/laporan/insiden" aksi="Riwayat" className="animate-entrance-2">
        <BarChart data={batangIns} warna={KATEGORI[1]} satuan=" laporan" format={(v) => String(Math.round(v))} label="Laporan insiden per periode" />
      </Kartu>
      <KartuStopPenyaluran className="animate-entrance-1 lg:col-span-2" />
      {/* Data sampling guard tour hanya terbaca ABH, pengawas, dan security (RLS bbm_gts). */}
      {['abh', 'pengawas', 'security'].includes(app.role ?? '') && <KartuGuardTour className="animate-entrance-2" />}
      <KartuInsiden />
      <KartuGrounding />
    </div>
  )
}

/** Dashboard Sales / Finance: grafik penjualan BBM & metode bayar, closing shift, dan petty cash untuk periode terpilih. */
export function DashboardSales({ periode }: { periode: Periode }) {
  const app = useApp()
  const { dari, sampai } = periode
  const { recs: tot } = useCatatan<TotalizerData>('totalizer', dari, sampai)
  const { recs: closing } = useCatatan<ClosingData>('closing', dari, sampai)
  const [petty, setPetty] = useState<{ kunci: string; recs: PettyRecord[] } | null>(null)
  const kunci = `${app.spbuId}|${dari}|${sampai}`
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
  const batangJual = kelompokPeriode(periode, (tot ?? []).map((r) => ({ tanggal: r.tanggal, value: jualPerProduk([r]).reduce((a, x) => a + x.liter, 0) })))
  const sumNt = (keys: string[]) => (closing ?? []).reduce((a, r) => a + keys.reduce((n, k) => n + ((r.data.nonTunai as Record<string, number>)[k] || 0), 0), 0)
  const bayar = [
    { label: 'Tunai', value: (closing ?? []).reduce((a, r) => a + r.data.cash, 0), warna: KATEGORI[0] },
    { label: 'EDC bank', value: sumNt(['edc_bca', 'edc_bri', 'edc_mandiri', 'edc_bni']), warna: KATEGORI[1] },
    { label: 'MyPertamina / LinkAja', value: sumNt(['myp_linkaja']), warna: KATEGORI[2] },
    { label: 'RFID & voucher', value: sumNt(['rfid', 'e_voucher', 'p_voucher']), warna: KATEGORI[3] },
  ]
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
      <KpiFinance periode={periode} className="animate-entrance-1" />
      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-2 lg:items-start">
        <Kartu icon={TrendingUp} judul="Penjualan BBM per hari" sub={`${formatNumber(totalLiter, 0)} L pada periode${totalRp ? ` · ${rupiah(totalRp)}` : ''}`} ke="/laporan/totalizer" aksi="Totalizer" className="animate-entrance-2">
          <BarChart data={batangJual} warna={KATEGORI[2]} satuan=" L" label="Penjualan BBM" />
        </Kartu>
        <Kartu icon={Fuel} judul="Penjualan per produk" sub="Komposisi volume penjualan" className="animate-entrance-2">
          <DonutChart data={jual.map((x, i) => ({ label: x.produk, value: x.liter, warna: warnaProduk(x.produk, i) }))} subTengah="volume" satuan=" L" label="Penjualan per produk" />
        </Kartu>
        {bayar.some((b) => b.value > 0) && (
          <Kartu icon={Banknote} judul="Metode pembayaran" sub="Dari closing shift pada periode" ke="/finance/closing" aksi="Closing" className="animate-entrance-3">
            <DonutChart data={bayar} subTengah="setoran" format={(v) => rupiah(v)} label="Metode pembayaran" />
          </Kartu>
        )}
        <Kartu icon={Fuel} judul="Penjualan BBM" sub="Dari totalizer × harga jual" ke="/laporan/totalizer" aksi="Totalizer" className="animate-entrance-2">
          {tot === null ? (
            <span className="text-body-sm text-on-surface-variant">Memuat…</span>
          ) : (
            <>
              <Angka
                items={[
                  ['Volume periode', `${formatNumber(totalLiter, 0)} L`],
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
              {!jual.length && <span className="text-body-sm text-on-surface-variant">Belum ada totalizer lengkap pada periode ini.</span>}
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
              {!cl.length && <span className="text-body-sm text-on-surface-variant">Belum ada closing shift pada periode ini.</span>}
            </>
          )}
        </Kartu>

        <Kartu icon={HandCoins} judul="Petty cash" sub="Pengajuan, settlement & realisasi pada periode" ke={lihatRp ? '/finance/petty/realisasi' : '/finance/petty'} aksi={lihatRp ? 'Realisasi' : 'Lihat'} className="animate-entrance-3 lg:col-span-2">
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
