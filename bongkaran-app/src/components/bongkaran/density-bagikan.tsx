import { useState } from 'react'
import { ImageDown, LoaderCircle, Send } from 'lucide-react'
import { salinTeks } from '@/components/bongkaran/kirim-wa'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { ekspor, muatFoto } from '@/lib/ekspor'
import { formatDensity, formatDensitySigned, parseAngka } from '@/lib/format'
import { buatKolaseGrid, type BagianKolase } from '@/lib/kolase'
import type { Derived, Report, Rules, Settings } from '@/lib/sop'

const ok = (b: boolean | null) => (b === null ? '' : b ? '✅' : '❌')
const jamFoto = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${formatTanggalIso(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)} ${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

/** Ringkasan uji density kompartemen untuk grup WhatsApp (format tebal WhatsApp: *teks*). */
export function teksDensityWa(report: Report, x: Derived, rules: Rules, settings: Settings) {
  const d = report.data
  const hasil = x.densityResults.filter((r) => r.d15)
  const anomali = hasil.some((r) => r.ok === false)
  const L: string[] = []
  L.push('*UJI DENSITY KOMPARTEMEN MT*')
  L.push(`${settings.namaSpbu || 'SPBU'}${settings.kodeSpbu ? ` (${settings.kodeSpbu})` : ''}`)
  L.push('')
  L.push(`📅 ${formatTanggalIso(d.tanggalDatang)}${d.jamDatang ? ` | Datang ${d.jamDatang}` : ''}`)
  L.push(`🚚 MT ${d.nopol || '-'} | Driver: ${d.namaDriver || '-'}`)
  L.push(`⛽ ${d.produk || '-'} | LO: ${d.noLOs.join(', ') || '-'}`)
  L.push(`Density std. 15 °C depot: *${formatDensity(x.d15Depot)}* (toleransi ±${String(rules.densityTolerance).replace('.', ',')})`)
  L.push('')
  for (const r of hasil) {
    L.push(`Komp ${r.kompartemenNo}: obs ${formatDensity(r.obs)} @${(parseAngka(r.suhu) ?? 0).toString().replace('.', ',')}°C → Density std. 15 °C *${formatDensity(r.d15?.value ?? null)}* | selisih ${formatDensitySigned(r.selisih)} ${ok(r.ok)}`)
  }
  L.push('')
  L.push(anomali ? '*❌ ANOMALI DENSITY, PEMBONGKARAN DIHENTIKAN*' : `*✅ ${hasil.length} pengukuran sesuai toleransi*`)
  if (d.namaPetugas) L.push(`Petugas: ${d.namaPetugas}`)
  return L.join('\n')
}

/**
 * Tahap Density: export foto (kolase foto hidrometer & termometer bercap hasil uji, JPG) dan kirim ringkasan
 * ke WhatsApp (lembar berbagi HP berisi foto + teks; tanpa berbagi file: teks dibuka di WhatsApp dan disalin).
 */
export function DensityBagikan({ report, x, rules }: { report: Report; x: Derived; rules: Rules }) {
  const app = useApp()
  const toast = useToast()
  const [busy, setBusy] = useState<'foto' | 'wa' | null>(null)
  const d = report.data
  const fotos = report.photos.density ?? []
  const hasil = x.densityResults.filter((r) => r.d15)
  if (!hasil.length) return null
  const teks = teksDensityWa(report, x, rules, app.settings)
  const nama = `Density_${(d.nopol || 'MT').replace(/[^a-zA-Z0-9]/g, '')}_${d.tanggalDatang}.jpg`

  /** Kolase foto density; tiap foto dicap waktu foto, MT & produk, dan hasil pengukuran ke-i (atau ringkasan). */
  const buatFoto = async (lapor: (p: number, t?: string) => void) => {
    const data = await muatFoto(fotos, (p) => app.backend.photoDataUrl(p), lapor, 10, 60)
    lapor(65, 'Mencetak hasil uji di foto')
    const bagian: BagianKolase[] = []
    for (const [i, p] of fotos.entries()) {
      const src = data[p.id]
      if (!src) continue
      const r = hasil[i] ?? null
      const blob = await (await fetch(src)).blob()
      bagian.push({
        blob,
        cap: [
          jamFoto(p.at) || formatTanggalIso(d.tanggalDatang),
          `${d.nopol || 'MT'} · ${d.produk || '-'} · Density std. 15 °C depot ${formatDensity(x.d15Depot)}`,
          r
            ? `Komp ${r.kompartemenNo}: ${formatDensity(r.d15?.value ?? null)} · selisih ${formatDensitySigned(r.selisih)} ${r.ok === false ? 'ANOMALI' : 'sesuai'}`
            : hasil.map((h) => `K${h.kompartemenNo} ${formatDensity(h.d15?.value ?? null)}`).join(' · '),
        ],
      })
    }
    if (!bagian.length) throw new Error('Foto density belum dapat dimuat. Periksa sinyal lalu coba lagi.')
    lapor(80, 'Menyusun kolase')
    return buatKolaseGrid(bagian)
  }

  const unduh = (blob: Blob) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = nama
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  const exportFoto = async () => {
    setBusy('foto')
    try {
      await ekspor('Membuat foto hasil uji density', async (lapor) => unduh(await buatFoto(lapor)))
    } catch (e) {
      toast(`Gagal membuat foto: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const kirimWa = async () => {
    setBusy('wa')
    try {
      const tersalin = await salinTeks(teks)
      const file = fotos.length ? new File([await ekspor('Menyiapkan foto untuk WhatsApp', buatFoto)], nama, { type: 'image/jpeg' }) : null
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (file && nav.canShare?.({ files: [file], text: teks })) {
        await navigator.share({ files: [file], text: teks })
        toast(tersalin ? 'Dibagikan. Teks ringkasan juga sudah disalin.' : 'Dibagikan.')
      } else {
        if (file) unduh(file)
        window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, '_blank', 'noopener')
        toast(file ? 'Foto diunduh; lampirkan di WhatsApp bersama teks ringkasan.' : 'Ringkasan dibuka di WhatsApp.')
      }
    } catch (e) {
      // Batal dari lembar berbagi bukan kesalahan.
      if (!(e instanceof DOMException && e.name === 'AbortError')) toast(`Gagal membagikan: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
      <span className="text-tag uppercase text-primary">Bagikan hasil uji density</span>
      <pre className="inset-field tabular max-h-48 overflow-auto whitespace-pre-wrap rounded-md p-space-sm text-xs text-on-surface">{teks}</pre>
      <div className="grid grid-cols-2 gap-space-xs">
        <Button variant="glass" size="pill" disabled={busy !== null || !fotos.length} onClick={() => void exportFoto()}>
          {busy === 'foto' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ImageDown aria-hidden="true" />}
          Export foto
        </Button>
        <Button size="pill" className="bg-[#1fa855] hover:bg-[#1a9149]" disabled={busy !== null} onClick={() => void kirimWa()}>
          {busy === 'wa' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          Kirim ke WhatsApp
        </Button>
      </div>
      <span className="text-xs text-on-surface-variant">
        {fotos.length ? `Export foto: kolase ${fotos.length} foto density bercap hasil uji (JPG). WhatsApp: foto + teks ringkasan.` : 'Tambahkan foto hidrometer & termometer di atas untuk export foto. Ringkasan teks tetap dapat dikirim.'}
      </span>
    </GlassCard>
  )
}
