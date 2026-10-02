import { useMemo, useState } from 'react'
import { CircleCheck, Save, TriangleAlert } from 'lucide-react'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { stokRecordId, type StokData, type StokItem, type StokRecord } from '@/lib/daily'
import { formatTanggalIso } from '@/lib/date'
import { formatLiter, formatNumber, parseAngka } from '@/lib/format'
import { currentShift, shiftLabel, type Shift } from '@/lib/shift'
import { TANKS, tankName, volumeFromLevel } from '@/lib/tank'
import { cn } from '@/lib/utils'

// Ditulis lengkap agar kelas animasi ikut terbaca Tailwind.
const ENTRANCE = ['animate-entrance-2', 'animate-entrance-3', 'animate-entrance-4']

const blankItem = (): StokItem => ({ tinggi: '', volume: '', pengeluaran: '' })

/** Waktu simpan (di luar render). */
const stamp = () => Date.now()

export function StokShift() {
  const app = useApp()
  const toast = useToast()
  const now = currentShift()
  const [key, setKey] = useState<{ tanggal: string; shift: Shift }>(now)
  const [range, setRange] = useDateRange('7d')
  const records = useMemo(() => app.daily.filter((d): d is StokRecord => d.kind === 'stok'), [app.daily])
  const existing = records.find((r) => r.id === stokRecordId(key.tanggal, key.shift)) ?? null
  const [draft, setDraft] = useState<{ id: string; data: StokData } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!app.loaded) return <Loading />

  const id = stokRecordId(key.tanggal, key.shift)
  // Draf mengikuti shift terpilih; pindah shift memuat data shift itu.
  const data: StokData =
    draft?.id === id ? draft.data : (existing?.data ?? { petugas: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName, items: {}, catatan: '' })
  const setData = (patch: Partial<StokData>) => {
    setError(null)
    setDraft({ id, data: { ...data, ...patch } })
  }
  const setItem = (produk: string, patch: Partial<StokItem>) => setData({ items: { ...data.items, [produk]: { ...(data.items[produk] ?? blankItem()), ...patch } } })

  const simpan = async () => {
    const kosong = TANKS.filter((t) => parseAngka(data.items[t.produk]?.volume ?? '') === null)
    if (kosong.length) return setError(`Isi stok awal: ${kosong.map((t) => t.produk).join(', ')}`)
    if (!data.petugas.trim()) return setError('Isi nama petugas.')
    setSaving(true)
    try {
      const rec: StokRecord = {
        id,
        kind: 'stok',
        tanggal: key.tanggal,
        shift: key.shift,
        data,
        createdAt: existing?.createdAt ?? stamp(),
        updatedAt: stamp(),
        createdBy: existing?.createdBy ?? app.session.user?.id ?? null,
      }
      await app.saveDaily(rec)
      setDraft(null)
      toast(`Stok ${shiftLabel(key.shift).split(' (')[0]} tersimpan`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const isNow = key.tanggal === now.tanggal && key.shift === now.shift
  const history = records.filter((r) => inRange(r.tanggal, range)).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.shift - a.shift)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <h2 className="text-headline-md font-bold text-on-surface">{shiftLabel(key.shift)}</h2>
            <span className="text-body-sm text-on-surface-variant">
              {formatTanggalIso(key.tanggal)}
              {isNow ? ', shift berjalan' : ''}
            </span>
          </div>
          {existing ? <Pill tone="success">Tersimpan</Pill> : <Pill tone="error">Wajib diisi</Pill>}
        </div>
        <div className="grid grid-cols-[1fr_auto] items-end gap-space-sm">
          <Field label="Tanggal shift" htmlFor="stok-tgl">
            <Input id="stok-tgl" type="date" value={key.tanggal} onChange={(e) => e.target.value && setKey({ ...key, tanggal: e.target.value })} />
          </Field>
          {!isNow && (
            <Button variant="soft" size="sm" onClick={() => setKey(now)}>
              Shift berjalan
            </Button>
          )}
        </div>
        <Choice
          label="Shift"
          value={String(key.shift) as '1' | '2' | '3'}
          onChange={(v) => setKey({ ...key, shift: Number(v) as Shift })}
          options={[
            { value: '1', label: 'Shift 1' },
            { value: '2', label: 'Shift 2' },
            { value: '3', label: 'Shift 3' },
          ]}
        />
        <span className="text-body-sm text-on-surface-variant">
          Stok awal diisi saat shift dimulai. Pengeluaran dispenser diisi di akhir shift dari catatan penjualan shift.
        </span>
      </GlassCard>

      {TANKS.map((t, i) => {
        const item = data.items[t.produk] ?? blankItem()
        const tabel = volumeFromLevel(t.id, item.tinggi)
        return (
          <GlassCard key={t.id} level={2} className={cn('flex flex-col gap-space-sm p-space-md', ENTRANCE[i])}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-body-md font-bold text-on-surface">{t.produk}</span>
              <span className="tabular text-body-sm text-on-surface-variant">{tankName(t.tankNo)}</span>
            </div>
            <div className="grid grid-cols-2 gap-space-sm">
              <Field label="Tinggi ATG/deepstick" htmlFor={`stok-t-${t.id}`}>
                <Input
                  id={`stok-t-${t.id}`}
                  numeric
                  inputMode="decimal"
                  suffix="mm"
                  value={item.tinggi}
                  onChange={(e) => {
                    const r = volumeFromLevel(t.id, e.target.value)
                    setItem(t.produk, { tinggi: e.target.value, ...(r?.volume !== undefined ? { volume: String(Math.round(r.volume * 10) / 10).replace('.', ',') } : {}) })
                  }}
                />
              </Field>
              <Field label="Stok awal" htmlFor={`stok-v-${t.id}`}>
                <Input id={`stok-v-${t.id}`} numeric inputMode="decimal" suffix="L" value={item.volume} onChange={(e) => setItem(t.produk, { volume: e.target.value })} />
              </Field>
            </div>
            {tabel?.error !== undefined && <span className="text-body-sm font-semibold text-error">{tabel.error}</span>}
            <Field label="Pengeluaran dispenser shift ini" htmlFor={`stok-e-${t.id}`} hint="Diisi di akhir shift.">
              <Input id={`stok-e-${t.id}`} numeric inputMode="decimal" suffix="L" value={item.pengeluaran} onChange={(e) => setItem(t.produk, { pengeluaran: e.target.value })} />
            </Field>
          </GlassCard>
        )
      })}

      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <Field label="Petugas" htmlFor="stok-petugas">
          <Input id="stok-petugas" value={data.petugas} onChange={(e) => setData({ petugas: e.target.value })} />
        </Field>
        {error && (
          <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
            <span className="text-body-sm font-semibold text-on-error-container">{error}</span>
          </div>
        )}
        <Button size="lg" className="w-full" disabled={saving} onClick={simpan}>
          <Save aria-hidden="true" />
          Simpan stok {shiftLabel(key.shift).split(' (')[0]}
        </Button>
      </GlassCard>

      <section aria-labelledby="riwayat-stok" className="flex flex-col gap-space-sm">
        <SectionHeader id="riwayat-stok" title="Riwayat stok shift" />
        <DateFilter id="stok-range" value={range} onChange={setRange} />
        {history.length === 0 ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Belum ada catatan stok pada rentang ini.
          </GlassCard>
        ) : (
          history.map((r) => {
            const total = Object.values(r.data.items).reduce((n, it) => n + (parseAngka(it.volume) ?? 0), 0)
            const jual = Object.values(r.data.items).reduce((n, it) => n + (parseAngka(it.pengeluaran) ?? 0), 0)
            const lengkapJual = TANKS.every((t) => (r.data.items[t.produk]?.pengeluaran ?? '').trim() !== '')
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setKey({ tanggal: r.tanggal, shift: r.shift })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="glass-1 flex min-h-14 items-center gap-space-sm rounded-lg p-space-sm text-left active:scale-[0.99]"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-md font-semibold text-on-surface">
                    {formatTanggalIso(r.tanggal)}, shift {r.shift}
                  </span>
                  <span className="tabular text-body-sm text-on-surface-variant">
                    Stok awal {formatLiter(total)}, keluar {formatNumber(jual)} L, {r.data.petugas}
                  </span>
                </div>
                {lengkapJual ? <CircleCheck aria-label="Pengeluaran lengkap" className="size-5 text-primary" /> : <Pill>Pengeluaran belum</Pill>}
              </button>
            )
          })
        )}
      </section>
    </div>
  )
}
