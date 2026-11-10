import { useState } from 'react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { BARIS_ORANYE, ProdukChip, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatLiter } from '@/lib/format'
import { barisPumpTest, LABEL_PUMP_TEST, rekapTeraNozzle, type BarisPumpTest, type JenisPumpTest } from '@/lib/pumptest'
import { cn } from '@/lib/utils'

const SEMUA = '__semua__'

const COLS: Col<BarisPumpTest>[] = [
  { header: 'Tanggal', cell: (x) => <span className="tabular whitespace-nowrap">{`${formatTanggalIso(x.tanggal)} ${x.jam}`}</span>, mobile: 'sub' },
  { header: 'Nozzle', cell: (x) => <span className="font-semibold">{x.nozzle ? `Nozzle ${x.nozzle}` : '-'}</span>, mobileCell: (x) => `${x.nozzle ? `Nozzle ${x.nozzle}` : 'Nozzle -'} · ${x.produk}`, mobile: 'title' },
  { header: 'Produk', cell: (x) => <ProdukChip produk={x.produk} />, mobile: 'hide' },
  { header: 'Jenis', cell: (x) => LABEL_PUMP_TEST[x.jenis], mobile: 'sub' },
  { header: 'Volume', cell: (x) => <span className="tabular whitespace-nowrap">{formatLiter(x.liter, 1)}</span>, mobile: 'badge' },
  { header: 'Hasil', cell: (x) => <span className={cn('tabular whitespace-nowrap', x.lewat && 'font-semibold text-error')}>{x.hasil}</span>, mobile: 'sub' },
  { header: 'Petugas', cell: (x) => x.petugas || '-', mobile: 'hide' },
]

/** Report > Riwayat Pump Test: uji kualitas, uji kuantitas Q&Q, dan uji takaran per nozzle & produk. */
export function RiwayatPumpTest() {
  const app = useApp()
  useSyncOnOpen()
  const [bulan, setBulan] = useState(todayIso().slice(0, 7))
  const [jenis, setJenis] = useState<'semua' | JenisPumpTest>('semua')
  const [nozzle, setNozzle] = useState(SEMUA)
  if (!app.loaded) return <Loading />
  const nozzles = app.settings.nozzles ?? []
  const bulanIni = barisPumpTest(app.daily, nozzles).filter((r) => r.tanggal.startsWith(bulan))
  const n = (j: JenisPumpTest) => bulanIni.filter((r) => r.jenis === j).length
  const rows = bulanIni.filter((r) => (jenis === 'semua' || r.jenis === jenis) && (nozzle === SEMUA || r.nozzle === nozzle))
  const rekap = rekapTeraNozzle(rows)
  const total = rows.reduce((s, r) => s + r.liter, 0)
  const perProduk = [...new Set(rows.map((r) => r.produk))].map((p) => ({ produk: p, liter: rows.filter((r) => r.produk === p).reduce((s, r) => s + r.liter, 0) }))
  const namaNozzle = [...new Set([...nozzles.map((x) => x.nama), ...bulanIni.map((r) => r.nozzle).filter(Boolean)])]

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Bulan" htmlFor="pt-bulan">
            <Input id="pt-bulan" type="month" value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
          </Field>
          <Field label="Nozzle" htmlFor="pt-nozzle">
            <Select value={nozzle} onValueChange={setNozzle}>
              <SelectTrigger id="pt-nozzle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA}>Semua nozzle</SelectItem>
                {namaNozzle.map((x) => (
                  <SelectItem key={x} value={x}>
                    Nozzle {x} · {nozzles.find((z) => z.nama === x)?.produk ?? ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <ChipFilter
          label="Jenis pump test"
          value={jenis}
          onChange={setJenis}
          options={[{ value: 'semua' as const, label: `Semua ${bulanIni.length}` }, ...(['kualitas', 'kuantitas', 'takaran'] as const).map((j) => ({ value: j, label: `${LABEL_PUMP_TEST[j]} ${n(j)}` }))]}
        />
        <div className="grid grid-cols-2 gap-space-xs">
          <div className="rounded-md bg-primary-fixed/50 p-space-xs">
            <span className="tabular block text-body-md font-bold text-on-surface">{formatLiter(total, 1)}</span>
            <span className="text-xs uppercase text-on-surface-variant">Total pump test</span>
          </div>
          {perProduk.map((x) => (
            <div key={x.produk} className="rounded-md bg-surface-container-low p-space-xs">
              <span className="tabular block text-body-md font-bold text-on-surface">{formatLiter(x.liter, 1)}</span>
              <span className="text-xs uppercase text-on-surface-variant">{x.produk}</span>
            </div>
          ))}
        </div>
        <span className="text-body-sm text-on-surface-variant">Volume pump test dikembalikan ke tangki dan tidak dihitung sebagai penjualan (BA Rekap Tera Nozzle di Laporan Stock Opname).</span>
      </GlassCard>

      {rekap.length > 0 && (
        <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-xs p-space-md">
          <SectionHeader id="pt-rekap" title="Rekap per nozzle" />
          {rekap.map((x) => (
            <span key={`${x.nozzle}|${x.produk}`} className="tabular flex items-center justify-between gap-2 text-body-sm">
              <span>
                {x.nozzle ? `Nozzle ${x.nozzle}` : 'Nozzle tidak dicatat'} · {x.produk} · {x.perHari.size} hari
              </span>
              <b>{formatLiter(x.total, 1)}</b>
            </span>
          ))}
        </GlassCard>
      )}

      <div className="animate-entrance-3">
        <RecordTable title="Riwayat Pump Test" rows={rows} total={bulanIni.length} cols={COLS} rowKey={(x) => x.key} rowClass={(x) => (x.lewat ? BARIS_ORANYE : undefined)} empty="Belum ada pump test pada bulan ini." />
      </div>
    </div>
  )
}
