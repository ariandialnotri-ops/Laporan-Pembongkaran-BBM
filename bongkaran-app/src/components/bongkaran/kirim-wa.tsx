import { useState, type ReactNode } from 'react'
import { CircleCheck, Copy, LoaderCircle, Send } from 'lucide-react'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { GAYA_STATUS } from '@/components/bongkaran/pilih-status'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function salinTeks(teks: string) {
  try {
    await navigator.clipboard.writeText(teks)
    return true
  } catch {
    return false
  }
}

/** Pratinjau teks seperti tampil di WhatsApp: *tebal* dan blok ``` monospace (tanda format disembunyikan). */
export function PratinjauWa({ teks }: { teks: string }) {
  const out: ReactNode[] = []
  let mono: string[] | null = null
  teks.split('\n').forEach((l, i) => {
    if (l.trim() === '```') {
      if (mono) {
        out.push(
          <pre key={i} className="my-1 overflow-x-auto font-mono text-[12.5px] leading-relaxed">
            {mono.join('\n')}
          </pre>,
        )
        mono = null
      } else mono = []
      return
    }
    if (mono) return void mono.push(l)
    const tebal = /^\*(.+)\*$/.exec(l)
    out.push(
      tebal ? (
        <strong key={i} className="block">
          {tebal[1]}
        </strong>
      ) : (
        <span key={i} className="block min-h-[1em]">
          {l}
        </span>
      ),
    )
  })
  return <div className="rounded-md bg-[#e7fbe0] p-space-sm text-body-sm text-[#111b21] shadow-sm">{out}</div>
}

/**
 * Layar setelah data tersimpan: pratinjau kolase foto & teks laporan, lalu kirim ke WhatsApp lewat
 * lembar berbagi HP (foto + teks; teks juga disalin). Perangkat tanpa berbagi file (komputer):
 * foto diunduh lalu WhatsApp dibuka dengan teks. Foto tidak disimpan di aplikasi.
 */
export function LayarKirimWa({
  judul,
  keterangan,
  teks,
  files,
  urls,
  dibagikan,
  onDibagikan,
  children,
}: {
  judul: string
  keterangan: ReactNode
  teks: string
  files: File[]
  urls: string[]
  dibagikan: boolean
  onDibagikan: () => void
  /** Tautan lanjutan di bawah (mis. kembali ke menu). */
  children?: ReactNode
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const keWa = async () => {
    setBusy(true)
    setError(null)
    // Teks juga disalin: bila aplikasi tujuan tidak memakai teks bersama foto, cukup ditempel.
    const tersalin = await salinTeks(teks)
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    try {
      if (nav.canShare?.({ files, text: teks })) {
        await navigator.share({ files, text: teks })
        onDibagikan()
        toast(tersalin ? 'Dibagikan. Teks laporan juga sudah disalin.' : 'Dibagikan.')
      } else {
        for (const f of files) {
          const a = document.createElement('a')
          a.href = URL.createObjectURL(f)
          a.download = f.name
          document.body.appendChild(a)
          a.click()
          a.remove()
          setTimeout(() => URL.revokeObjectURL(a.href), 2000)
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank', 'noopener')
        onDibagikan()
        toast('Foto diunduh; lampirkan di WhatsApp bersama teks laporan.')
      }
    } catch (e) {
      // Batal dari lembar berbagi bukan kesalahan.
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(`Gagal membagikan: ${pesan(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className={cn('animate-entrance-1 flex items-start gap-space-sm border p-space-md', GAYA_STATUS.sudah.kartu)}>
        <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', GAYA_STATUS.sudah.ikon)}>
          <CircleCheck className="size-6" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-headline-md font-bold text-on-surface">{judul}</span>
          <span className="text-body-sm text-on-surface-variant">{keterangan}</span>
        </span>
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
        {urls.map((u) => (
          <img key={u} src={u} alt="Kolase foto laporan" className="w-full rounded-md bg-white shadow-sm" />
        ))}
        <PratinjauWa teks={teks} />
        <ErrorBox text={error} />
        <Button size="lg" className="bg-[#1fa855] text-white hover:bg-[#1a9149]" disabled={busy} onClick={() => void keWa()}>
          {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {dibagikan ? 'Kirim ulang ke WhatsApp' : 'Kirim ke WhatsApp (kolase foto + teks)'}
        </Button>
        <Button variant="glass" onClick={() => void salinTeks(teks).then((ok) => toast(ok ? 'Teks laporan disalin' : 'Gagal menyalin teks'))}>
          <Copy aria-hidden="true" />
          Salin teks laporan
        </Button>
        <span className="text-body-sm text-on-surface-variant">Pilih WhatsApp lalu grup laporan di lembar berbagi. Bila teks tidak ikut, tempel dari salinan sebagai keterangan foto.</span>
      </GlassCard>

      {children && <div className="flex flex-col gap-space-xs">{children}</div>}
    </div>
  )
}
