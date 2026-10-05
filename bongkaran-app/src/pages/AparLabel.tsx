import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { QrImg } from '@/components/apar/qr'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Loading } from '@/components/bongkaran/load-state'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { aparUnitUrl, tipeLabel, type AparTipe, type AparUnit } from '@/lib/apar'
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
          Cetak label, potong, lalu tempel di tiap tabung (sebaiknya dilaminasi). Pindai QR dengan kamera HP untuk membuka data, kondisi, dan form inspeksi unit itu.
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
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2 print:grid-cols-3 print:gap-2">
          {labels.map(({ u, tipe }) => (
            <article key={u.id} className="flex break-inside-avoid items-center gap-space-sm rounded-md border-2 border-dashed border-on-surface/40 bg-white p-space-sm text-black">
              <QrImg text={aparUnitUrl(u.id)} size={112} alt={`QR ${u.kode}`} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wide">{s.namaSpbu || 'SPBU'}</span>
                <span className="tabular text-headline-md font-bold leading-tight">{u.kode || '-'}</span>
                <span className="text-body-sm font-semibold">
                  {tipeLabel(tipe, u.cadangan)}, {u.jenis}, {u.kapasitasKg || '-'} kg
                </span>
                <span className="text-body-sm">{u.lokasi || '-'}</span>
                <span className="text-[10px]">Pindai: data, kondisi & inspeksi</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
