import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Eye, Printer, Save, Trash2 } from 'lucide-react'
import { CheckRow, Choice, Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { APAR_JENIS, berlakuInstansi, DEFAULT_AREAS, kodeBerikut, MASA_INSTANSI_BULAN, lokasiOptions, tipeLabel, unitBaru, type AparTipe, type AparUnit } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { parseAngka } from '@/lib/format'

const TIPE = [
  { value: 'apar' as const, label: 'APAR' },
  { value: 'apab' as const, label: 'APAB (beroda)' },
]

/** Form tambah/ubah satu unit APAR/APAB. Simpan kembali ke daftar data utama. */
export function AparUnitForm() {
  const app = useApp()
  const { id = 'baru' } = useParams()
  if (!app.loaded) return <Loading />
  const s = app.settings
  const ada = [...(s.apar ?? []).map((u) => ({ u, tipe: 'apar' as const })), ...(s.apab ?? []).map((u) => ({ u, tipe: 'apab' as const }))].find((x) => x.u.id === id)
  if (id !== 'baru' && !ada)
    return (
      <GlassCard level={1} className="flex flex-col items-center gap-space-sm p-space-md text-center">
        <span className="text-body-md font-semibold text-on-surface">Unit tidak ditemukan</span>
        <Link to="/apar/data" className={buttonVariants({ size: 'pill' })}>
          Ke data utama
        </Link>
      </GlassCard>
    )
  return <Form key={id} awal={ada ?? null} />
}

function Form({ awal }: { awal: { u: AparUnit; tipe: AparTipe } | null }) {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const s = app.settings
  const semua = [...(s.apar ?? []), ...(s.apab ?? [])]
  const [tipe, setTipe] = useState<AparTipe>(() => awal?.tipe ?? (params.get('tipe') === 'apab' ? 'apab' : 'apar'))
  const [u, setU] = useState<AparUnit>(() => awal?.u ?? unitBaru(tipe, kodeBerikut(tipe, semua)))
  const [error, setError] = useState<string | null>(null)
  const dirty = !awal || JSON.stringify(u) !== JSON.stringify(awal.u)
  const guard = useLeaveGuard({ active: dirty, title: 'Keluar tanpa menyimpan?', detail: 'Isian unit APAR/APAB ini belum disimpan.' })
  const lokasi = [...new Set([...lokasiOptions(s.jumlahPulau ?? 0, s.aparArea ?? DEFAULT_AREAS), ...(u.lokasi ? [u.lokasi] : [])])]
  const set = (p: Partial<AparUnit>) => (setError(null), setU({ ...u, ...p }))

  const gantiTipe = (t: AparTipe) => {
    setTipe(t)
    // Kode & kapasitas awal ikut tipe selama belum diubah pengguna.
    const kodeAwal = kodeBerikut(tipe, semua)
    set({ kode: u.kode === kodeAwal ? kodeBerikut(t, semua) : u.kode, kapasitasKg: u.kapasitasKg === (tipe === 'apar' ? '6' : '50') ? (t === 'apar' ? '6' : '50') : u.kapasitasKg, cadangan: t === 'apab' ? false : u.cadangan })
  }

  const simpan = () => {
    const kode = u.kode.trim()
    if (!kode) return setError('Isi kode unit, mis. APAR-01.')
    if (semua.some((x) => x.id !== u.id && x.kode.trim().toUpperCase() === kode.toUpperCase())) return setError(`Kode ${kode} sudah dipakai unit lain.`)
    if (!u.lokasi && !u.cadangan) return setError('Pilih lokasi unit.')
    const kap = parseAngka(u.kapasitasKg)
    if (!(kap && kap > 0)) return setError('Isi kapasitas (kg).')
    if (u.periksaInstansi && u.periksaInstansi > todayIso()) return setError('Tanggal pemeriksaan instansi tidak boleh di masa depan.')
    const next = { ...u, kode }
    const list = (t: AparTipe) => (t === 'apar' ? (s.apar ?? []) : (s.apab ?? []))
    const ganti = (arr: AparUnit[]) => (arr.some((x) => x.id === u.id) ? arr.map((x) => (x.id === u.id ? next : x)) : [...arr, next])
    app.updateSettings(tipe === 'apar' ? { apar: ganti(list('apar')) } : { apab: ganti(list('apab')) })
    guard.bypass()
    toast(`${kode} ${awal ? 'diperbarui' : 'ditambahkan'}`)
    navigate('/apar/data')
  }

  const hapus = () => {
    if (!awal || !window.confirm(`Hapus ${awal.u.kode} dari data utama? Label QR unit ini tidak berlaku lagi; riwayat inspeksinya tetap tersimpan.`)) return
    app.updateSettings(awal.tipe === 'apar' ? { apar: (s.apar ?? []).filter((x) => x.id !== awal.u.id) } : { apab: (s.apab ?? []).filter((x) => x.id !== awal.u.id) })
    guard.bypass()
    toast(`${awal.u.kode} dihapus`)
    navigate('/apar/data')
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <div className="flex flex-col">
          <span className="text-tag uppercase text-primary">{awal ? 'Ubah unit' : 'Unit baru'}</span>
          <span className="tabular text-headline-md font-bold text-on-surface">
            {u.kode || '-'} <span className="text-body-md font-normal text-on-surface-variant">{tipeLabel(tipe, u.cadangan)}</span>
          </span>
        </div>
        {!awal && (
          <Field label="Tipe">
            <Choice label="Tipe unit" value={tipe} onChange={gantiTipe} options={TIPE} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Kode unit" htmlFor="unit-kode" hint="Tertulis di tabung & label QR.">
            <Input id="unit-kode" autoComplete="off" value={u.kode} onChange={(e) => set({ kode: e.target.value })} />
          </Field>
          <Field label="Kapasitas" htmlFor="unit-kap">
            <Input id="unit-kap" numeric inputMode="decimal" suffix="kg" value={u.kapasitasKg} onChange={(e) => set({ kapasitasKg: e.target.value })} />
          </Field>
          <Field label="Jenis media" htmlFor="unit-jenis" className="col-span-2">
            <Select value={u.jenis} onValueChange={(v) => set({ jenis: v })}>
              <SelectTrigger id="unit-jenis">
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
          <Field label={u.cadangan ? 'Tempat simpan' : 'Lokasi'} htmlFor="unit-lokasi" className="col-span-2">
            <Select value={u.lokasi || undefined} onValueChange={(v) => set({ lokasi: v })}>
              <SelectTrigger id="unit-lokasi">
                <SelectValue placeholder="Pilih lokasi" />
              </SelectTrigger>
              <SelectContent>
                {lokasi.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Jadwal isi ulang" htmlFor="unit-exp" className="col-span-2">
            <Input id="unit-exp" type="date" value={u.kedaluwarsa} onChange={(e) => set({ kedaluwarsa: e.target.value })} />
          </Field>
          <Field
            label="Pemeriksaan instansi terakhir"
            htmlFor="unit-instansi-tgl"
            hint={u.periksaInstansi ? `Berlaku sampai ${formatTanggalIso(berlakuInstansi(u.periksaInstansi))} (maks. ${MASA_INSTANSI_BULAN} bulan).` : `Wajib diperiksa instansi berwenang maks. ${MASA_INSTANSI_BULAN} bulan sekali.`}
          >
            <Input id="unit-instansi-tgl" type="date" max={todayIso()} value={u.periksaInstansi ?? ''} onChange={(e) => set({ periksaInstansi: e.target.value })} />
          </Field>
          <Field label="Instansi pemeriksa" htmlFor="unit-instansi">
            <Input id="unit-instansi" autoComplete="off" placeholder="Mis. Disnaker / Damkar" value={u.instansi ?? ''} onChange={(e) => set({ instansi: e.target.value })} />
          </Field>
        </div>
        {tipe === 'apar' && (
          <CheckRow checked={u.cadangan} onChange={(v) => set({ cadangan: v })}>
            APAR cadangan (disimpan, belum dipasang)
          </CheckRow>
        )}
        <ErrorBox text={error} />
        <div className="flex gap-space-xs">
          <Button size="lg" variant="glass" onClick={() => navigate('/apar/data')}>
            Batal
          </Button>
          <Button size="lg" className="flex-1" onClick={simpan}>
            <Save aria-hidden="true" />
            {awal ? 'Simpan perubahan' : 'Simpan unit'}
          </Button>
        </div>
      </GlassCard>

      {awal && (
        <GlassCard level={1} className="animate-entrance-2 flex flex-col gap-space-xs p-space-sm">
          <div className="grid grid-cols-2 gap-space-xs">
            <Link to={`/apar/unit/${encodeURIComponent(awal.u.id)}`} className={buttonVariants({ variant: 'glass' })}>
              <Eye aria-hidden="true" />
              Kondisi unit
            </Link>
            <Link to={`/apar/label?unit=${encodeURIComponent(awal.u.id)}`} className={buttonVariants({ variant: 'glass' })}>
              <Printer aria-hidden="true" />
              Label QR
            </Link>
          </div>
          <Button variant="ghost" className="text-error" onClick={hapus}>
            <Trash2 aria-hidden="true" />
            Hapus unit dari data utama
          </Button>
        </GlassCard>
      )}
      {guard.dialog}
    </div>
  )
}
