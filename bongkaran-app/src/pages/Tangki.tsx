import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ClipboardPaste, Cylinder, FileUp, Plus, Save, Trash2, TriangleAlert } from 'lucide-react'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { formatNumber, parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
import { produkMeta } from '@/lib/produk'
import { PRODUK_OPTIONS } from '@/lib/sop'
import { bacaTabelKalibrasi, buatTank, tankName, volumeTank, type TankDef, type TankTabel } from '@/lib/tank'
import { cn } from '@/lib/utils'

/** Daftar tangki SPBU aktif; dipakai di halaman Database Tangki dan langkah 2 Siapkan SPBU. */
export function DaftarTangki({ kembali }: { kembali?: string }) {
  const app = useApp()
  const bolehUbah = app.role === 'abh' || app.role === 'pengawas'
  const q = kembali ? `?kembali=${encodeURIComponent(kembali)}` : ''
  const tanks = app.tanks.map(buatTank)
  return (
    <div className="flex flex-col gap-space-sm">
      <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 p-space-2xs">
        {tanks.length === 0 && (
          <p className="p-space-md text-center text-body-sm text-on-surface-variant">Belum ada tangki. Tambahkan setiap tangki pendam beserta tabel kalibrasinya (dari dokumen tera tangki).</p>
        )}
        {tanks.map((t) => {
          const isi = (
            <>
              <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', produkMeta(t.produk).tile)}>
                <Cylinder className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-md font-semibold text-on-surface">
                  {tankName(t.tankNo)} <span className="font-normal text-on-surface-variant">{t.produk}</span>
                </span>
                <span className="tabular truncate text-body-sm text-on-surface-variant">
                  {formatNumber(t.capacity)} L, {formatNumber(t.startMm)}–{formatNumber(t.maxMm)} mm, {formatNumber(t.rows)} baris, kalibrasi {t.tanggalKalibrasi || '-'}
                </span>
              </span>
              {t.anomalyLevels.length > 0 ? <Pill tone="error">{t.anomalyLevels.length} titik janggal</Pill> : <Pill tone="success">OK</Pill>}
            </>
          )
          return bolehUbah ? (
            <Link key={t.id} to={`/pengaturan/tangki/${encodeURIComponent(t.id)}${q}`} className="flex min-h-16 items-center gap-space-sm rounded-md px-space-sm py-space-xs transition-colors hover:bg-white/50">
              {isi}
            </Link>
          ) : (
            <div key={t.id} className="flex min-h-16 items-center gap-space-sm px-space-sm py-space-xs">
              {isi}
            </div>
          )
        })}
      </GlassCard>
      {bolehUbah && (
        <Link to={`/pengaturan/tangki/baru${q}`} className={buttonVariants({ variant: 'soft', size: 'lg' })}>
          <Plus aria-hidden="true" />
          Tambah tangki
        </Link>
      )}
    </div>
  )
}

/** Profil > Database Tangki: tangki pendam SPBU aktif & tabel kalibrasinya. */
export function DatabaseTangki() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={1} className="animate-entrance-1 p-space-md text-body-sm text-on-surface-variant">
        Tabel kalibrasi dipakai untuk menghitung volume dari tinggi ATG / deepstick di stok awal shift, form bongkaran, dan kalkulator. Setiap SPBU punya database tangkinya sendiri.
      </GlassCard>
      <div className="animate-entrance-2">
        <DaftarTangki />
      </div>
    </div>
  )
}

/** "20.05.2022" (format dokumen tera) -> "2022-05-20" untuk isian tanggal. */
function keIso(t: string | null) {
  if (!t) return ''
  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''
}

/** Tambah / ubah satu tangki: produk, nomor, tanggal kalibrasi, dan tabel kalibrasi (tempel dari Excel / file CSV). */
export function TangkiForm() {
  const app = useApp()
  const { id = 'baru' } = useParams()
  if (!app.loaded) return <Loading />
  const ada = app.tanks.find((t) => t.id === id) ?? null
  if (id !== 'baru' && !ada)
    return (
      <GlassCard level={1} className="flex flex-col items-center gap-space-sm p-space-md text-center">
        <span className="text-body-md font-semibold text-on-surface">Tangki tidak ditemukan</span>
        <Link to="/pengaturan/tangki" className={buttonVariants({ size: 'pill' })}>
          Ke database tangki
        </Link>
      </GlassCard>
    )
  return <FormTangki key={id} awal={ada} />
}

function FormTangki({ awal }: { awal: TankDef | null }) {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const kembali = params.get('kembali') || '/pengaturan/tangki'
  const fileRef = useRef<HTMLInputElement>(null)
  const dipakai = new Set(app.tanks.filter((t) => t.id !== awal?.id).map((t) => t.produk))
  const [produk, setProduk] = useState(awal?.produk ?? PRODUK_OPTIONS.find((p) => !dipakai.has(p)) ?? PRODUK_OPTIONS[0])
  const [tankNo, setTankNo] = useState(awal?.tankNo ?? String(app.tanks.length + 1))
  const [tanggal, setTanggal] = useState(keIso(awal?.tanggalKalibrasi ?? null))
  const [catatan, setCatatan] = useState(awal?.catatan ?? '')
  const [satuan, setSatuan] = useState<'mm' | 'cm'>('mm')
  const [teks, setTeks] = useState('')
  const [uji, setUji] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [simpan, setSimpan] = useState(false)

  const hasil = useMemo(() => (teks.trim() ? bacaTabelKalibrasi(teks, satuan) : null), [teks, satuan])
  const tabel: TankTabel | null = hasil?.ok ? hasil.tabel : (awal?.tabel ?? null)
  const pratinjau = tabel ? buatTank({ id: 'x', produk, tankNo, tanggalKalibrasi: null, catatan: null, tabel, urut: 0 }) : null
  const ujiMm = parseAngka(uji)
  const ujiHasil = pratinjau && ujiMm !== null ? volumeTank(pratinjau, ujiMm) : null

  const bacaFile = async (f?: File) => {
    if (!f) return
    if (/\.xlsx?$/i.test(f.name)) return setError('File Excel: buka filenya, blok kolom tinggi & volume, salin (Ctrl+C), lalu tempel di kotak tabel. Atau simpan sebagai CSV.')
    setError(null)
    setTeks(await f.text())
    if (fileRef.current) fileRef.current.value = ''
  }

  const kirim = async () => {
    if (!tankNo.trim()) return setError('Isi nomor tangki.')
    if (hasil && !hasil.ok) return setError(hasil.error)
    if (!tabel) return setError('Tempel tabel kalibrasi tangki (tinggi & volume).')
    if (app.tanks.some((t) => t.id !== awal?.id && t.tankNo.trim().toUpperCase() === tankNo.trim().toUpperCase())) return setError(`Nomor tangki ${tankNo.trim()} sudah dipakai.`)
    setSimpan(true)
    try {
      await app.saveTank({
        id: awal?.id ?? genId('tk'),
        produk,
        tankNo: tankNo.trim(),
        tanggalKalibrasi: tanggal || null,
        catatan: catatan.trim() || null,
        tabel,
        urut: awal?.urut ?? app.tanks.length,
      })
      toast(`${tankName(tankNo.trim())} (${produk}) tersimpan`)
      navigate(kembali)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSimpan(false)
    }
  }

  const hapus = async () => {
    if (!awal || !window.confirm(`Hapus ${tankName(awal.tankNo)} (${awal.produk}) dari database tangki? Laporan lama yang memakai tangki ini tidak lagi menghitung volume dari tabel.`)) return
    try {
      await app.deleteTank(awal.id)
      toast('Tangki dihapus')
      navigate(kembali)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <div className="flex flex-col">
          <span className="text-tag uppercase text-primary">{awal ? 'Ubah tangki' : 'Tangki baru'}</span>
          <span className="text-headline-md font-bold text-on-surface">
            {tankName(tankNo || '-')} <span className="text-body-md font-normal text-on-surface-variant">{produk}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Produk" htmlFor="tk-produk" className="col-span-2">
            <Select value={produk} onValueChange={setProduk}>
              <SelectTrigger id="tk-produk">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUK_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                    {dipakai.has(p) ? ' (sudah ada tangki)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nomor tangki" htmlFor="tk-no" hint="Mis. 1, 2, atau nama di dokumen tera.">
            <Input id="tk-no" autoComplete="off" value={tankNo} onChange={(e) => (setError(null), setTankNo(e.target.value))} />
          </Field>
          <Field label="Tanggal kalibrasi" htmlFor="tk-tgl">
            <Input id="tk-tgl" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </Field>
        </div>
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-fixed text-primary">
            <ClipboardPaste className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-body-md font-bold text-on-surface">Tabel kalibrasi</span>
            <span className="text-body-sm text-on-surface-variant">
              Dari Excel tabel tera tangki: blok kolom <b>tinggi</b> dan <b>volume (liter)</b>, salin, lalu tempel di bawah. Beberapa pasang kolom berdampingan juga terbaca. Baris judul diabaikan.
            </span>
          </div>
        </div>
        <Field label="Satuan tinggi di tabel">
          <Choice
            label="Satuan tinggi"
            value={satuan}
            onChange={setSatuan}
            options={[
              { value: 'mm' as const, label: 'Milimeter (mm)' },
              { value: 'cm' as const, label: 'Sentimeter (cm)' },
            ]}
          />
        </Field>
        <Textarea
          aria-label="Tempel tabel kalibrasi"
          rows={7}
          spellCheck={false}
          placeholder={'Tinggi\tVolume\n0\t10\n1\t10\n2\t11\n…'}
          className="tabular font-mono text-body-sm"
          value={teks}
          onChange={(e) => (setError(null), setTeks(e.target.value))}
        />
        <div className="flex flex-wrap gap-space-xs">
          <Button variant="glass" size="sm" onClick={() => fileRef.current?.click()}>
            <FileUp aria-hidden="true" />
            Pilih file CSV
          </Button>
          {teks && (
            <Button variant="ghost" size="sm" onClick={() => setTeks('')}>
              Kosongkan
            </Button>
          )}
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain,.xls,.xlsx" className="sr-only" onChange={(e) => void bacaFile(e.target.files?.[0])} />
        </div>
        {hasil && !hasil.ok && (
          <span role="alert" className="text-body-sm font-semibold text-error">
            {hasil.error}
          </span>
        )}
        {pratinjau && (
          <div role="status" className="flex flex-col gap-space-xs rounded-md bg-surface-container-low p-space-sm">
            <span className="text-body-sm text-on-surface">
              {hasil?.ok ? 'Terbaca' : 'Tabel tersimpan'}: <b className="tabular">{formatNumber(pratinjau.rows)} baris</b>, tinggi{' '}
              <b className="tabular">
                {formatNumber(pratinjau.startMm)}–{formatNumber(pratinjau.maxMm)} mm
              </b>
              , kapasitas <b className="tabular">{formatNumber(pratinjau.capacity)} L</b>
              {hasil?.ok && hasil.diabaikan > 0 ? `, ${hasil.diabaikan} baris judul/kosong diabaikan` : ''}.
            </span>
            {pratinjau.anomalyLevels.length > 0 && (
              <span className="flex items-start gap-1.5 text-body-sm font-semibold text-error">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Volume turun di {pratinjau.anomalyLevels.length} titik (mis. {pratinjau.anomalyLevels.slice(0, 3).map((l) => `${formatNumber(l)} mm`).join(', ')}). Periksa tabel asli.
              </span>
            )}
            <div className="grid grid-cols-[1fr_auto] items-end gap-space-xs">
              <Field label="Uji: tinggi (mm)" htmlFor="tk-uji">
                <Input id="tk-uji" numeric inputMode="decimal" placeholder="1200" value={uji} onChange={(e) => setUji(e.target.value)} />
              </Field>
              <span className="tabular min-w-24 pb-3 text-right text-body-md font-bold text-primary">
                {ujiHasil?.volume !== undefined ? `${formatNumber(ujiHasil.volume, 1)} L` : ujiHasil?.error ? '-' : ''}
              </span>
            </div>
            {ujiHasil?.error && <span className="text-body-sm text-error">{ujiHasil.error}</span>}
          </div>
        )}
        <Field label="Catatan" htmlFor="tk-catatan">
          <Input id="tk-catatan" autoComplete="off" placeholder="Mis. pelaksana tera, koreksi data" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>
      </GlassCard>

      <ErrorBox text={error} />
      <div className="flex gap-space-xs">
        <Button size="lg" variant="glass" onClick={() => navigate(kembali)}>
          Batal
        </Button>
        <Button size="lg" className="flex-1" disabled={simpan} onClick={() => void kirim()}>
          <Save aria-hidden="true" />
          {simpan ? 'Menyimpan…' : awal ? 'Simpan perubahan' : 'Simpan tangki'}
        </Button>
      </div>
      {awal && (
        <Button variant="ghost" className="text-error" onClick={() => void hapus()}>
          <Trash2 aria-hidden="true" />
          Hapus tangki
        </Button>
      )}
    </div>
  )
}
