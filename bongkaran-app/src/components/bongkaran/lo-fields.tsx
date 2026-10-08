import { TriangleAlert } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PRODUK_OPTIONS, SUPPLY_POINTS } from '@/lib/sop'

/** Bagian form LO yang dipakai bersama: Plan Pengiriman, Edit SO & LO, dan langkah 2 bongkaran. */

export function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
      <span className="text-body-sm font-semibold text-on-error-container">{text}</span>
    </div>
  )
}

export function ProdukSelect({ id, value, onChange, label = 'Produk' }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label}>
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
  )
}

export function SupplySelect({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label}>
        <SelectValue placeholder="Pilih supply point" />
      </SelectTrigger>
      <SelectContent>
        {SUPPLY_POINTS.map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
