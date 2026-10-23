import { CircleCheck, CircleDot, LoaderCircle, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Pill } from '@/components/ui/pill'
import { cn } from '@/lib/utils'

const jamDari = (iso?: string) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '')

/**
 * Kotak simpan di setiap kartu input: amber + tombol Simpan biru penuh selama belum disimpan, hijau
 * "Tersimpan jam" setelahnya. `savedAt` berupa ISO atau jam "HH:MM".
 */
export function SimpanBaris({
  ok,
  okText,
  savedAt,
  busy,
  error,
  onSave,
  label,
}: {
  ok: boolean | null
  okText: string
  savedAt?: string
  busy: boolean
  error?: string
  onSave: () => void
  label: string
}) {
  const jam = savedAt && savedAt.length > 5 ? jamDari(savedAt) : savedAt
  return (
    <div className={cn('flex flex-col gap-space-xs rounded-md border-2 p-space-sm', savedAt ? 'border-emerald-300 bg-emerald-50' : 'border-amber-400 bg-amber-50')}>
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <span className="flex flex-wrap items-center gap-space-xs">
          {ok !== null && <Pill tone={ok ? 'success' : 'error'}>{okText}</Pill>}
          {savedAt ? (
            <span className="flex items-center gap-1 text-body-sm font-semibold text-emerald-800">
              <CircleCheck aria-hidden="true" className="size-4" />
              Tersimpan {jam}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-body-sm font-semibold text-amber-900">
              <CircleDot aria-hidden="true" className="size-4" />
              Belum disimpan
            </span>
          )}
        </span>
        <Button variant={savedAt ? 'glass' : 'primary'} className="min-w-28" disabled={busy} onClick={onSave} aria-label={label}>
          {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
          {savedAt ? 'Simpan ulang' : 'Simpan'}
        </Button>
      </div>
      {error && <span className="text-body-sm font-semibold text-error">{error}</span>}
    </div>
  )
}
