import { useEffect, useMemo, useRef, useState } from 'react'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { Link, useSearchParams } from 'react-router-dom'
import { Beaker, Camera, CircleCheck, FileDown, FileText, History, LoaderCircle, Send, Trash2, TriangleAlert } from 'lucide-react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Field } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { KartuPilih, LegendaStatus } from '@/components/bongkaran/pilih-status'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { BARIS_ORANYE, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { InfoHalaman } from '@/components/ui/info-pop'
import { ekspor, muatFoto } from '@/lib/ekspor'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { TakarRecord } from '@/lib/daily'
import { formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { parseAngka } from '@/lib/format'
import { capWaktu, compressImage, genId } from '@/lib/image'
import { PRODUK_OPTIONS, type Photo } from '@/lib/sop'
import { currentShift } from '@/lib/shift'
import { FOTO_TAKAR, formatMl, OPSI_TAKAR, opsiLabel, takarStatus, TOLERANSI_TAKAR_ML, type FotoTakarKey, type OpsiTakar, type TakarData } from '@/lib/takar'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { useKeTerkirim } from '@/lib/terkirim'
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

/**
 * Input > Uji Takaran: uji nozzle dengan bejana ukur 20 L. Petugas mengetik nomor nozzle &
 * produk, memilih opsi P (Preset) atau M (Manual), mengisi selisih (ml), memotret dudukan
 * bejana + water pass dan hasil pengukuran, lalu mengirim satu hasil. Ulangi untuk hasil berikutnya.
 */
/**
 * Operation > Uji Takaran: pilih nozzle. Hijau = Preset & Manual sudah diuji hari ini,
 * oranye = belum lengkap. Hasil hari ini tampil di bawah.
 */
export function MenuTakaran() {
  const app = useApp()
  useSyncOnOpen()
  const semua = useTakar()
  const [detail, setDetail] = useState<TakarRecord | null>(null)
  if (!app.loaded) return <Loading />
  const today = todayIso()
  const hariIni = semua.filter((r) => r.tanggal === today).sort((a, b) => a.createdAt - b.createdAt)
  // Nozzle dari Pengaturan; nozzle yang diuji hari ini tetapi tidak terdaftar ikut tampil.
  const daftar = new Map<string, string>()
  for (const n of app.settings.nozzles ?? []) if (n.nama.trim()) daftar.set(n.nama.trim().toUpperCase(), n.produk)
  for (const r of hariIni) if (!daftar.has(r.data.nozzle.toUpperCase())) daftar.set(r.data.nozzle.toUpperCase(), r.data.produk)
  const nama = (key: string) => (app.settings.nozzles ?? []).find((n) => n.nama.trim().toUpperCase() === key)?.nama.trim() ?? hariIni.find((r) => r.data.nozzle.toUpperCase() === key)?.data.nozzle ?? key
  return (
    <div className="flex flex-col gap-space-md">
      <InfoHalaman judul="Uji Takaran">
        <p>Pilih nozzle, lalu uji dengan bejana ukur 20 L untuk opsi Preset dan Manual. Toleransi: selisih tidak boleh kurang dari {TOLERANSI_TAKAR_ML} ml.</p>
      </InfoHalaman>
      <section aria-labelledby="takar-nozzle" className="animate-entrance-2 flex flex-col gap-space-xs">
        <SectionHeader id="takar-nozzle" title="Nozzle" action={<span className="tabular text-body-sm text-on-surface-variant">{daftar.size}</span>} />
        {[...daftar].map(([key, prod]) => {
          const uji = hariIni.filter((r) => r.data.nozzle.toUpperCase() === key)
          const p = uji.some((r) => r.data.opsi === 'P')
          const m = uji.some((r) => r.data.opsi === 'M')
          const lewat = uji.some((r) => takarStatus(r.data.hasilMl) === 'lewat')
          const lanjut: OpsiTakar = p && !m ? 'M' : 'P'
          return (
            <KartuPilih
              key={key}
              to={`/takaran/uji?nozzle=${encodeURIComponent(nama(key))}&produk=${encodeURIComponent(prod)}&opsi=${lanjut}`}
              status={p && m ? 'sudah' : 'belum'}
              judul={`Nozzle ${nama(key)}`}
              sub={prod || '-'}
              keterangan={`Preset ${p ? '✓' : 'belum'} · Manual ${m ? '✓' : 'belum'}${lewat ? ' · melebihi toleransi' : ''}`}
            />
          )
        })}
        <KartuPilih to="/takaran/uji" status="belum" judul="Nozzle lain" sub="Ketik nomor nozzle & produk sendiri" keterangan="Uji baru" />
        <LegendaStatus />
      </section>

      <section aria-labelledby="takar-hari-ini" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="takar-hari-ini" title={`Hasil uji hari ini (${hariIni.length})`} />
        <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
          {hariIni.length === 0 && <p className="p-space-md text-center text-body-sm text-on-surface-variant">Belum ada hasil terkirim hari ini.</p>}
          {hariIni.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setDetail(r)}
              className={cn('flex min-h-14 w-full items-center gap-space-sm px-space-sm py-space-xs text-left', takarStatus(r.data.hasilMl) === 'lewat' && BARIS_ORANYE)}
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
    </div>
  )
}

/** Halaman form uji takaran satu nozzle & opsi. */
export function UjiTakaran() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  useSyncOnOpen()
  const semua = useTakar()
  const [params] = useSearchParams()
  const [nozzle, setNozzle] = useState(() => params.get('nozzle') ?? '')
  const [produk, setProduk] = useState(() => params.get('produk') ?? '')
  const [opsi, setOpsi] = useState<OpsiTakar>(() => (params.get('opsi') === 'M' ? 'M' : 'P'))
  const [hasil, setHasil] = useState('')
  const [catatan, setCatatan] = useState('')
  const [petugas, setPetugas] = useState(() => (app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName))
  const [foto, setFoto] = useState<Record<FotoTakarKey, FotoLokal[]>>({ dudukan: [], hasil: [] })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<FotoTakarKey | 'kirim' | null>(null)
  const fotoRef = useRef(foto)
  useEffect(() => {
    fotoRef.current = foto
  }, [foto])
  // Lepas pratinjau foto saat halaman ditutup.
  useEffect(() => () => Object.values(fotoRef.current).flat().forEach((f) => URL.revokeObjectURL(f.url)), [])

  const guard = useLeaveGuard({ active: true, title: 'Keluar dari uji takaran?', detail: 'Hasil uji dan foto yang belum dikirim akan hilang.' })
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
      guard.bypass()
      Object.values(foto).flat().forEach((f) => URL.revokeObjectURL(f.url))
      // Opsi lain nozzle ini yang belum diuji hari ini ditawarkan sebagai langkah berikutnya.
      const lain: OpsiTakar = opsi === 'P' ? 'M' : 'P'
      const lainBelum = !hariIni.some((r) => r.data.nozzle.toUpperCase() === data.nozzle.toUpperCase() && r.data.opsi === lain)
      const q = (o: OpsiTakar) => `/takaran/uji?nozzle=${encodeURIComponent(data.nozzle)}&produk=${encodeURIComponent(data.produk)}&opsi=${o}`
      keTerkirim({
        judul: `Nozzle ${data.nozzle} · ${opsiLabel(opsi)} terkirim`,
        detail: `${data.produk}, ${formatTanggalIso(todayIso())} ${data.jam}`,
        peringatan: takarStatus(data.hasilMl) === 'lewat' ? `Melebihi toleransi ${TOLERANSI_TAKAR_ML} ml. Laporkan ke pengawas.` : undefined,
        baris: [
          ['Hasil (selisih dari 20 L)', formatMl(data.hasilMl)],
          ['Foto', `${data.foto.dudukan.length + data.foto.hasil.length} foto`],
          ['Petugas', data.petugas],
        ],
        aksi: [
          ...(lainBelum ? [{ to: q(lain), label: `Lanjut uji ${opsiLabel(lain)} nozzle ${data.nozzle}` }] : []),
          { to: '/takaran', label: 'Pilih nozzle lain' },
          { to: '/laporan/takaran', label: 'Riwayat uji takaran' },
        ],
      })
      return
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
          <Input id="tk-hasil" numeric inputMode="text" suffix="ml" value={hasil} onChange={(e) => ubah(() => setHasil(e.target.value))} />
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

      {guard.dialog}
    </div>
  )
}

/** Pop up satu hasil: data, foto bercap waktu, dan hapus (pengawas/ABH atau pengirim di hari yang sama). */
function DetailTakar({ r, onClose }: { r: TakarRecord | null; onClose: () => void }) {
  const app = useApp()
  const konfirmasi = useKonfirmasi()
  const toast = useToast()
  const fotos = r ? [...r.data.foto.dudukan, ...r.data.foto.hasil] : []
  const srcOf = usePhotoSrc(fotos)
  const [hapus, setHapus] = useState(false)
  if (!r) return null
  const d = r.data
  const bolehHapus = app.canManage || (r.createdBy === app.session.user?.id && r.tanggal === todayIso())
  const hapusHasil = async () => {
    if (!(await konfirmasi({ judul: 'Hapus hasil uji takaran?', pesan: <>Hasil <b>Nozzle {d.nozzle} {opsiLabel(d.opsi)} ({formatMl(d.hasilMl)})</b> akan dihapus dari riwayat.</> }))) return
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
      <CetakBaTakar semua={semua} />
      <div className="animate-entrance-3">
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

/**
 * Cetak PDF Berita Acara Uji Takar untuk satu tanggal uji: BA saja, atau BA + lampiran foto
 * (dudukan bejana & water pass, hasil pengukuran) per hasil.
 */
function CetakBaTakar({ semua }: { semua: TakarRecord[] }) {
  const app = useApp()
  const toast = useToast()
  const tanggalAda = [...new Set(semua.map((r) => r.tanggal))].sort().reverse()
  const [tanggal, setTanggal] = useState(() => tanggalAda[0] ?? todayIso())
  const [busy, setBusy] = useState<'ba' | 'lampiran' | null>(null)
  const records = semua.filter((r) => r.tanggal === tanggal)
  const lewat = records.filter((r) => takarStatus(r.data.hasilMl) === 'lewat').length

  const cetak = async (lampiran: boolean) => {
    setBusy(lampiran ? 'lampiran' : 'ba')
    try {
      await ekspor(lampiran ? 'Membuat PDF BA Uji Takar + lampiran' : 'Membuat PDF BA Uji Takar', async (lapor) => {
        lapor(8, 'Memuat modul laporan')
        const { exportBaTakarPdf } = await import('@/lib/report/ba-takar')
        const fotos = lampiran ? records.flatMap((r) => [...r.data.foto.dudukan, ...r.data.foto.hasil]) : []
        const fotoData = await muatFoto(fotos, (p) => app.backend.photoDataUrl(p), lapor, 15, 70)
        lapor(lampiran ? 75 : 40, 'Menyusun halaman PDF')
        const kode = app.settings.kodeSpbu?.trim() || 'SPBU'
        await exportBaTakarPdf({ tanggal, records, settings: app.settings, fotoData }, lampiran, `BA_Uji_Takar_SPBU_${kode}_${tanggal}${lampiran ? '_Lampiran' : ''}.pdf`)
      })
      toast(lampiran ? 'BA + lampiran foto diunduh' : 'Berita Acara diunduh')
    } catch (e) {
      toast(`Gagal membuat PDF: ${pesan(e)}`, TriangleAlert)
    } finally {
      setBusy(null)
    }
  }

  return (
    <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
      <div className="flex items-start gap-space-sm">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-fixed text-primary">
          <FileText className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-body-md font-bold text-on-surface">Berita Acara Uji Takar</span>
          <span className="text-body-sm text-on-surface-variant">PDF per tanggal uji: info SPBU, hasil per nozzle, ringkasan, tanda tangan petugas & pengawas.</span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-space-sm">
        <Field label="Tanggal uji" htmlFor="ba-takar-tgl">
          <Input id="ba-takar-tgl" type="date" max={todayIso()} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </Field>
        <span role="status" className="pb-3 text-body-sm text-on-surface-variant">
          {records.length ? (
            <>
              <b className="text-on-surface">{records.length} hasil</b>
              {lewat ? <span className="text-error">, {lewat} lewat</span> : null}
            </>
          ) : (
            'Tidak ada hasil'
          )}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-space-xs sm:grid-cols-2">
        <Button variant="glass" disabled={!records.length || busy !== null} onClick={() => void cetak(false)}>
          {busy === 'ba' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileDown aria-hidden="true" />}
          BA saja (PDF)
        </Button>
        <Button disabled={!records.length || busy !== null} onClick={() => void cetak(true)}>
          {busy === 'lampiran' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileDown aria-hidden="true" />}
          {busy === 'lampiran' ? 'Menyiapkan foto…' : 'BA + Lampiran foto (PDF)'}
        </Button>
      </div>
    </GlassCard>
  )
}
