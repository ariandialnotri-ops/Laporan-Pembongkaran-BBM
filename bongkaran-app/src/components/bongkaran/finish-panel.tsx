import { useState } from 'react'
import { CircleCheck, Copy, FileText, ImageIcon, LoaderCircle, RotateCcw, Send, TriangleAlert } from 'lucide-react'
import { Field, Ladder } from '@/components/bongkaran/form-bits'
import { StatusBanner } from '@/components/bongkaran/status-banner'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { formatLiter, formatSigned } from '@/lib/format'
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
  onJpg,
  generating,
  waText,
}: {
  report: Report
  evaluation: Evaluation
  settings: Settings
  readOnly: boolean
  setData: (patch: Partial<ReportData>) => void
  onFinish: (status: ReportStatus) => void
  onReopen: () => void
  onPdf: () => void
  onJpg: () => void
  generating: 'pdf' | 'jpg' | null
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
          {d.nopol || 'MT'} · {d.produk || '-'}
        </span>
        <StatusBanner
          tone={anomaly ? 'error' : densityOk ? 'success' : 'idle'}
          title={anomaly ? 'Anomali density — pembongkaran dihentikan' : 'Quality & quantity lengkap'}
          detail={anomaly ? 'Berita Acara dibuat dengan status ANOMALI' : `Density sesuai • ${x.compartments.length} kompartemen diperiksa`}
        />
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
        <span className="text-tag uppercase text-primary">Rekap quantity</span>
        <Ladder
          rows={[
            ['Stok awal (ATG)', x.stokAwal !== null ? formatLiter(x.stokAwal) : '—'],
            ['Volume DO diterima', formatLiter(x.volumeDO ?? 0)],
            ['Stok akhir teoritis', x.stokTeoritis !== null ? formatLiter(x.stokTeoritis) : '—'],
            ['Real stok (ATG)', x.realStok !== null ? formatLiter(x.realStok) : '—'],
          ]}
          total={['Gain / loss', x.gainLoss !== null ? `${formatSigned(x.gainLoss, 0, ' L')} (${formatSigned(x.gainLossPct ?? 0, 2, '%')})` : '—']}
        />
        <Ladder rows={[['Penerimaan menurut deepstick', x.diterimaDip !== null ? formatLiter(x.diterimaDip, 1) : '—']]} total={['Gain / loss deepstick', x.gainLossDip !== null ? formatSigned(x.gainLossDip, 1, ' L') : '—']} />
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
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Petugas penerima" htmlFor="petugas">
              <Input id="petugas" value={d.namaPetugas} onChange={(e) => setData({ namaPetugas: e.target.value })} />
            </Field>
            <Field label="Pengawas SPBU" htmlFor="pengawas">
              <Input id="pengawas" value={d.namaPengawas} onChange={(e) => setData({ namaPengawas: e.target.value })} />
            </Field>
          </div>
          <Field label="Catatan" htmlFor="catatan">
            <Textarea id="catatan" rows={3} placeholder="Catatan tambahan (opsional)" value={d.catatan} onChange={(e) => setData({ catatan: e.target.value })} />
          </Field>
        </fieldset>
      </GlassCard>

      {!finished ? (
        <Button size="lg" variant={anomaly ? 'danger' : 'primary'} className="w-full" onClick={() => onFinish(anomaly ? 'anomali' : 'selesai')}>
          {anomaly ? <TriangleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
          {anomaly ? 'Tutup sebagai anomali' : 'Selesaikan & buat Berita Acara'}
        </Button>
      ) : (
        <>
          <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
            <span className="text-tag uppercase text-primary">Berita Acara Pembongkaran (Q&Q)</span>
            <div className="grid grid-cols-2 gap-space-xs">
              <Button size="pill" disabled={generating !== null} onClick={onPdf}>
                {generating === 'pdf' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileText aria-hidden="true" />}
                PDF
              </Button>
              <Button variant="glass" size="pill" disabled={generating !== null} onClick={onJpg}>
                {generating === 'jpg' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ImageIcon aria-hidden="true" />}
                JPG
              </Button>
            </div>
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

          <Button variant="ghost" size="sm" className="self-center" onClick={onReopen}>
            <RotateCcw aria-hidden="true" />
            Buka kembali untuk koreksi
          </Button>
        </>
      )}
    </div>
  )
}
