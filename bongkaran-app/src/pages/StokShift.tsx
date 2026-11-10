import { useState } from 'react'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { Send, TriangleAlert } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { PilihShift, useKunciShift } from '@/components/bongkaran/pilih-shift'
import { TangkiBelumAda } from '@/components/bongkaran/stok-gate'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { InfoHalaman } from '@/components/ui/info-pop'
import { useApp } from '@/lib/app-state'
import { stokRecordId, type StokData, type StokItem, type StokRecord } from '@/lib/daily'
import { formatTanggalIso } from '@/lib/date'
import { formatLiter, parseAngka } from '@/lib/format'
import { shiftLabel, type Shift } from '@/lib/shift'
import { statusShift } from '@/lib/status-isi'
import { TANKS, tankName, volumeFromLevel } from '@/lib/tank'
import { useKeTerkirim } from '@/lib/terkirim'
import { cn } from '@/lib/utils'

// Ditulis lengkap agar kelas animasi ikut terbaca Tailwind.
const ENTRANCE = ['animate-entrance-2', 'animate-entrance-3', 'animate-entrance-4']

const blankItem = (): StokItem => ({ tinggi: '', volume: '', pengeluaran: '' })

/** Waktu simpan (di luar render). */
const stamp = () => Date.now()

const stokLengkap = (r: StokRecord | undefined) => !!r && TANKS.every((t) => (r.data.items[t.produk]?.volume ?? '').trim() !== '')

/** Operation > Stok Awal Shift: hanya memilih shift (hijau sudah, oranye belum, merah terlewat). */
export function StokShift() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  // Tanpa database tangki, stok awal (tinggi -> volume) belum bisa diisi.
  if (!TANKS.length) return <TangkiBelumAda className="animate-entrance-1" detail="Stok awal shift diisi per tangki (tinggi ATG/deepstick ke volume), jadi menunggu database tangki SPBU ini." />
  const rec = (tanggal: string, shift: Shift) => app.daily.find((d): d is StokRecord => d.kind === 'stok' && d.id === stokRecordId(tanggal, shift))
  return (
    <div className="flex flex-col gap-space-md">
      <InfoHalaman judul="Stok Awal Shift">
        <p>Pilih shift untuk mengisi stok awal tiap produk. Pengeluaran dispenser dihitung otomatis dari totalizer shift itu.</p>
      </InfoHalaman>
      <PilihShift
        status={(k) => statusShift(k, stokLengkap(rec(k.tanggal, k.shift)))}
        keHalaman={(k) => `/stok/${k.tanggal}/${k.shift}`}
        keterangan={(k, st) => {
          const r = rec(k.tanggal, k.shift)
          if (st !== 'sudah' || !r) return undefined
          return `Sudah diisi · ${r.data.petugas || '-'}`
        }}
      />
    </div>
  )
}

/** Halaman form stok awal satu shift: tinggi & volume per produk (pengeluaran dari totalizer). */
export function StokShiftForm() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const konfirmasi = useKonfirmasi()
  const { tanggal, shift, valid } = useKunciShift()
  const id = stokRecordId(tanggal, shift)
  const existing = app.daily.find((d): d is StokRecord => d.kind === 'stok' && d.id === id) ?? null
  const [draft, setDraft] = useState<StokData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const namaShift = shiftLabel(shift).split(' (')[0]
  const guard = useLeaveGuard({ active: true, title: `Keluar dari stok ${namaShift}?`, detail: 'Isian yang belum dikirim akan hilang.' })

  if (!app.loaded) return <Loading />
  if (!TANKS.length) return <TangkiBelumAda className="animate-entrance-1" />
  if (!valid) return <GlassCard className="p-space-md">Shift tidak dikenal.</GlassCard>

  const data: StokData = draft ?? existing?.data ?? { petugas: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName, items: {}, catatan: '' }
  const setData = (patch: Partial<StokData>) => {
    setError(null)
    setDraft({ ...data, ...patch })
  }
  const setItem = (produk: string, patch: Partial<StokItem>) => setData({ items: { ...data.items, [produk]: { ...(data.items[produk] ?? blankItem()), ...patch } } })

  const kirim = async () => {
    const kosong = TANKS.filter((t) => parseAngka(data.items[t.produk]?.volume ?? '') === null)
    if (kosong.length) return setError(`Isi stok awal: ${kosong.map((t) => t.produk).join(', ')}`)
    if (!data.petugas.trim()) return setError('Isi nama petugas.')
    if (existing && !(await konfirmasi({ jenis: 'ubah', judul: `Ubah stok ${namaShift}?`, pesan: <>Stok awal <b>{namaShift}</b> tanggal <b>{formatTanggalIso(tanggal)}</b> sudah terkirim. Angka baru akan menggantikan data sebelumnya.</>, ya: 'Ya, ubah data' }))) return
    setSaving(true)
    try {
      const rec: StokRecord = {
        id,
        kind: 'stok',
        tanggal,
        shift,
        data,
        createdAt: existing?.createdAt ?? stamp(),
        updatedAt: stamp(),
        createdBy: existing?.createdBy ?? app.session.user?.id ?? null,
      }
      await app.saveDaily(rec)
      guard.bypass()
      const total = TANKS.reduce((n, t) => n + (parseAngka(data.items[t.produk]?.volume ?? '') ?? 0), 0)
      keTerkirim({
        judul: `Stok awal ${namaShift} terkirim`,
        detail: `${formatTanggalIso(tanggal)}, ${shiftLabel(shift)}`,
        baris: [...TANKS.map((t): [string, string] => [t.produk, formatLiter(parseAngka(data.items[t.produk]?.volume ?? '') ?? 0)]), ['Total', formatLiter(total)], ['Petugas', data.petugas.trim()]],
        aksi: [
          { to: '/stok', label: 'Pilih shift lain' },
          { to: `/laporan/persediaan?baru=${encodeURIComponent(id)}`, label: 'Lihat catatan persediaan' },
        ],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex items-start justify-between gap-2 p-space-md">
        <div className="flex flex-col">
          <h2 className="text-headline-md font-bold text-on-surface">{shiftLabel(shift)}</h2>
          <span className="text-body-sm text-on-surface-variant">{formatTanggalIso(tanggal)}</span>
        </div>
        {existing ? <Pill tone="success">Sudah diisi</Pill> : <Pill tone="error">Wajib diisi</Pill>}
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
        <Button size="lg" className="w-full" disabled={saving} onClick={kirim}>
          <Send aria-hidden="true" />
          Kirim stok {namaShift}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}
