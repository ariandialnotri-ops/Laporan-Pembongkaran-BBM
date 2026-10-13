import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FireExtinguisher, Printer } from 'lucide-react'
import { QrImg } from '@/components/apar/qr'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { aparUnitUrl, jenisLengkap, tipeLabel, type AparTipe, type AparUnit } from '@/lib/apar'
import { useApp } from '@/lib/app-state'

type Saring = 'semua' | AparTipe

/** Label QR per unit APAR/APAB untuk dicetak dan ditempel di tabung. Memindai label membuka halaman unit. */
export function AparLabel() {
  const app = useApp()
  const [params] = useSearchParams()
  const satu = params.get('unit')
  const [saring, setSaring] = useState<Saring>('semua')
  if (!app.loaded) return <Loading />

  const s = app.settings
  const semua: { u: AparUnit; tipe: AparTipe }[] = [...(s.apar ?? []).map((u) => ({ u, tipe: 'apar' as const })), ...(s.apab ?? []).map((u) => ({ u, tipe: 'apab' as const }))]
  const labels = satu ? semua.filter((x) => x.u.id === satu) : semua.filter((x) => saring === 'semua' || x.tipe === saring)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md print:hidden">
        <span className="text-body-sm text-on-surface-variant">
          Cetak label, potong, lalu tempel di tiap tabung (sebaiknya dilaminasi). QR membuka data, kondisi, kalender kepatuhan, dan form inspeksi unit itu.
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
        <Button size="lg" disabled={!labels.length} onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Cetak / simpan PDF ({labels.length} label)
        </Button>
      </GlassCard>

      {labels.length === 0 ? (
        <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
          Belum ada unit di data utama.
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 print:grid-cols-2 print:gap-[4mm]">
          {/* Kertas A4, 2 kolom x 4 baris = 8 label per halaman; tiap label ±93 x 65 mm. */}
          <style>{'@page { size: A4 portrait; margin: 10mm; }'}</style>
          {labels.map(({ u, tipe }) => (
            <article
              key={u.id}
              className="flex h-full break-inside-avoid flex-col overflow-hidden rounded-lg border-2 border-black bg-white text-black [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:h-[65mm]"
            >
              {/* Nama SPBU utuh (boleh dua baris), tidak dipotong. */}
              <header className="flex items-center gap-2 bg-[#c62828] px-3 py-2 text-white">
                <FireExtinguisher aria-hidden="true" className="size-5 shrink-0" />
                <span className="min-w-0 break-words text-[13px] font-extrabold uppercase leading-tight tracking-wide print:text-[11pt]">{s.namaSpbu || 'SPBU'}</span>
              </header>
              <div className="flex flex-1 items-center gap-3 p-3">
                <QrImg text={aparUnitUrl(u.id)} size={160} alt={`QR ${u.kode}`} className="print:size-[46mm]" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="tabular break-words text-[28px] font-extrabold leading-none tracking-tight print:text-[20pt]">{u.kode || '-'}</span>
                  <span className="w-fit rounded-sm border-2 border-black px-1.5 text-[12px] font-bold uppercase leading-5 print:text-[10pt]">{tipeLabel(tipe, u.cadangan)}</span>
                  <span className="text-[13px] font-semibold leading-tight print:text-[10.5pt]">
                    {jenisLengkap(u)}, <span className="whitespace-nowrap">{u.kapasitasKg || '-'} kg</span>
                  </span>
                  <span className="break-words text-[13px] leading-tight print:text-[10.5pt]">{u.lokasi || '-'}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
