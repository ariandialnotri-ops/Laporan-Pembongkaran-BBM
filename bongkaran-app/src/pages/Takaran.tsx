import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, CircleCheck, History, LoaderCircle, Beaker, Send, Trash2, TriangleAlert, X } from 'lucide-react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { BARIS_BARU, BARIS_ORANYE, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { TakarRecord } from '@/lib/daily'
import { formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { parseAngka } from '@/lib/format'
import { capWaktu, compressImage, genId } from '@/lib/image'
import { PRODUK_OPTIONS, type Photo } from '@/lib/sop'
import { currentShift } from '@/lib/shift'
import { FOTO_TAKAR, formatMl, OPSI_TAKAR, opsiLabel, takarStatus, TOLERANSI_TAKAR_ML, type FotoTakarKey, type OpsiTakar, type TakarData } from '@/lib/takar'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const stamp = () => Date.now()

function useTakar() {
  const app = useApp()
  return useMemo(
    () => app.daily.filter((d): d is TakarRecord => d.kind === 'takar').sort((a, b) => b.createdAt - a.createdAt),
    [app.daily],
  )
}

function StatusTakar({ hasil }: { hasil: string }) {
  return takarStatus(hasil) === 'lewat' ? <Pill tone="error">Melebihi toleransi</Pill> : <Pill tone="success">Sesuai</Pill>
}

/** Foto yang sudah diambil tetapi belum dikirim: disimpan di perangkat, diunggah saat hasil dikirim. */
type FotoLokal = { id: string; blob: Blob; url: string }

/**
 * Input > Uji Takaran: uji nozzle dengan bejana ukur 20 L. Petugas mengetik nomor nozzle &
 * produk, memilih opsi P (Preset) atau M (Manual), mengisi selisih (ml), memotret dudukan
 * bejana + water pass dan hasil pengukuran, lalu mengirim satu hasil. Ulangi untuk hasil berikutnya.
 */
export function UjiTakaran() {
  const app = useApp()
  const toast = useToast()
  useSyncOnOpen()
  const semua = useTakar()
  const [nozzle, setNozzle] = useState('')
  const [produk, setProduk] = useState('')
  const [opsi, setOpsi] = useState<OpsiTakar>('P')
  const [hasil, setHasil] = useState('')
  const [catatan, setCatatan] = useState('')
  const [petugas, setPetugas] = useState(() => (app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName))
  const [foto, setFoto] = useState<Record<FotoTakarKey, FotoLokal[]>>({ dudukan: [], hasil: [] })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<FotoTakarKey | 'kirim' | null>(null)
  const [terakhir, setTerakhir] = useState<string | null>(null)
  const [detail, setDetail] = useState<TakarRecord | null>(null)
  const fotoRef = useRef(foto)
  useEffect(() => {
    fotoRef.current = foto
  }, [foto])
  // Lepas pratinjau foto saat halaman ditutup.
  useEffect(() => () => Object.values(fotoRef.current).flat().forEach((f) => URL.revokeObjectURL(f.url)), [])

  const adaIsian = !!hasil.trim() || !!catatan.trim() || foto.dudukan.length > 0 || foto.hasil.length > 0
  const guard = useLeaveGuard({ active: adaIsian, title: 'Keluar dari uji takaran?', detail: 'Hasil uji dan foto yang belum dikirim akan hilang.' })
  if (!app.loaded) return <Loading />

  const today = todayIso()
  const hariIni = semua.filter((r) => r.tanggal === today).sort((a, b) => a.createdAt - b.createdAt)
  const nozzleList = [...new Set((app.settings.nozzles ?? []).map((n) => n.nama).filter(Boolean))]
  const produkList = [...new Set([...PRODUK_OPTIONS, ...(app.settings.nozzles ?? []).map((n) => n.produk).filter(Boolean)])]
  const status = takarStatus(hasil)
  const identitasOk = !!nozzle.trim() && !!produk.trim()
  const sudahDiuji = (o: OpsiTakar) => hariIni.some((r) => r.data.nozzle.trim().toUpperCase() === nozzle.trim().toUpperCase() && r.data.opsi === o)

  const ubah = (f: () => void) => {
    setError(null)
    f()
  }

  const ambilFoto = async (key: FotoTakarKey, files: File[]) => {
    if (!identitasOk) return setError('Isi nomor nozzle dan produk dulu: keduanya ikut tercetak pada foto.')
    setBusy(key)
    try {
      const label = FOTO_TAKAR.find((f) => f.key === key)!.label
      const baru: FotoLokal[] = []
      for (const f of files) {
        const blob = await compressImage(f, {
          cap: [capWaktu(), `${app.settings.namaSpbu || 'SPBU'} · Nozzle ${nozzle.trim()} ${produk.trim()}`, `Uji takaran 20 L · ${opsiLabel(opsi)} · ${label}`],
        })
        baru.push({ id: genId('f'), blob, url: URL.createObjectURL(blob) })
      }
      setFoto((x) => ({ ...x, [key]: [...x[key], ...baru] }))
      setError(null)
    } catch (e) {
      setError(`Gagal memproses foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }
  const hapusFoto = (key: FotoTakarKey, id: string) =>
    setFoto((x) => {
      const t = x[key].find((f) => f.id === id)
      if (t) URL.revokeObjectURL(t.url)
      return { ...x, [key]: x[key].filter((f) => f.id !== id) }
    })

  const kirim = async () => {
    const v = parseAngka(hasil)
    if (!nozzle.trim()) return setError('Isi nomor nozzle.')
    if (!produk.trim()) return setError('Isi nama produk.')
    if (v === null) return setError('Isi hasil pengukuran (ml), mis. -40 bila kurang 40 ml.')
    if (Math.abs(v) > 2000) return setError('Hasil di luar wajar untuk bejana 20 L (maks. ±2.000 ml). Periksa kembali.')
    for (const f of FOTO_TAKAR) if (!foto[f.key].length) return setError(`Foto ${f.label.toLowerCase()} wajib diunggah.`)
    if (!petugas.trim()) return setError('Isi nama petugas.')
    setBusy('kirim')
    const id = genId('takar')
    try {
      const unggah = async (key: FotoTakarKey) => {
        const out: Photo[] = []
        for (const [i, f] of foto[key].entries()) out.push(await app.backend.uploadPhoto(`daily-${id}`, f.blob, `takar-${nozzle.trim()}-${opsi}-${key}-${i + 1}.jpg`))
        return out
      }
      const data: TakarData = {
        nozzle: nozzle.trim(),
        produk: produk.trim(),
        opsi,
        hasilMl: String(v),
        jam: nowHm(),
        petugas: petugas.trim(),
        catatan: catatan.trim(),
        foto: { dudukan: await unggah('dudukan'), hasil: await unggah('hasil') },
      }
      // Tanggal kalender saat uji (bukan tanggal operasional shift 3), shift tetap dicatat.
      const t = stamp()
      await app.saveDaily({ id, kind: 'takar', tanggal: todayIso(), shift: currentShift().shift, data, createdAt: t, updatedAt: t, createdBy: app.session.user?.id ?? null })
      toast(`Nozzle ${data.nozzle} ${opsiLabel(opsi)} terkirim: ${formatMl(data.hasilMl)}`)
      // Siap untuk hasil berikutnya: nozzle & produk tetap, opsi berpindah ke yang belum diuji.
      Object.values(foto).flat().forEach((f) => URL.revokeObjectURL(f.url))
      setFoto({ dudukan: [], hasil: [] })
      setHasil('')
      setCatatan('')
      setTerakhir(id)
      const lain: OpsiTakar = opsi === 'P' ? 'M' : 'P'
      if (!hariIni.some((r) => r.data.nozzle.toUpperCase() === data.nozzle.toUpperCase() && r.data.opsi === lain)) setOpsi(lain)
    } catch (e) {
      setError(`Gagal mengirim: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <Beaker className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-primary">Bejana ukur 20 liter</span>
            <span className="text-headline-md font-bold text-on-surface">Uji takaran nozzle</span>
            <span className="text-body-sm text-on-surface-variant">
              Toleransi: selisih tidak boleh kurang dari {TOLERANSI_TAKAR_ML} ml. Kirim satu hasil per nozzle per opsi.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Nomor nozzle" htmlFor="tk-nozzle">
            <Input id="tk-nozzle" list="tk-nozzle-list" autoComplete="off" placeholder="Mis. 3" value={nozzle} onChange={(e) => ubah(() => setNozzle(e.target.value))} />
            <datalist id="tk-nozzle-list">
              {nozzleList.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Field>
          <Field label="Produk" htmlFor="tk-produk">
            <Input id="tk-produk" list="tk-produk-list" autoComplete="off" placeholder="Mis. Pertalite" value={produk} onChange={(e) => ubah(() => setProduk(e.target.value))} />
            <datalist id="tk-produk-list">
              {produkList.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>
        </div>

        <div role="radiogroup" aria-label="Opsi pengisian" className="grid grid-cols-2 gap-space-xs">
          {OPSI_TAKAR.map((o) => {
            const on = opsi === o.value
            const done = identitasOk && sudahDiuji(o.value)
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => ubah(() => setOpsi(o.value))}
                className={cn('flex min-h-16 flex-col items-start justify-center rounded-md px-space-sm py-space-xs text-left', on ? 'bg-primary text-on-primary' : 'inset-field text-on-surface')}
              >
                <span className="flex items-center gap-1.5 text-body-md font-bold">
                  {o.label}
                  {done && <CircleCheck aria-label="sudah diuji hari ini" className="size-4" />}
                </span>
                <span className={cn('text-body-sm leading-snug', on ? 'text-on-primary' : 'text-on-surface-variant')}>{o.desc}</span>
              </button>
            )
          })}
        </div>

        <Field label={`Hasil ${opsiLabel(opsi)} (selisih dari 20 L)`} htmlFor="tk-hasil" hint="Minus bila kurang dari 20 L, mis. -40. Plus bila lebih.">
          <Input id="tk-hasil" numeric inputMode="text" suffix="ml" placeholder="-40" value={hasil} onChange={(e) => ubah(() => setHasil(e.target.value))} />
        </Field>
        {status !== 'kosong' && (
          <div role="status" className={cn('flex items-start gap-space-sm rounded-md p-space-sm text-body-sm', status === 'lewat' ? 'bg-error-container/70 text-on-error-container' : 'bg-emerald-50 text-emerald-800')}>
            {status === 'lewat' ? <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
            <span>
              <b>
                Nozzle {nozzle || '-'} {produk}, {opsiLabel(opsi)} = {formatMl(hasil)}
              </b>
              {status === 'lewat' ? `: melebihi toleransi ${TOLERANSI_TAKAR_ML} ml. Laporkan ke pengawas dan tulis tindak lanjut di catatan.` : ': dalam toleransi.'}
            </span>
          </div>
        )}
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
        {FOTO_TAKAR.map((f) => (
          <FotoWajib
            key={f.key}
            label={f.label}
            hint={f.hint}
            fotos={foto[f.key]}
            busy={busy === f.key}
            disabled={busy === 'kirim'}
            onAdd={(files) => void ambilFoto(f.key, files)}
            onRemove={(id) => hapusFoto(f.key, id)}
          />
        ))}
        <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <Camera aria-hidden="true" className="size-4 shrink-0" />
          Tanggal, jam, SPBU, nozzle, dan opsi tercetak otomatis pada foto.
        </span>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Petugas" htmlFor="tk-petugas">
            <Input id="tk-petugas" value={petugas} onChange={(e) => ubah(() => setPetugas(e.target.value))} />
          </Field>
          <Field label={status === 'lewat' ? 'Catatan / tindak lanjut' : 'Catatan (opsional)'} htmlFor="tk-catatan">
            <Input id="tk-catatan" autoComplete="off" value={catatan} onChange={(e) => ubah(() => setCatatan(e.target.value))} />
          </Field>
        </div>
        <ErrorBox text={error} />
        <Button size="lg" disabled={busy !== null} onClick={() => void kirim()}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {busy === 'kirim' ? 'Mengirim…' : `Kirim hasil Nozzle ${nozzle.trim() || '-'} · ${opsiLabel(opsi)}`}
        </Button>
      </GlassCard>

      <section aria-labelledby="takar-hari-ini" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="takar-hari-ini" title={`Hasil uji hari ini (${hariIni.length})`} />
        <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
          {hariIni.length === 0 && <p className="p-space-md text-center text-body-sm text-on-surface-variant">Belum ada hasil terkirim hari ini.</p>}
          {hariIni.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setDetail(r)}
              className={cn('flex min-h-14 w-full items-center gap-space-sm px-space-sm py-space-xs text-left', r.id === terakhir ? BARIS_BARU : takarStatus(r.data.hasilMl) === 'lewat' && BARIS_ORANYE)}
            >
              <span className="tabular w-6 shrink-0 text-body-sm font-bold text-on-surface-variant">{i + 1}.</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-md font-semibold leading-snug text-on-surface">
                  Nozzle {r.data.nozzle} {r.data.produk}, {opsiLabel(r.data.opsi)} = <span className="tabular whitespace-nowrap">{formatMl(r.data.hasilMl)}</span>
                </span>
                <span className="truncate text-body-sm text-on-surface-variant">
                  {r.data.jam} oleh {r.data.petugas || '-'}
                </span>
              </span>
              <StatusTakar hasil={r.data.hasilMl} />
            </button>
          ))}
        </GlassCard>
        {app.can('/laporan/takaran') && (
          <Link to="/laporan/takaran" className={buttonVariants({ variant: 'glass' })}>
            <History aria-hidden="true" />
            Riwayat uji takaran
          </Link>
        )}
      </section>

      <DetailTakar r={detail} onClose={() => setDetail(null)} />
      {guard.dialog}
    </div>
  )
}

/** Slot foto wajib dengan pratinjau; foto belum diunggah sampai hasil dikirim. */
function FotoWajib({
  label,
  hint,
  fotos,
  busy,
  disabled,
  onAdd,
  onRemove,
}: {
  label: string
  hint: string
  fotos: FotoLokal[]
  busy: boolean
  disabled: boolean
  onAdd: (files: File[]) => void
  onRemove: (id: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-tag uppercase text-on-surface-variant">{label} (wajib)</span>
        {fotos.length > 0 ? <Pill tone="success">{fotos.length} foto</Pill> : <Pill tone="error">Belum</Pill>}
      </div>
      <span className="text-body-sm text-on-surface-variant">{hint}</span>
      <div className="grid grid-cols-3 gap-space-xs">
        {fotos.map((f) => (
          <div key={f.id} className="relative overflow-hidden rounded-md">
            <img src={f.url} alt={label} className="aspect-[3/4] w-full bg-black object-contain" />
            <button
              type="button"
              aria-label={`Hapus foto ${label}`}
              disabled={disabled}
              onClick={() => onRemove(f.id)}
              className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => ref.current?.click()}
          className="inset-field flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-md border-[1.5px] border-dashed border-outline-variant text-body-sm font-semibold text-primary"
        >
          {busy ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin" /> : <Camera aria-hidden="true" className="size-5" />}
          {busy ? 'Memproses' : 'Ambil foto'}
        </button>
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.length) onAdd(files)
        }}
      />
    </div>
  )
}

/** Pop up satu hasil: data, foto bercap waktu, dan hapus (pengawas/ABH atau pengirim di hari yang sama). */
function DetailTakar({ r, onClose }: { r: TakarRecord | null; onClose: () => void }) {
  const app = useApp()
  const toast = useToast()
  const fotos = r ? [...r.data.foto.dudukan, ...r.data.foto.hasil] : []
  const srcOf = usePhotoSrc(fotos)
  const [hapus, setHapus] = useState(false)
  if (!r) return null
  const d = r.data
  const bolehHapus = app.canManage || (r.createdBy === app.session.user?.id && r.tanggal === todayIso())
  const hapusHasil = async () => {
    if (!window.confirm(`Hapus hasil Nozzle ${d.nozzle} ${opsiLabel(d.opsi)} (${formatMl(d.hasilMl)})?`)) return
    setHapus(true)
    try {
      await app.deleteDaily(r)
      for (const p of fotos) void app.backend.deletePhoto(p).catch(() => {})
      toast('Hasil uji dihapus')
      onClose()
    } catch (e) {
      toast(pesan(e), TriangleAlert)
    } finally {
      setHapus(false)
    }
  }
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} title={`Nozzle ${d.nozzle} ${d.produk}`} description={`${formatTanggalIso(r.tanggal)} ${d.jam}, ${opsiLabel(d.opsi)}, oleh ${d.petugas || '-'}`}>
      <div className="flex items-center justify-between gap-space-sm rounded-md bg-surface-container-low p-space-sm">
        <span className="tabular text-headline-md font-bold text-on-surface">{formatMl(d.hasilMl)}</span>
        <StatusTakar hasil={d.hasilMl} />
      </div>
      {d.catatan && <span className="text-body-sm text-on-surface">Catatan: {d.catatan}</span>}
      {FOTO_TAKAR.map((f) => (
        <div key={f.key} className="flex flex-col gap-space-xs">
          <span className="text-tag uppercase text-on-surface-variant">{f.label}</span>
          <div className="grid grid-cols-2 gap-space-xs">
            {d.foto[f.key].map((p) =>
              srcOf(p) ? (
                <a key={p.id} href={srcOf(p)} target="_blank" rel="noreferrer">
                  <img src={srcOf(p)} alt={f.label} className="aspect-[3/4] w-full rounded-md bg-black object-contain" />
                </a>
              ) : (
                <span key={p.id} className="aspect-[3/4] w-full animate-pulse rounded-md bg-surface-container" />
              ),
            )}
          </div>
        </div>
      ))}
      {bolehHapus && (
        <Button variant="ghost" className="text-error" disabled={hapus} onClick={() => void hapusHasil()}>
          <Trash2 aria-hidden="true" />
          Hapus hasil ini
        </Button>
      )}
    </Sheet>
  )
}

type Saring = 'semua' | 'lewat' | 'ok'

/** Laporan > Riwayat Uji Takaran: semua hasil per nozzle & opsi, sorot yang melebihi toleransi. */
export function RiwayatTakaran() {
  const app = useApp()
  useSyncOnOpen()
  const semua = useTakar()
  const [range, setRange] = useDateRange('month')
  const [saring, setSaring] = useState<Saring>('semua')
  const [detail, setDetail] = useState<TakarRecord | null>(null)
  if (!app.loaded) return <Loading />

  const diRentang = semua.filter((r) => inRange(r.tanggal, range))
  const lewat = diRentang.filter((r) => takarStatus(r.data.hasilMl) === 'lewat')
  const rows = saring === 'lewat' ? lewat : saring === 'ok' ? diRentang.filter((r) => takarStatus(r.data.hasilMl) !== 'lewat') : diRentang
  const cols: Col<TakarRecord>[] = [
    { header: 'Tanggal', mobile: 'sub', cell: (r) => <span className="tabular whitespace-nowrap">{`${formatTanggalIso(r.tanggal)} ${r.data.jam}`}</span> },
    { header: 'Nozzle', mobile: 'title', cell: (r) => <span className="font-semibold">{r.data.nozzle}</span>, mobileCell: (r) => `Nozzle ${r.data.nozzle} ${r.data.produk}, ${opsiLabel(r.data.opsi)} = ${formatMl(r.data.hasilMl)}` },
    { header: 'Produk', mobile: 'hide', cell: (r) => r.data.produk },
    { header: 'Opsi', mobile: 'hide', cell: (r) => `${r.data.opsi} · ${opsiLabel(r.data.opsi)}` },
    { header: 'Hasil', align: 'right', mobile: 'hide', cell: (r) => <span className={cn('font-semibold', takarStatus(r.data.hasilMl) === 'lewat' && 'text-error')}>{formatMl(r.data.hasilMl)}</span> },
    { header: 'Petugas', mobile: 'sub', cell: (r) => r.data.petugas || '-' },
    { header: 'Status', mobile: 'badge', cell: (r) => <StatusTakar hasil={r.data.hasilMl} /> },
  ]

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-center gap-space-sm">
          <Beaker aria-hidden="true" className="size-5 text-primary" />
          <span className="flex-1 text-body-md font-bold text-on-surface">
            {diRentang.length} hasil uji, {lewat.length} melebihi toleransi
          </span>
          {app.can('/takaran') && (
            <Link to="/takaran" className={buttonVariants({ size: 'sm' })}>
              Uji takaran
            </Link>
          )}
        </div>
        <DateFilter id="takar-range" value={range} onChange={setRange} />
        <ChipFilter
          label="Saring hasil"
          value={saring}
          onChange={setSaring}
          options={[
            { value: 'semua' as const, label: `Semua ${diRentang.length}` },
            { value: 'lewat' as const, label: `Melebihi toleransi ${lewat.length}` },
            { value: 'ok' as const, label: `Sesuai ${diRentang.length - lewat.length}` },
          ]}
        />
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable
          title="Uji takaran 20 L"
          rows={rows}
          total={diRentang.length}
          cols={cols}
          rowKey={(r) => r.id}
          onRow={setDetail}
          rowClass={(r) => (takarStatus(r.data.hasilMl) === 'lewat' ? BARIS_ORANYE : undefined)}
          empty="Belum ada hasil uji takaran pada rentang ini."
        />
      </div>
      <DetailTakar r={detail} onClose={() => setDetail(null)} />
    </div>
  )
}
