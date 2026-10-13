import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileDown, FireExtinguisher, LoaderCircle, TriangleAlert } from 'lucide-react'
import { QrImg } from '@/components/apar/qr'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useToast } from '@/components/ui/toast'
import { aparUnitUrl, jenisLengkap, tipeLabel, warnaLabel, type AparTipe, type AparUnit } from '@/lib/apar'
import { useApp } from '@/lib/app-state'

type Saring = 'semua' | AparTipe

/**
 * Label QR per unit APAR/APAB untuk dicetak dan ditempel di tabung. Memindai label membuka halaman unit.
 * Cetak lewat PDF A4 (bukan cetak halaman browser) agar ukuran label sama di semua HP/printer.
 */
export function AparLabel() {
  const app = useApp()
  const toast = useToast()
  const [params] = useSearchParams()
  const satu = params.get('unit')
  const [saring, setSaring] = useState<Saring>('semua')
  const [busy, setBusy] = useState(false)
  if (!app.loaded) return <Loading />

  const s = app.settings
  const semua: { u: AparUnit; tipe: AparTipe }[] = [...(s.apar ?? []).map((u) => ({ u, tipe: 'apar' as const })), ...(s.apab ?? []).map((u) => ({ u, tipe: 'apab' as const }))]
  const labels = satu ? semua.filter((x) => x.u.id === satu) : semua.filter((x) => saring === 'semua' || x.tipe === saring)

  const unduh = async () => {
    setBusy(true)
    try {
      const { exportLabelAparPdf } = await import('@/lib/report/label-apar')
      const kode = s.kodeSpbu?.trim() || 'SPBU'
      await exportLabelAparPdf(labels, s.namaSpbu?.trim() || 'SPBU', `Label_QR_APAR_SPBU_${kode}${satu && labels[0] ? `_${labels[0].u.kode}` : ''}.pdf`)
      toast('PDF label diunduh')
    } catch (e) {
      toast(`Gagal membuat PDF: ${e instanceof Error ? e.message : String(e)}`, TriangleAlert)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md print:hidden">
        <span className="text-body-sm text-on-surface-variant">
          Unduh PDF label (A4, 8 label per lembar), cetak dengan skala 100%, potong, lalu tempel di tiap tabung (sebaiknya dilaminasi). QR membuka data,
          kondisi, kalender kepatuhan, dan form inspeksi unit itu. Label merah untuk unit terpasang & APAB, biru untuk APAR cadangan.
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
        <Button size="lg" disabled={!labels.length || busy} onClick={unduh}>
          {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileDown aria-hidden="true" />}
          Unduh PDF label A4 ({labels.length} label)
        </Button>
      </GlassCard>

      {labels.length === 0 ? (
        <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
          Belum ada unit di data utama.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 print:hidden">
          {labels.map(({ u, tipe }) => (
            <article
              key={u.id}
              className="flex h-full break-inside-avoid flex-col overflow-hidden rounded-lg border-2 border-black bg-white text-black [-webkit-print-color-adjust:exact] [print-color-adjust:exact]"
            >
              {/* Nama SPBU utuh (boleh dua baris), tidak dipotong. */}
              <header style={{ backgroundColor: warnaLabel(tipe, u.cadangan) }} className="flex items-center gap-2 px-3 py-2 text-white">
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
          ))}
        </div>
      )}
    </div>
  )
}
