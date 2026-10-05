import { useState } from 'react'
import { Plus, Trash2, Wand2 } from 'lucide-react'
import { CheckRow, Field } from '@/components/bongkaran/form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/lib/app-state'
import { APAR_JENIS, lokasiOptions, type AparTipe, type AparUnit } from '@/lib/apar'
import { parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'

const LABEL: Record<AparTipe, string> = { apar: 'APAR', apab: 'APAB' }

const unitBaru = (tipe: AparTipe, n: number, lokasi = ''): AparUnit => ({
  id: genId(tipe),
  kode: `${LABEL[tipe]}-${String(n).padStart(2, '0')}`,
  jenis: APAR_JENIS[0],
  kapasitasKg: tipe === 'apar' ? '6' : '50',
  lokasi,
  cadangan: false,
  kedaluwarsa: '',
})

/** Pengaturan > Proteksi Kebakaran: jumlah pulau pompa, daftar APAR (dan cadangan), daftar APAB. */
export function ProteksiSettings() {
  const app = useApp()
  const s = app.settings
  const pulau = s.jumlahPulau ?? 0
  const apar = s.apar ?? []
  const apab = s.apab ?? []
  const [pulauText, setPulauText] = useState(() => (pulau ? String(pulau) : ''))
  const aktif = apar.filter((u) => !u.cadangan).length

  const list = (tipe: AparTipe) => (tipe === 'apar' ? apar : apab)
  const setList = (tipe: AparTipe, next: AparUnit[]) => app.updateSettings(tipe === 'apar' ? { apar: next } : { apab: next })
  const setUnit = (tipe: AparTipe, id: string, patch: Partial<AparUnit>) => setList(tipe, list(tipe).map((u) => (u.id === id ? { ...u, ...patch } : u)))

  // Isi cepat: satu APAR di tiap pulau pompa yang belum punya APAR.
  const isiPerPulau = () => {
    const ada = new Set(apar.map((u) => u.lokasi))
    const baru = lokasiOptions(pulau)
      .slice(0, pulau)
      .filter((l) => !ada.has(l))
      .map((l, i) => unitBaru('apar', apar.length + i + 1, l))
    setList('apar', [...apar, ...baru])
  }

  return (
    <div className="flex flex-col gap-space-md">
      <span className="text-body-sm text-on-surface-variant">
        Dipakai untuk form Inspeksi APAR & APAB (menu Input). Catat semua unit, termasuk APAR cadangan.
      </span>
      <div className="grid grid-cols-2 gap-space-sm">
        <Field label="Jumlah pulau pompa" htmlFor="set-pulau">
          <Input
            id="set-pulau"
            numeric
            inputMode="numeric"
            value={pulauText}
            onChange={(e) => {
              setPulauText(e.target.value)
              const n = parseAngka(e.target.value)
              app.updateSettings({ jumlahPulau: n !== null && n >= 0 ? Math.min(Math.round(n), 30) : 0 })
            }}
          />
        </Field>
        <div className="flex flex-col justify-end gap-0.5 rounded-md bg-surface-container-low/80 px-space-sm py-space-xs text-body-sm">
          <span className="tabular font-semibold text-on-surface">
            {aktif} APAR terpasang, {apar.length - aktif} cadangan
          </span>
          <span className="tabular text-on-surface-variant">{apab.length} APAB</span>
        </div>
      </div>

      {(['apar', 'apab'] as const).map((tipe) => (
        <div key={tipe} className="flex flex-col gap-space-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-tag uppercase text-primary">{tipe === 'apar' ? 'APAR (alat pemadam api ringan)' : 'APAB (alat pemadam api berat / beroda)'}</span>
          </div>
          {list(tipe).length === 0 && <span className="text-body-sm text-on-surface-variant">Belum ada {LABEL[tipe]}.</span>}
          {list(tipe).map((u, i) => (
            <UnitRow key={u.id} tipe={tipe} u={u} no={i + 1} pulau={pulau} onChange={(p) => setUnit(tipe, u.id, p)} onRemove={() => setList(tipe, list(tipe).filter((x) => x.id !== u.id))} />
          ))}
          <div className="flex flex-wrap gap-space-xs">
            <Button variant="soft" size="sm" onClick={() => setList(tipe, [...list(tipe), unitBaru(tipe, list(tipe).length + 1)])}>
              <Plus aria-hidden="true" />
              Tambah {LABEL[tipe]}
            </Button>
            {tipe === 'apar' && pulau > 0 && (
              <Button variant="glass" size="sm" onClick={isiPerPulau}>
                <Wand2 aria-hidden="true" />
                1 APAR per pulau
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function UnitRow({ tipe, u, no, pulau, onChange, onRemove }: { tipe: AparTipe; u: AparUnit; no: number; pulau: number; onChange: (p: Partial<AparUnit>) => void; onRemove: () => void }) {
  const idp = `${tipe}-${u.id}`
  const lokasi = lokasiOptions(pulau)
  return (
    <div className="flex flex-col gap-space-sm rounded-md bg-surface-container-low/70 p-space-sm">
      <div className="grid grid-cols-[1fr_auto] items-end gap-space-xs">
        <Field label={`Kode ${LABEL[tipe]} ${no}`} htmlFor={`${idp}-kode`}>
          <Input id={`${idp}-kode`} autoComplete="off" value={u.kode} onChange={(e) => onChange({ kode: e.target.value })} />
        </Field>
        <Button variant="ghost" size="icon" aria-label={`Hapus ${u.kode || LABEL[tipe]}`} onClick={onRemove}>
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-space-xs">
        <Field label="Jenis" htmlFor={`${idp}-jenis`} className="col-span-2">
          <Select value={u.jenis} onValueChange={(v) => onChange({ jenis: v })}>
            <SelectTrigger id={`${idp}-jenis`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APAR_JENIS.map((j) => (
                <SelectItem key={j} value={j}>
                  {j}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Lokasi" htmlFor={`${idp}-lok`} className="col-span-2">
          <Select value={u.lokasi || undefined} onValueChange={(v) => onChange({ lokasi: v })}>
            <SelectTrigger id={`${idp}-lok`}>
              <SelectValue placeholder={u.cadangan ? 'Tempat simpan' : 'Pilih lokasi'} />
            </SelectTrigger>
            <SelectContent>
              {[...new Set([...lokasi, ...(u.lokasi ? [u.lokasi] : [])])].map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Kapasitas" htmlFor={`${idp}-kap`}>
          <Input id={`${idp}-kap`} numeric inputMode="decimal" suffix="kg" value={u.kapasitasKg} onChange={(e) => onChange({ kapasitasKg: e.target.value })} />
        </Field>
        <Field label="Jadwal isi ulang" htmlFor={`${idp}-exp`}>
          <Input id={`${idp}-exp`} type="date" value={u.kedaluwarsa} onChange={(e) => onChange({ kedaluwarsa: e.target.value })} />
        </Field>
      </div>
      {tipe === 'apar' && (
        <CheckRow checked={u.cadangan} onChange={(v) => onChange({ cadangan: v })}>
          APAR cadangan (disimpan, belum dipasang)
        </CheckRow>
      )}
    </div>
  )
}
