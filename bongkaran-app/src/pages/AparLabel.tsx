import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, FileDown, FileImage, FireExtinguisher, LoaderCircle, TriangleAlert } from 'lucide-react'
import { QrImg } from '@/components/apar/qr'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useToast } from '@/components/ui/toast'
import { aparUnitUrl, jenisLengkap, tipeLabel, warnaLabel, type AparTipe, type AparUnit } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import { cn } from '@/lib/utils'

type Saring = 'semua' | AparTipe

/**
 * Label QR per unit APAR/APAB untuk dicetak dan ditempel di tabung. Memindai label membuka halaman unit.
 * Cetak lewat PDF A4 (bukan cetak halaman browser) agar ukuran label sama di semua HP/printer, atau
 * unduh JPG 300 dpi (per label atau lembar A4) untuk dicetak di percetakan / dikirim lewat WhatsApp.
 * Label yang dicetak dapat dipilih (centang di tiap label).
 */
export function AparLabel() {
  const app = useApp()
  const toast = useToast()
  const [params] = useSearchParams()
  const satu = params.get('unit')
  const [saring, setSaring] = useState<Saring>('semua')
  const [busy, setBusy] = useState<'pdf' | 'label' | 'a4' | null>(null)
  // Label yang tidak dicentang (default semua tercentang, juga saat filter berganti).
  const [lepas, setLepas] = useState<Set<string>>(() => new Set())
  if (!app.loaded) return <Loading />

  const s = app.settings
  const semua: { u: AparUnit; tipe: AparTipe }[] = [...(s.apar ?? []).map((u) => ({ u, tipe: 'apar' as const })), ...(s.apab ?? []).map((u) => ({ u, tipe: 'apab' as const }))]
  const tampil = satu ? semua.filter((x) => x.u.id === satu) : semua.filter((x) => saring === 'semua' || x.tipe === saring)
  const labels = tampil.filter((x) => !lepas.has(x.u.id))
  const kode = s.kodeSpbu?.trim() || 'SPBU'
  const dasar = `Label_QR_APAR_SPBU_${kode}${satu && labels[0] ? `_${labels[0].u.kode}` : ''}`
  const centang = (id: string) =>
    setLepas((x) => {
      const n = new Set(x)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const unduh = async () => {
    setBusy('pdf')
    try {
      const { exportLabelAparPdf } = await import('@/lib/report/label-apar')
      await exportLabelAparPdf(labels, s.namaSpbu?.trim() || 'SPBU', `${dasar}.pdf`)
      toast('PDF label diunduh')
    } catch (e) {
      toast(`Gagal membuat PDF: ${e instanceof Error ? e.message : String(e)}`, TriangleAlert)
    } finally {
      setBusy(null)
    }
  }

  const unduhJpg = async (mode: 'label' | 'a4') => {
    setBusy(mode)
    try {
      const { exportLabelAparJpg } = await import('@/lib/report/label-apar-jpg')
      const n = await exportLabelAparJpg(labels, s.namaSpbu?.trim() || 'SPBU', mode, dasar)
      toast(n > 1 ? `${n} gambar JPG diunduh (ZIP)` : 'JPG label diunduh')
    } catch (e) {
      toast(`Gagal membuat JPG: ${e instanceof Error ? e.message : String(e)}`, TriangleAlert)
    } finally {
      setBusy(null)
    }
  }
  const putar = (m: typeof busy) => (busy === m ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md print:hidden">
        <span className="text-body-sm text-on-surface-variant">
          Centang label yang ingin dicetak, lalu unduh PDF A4 (8 label per lembar, cetak skala 100%) atau JPG 300 dpi (per label 92 × 66 mm, atau
          lembar A4). Potong, lalu tempel di tiap tabung (sebaiknya dilaminasi). QR membuka data, kondisi, kalender kepatuhan, dan form inspeksi unit
          itu. Label merah untuk unit terpasang & APAB, biru untuk APAR cadangan.
        </span>
        {!satu && (
          <ChipFilter
            label="Jenis label"
            value={saring}
            onChange={setSaring}
            options={[
              { value: 'semua' as const, label: `Semua ${semua.length}` },
              { value: 'apar' as const, label: `APAR ${(s.apar ?? []).length}` },
              { value: 'apab' as const, label: `APAB ${(s.apab ?? []).length}` },
            ]}
          />
        )}
        {!satu && tampil.length > 1 && (
          <div className="flex items-center justify-between gap-space-sm text-body-sm">
            <span className="text-on-surface-variant">
              {labels.length} dari {tampil.length} label dipilih
            </span>
            <span className="flex gap-space-sm">
              <button type="button" className="touch-44 font-semibold text-primary" onClick={() => setLepas(new Set())}>
                Pilih semua
              </button>
              <button type="button" className="touch-44 font-semibold text-primary" onClick={() => setLepas(new Set(tampil.map((x) => x.u.id)))}>
                Kosongkan
              </button>
            </span>
          </div>
        )}
        <Button size="lg" disabled={!labels.length || !!busy} onClick={unduh}>
          {putar('pdf') ?? <FileDown aria-hidden="true" />}
          Unduh PDF label A4 ({labels.length} label)
        </Button>
        <div className="grid grid-cols-2 gap-space-xs">
          <Button variant="glass" disabled={!labels.length || !!busy} onClick={() => void unduhJpg('label')}>
            {putar('label') ?? <FileImage aria-hidden="true" />}
            JPG per label
          </Button>
          <Button variant="glass" disabled={!labels.length || !!busy} onClick={() => void unduhJpg('a4')}>
            {putar('a4') ?? <FileImage aria-hidden="true" />}
            JPG lembar A4
          </Button>
        </div>
        <span className="text-body-sm text-on-surface-variant">{labels.length > 1 ? 'Lebih dari satu gambar diunduh sebagai file ZIP.' : 'Satu label diunduh sebagai satu file JPG.'}</span>
      </GlassCard>

      {tampil.length === 0 ? (
        <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
          Belum ada unit di data utama.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 print:hidden">
          {tampil.map(({ u, tipe }) => {
            const dipilih = !lepas.has(u.id)
            return (
              <article
                key={u.id}
                className={cn(
                  'relative flex h-full break-inside-avoid flex-col overflow-hidden rounded-lg border-2 border-black bg-white text-black transition-opacity [-webkit-print-color-adjust:exact] [print-color-adjust:exact]',
                  !dipilih && 'opacity-45',
                )}
              >
                {!satu && (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={dipilih}
                    aria-label={`Cetak label ${u.kode}`}
                    onClick={() => centang(u.id)}
                    className="absolute right-1.5 top-1.5 z-10 flex size-11 items-center justify-center"
                  >
                    <span className={cn('flex size-7 items-center justify-center rounded-md border-2 border-white shadow', dipilih ? 'bg-emerald-600 text-white' : 'bg-white/90 text-transparent')}>
                      <Check aria-hidden="true" className="size-5" strokeWidth={3} />
                    </span>
                  </button>
                )}
                {/* Nama SPBU utuh (boleh dua baris), tidak dipotong. */}
                <header style={{ backgroundColor: warnaLabel(tipe, u.cadangan) }} className={cn('flex items-center gap-2 px-3 py-2 text-white', !satu && 'pr-12')}>
                  <FireExtinguisher aria-hidden="true" className="size-5 shrink-0" />
                  <span className="min-w-0 break-words text-[13px] font-extrabold uppercase leading-tight tracking-wide">{s.namaSpbu || 'SPBU'}</span>
                </header>
                <div className="flex flex-1 items-center gap-3 p-3">
                  <QrImg text={aparUnitUrl(u.id)} size={160} alt={`QR ${u.kode}`} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="tabular break-words text-[28px] font-extrabold leading-none tracking-tight">{u.kode || '-'}</span>
                    <span style={{ borderColor: warnaLabel(tipe, u.cadangan), color: warnaLabel(tipe, u.cadangan) }} className="w-fit rounded-sm border-2 px-1.5 text-[12px] font-bold uppercase leading-5">{tipeLabel(tipe, u.cadangan)}</span>
                    <span className="text-[13px] font-semibold leading-tight">
                      {jenisLengkap(u)}, <span className="whitespace-nowrap">{u.kapasitasKg || '-'} kg</span>
                    </span>
                    <span className="break-words text-[13px] leading-tight">{u.lokasi || '-'}</span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
