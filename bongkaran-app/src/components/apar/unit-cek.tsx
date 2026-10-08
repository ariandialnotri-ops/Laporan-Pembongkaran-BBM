import { CircleCheck } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { PhotoSlot } from '@/components/bongkaran/photo-slot'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Button } from '@/components/ui/button'
import { hasilCek, statusKedaluwarsa, type AparCek, type CekKey, type CekNilai } from '@/lib/apar'
import { formatTanggalIso } from '@/lib/date'
import type { Photo } from '@/lib/sop'
import { cn } from '@/lib/utils'

/** Checklist inspeksi satu unit APAR/APAB: butir Baik/Tidak, catatan tindak lanjut, dan foto kondisi. */
export function UnitCard({
  u,
  hariIni,
  readOnly,
  busy,
  srcOf,
  onCek,
  onSemuaBaik,
  onCatatan,
  onFoto,
  onHapusFoto,
}: {
  u: AparCek
  hariIni: string
  readOnly: boolean
  busy: boolean
  srcOf: (p: Photo) => string | undefined
  onCek: (k: CekKey, v: CekNilai) => void
  onSemuaBaik: () => void
  onCatatan: (v: string) => void
  onFoto: (f: File[]) => void
  onHapusFoto: (i: number) => void
}) {
  const h = hasilCek(u)
  const exp = statusKedaluwarsa(u.kedaluwarsa, hariIni)
  return (
    <GlassCard id={`unit-${u.unitId}`} level={2} className={cn('flex scroll-mt-24 flex-col gap-space-sm p-space-md', h.temuan.length > 0 && 'ring-1 ring-error/40')}>
      <div className="flex items-start gap-space-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="tabular text-body-lg font-bold text-on-surface">{u.kode || '-'}</span>
            <Pill tone={u.tipe === 'apab' ? 'primary' : 'neutral'}>{u.tipe === 'apab' ? 'APAB' : u.cadangan ? 'Cadangan' : 'APAR'}</Pill>
          </span>
          <span className="text-body-sm text-on-surface-variant">
            {u.jenis}, {u.kapasitasKg || '-'} kg, {u.lokasi || 'lokasi belum diatur'}
          </span>
          {exp && (
            <span className={cn('tabular text-body-sm font-semibold', exp === 'lewat' ? 'text-error' : exp === 'segera' ? 'text-amber-700' : 'text-on-surface-variant')}>
              Isi ulang {formatTanggalIso(u.kedaluwarsa)}
              {exp === 'lewat' ? ' (sudah lewat)' : exp === 'segera' ? ' (kurang dari 30 hari)' : ''}
            </span>
          )}
        </div>
        {h.kosong.length === 0 && u.foto.length > 0 ? (
          h.temuan.length ? (
            <Pill tone="error">{h.temuan.length} temuan</Pill>
          ) : (
            <Pill tone="success">
              <CircleCheck aria-hidden="true" />
              Baik
            </Pill>
          )
        ) : (
          <Pill>{h.kosong.length ? `${h.kosong.length} belum` : 'Foto belum'}</Pill>
        )}
      </div>
      {!readOnly && h.kosong.length > 0 && (
        <Button variant="soft" size="sm" className="self-start" onClick={onSemuaBaik}>
          <CircleCheck aria-hidden="true" />
          Semua butir baik
        </Button>
      )}
      <ul className="flex flex-col gap-1">
        {h.items.map((it) => {
          const v = u.cek[it.key]
          return (
            <li key={it.key} className="flex items-center gap-space-sm rounded-md bg-surface-container-low/70 px-space-sm py-1.5">
              <span className="flex min-w-0 flex-1 flex-col text-body-sm">
                <span className="text-on-surface">{it.label}</span>
                {it.hint && <span className="text-on-surface-variant">{it.hint}</span>}
              </span>
              <div role="radiogroup" aria-label={`${it.label}, ${u.kode}`} className="flex shrink-0 gap-1">
                {(['ok', 'tidak'] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={v === n}
                    disabled={readOnly}
                    onClick={() => onCek(it.key, n)}
                    className={cn(
                      'min-h-9 min-w-14 rounded-full px-2.5 text-body-sm font-semibold transition-colors disabled:cursor-default',
                      v === n ? (n === 'ok' ? 'bg-primary text-on-primary' : 'bg-error text-on-error') : 'bg-surface-container-lowest text-on-surface-variant ring-1 ring-outline-variant',
                    )}
                  >
                    {n === 'ok' ? 'Baik' : 'Tidak'}
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>
      <Field label={h.temuan.length ? 'Tindak lanjut temuan (wajib)' : 'Catatan (opsional)'} htmlFor={`apar-cat-${u.unitId}`}>
        <Input id={`apar-cat-${u.unitId}`} disabled={readOnly} placeholder={h.temuan.length ? 'Mis. diganti pin baru, isi ulang dijadwalkan' : ''} value={u.catatan} onChange={(e) => onCatatan(e.target.value)} />
      </Field>
      <PhotoSlot
        label={h.temuan.length ? 'Foto kondisi unit & bukti temuan' : 'Foto kondisi unit'}
        photos={u.foto}
        busy={busy}
        disabled={readOnly}
        srcOf={srcOf}
        onAdd={onFoto}
        onRemove={onHapusFoto}
      />
    </GlassCard>
  )
}
