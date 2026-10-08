import { useMemo, useState } from 'react'
import { FileSpreadsheet, FileText, LoaderCircle, TriangleAlert } from 'lucide-react'
import { DateFilter, useDateRange } from '@/components/bongkaran/date-filter'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import type { StokRecord } from '@/lib/daily'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import { persediaanRows, ROWS_PER_PAGE } from '@/lib/report/persediaan'
import { PRODUK_OPTIONS } from '@/lib/sop'
import { tankForProduk, tankName } from '@/lib/tank'
import { cn } from '@/lib/utils'

/** Laporan > Persediaan BBM: pilih produk & tanggal, lihat baris per shift, unduh sesuai template. */
export function Persediaan() {
  const app = useApp()
  const toast = useToast()
  const [range, setRange] = useDateRange('month')
  const [produk, setProduk] = useState(PRODUK_OPTIONS[0])
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)

  const stok = useMemo(() => app.daily.filter((d): d is StokRecord => d.kind === 'stok'), [app.daily])
  const from = range.from || '0000-01-01'
  const to = range.to || todayIso()
  const rows = useMemo(() => persediaanRows(produk, from, to, stok, app.reports), [produk, from, to, stok, app.reports])

  if (!app.loaded) return <Loading />

  const tank = tankForProduk(produk)
  const unduh = async (kind: 'xlsx' | 'pdf') => {
    if (!rows.length) return toast('Belum ada data stok shift atau bongkaran untuk produk & tanggal ini', TriangleAlert)
    setBusy(kind)
    try {
      const ex = await import('@/lib/report/export')
      const data = { rows, header: { noSpbu: app.settings.kodeSpbu, produk, tangki: tank ? String(tank.tankNo) : '' } }
      const name = `Catatan_Persediaan_${produk.replace(/\s+/g, '')}_${from}_${to}`
      if (kind === 'xlsx') await ex.exportPersediaanXlsx(data, `${name}.xlsx`)
      else await ex.exportPersediaanPdf(data, `${name}.pdf`)
    } catch (e) {
      toast(`Gagal membuat laporan: ${e instanceof Error ? e.message : String(e)}`, TriangleAlert)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <Field label="Produk" htmlFor="persediaan-produk" hint={tank ? tankName(tank.tankNo) : undefined}>
          <Select value={produk} onValueChange={setProduk}>
            <SelectTrigger id="persediaan-produk">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUK_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DateFilter id="persediaan-range" value={range} onChange={setRange} />
        <div className="grid grid-cols-2 gap-space-xs">
          <Button size="pill" disabled={busy !== null} onClick={() => unduh('xlsx')}>
            {busy === 'xlsx' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileSpreadsheet aria-hidden="true" />}
            Unduh Excel
          </Button>
          <Button variant="glass" size="pill" disabled={busy !== null} onClick={() => unduh('pdf')}>
            {busy === 'pdf' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileText aria-hidden="true" />}
            Unduh PDF
          </Button>
        </div>
        <span className="tabular text-body-sm text-on-surface-variant">
          {rows.length} baris shift{rows.length > ROWS_PER_PAGE ? `, ${Math.ceil(rows.length / ROWS_PER_PAGE)} lembar` : ''}. Format sama dengan template Excel.
        </span>
      </GlassCard>

      {/* Pratinjau: kolom utama yang sama dengan lembar persediaan. */}
      <GlassCard level={1} className="animate-entrance-2 overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-space-md text-center text-body-sm text-on-surface-variant">Belum ada stok shift atau bongkaran {produk} pada rentang ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-body-sm">
              <thead className="bg-surface-container-low/80">
                <tr className="text-tag uppercase text-on-surface-variant">
                  <th scope="col" className="px-space-sm py-space-xs font-semibold">Tanggal</th>
                  <th scope="col" className="px-space-xs py-space-xs font-semibold">Shift</th>
                  <th scope="col" className="px-space-xs py-space-xs text-right font-semibold">Stok awal</th>
                  <th scope="col" className="px-space-xs py-space-xs text-right font-semibold">Terima</th>
                  <th scope="col" className="px-space-xs py-space-xs text-right font-semibold">Keluar</th>
                  <th scope="col" className="px-space-sm py-space-xs text-right font-semibold">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {rows.map((r) => (
                  <tr key={`${r.tanggal}-${r.shift}`} className="tabular">
                    <td className="whitespace-nowrap px-space-sm py-space-xs text-on-surface">{formatTanggalIso(r.tanggal)}</td>
                    <td className="px-space-xs py-space-xs text-on-surface-variant">{r.shift}</td>
                    <td className="px-space-xs py-space-xs text-right text-on-surface">{num(r.a)}</td>
                    <td className="px-space-xs py-space-xs text-right text-on-surface">{num(r.c)}</td>
                    <td className="px-space-xs py-space-xs text-right text-on-surface">{num(r.e)}</td>
                    <td className={cn('px-space-sm py-space-xs text-right font-semibold', (r.h ?? 0) < 0 ? 'text-error' : 'text-on-surface')}>{r.h === null ? '-' : formatNumber(r.h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  )
}

const num = (v: number | null | undefined) => (v === null || v === undefined || v === 0 ? '-' : formatNumber(v))
