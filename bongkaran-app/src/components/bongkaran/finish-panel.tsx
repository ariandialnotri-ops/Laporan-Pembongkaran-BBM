import { useState } from 'react'
import { CircleCheck, Clock, Copy, Download, FileSpreadsheet, FileText, ImageIcon, LoaderCircle, RotateCcw, Send, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ExportKind } from '@/lib/report/export'
import { Field, Ladder } from '@/components/bongkaran/form-bits'
import { SignersSection } from '@/components/bongkaran/sop-steps'
import { StatusBanner } from '@/components/bongkaran/status-banner'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { formatTanggalIso } from '@/lib/date'
import { formatLiter, formatNumber, formatSigned, parseAngka } from '@/lib/format'
import { shiftLabel } from '@/lib/shift'
import { formatDurasi } from '@/lib/sla'
import { effectiveRules, lamaProses, suggestNoBA, type Evaluation, type Report, type ReportData, type ReportStatus, type Settings } from '@/lib/sop'
import { cn } from '@/lib/utils'

/** Pilihan format unduhan Berita Acara (dropdown). PDF BA saja & PDF + foto memakai ikon yang sama. */
const FORMAT_BA: { kind: ExportKind; label: string; desc: string; icon: LucideIcon }[] = [
  { kind: 'xlsx', label: 'Excel (template BA)', desc: 'File Excel sesuai template', icon: FileSpreadsheet },
  { kind: 'pdf-ba', label: 'PDF BA saja', desc: 'Cepat, tanpa lampiran foto', icon: FileText },
  { kind: 'pdf', label: 'PDF BA + foto', desc: 'Dengan lampiran foto evidence', icon: FileText },
  { kind: 'jpg', label: 'JPG', desc: 'Gambar BA untuk dibagikan', icon: ImageIcon },
]
const KUNCI_FORMAT = 'floq-format-ba'
const formatAwal = (): ExportKind => {
  try {
    const v = localStorage.getItem(KUNCI_FORMAT)
    return FORMAT_BA.some((f) => f.kind === v) ? (v as ExportKind) : 'pdf'
  } catch {
    return 'pdf'
  }
}
const jamMenit = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}
const tglIso = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function FinishPanel({
  report,
  evaluation,
  settings,
  readOnly,
  setData,
  onFinish,
  onReopen,
  onPdf,
  onPdfBa,
  onJpg,
  onXlsx,
  generating,
  waText,
}: {
  report: Report
  evaluation: Evaluation
  settings: Settings
  readOnly: boolean
  setData: (patch: Partial<ReportData>) => void
  onFinish: (status: ReportStatus) => void
  /** Hanya untuk BA anomali dan pengawas; BA selesai tidak dapat diubah. */
  onReopen?: () => void
  /** PDF BA + lampiran foto evidence. */
  onPdf: () => void
  /** PDF BA saja, tanpa foto (cepat). */
  onPdfBa: () => void
  onJpg: () => void
  onXlsx: () => void
  generating: ExportKind | null
  waText: string
}) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [format, setFormat] = useState<ExportKind>(formatAwal)
  const pilihFormat = (v: string) => {
    setFormat(v as ExportKind)
    try {
      localStorage.setItem(KUNCI_FORMAT, v)
    } catch {
      // abaikan
    }
  }
  const unduh: Record<ExportKind, () => void> = { xlsx: onXlsx, 'pdf-ba': onPdfBa, pdf: onPdf, jpg: onJpg }
  const fmt = FORMAT_BA.find((f) => f.kind === format)!
  // Lama proses: mulai tahap 1 (laporan dibuat) sampai laporan ditutup; draf dihitung sampai saat ini.
  const [sekarang] = useState(() => Date.now())
  const lama = lamaProses({ createdAt: report.createdAt, finishedAt: report.finishedAt, status: report.status }, sekarang)
  const d = report.data
  const x = evaluation.derived
  const anomaly = evaluation.densityAnomaly || report.status === 'anomali'
  const finished = report.status !== 'draft'
  const densityOk = x.densityResults.length > 0 && x.densityResults.every((r) => r.ok)
  const rules = effectiveRules(settings.rules)
  const lewat = (v: number | null, batas: number) => v !== null && Math.abs(v) > batas
  const transportLebih = lewat(x.transportLoss, rules.batasLossL)
  const c = x.cek
  const mm = (v: string) => {
    const n = parseAngka(v)
    return n !== null ? `${formatNumber(n)} mm` : '-'
  }
  // Satu baris rekap: nilai ATG vs deepstick dan selisihnya; merah bila melewati batas.
  const selisih = (selMm: number | null, selL: number | null) => (
    <span className={cn((lewat(selMm, rules.batasDipAtgMm) || lewat(selL, rules.batasDipAtgL)) && 'font-bold text-error')}>
      {selMm !== null ? formatSigned(selMm, 0, ' mm') : '-'} · {selL !== null ? formatSigned(selL, 1, ' L') : '-'}
    </span>
  )
  const merah = (on: boolean) => cn('flex flex-col gap-space-xs rounded-lg', on && 'bg-error-container/40 p-space-xs ring-2 ring-error')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(waText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = waText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    toast('Teks laporan disalin')
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-center justify-between gap-2">
          <span className="text-tag uppercase text-primary">Finish proses</span>
          {report.status === 'selesai' && <Pill tone="primary">Selesai</Pill>}
          {report.status === 'anomali' && <Pill tone="error">Anomali</Pill>}
          {!finished && <Pill>Belum ditutup</Pill>}
        </div>
        <span className="text-headline-md font-bold text-on-surface">
          {d.nopol || 'MT'}, {d.produk || '-'}
        </span>
        <span className="text-body-sm text-on-surface-variant">Bongkaran {shiftLabel(x.shift)}</span>
        {lama !== null && (
          <div className="flex items-center gap-space-sm rounded-lg bg-primary/5 px-space-sm py-space-xs">
            <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{finished ? 'Lama proses bongkaran' : 'Berjalan sejak tahap 1'}</span>
              <span className="tabular text-body-sm text-on-surface-variant">
                Mulai {formatTanggalIso(tglIso(report.createdAt))}, {jamMenit(report.createdAt)}
                {report.finishedAt ? ` → selesai ${tglIso(report.finishedAt) === tglIso(report.createdAt) ? '' : `${formatTanggalIso(tglIso(report.finishedAt))}, `}${jamMenit(report.finishedAt)}` : ''}
              </span>
            </span>
            <span className="tabular shrink-0 text-numeric-md font-bold text-primary">{formatDurasi(lama)}</span>
          </div>
        )}
        <StatusBanner
          tone={anomaly ? 'error' : densityOk ? 'success' : 'idle'}
          title={anomaly ? 'Anomali density, pembongkaran dihentikan' : 'Quality & quantity lengkap'}
          detail={anomaly ? 'Berita Acara dibuat dengan status ANOMALI' : `Density sesuai, ${x.compartments.length} kompartemen diperiksa`}
        />
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
        <span className="text-tag uppercase text-primary">Rekap quantity</span>
        {transportLebih && (
          <StatusBanner
            tone="error"
            title={`Transport gain/loss di atas ${rules.batasLossL} L, lakukan pemeriksaan kembali`}
            detail={`Transport ${formatSigned(x.transportLoss ?? 0, 1, ' L')}: cek deepstick kompartemen & kepekaan buku tera`}
          />
        )}
        <div className={merah(transportLebih)}>
          <Ladder
            rows={[['Batas toleransi (-0,15% kapasitas)', x.transportLossLimit !== null ? formatSigned(x.transportLossLimit, 2, ' L') : '-']]}
            total={['Total transport loss', x.transportLoss !== null ? formatSigned(x.transportLoss, 2, ' L') : '-']}
          />
        </div>
        {x.transportLoss !== null && x.transportLossLimit !== null && x.transportLoss < x.transportLossLimit && (
          <StatusBanner tone="error" title="Transport loss melebihi batas toleransi" detail="Akan ditandai merah di Berita Acara" />
        )}
        <Ladder
          rows={[
            ['Stok awal (ATG)', x.stokAwal !== null ? formatLiter(x.stokAwal) : '-'],
            ['Volume DO diterima', formatLiter(x.volumeDO ?? 0)],
            ['Stok akhir teoritis', x.stokTeoritis !== null ? formatLiter(x.stokTeoritis) : '-'],
            ['Real stok (ATG)', x.realStok !== null ? formatLiter(x.realStok) : '-'],
          ]}
          total={['Discharge gain/loss', x.gainLoss !== null ? `${formatSigned(x.gainLoss, 0, ' L')} (${formatSigned(x.gainLossPct ?? 0, 2, '%')} dari volume DO)` : '-']}
        />
        <span className="text-tag uppercase text-on-surface-variant">Selisih ATG vs deepstick</span>
        <Ladder
          rows={[
            ['Sebelum: ATG / deepstick', `${mm(d.atgBefore.tinggi)} / ${mm(d.dipBeforeMm)}`],
            ['Sebelum: selisih', selisih(c.dipAtgMmBefore, c.dipAtgLBefore)],
            ['Sesudah: ATG / deepstick', `${mm(d.atgAfter.tinggi)} / ${mm(d.dipAfterMm)}`],
            ['Sesudah: selisih', selisih(c.dipAtgMmAfter, c.dipAtgLAfter)],
          ]}
        />
        <Ladder
          rows={[
            ['Penerimaan ATG', x.terimaAktual !== null ? formatLiter(x.terimaAktual, 0) : '-'],
            ['Penerimaan P-Insyst', parseAngka(d.penerimaanPinsyst ?? '') !== null ? formatLiter(parseAngka(d.penerimaanPinsyst ?? '') ?? 0, 0) : '-'],
          ]}
          total={['Selisih P-Insyst − ATG', c.pinsyst !== null ? <span className={cn(lewat(c.pinsyst, rules.batasPinsystL) && 'text-error')}>{formatSigned(c.pinsyst, 0, ' L')}</span> : '-']}
        />
        <Ladder rows={[['Penerimaan menurut deepstick', x.diterimaDip !== null ? formatLiter(x.diterimaDip, 1) : '-']]} total={['Gain / loss deepstick', x.gainLossDip !== null ? formatSigned(x.gainLossDip, 1, ' L') : '-']} />
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-3 p-space-md">
        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-space-md">
          <Field label="Nomor Berita Acara" htmlFor="noba">
            <div className="flex gap-space-xs">
              <Input id="noba" className="flex-1" value={d.noBA} onChange={(e) => setData({ noBA: e.target.value })} />
              <Button variant="soft" onClick={() => setData({ noBA: suggestNoBA(settings, report) })}>
                Otomatis
              </Button>
            </div>
          </Field>
          <Field label="Catatan" htmlFor="catatan">
            <Textarea id="catatan" rows={3} placeholder="Catatan tambahan (opsional)" value={d.catatan} onChange={(e) => setData({ catatan: e.target.value })} />
          </Field>
        </fieldset>
      </GlassCard>

      {finished && <SignersSection report={report} setData={setData} readOnly={readOnly} keys={['pengawas', 'abh']} title="Tanda tangan pengawas & ABH" />}

      {!finished ? (
        <Button size="lg" variant={anomaly ? 'danger' : 'primary'} className="w-full" onClick={() => onFinish(anomaly ? 'anomali' : 'selesai')}>
          {anomaly ? <TriangleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
          {anomaly ? 'Tutup sebagai anomali' : 'Selesaikan & buat Berita Acara'}
        </Button>
      ) : (
        <>
          <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
            <span className="text-tag uppercase text-primary">Berita Acara Pembongkaran (Q&Q)</span>
            <Field label="Pilih format unduhan" htmlFor="format-ba">
              <Select value={format} onValueChange={pilihFormat} disabled={generating !== null}>
                <SelectTrigger id="format-ba" className="[&_.fmt-desc]:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_BA.map((f) => (
                    <SelectItem key={f.kind} value={f.kind}>
                      <span className="flex items-center gap-2.5">
                        <f.icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
                        <span className="flex flex-col">
                          <span className="font-semibold">{f.label}</span>
                          <span className="fmt-desc text-xs text-on-surface-variant">{f.desc}</span>
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Button size="pill" disabled={generating !== null} onClick={unduh[format]}>
              {generating !== null ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
              Unduh {fmt.label}
            </Button>
            <span className="text-body-sm text-on-surface-variant">Pilihan format diingat untuk unduhan berikutnya.</span>
          </GlassCard>

          <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
            <span className="text-tag uppercase text-primary">Laporan grup WhatsApp SPBU</span>
            <pre className="inset-field tabular max-h-72 overflow-auto whitespace-pre-wrap rounded-md p-space-sm text-numeric-sm text-on-surface">{waText}</pre>
            <div className="grid grid-cols-2 gap-space-xs">
              <Button variant="glass" size="pill" onClick={copy}>
                <Copy aria-hidden="true" />
                {copied ? 'Tersalin' : 'Salin teks'}
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ size: 'pill' }))}
              >
                <Send aria-hidden="true" />
                Kirim WA
              </a>
            </div>
          </GlassCard>

          {onReopen && (
            <Button variant="ghost" size="sm" className="self-center" onClick={onReopen}>
              <RotateCcw aria-hidden="true" />
              Buka kembali untuk koreksi (pengawas)
            </Button>
          )}
        </>
      )}
    </div>
  )
}
