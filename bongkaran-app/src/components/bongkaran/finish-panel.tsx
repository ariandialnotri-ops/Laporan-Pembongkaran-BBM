import { useState } from 'react'
import { CircleCheck, Copy, FileSpreadsheet, FileText, ImageIcon, Images, LoaderCircle, RotateCcw, Send, TriangleAlert } from 'lucide-react'
import type { ExportKind } from '@/lib/report/export'
import { Field, Ladder } from '@/components/bongkaran/form-bits'
import { SignersSection } from '@/components/bongkaran/sop-steps'
import { StatusBanner } from '@/components/bongkaran/status-banner'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { formatLiter, formatSigned } from '@/lib/format'
import { shiftLabel } from '@/lib/shift'
import { suggestNoBA, type Evaluation, type Report, type ReportData, type ReportStatus, type Settings } from '@/lib/sop'
import { cn } from '@/lib/utils'

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
  const d = report.data
  const x = evaluation.derived
  const anomaly = evaluation.densityAnomaly || report.status === 'anomali'
  const finished = report.status !== 'draft'
  const densityOk = x.densityResults.length > 0 && x.densityResults.every((r) => r.ok)

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
        <StatusBanner
          tone={anomaly ? 'error' : densityOk ? 'success' : 'idle'}
          title={anomaly ? 'Anomali density, pembongkaran dihentikan' : 'Quality & quantity lengkap'}
          detail={anomaly ? 'Berita Acara dibuat dengan status ANOMALI' : `Density sesuai, ${x.compartments.length} kompartemen diperiksa`}
        />
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
        <span className="text-tag uppercase text-primary">Rekap quantity</span>
        <Ladder
          rows={[['Batas toleransi (-0,15% kapasitas)', x.transportLossLimit !== null ? formatSigned(x.transportLossLimit, 2, ' L') : '-']]}
          total={['Total transport loss', x.transportLoss !== null ? formatSigned(x.transportLoss, 2, ' L') : '-']}
        />
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
            <Button size="pill" disabled={generating !== null} onClick={onXlsx}>
              {generating === 'xlsx' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileSpreadsheet aria-hidden="true" />}
              Excel (template BA)
            </Button>
            <div className="grid grid-cols-2 gap-space-xs">
              <Button variant="glass" size="pill" disabled={generating !== null} onClick={onPdfBa}>
                {generating === 'pdf-ba' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileText aria-hidden="true" />}
                PDF BA saja
              </Button>
              <Button variant="glass" size="pill" disabled={generating !== null} onClick={onPdf}>
                {generating === 'pdf' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Images aria-hidden="true" />}
                PDF + foto
              </Button>
              <Button variant="glass" size="pill" className="col-span-2" disabled={generating !== null} onClick={onJpg}>
                {generating === 'jpg' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ImageIcon aria-hidden="true" />}
                JPG
              </Button>
            </div>
            <span className="text-body-sm text-on-surface-variant">PDF BA saja lebih cepat, tanpa lampiran foto evidence.</span>
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
