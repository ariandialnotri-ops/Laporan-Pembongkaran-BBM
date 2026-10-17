import { useState, type ReactNode } from 'react'
import { ChevronDown, FileSpreadsheet, LoaderCircle, Save } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { PECAHAN } from '@/lib/closing'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatLiter, formatNumber, parseAngka } from '@/lib/format'
import { barisPumpTest, rekapTeraNozzle } from '@/lib/pumptest'
import { downloadBlob } from '@/lib/report/export'
import {
  CASH_SO,
  hitungArus,
  hitungCashSo,
  hitungNozzle,
  hitungTangki,
  JABATAN_SO,
  kosongCash,
  NON_TUNAI_SO,
  nozzleKosong,
  penerimaanBulan,
  soKosong,
  tangkiKosong,
  terbilang,
  type JenisCash,
  type SoArus,
  type SoData,
  type SoNozzle,
  type SoRecord,
  type SoTangki,
} from '@/lib/so'
import { TANKS, volumeTank, type Tank } from '@/lib/tank'
import type { TotalizerData } from '@/lib/totalizer'
import { useCatatan } from '@/lib/use-catatan'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const akhirBulan = (bulan: string) => todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0))
const bulanLalu = (bulan: string) => todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)) - 2, 1)).slice(0, 7)
const bulanDepan = (bulan: string) => todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 1))
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const labelBulan = (b: string) => `${BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`
const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '-' : formatNumber(v, d))
const rp = (v: number) => `Rp ${Math.round(v).toLocaleString('id-ID')}`
/** Volume (L) dari tinggi cm lewat tabel kalibrasi tangki (mm). */
const literDariCm = (t: Tank, cm: string) => {
  const v = parseAngka(cm)
  if (v === null) return ''
  const r = volumeTank(t, v * 10)
  return r.error === undefined ? String(Math.round(r.volume)) : ''
}

/** Kartu bagian yang dapat dilipat. */
function Bagian({ no, judul, ringkas, children, buka: bukaAwal = false }: { no: number; judul: string; ringkas?: string; children: ReactNode; buka?: boolean }) {
  const [buka, setBuka] = useState(bukaAwal)
  return (
    <GlassCard level={2} className="flex flex-col">
      <button type="button" aria-expanded={buka} onClick={() => setBuka(!buka)} className="flex min-h-14 items-center gap-space-sm px-space-md py-space-sm text-left">
        <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-body-sm font-bold text-primary">{no}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-md font-bold text-on-surface">{judul}</span>
          {ringkas && <span className="truncate text-body-sm text-on-surface-variant">{ringkas}</span>}
        </span>
        <ChevronDown aria-hidden="true" className={cn('size-5 shrink-0 text-on-surface-variant transition-transform', buka && 'rotate-180')} />
      </button>
      {buka && <div className="flex flex-col gap-space-sm px-space-md pb-space-md">{children}</div>}
    </GlassCard>
  )
}

function Nilai({ k, v, tebal, merah }: { k: string; v: string; tebal?: boolean; merah?: boolean }) {
  return (
    <span className="flex justify-between gap-space-sm text-body-sm">
      <span className="text-on-surface-variant">{k}</span>
      <span className={cn('tabular text-right text-on-surface', tebal && 'font-bold', merah && 'font-bold text-error')}>{v}</span>
    </span>
  )
}

/** Report > Laporan Stock Opname: BA Laporan Bulanan SPBU per bulan (isian + tarikan data FLOQ), unduh Excel. */
export function LaporanStockOpname() {
  const app = useApp()
  const toast = useToast()
  useSyncOnOpen()
  const [bulan, setBulan] = useState(() => {
    // Sebelum tanggal 10, bawaan bulan lalu (SO dilakukan awal bulan berikutnya).
    const t = todayIso()
    return Number(t.slice(8, 10)) < 10 ? bulanLalu(t.slice(0, 7)) : t.slice(0, 7)
  })
  const lalu = bulanLalu(bulan)
  const so = useCatatan<SoData>('so', `${lalu}-01`, `${bulan}-01`)
  const tot = useCatatan<TotalizerData>('totalizer', `${bulan}-01`, akhirBulan(bulan))
  const [draft, setDraft] = useState<{ bulan: string; data: SoData } | null>(null)
  const [busy, setBusy] = useState<'simpan' | 'excel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bolehUbah = ['abh', 'pengawas', 'admin'].includes(app.role ?? '')
  const guard = useLeaveGuard({ active: !!draft, title: 'Keluar tanpa menyimpan?', detail: 'Isian stock opname yang belum disimpan akan hilang.' })

  if (!app.loaded || !so.recs || !tot.recs) return <Loading />
  const rec = so.recs.find((r) => r.id === bulan)
  const recLalu = so.recs.find((r) => r.id === lalu)?.data ?? null
  const s = app.settings
  const nozzles = s.nozzles ?? []
  const dispensers = s.dispensers ?? []

  // Data efektif: isian tersimpan/draf + nilai otomatis dari SO bulan lalu.
  const dasar: SoData = draft?.bulan === bulan ? draft.data : { ...soKosong(), ...rec?.data, ttd: { ...soKosong().ttd, ...rec?.data.ttd } }
  const data: SoData = {
    ...dasar,
    tanggalSo: dasar.tanggalSo || bulanDepan(bulan),
    listrikAwal: dasar.listrikAwal || recLalu?.listrikAkhir || '',
    ttd: {
      pengawas: dasar.ttd.pengawas || s.namaPengawasDefault || '',
      admin: dasar.ttd.admin,
      abh: dasar.ttd.abh || s.namaAbhDefault || '',
      kasir: dasar.ttd.kasir,
    },
    tangki: Object.fromEntries(
      TANKS.map((t) => {
        const x = dasar.tangki[t.id] ?? tangkiKosong()
        const l = recLalu?.tangki[t.id]
        return [t.id, { ...x, laluDipCm: x.laluDipCm || l?.dipCm || '', laluAtgCm: x.laluAtgCm || l?.atgCm || '', laluTanggal: x.laluTanggal || recLalu?.tanggalSo || '' }]
      }),
    ),
  }
  const ubah = (patch: Partial<SoData>) => {
    setError(null)
    setDraft({ bulan, data: { ...data, ...patch } })
  }
  const ubahTangki = (id: string, p: Partial<SoTangki>) => ubah({ tangki: { ...data.tangki, [id]: { ...(data.tangki[id] ?? tangkiKosong()), ...p } } })
  const ubahNozzle = (id: string, p: Partial<SoNozzle>) => ubah({ nozzle: { ...data.nozzle, [id]: { ...(data.nozzle[id] ?? nozzleKosong()), ...p } } })
  const ubahArus = (produk: string, p: Partial<SoArus>) => ubah({ arus: { ...data.arus, [produk]: { ...{ stokAwal: '', penerimaan: '', penjualan: '' }, ...data.arus[produk], ...p } } })
  const ubahCash = (k: JenisCash, p: Partial<SoData['cash'][JenisCash]>) => ubah({ cash: { ...data.cash, [k]: { ...kosongCash(), ...data.cash[k], ...p } } })

  const pumpTest = barisPumpTest(app.daily, nozzles).filter((r) => r.tanggal.startsWith(bulan))
  const penerimaan = penerimaanBulan(app.reports, bulan)
  const produk = [...new Set([...TANKS.map((t) => t.produk), ...nozzles.map((n) => n.produk)])]
  const arus = produk.map((p) => hitungArus(p, { tanks: TANKS, data, lalu: recLalu, totalizer: tot.recs!, nozzles, penerimaan, pumpTest }))
  const rekapTera = rekapTeraNozzle(pumpTest)

  const simpan = async () => {
    setBusy('simpan')
    try {
      const r: SoRecord = { id: bulan, tanggal: `${bulan}-01`, shift: 0, data, createdAt: rec?.createdAt ?? Date.now(), updatedAt: Date.now(), createdBy: rec?.createdBy ?? app.session.user?.id ?? null }
      await app.backend.saveCatatan('so', r)
      setDraft(null)
      await so.muat()
      toast(`Stock opname ${labelBulan(bulan)} tersimpan`)
    } catch (e) {
      setError(pesan(e))
    } finally {
      setBusy(null)
    }
  }
  const unduh = async () => {
    setBusy('excel')
    try {
      const { soXlsx } = await import('@/lib/report/so-xlsx')
      const blob = await soXlsx({ bulan, settings: s, data, lalu: recLalu, tanks: TANKS, nozzles, dispensers, totalizer: tot.recs!, reports: app.reports, pumpTest })
      downloadBlob(blob, `BA Laporan Bulanan ${s.namaSpbu || 'SPBU'} ${labelBulan(bulan)}.xlsx`)
    } catch (e) {
      setError(`Gagal membuat Excel: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const angkaInput = (id: string, label: string, value: string, onChange: (v: string) => void, o: { suffix?: string; placeholder?: string } = {}) => (
    <Field label={label} htmlFor={id}>
      <Input id={id} numeric inputMode="decimal" suffix={o.suffix} placeholder={o.placeholder} disabled={!bolehUbah} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Periode SO" htmlFor="so-bulan">
            <Input id="so-bulan" type="month" value={bulan} onChange={(e) => e.target.value && (setDraft(null), setBulan(e.target.value))} />
          </Field>
          <div className="flex items-end">{rec ? <Pill tone="success">Tersimpan {new Date(rec.updatedAt).toLocaleDateString('id-ID')}</Pill> : <Pill>Belum disimpan</Pill>}</div>
          <Field label="Tanggal SO" htmlFor="so-tgl">
            <Input id="so-tgl" type="date" disabled={!bolehUbah} value={data.tanggalSo} onChange={(e) => ubah({ tanggalSo: e.target.value })} />
          </Field>
          <Field label="Jam SO" htmlFor="so-jam">
            <Input id="so-jam" type="time" disabled={!bolehUbah} value={data.jamSo} onChange={(e) => ubah({ jamSo: e.target.value })} />
          </Field>
        </div>
        <span className="text-body-sm text-on-surface-variant">
          BA Laporan Bulanan sesuai dokumen SPBU. Ditarik otomatis: totalisator digital (Totalizer), penerimaan (Input Bongkaran), pump test/tera (Kualitas Harian & Uji Takaran), stok awal & D t-1 (SO {labelBulan(lalu)}{recLalu ? '' : ', belum ada'}).
        </span>
        {!bolehUbah && <span className="text-body-sm font-semibold text-on-surface-variant">Hanya dapat dilihat. Isian diisi ABH, pengawas, atau admin.</span>}
      </GlassCard>

      <Bagian no={1} judul="Stock Opname Tangki Pendam & Meter Listrik" ringkas={`${TANKS.length} tangki · konsistensi maks. 2,5 cm`} buka>
        {TANKS.map((t) => {
          const x = data.tangki[t.id] ?? tangkiKosong()
          const h = hitungTangki(x)
          return (
            <div key={t.id} className="flex flex-col gap-space-xs rounded-md bg-surface-container-low p-space-sm">
              <span className="flex items-center justify-between gap-2">
                <b className="text-body-md text-on-surface">
                  {t.label} · {t.produk}
                </b>
                {h.konsisten !== null && <Pill tone={h.konsisten ? 'success' : 'error'}>{h.konsisten ? 'Konsisten · ATG' : 'Tidak · dipping'}</Pill>}
              </span>
              <div className="grid grid-cols-3 gap-space-xs">
                {angkaInput(`so-air-${t.id}`, 'Air (cm)', x.airCm, (v) => ubahTangki(t.id, { airCm: v }))}
                {angkaInput(`so-dip-${t.id}`, 'Dipping (cm)', x.dipCm, (v) => ubahTangki(t.id, { dipCm: v, dipL: literDariCm(t, v) || x.dipL }))}
                {angkaInput(`so-dipl-${t.id}`, 'Vol. dipping', x.dipL, (v) => ubahTangki(t.id, { dipL: v }), { suffix: 'L' })}
                <span />
                {angkaInput(`so-atg-${t.id}`, 'ATG (cm)', x.atgCm, (v) => ubahTangki(t.id, { atgCm: v, atgL: literDariCm(t, v) || x.atgL }))}
                {angkaInput(`so-atgl-${t.id}`, 'Vol. ATG', x.atgL, (v) => ubahTangki(t.id, { atgL: v }), { suffix: 'L' })}
                <span className="self-center text-body-sm text-on-surface-variant">SO lalu</span>
                {angkaInput(`so-ld-${t.id}`, 'Dipping lalu (cm)', x.laluDipCm, (v) => ubahTangki(t.id, { laluDipCm: v }))}
                {angkaInput(`so-la-${t.id}`, 'ATG lalu (cm)', x.laluAtgCm, (v) => ubahTangki(t.id, { laluAtgCm: v }))}
              </div>
              <Nilai k="Selisih Dt (dipping − ATG)" v={`${fmt(h.selisih)} cm`} />
              <Nilai k="Konsistensi (Dt) − (Dt-1)" v={`${fmt(h.konsistensiCm)} cm`} merah={h.konsisten === false} />
              <Nilai k="Volume SO dipakai" v={h.volume === null ? '-' : formatLiter(h.volume)} tebal />
            </div>
          )
        })}
        <Field label="Catatan ATG (mis. ATG rusak / belum adjusting)" htmlFor="so-catatg">
          <Input id="so-catatg" disabled={!bolehUbah} value={data.catatanAtg} onChange={(e) => ubah({ catatanAtg: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-space-sm">
          {angkaInput('so-la', 'Meter listrik awal bulan', data.listrikAwal, (v) => ubah({ listrikAwal: v }), { suffix: 'kWh' })}
          {angkaInput('so-lb', 'Meter listrik akhir bulan', data.listrikAkhir, (v) => ubah({ listrikAkhir: v }), { suffix: 'kWh' })}
        </div>
        <Nilai k="Total pemakaian listrik" v={(() => { const a = parseAngka(data.listrikAwal); const b = parseAngka(data.listrikAkhir); return a !== null && b !== null ? `${formatNumber(b - a, 2)} kWh` : '-' })()} tebal />
      </Bagian>

      <Bagian no={2} judul="Totalisator" ringkas={`${nozzles.length} nozzle · digital dari Totalizer (${tot.recs.length} catatan shift)`}>
        {nozzles.map((nz) => {
          const x = data.nozzle[nz.id] ?? nozzleKosong()
          const h = hitungNozzle(nz, x, tot.recs!)
          return (
            <div key={nz.id} className="flex flex-col gap-space-xs rounded-md bg-surface-container-low p-space-sm">
              <span className="flex items-center justify-between gap-2">
                <b className="text-body-md text-on-surface">
                  Nozzle {nz.nama} · {nz.produk}
                </b>
                <span className="text-body-sm text-on-surface-variant">{dispensers.find((d) => d.id === nz.dispenserId)?.nama ?? ''}</span>
              </span>
              <div className="grid grid-cols-3 gap-space-xs">
                <Field label="Ket. R2/R4" htmlFor={`so-k-${nz.id}`}>
                  <Input id={`so-k-${nz.id}`} disabled={!bolehUbah} placeholder="R4" value={x.keterangan} onChange={(e) => ubahNozzle(nz.id, { keterangan: e.target.value })} />
                </Field>
                {angkaInput(`so-ma-${nz.id}`, 'Manual awal', x.manualAwal, (v) => ubahNozzle(nz.id, { manualAwal: v }))}
                {angkaInput(`so-mb-${nz.id}`, 'Manual akhir', x.manualAkhir, (v) => ubahNozzle(nz.id, { manualAkhir: v }))}
                <span className="self-center text-body-sm text-on-surface-variant">Digital {h.otomatis ? '(otomatis)' : ''}</span>
                {angkaInput(`so-da-${nz.id}`, 'Digital awal', x.digitalAwal, (v) => ubahNozzle(nz.id, { digitalAwal: v }), { placeholder: fmt(h.dAwal) })}
                {angkaInput(`so-db-${nz.id}`, 'Digital akhir', x.digitalAkhir, (v) => ubahNozzle(nz.id, { digitalAkhir: v }), { placeholder: fmt(h.dAkhir) })}
              </div>
              <Nilai k="Sales manual (c)" v={fmt(h.manual)} />
              <Nilai k="Sales digital (f)" v={fmt(h.digital)} />
              <Nilai k="Selisih (f − c)" v={fmt(h.selisih)} tebal />
            </div>
          )
        })}
        {!nozzles.length && <span className="text-body-sm text-on-surface-variant">Database nozzle belum diisi.</span>}
        <Field label="Catatan totalisator" htmlFor="so-cattot">
          <Input id="so-cattot" disabled={!bolehUbah} value={data.catatanTotalisator} onChange={(e) => ubah({ catatanTotalisator: e.target.value })} />
        </Field>
      </Bagian>

      <Bagian no={3} judul="Arus Minyak" ringkas={arus.map((a) => `${a.produk} ${a.h === null ? '-' : `${formatNumber(a.h, 2)}%`}`).join(' · ')}>
        {arus.map((a) => (
          <div key={a.produk} className="flex flex-col gap-space-xs rounded-md bg-surface-container-low p-space-sm">
            <b className="text-body-md text-on-surface">{a.produk}</b>
            <div className="grid grid-cols-3 gap-space-xs">
              {angkaInput(`so-aa-${a.produk}`, 'Stok awal (a)', data.arus[a.produk]?.stokAwal ?? '', (v) => ubahArus(a.produk, { stokAwal: v }), { placeholder: fmt(a.otomatisA ? a.a : null, 0) })}
              {angkaInput(`so-ab-${a.produk}`, 'Penerimaan (b)', data.arus[a.produk]?.penerimaan ?? '', (v) => ubahArus(a.produk, { penerimaan: v }), { placeholder: fmt(a.otomatisB ? a.b : null, 0) })}
              {angkaInput(`so-ad-${a.produk}`, 'Penjualan bersih (d)', data.arus[a.produk]?.penjualan ?? '', (v) => ubahArus(a.produk, { penjualan: v }), { placeholder: fmt(a.otomatisD ? a.d : null, 0) })}
            </div>
            <Nilai k="Jumlah (c = a + b)" v={fmt(a.c)} />
            <Nilai k={`Pump test/tera dikurangkan`} v={formatNumber(a.tera, 1)} />
            <Nilai k="Stok akhir teoritis (e)" v={fmt(a.e)} />
            <Nilai k="Stok akhir real (f)" v={fmt(a.f)} />
            <Nilai k="Losses (g = f − e)" v={fmt(a.g)} tebal merah={(a.g ?? 0) < 0} />
            <Nilai k="% Losses" v={a.h === null ? '-' : `${formatNumber(a.h, 2)}%`} tebal />
          </div>
        ))}
        <span className="text-body-sm text-on-surface-variant">Kosongkan isian untuk memakai nilai otomatis (abu-abu).</span>
      </Bagian>

      <Bagian no={4} judul="Penerimaan BBM & BBK" ringkas={`${penerimaan.length} penerimaan dari Input Bongkaran`}>
        {penerimaan.map(({ r, order, real }) => (
          <span key={r.id} className="tabular flex flex-col border-b border-outline-variant/40 pb-1 text-body-sm">
            <b>
              {formatTanggalIso(r.tanggal)} · {r.produk} · {r.nopol}
            </b>
            <span className="text-on-surface-variant">
              SO {r.noSO || '-'} · LO {r.noLOs.join(', ') || '-'} · order {formatLiter(order)} · real {real === null ? '-' : formatLiter(real, 2)} · losses {real === null ? '-' : formatNumber(real - order, 2)}
            </span>
          </span>
        ))}
        {!penerimaan.length && <span className="text-body-sm text-on-surface-variant">Belum ada penerimaan bulan ini.</span>}
      </Bagian>

      <Bagian no={5} judul="Rekap Tera Nozzle" ringkas={`${formatLiter(pumpTest.reduce((n, r) => n + r.liter, 0), 1)} pump test bulan ini`}>
        {rekapTera.map((x) => (
          <Nilai key={`${x.nozzle}|${x.produk}`} k={`${x.nozzle ? `Nozzle ${x.nozzle}` : 'Nozzle -'} · ${x.produk} · ${x.perHari.size} hari`} v={formatLiter(x.total, 1)} />
        ))}
        {!rekapTera.length && <span className="text-body-sm text-on-surface-variant">Belum ada pump test bulan ini.</span>}
      </Bagian>

      {CASH_SO.map((c, i) => {
        const x = data.cash[c.key] ?? kosongCash()
        const h = hitungCashSo(x, c.key)
        return (
          <Bagian key={c.key} no={6 + i} judul={c.judul.replace('Berita Acara ', '')} ringkas={`Fisik ${rp(h.fisik)} · selisih ${rp(h.selisih)}`}>
            <div className="grid grid-cols-2 gap-space-xs">
              <Field label="Tanggal transaksi" htmlFor={`so-ct-${c.key}`}>
                <Input id={`so-ct-${c.key}`} type="date" disabled={!bolehUbah} value={x.tanggal} onChange={(e) => ubahCash(c.key, { tanggal: e.target.value })} />
              </Field>
              {angkaInput(`so-cj-${c.key}`, c.key === 'petty' ? 'Saldo per book (Rp)' : 'Transaksi penjualan (Rp)', x.penjualan, (v) => ubahCash(c.key, { penjualan: v }))}
              {c.key === 'bbm'
                ? NON_TUNAI_SO.map((k) => <div key={k}>{angkaInput(`so-cn-${c.key}-${k}`, `${k} (Rp)`, x.nonTunai[k] ?? '', (v) => ubahCash(c.key, { nonTunai: { ...x.nonTunai, [k]: v } }))}</div>)
                : c.key !== 'petty' && angkaInput(`so-cn-${c.key}`, 'Non tunai (Rp)', x.nonTunai.non_tunai ?? '', (v) => ubahCash(c.key, { nonTunai: { ...x.nonTunai, non_tunai: v } }))}
            </div>
            <span className="text-tag uppercase text-on-surface-variant">Rincian uang (lembar/keping)</span>
            <div className="grid grid-cols-3 gap-space-xs">
              {PECAHAN.map(([k, l, , t]) => (
                <div key={k}>{angkaInput(`so-cp-${c.key}-${k}`, `${l}${t === 'l' ? ' logam' : ''}`, x.pecahan[k] ?? '', (v) => ubahCash(c.key, { pecahan: { ...x.pecahan, [k]: v } }))}</div>
              ))}
            </div>
            {c.key !== 'petty' && <Nilai k="Total penjualan tunai" v={rp(h.seharusnya)} />}
            <Nilai k="Hasil cash opname" v={rp(h.fisik)} tebal />
            <Nilai k="Selisih lebih/(kurang)" v={rp(h.selisih)} tebal merah={h.selisih < 0} />
            <span className="text-body-sm italic text-on-surface-variant">Terbilang: {terbilang(h.fisik)}</span>
          </Bagian>
        )
      })}

      <Bagian no={10} judul="Justifikasi Sales, Losses & Pertamina Way">
        {(
          [
            ['justifikasiSales', 'a. Justifikasi sales (kenaikan/penurunan)'],
            ['justifikasiLosses', 'b. Justifikasi losses & action'],
            ['justifikasiPw', 'c. Justifikasi Pertamina Way'],
          ] as const
        ).map(([k, l]) => (
          <Field key={k} label={l} htmlFor={`so-${k}`}>
            <Textarea id={`so-${k}`} className="min-h-[88px]" disabled={!bolehUbah} value={data[k]} onChange={(e) => ubah({ [k]: e.target.value })} />
          </Field>
        ))}
      </Bagian>

      <Bagian no={11} judul="Update Pekerja SPBU" ringkas={`${JABATAN_SO.reduce((n, j) => n + (parseAngka(data.pekerja[j] ?? '') ?? 0), 0)} orang`}>
        <div className="grid grid-cols-2 gap-space-xs">
          {JABATAN_SO.map((j) => (
            <div key={j}>{angkaInput(`so-pk-${j}`, j, data.pekerja[j] ?? '', (v) => ubah({ pekerja: { ...data.pekerja, [j]: v } }))}</div>
          ))}
        </div>
      </Bagian>

      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <span className="text-tag uppercase text-primary">Penanda tangan BA</span>
        <div className="grid grid-cols-2 gap-space-xs">
          {(
            [
              ['pengawas', 'Pengawas BBM'],
              ['admin', 'Administrasi'],
              ['abh', 'ABH'],
              ['kasir', 'Kasir (cash opname)'],
            ] as const
          ).map(([k, l]) => (
            <Field key={k} label={l} htmlFor={`so-ttd-${k}`}>
              <Input id={`so-ttd-${k}`} disabled={!bolehUbah} value={data.ttd[k]} onChange={(e) => ubah({ ttd: { ...data.ttd, [k]: e.target.value } })} />
            </Field>
          ))}
        </div>
        <ErrorBox text={error} />
        {bolehUbah && (
          <Button size="lg" disabled={busy !== null} onClick={() => void simpan()}>
            {busy === 'simpan' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            Simpan stock opname {labelBulan(bulan)}
          </Button>
        )}
        <Button variant="glass" size="lg" disabled={busy !== null} onClick={() => void unduh()}>
          {busy === 'excel' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileSpreadsheet aria-hidden="true" />}
          Unduh Excel BA Laporan Bulanan
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}
