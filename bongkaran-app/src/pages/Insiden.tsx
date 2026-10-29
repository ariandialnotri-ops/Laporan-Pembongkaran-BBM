import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Ban, ChevronRight, CircleCheck, Clock, FileText, LoaderCircle, Paperclip, Plus, ScanSearch, Send, ShieldAlert, TriangleAlert, Wrench, X } from 'lucide-react'
import { BannerTerkirim } from '@/components/bongkaran/banner-terkirim'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { HentiInfo } from '@/components/insiden/henti'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { PhotoSlot } from '@/components/bongkaran/photo-slot'
import { KartuPilih } from '@/components/bongkaran/pilih-status'
import { BARIS_BARU, BARIS_ORANYE, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { TandaRevisi } from '@/components/ui/tanda-revisi'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { Stepper, type Langkah } from '@/components/ui/stepper'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { InfoHalaman } from '@/components/ui/info-pop'
import { DEFAULT_AREAS, lokasiOptions } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { InsidenRecord } from '@/lib/daily'
import { formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { compressImage, genId } from '@/lib/image'
import { ambilMedia } from '@/lib/lapor-media'
import {
  durasiHenti,
  JENIS_HENTI,
  JENIS_INSIDEN,
  jenisLabel,
  labelWaktu,
  waktuLokal,
  KATEGORI_INSIDEN,
  STATUS_INSIDEN,
  statusMeta,
  TINGKAT_INSIDEN,
  type HentiPenyaluran,
  type InsidenData,
  type InsidenLangkah,
  type JenisInsiden,
  type StatusInsiden,
  type TingkatInsiden,
} from '@/lib/insiden'
import { shiftKey } from '@/lib/shift'
import type { Photo } from '@/lib/sop'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { useKeTerkirim } from '@/lib/terkirim'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const stamp = () => Date.now()
const isoNow = () => new Date().toISOString()

function useInsiden() {
  const app = useApp()
  return useMemo(() => app.daily.filter((d): d is InsidenRecord => d.kind === 'insiden'), [app.daily])
}

/** Laporan stop penyaluran punya menu & riwayat sendiri; daftar insiden hanya insiden, near miss, temuan, kerusakan. */
const bukanHenti = (r: InsidenRecord) => r.data.jenis !== 'henti'

function StatusPill({ s }: { s: StatusInsiden }) {
  const m = statusMeta(s)
  return <Pill tone={m.tone}>{m.label}</Pill>
}

const IKON_JENIS: Record<JenisInsiden, typeof Ban> = { insiden: ShieldAlert, nearmiss: TriangleAlert, temuan: ScanSearch, kerusakan: Wrench, henti: Ban }

/** Keterangan ikon status di ujung kanan kartu. */
function LegendaIkon() {
  return (
    <div className="flex flex-wrap items-center gap-x-space-sm gap-y-1 px-space-xs text-body-sm text-on-surface-variant">
      <span className="flex items-center gap-1.5">
        <CircleCheck aria-hidden="true" className="size-4 text-emerald-600" />
        Semua selesai
      </span>
      <span className="flex items-center gap-1.5">
        <Clock aria-hidden="true" className="size-4 text-orange-500" />
        Ada laporan terbuka
      </span>
    </div>
  )
}

const tingkatTone = (t: TingkatInsiden) => (t === 'tinggi' ? 'text-error' : t === 'sedang' ? 'text-amber-700' : 'text-on-surface-variant')

/** Lapor Kejadian: form satu laporan insiden / near miss / temuan / kerusakan. Kirim lalu ke riwayat. */
/** HSSE > Lapor Kejadian: pilih jenis kejadian, lalu isi form di halaman berikutnya. */
export function PilihJenisInsiden() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  const terbuka = (j: JenisInsiden) => app.daily.filter((x): x is InsidenRecord => x.kind === 'insiden' && x.data.jenis === j && x.data.status !== 'selesai').length
  const henti = app.daily.filter((x): x is InsidenRecord => x.kind === 'insiden' && !!x.data.henti && !x.data.henti.selesai)
  return (
    <div className="flex flex-col gap-space-md">
      <InfoHalaman judul="Lapor Kejadian">
        <p>Pilih jenis kejadian yang akan dilaporkan.</p>
      </InfoHalaman>
      {henti.map((r) => (
        <Link key={r.id} to={`/laporan/insiden/${encodeURIComponent(r.id)}`} className="animate-entrance-1">
          <HentiInfo h={r.data.henti!} />
        </Link>
      ))}

      <div className="animate-entrance-2 flex flex-col gap-space-sm">
        {JENIS_INSIDEN.map((j) => {
          const n = terbuka(j.value)
          return (
            <KartuPilih
              key={j.value}
              model="ikon"
              ikon={IKON_JENIS[j.value]}
              to={`/insiden/baru/${j.value}`}
              status={n ? 'belum' : 'sudah'}
              judul={j.label}
              sub={j.desc}
              keterangan={n ? `${n} laporan belum selesai ditindaklanjuti` : 'Tidak ada laporan terbuka'}
            />
          )
        })}
        <KartuPilih
          model="ikon"
          ikon={Ban}
          to="/stop-penyaluran"
          status={henti.length ? 'belum' : 'sudah'}
          judul={JENIS_HENTI.label}
          sub="Dilaporkan di menu tersendiri, dengan jam penyaluran kembali"
          keterangan={henti.length ? `${henti.length} stop penyaluran masih berjalan` : 'Semua produk tersalurkan normal'}
        />
      </div>
      <LegendaIkon />
    </div>
  )
}

export function InsidenBaru() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const { jenis: jenisParam } = useParams()
  const jenisAwal = (JENIS_INSIDEN.find((j) => j.value === jenisParam)?.value ?? 'nearmiss') as JenisInsiden
  const [id] = useState(() => genId('insiden'))
  const [tanggal, setTanggal] = useState(() => todayIso())
  const [d, setD] = useState<InsidenData>(() => ({
    jenis: jenisAwal,
    kategori: KATEGORI_INSIDEN[jenisAwal][0],
    jam: nowHm(),
    lokasi: '',
    aset: '',
    uraian: '',
    penyebab: '',
    tindakanSegera: '',
    dampak: '',
    tingkat: 'rendah',
    pelapor: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName,
    foto: [],
    status: 'terbuka',
    pic: '',
    targetSelesai: '',
    riwayat: [],
  }))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'foto' | 'kirim' | null>(null)
  const srcOf = usePhotoSrc([...d.foto, ...(d.video ?? [])])
  // Foto & video bercap waktu dari kamera Lapor (tombol tengah bar bawah) langsung diunggah ke laporan ini.
  const titipan = useRef(false)
  useEffect(() => {
    if (titipan.current) return
    titipan.current = true
    const media = ambilMedia()
    if (!media.length) return
    setBusy('foto')
    void (async () => {
      try {
        for (const m of media) {
          const p = await app.backend.uploadPhoto(`daily-${id}`, m.blob, m.jenis === 'video' ? 'video-kejadian' : 'kejadian.jpg')
          setD((x) => (m.jenis === 'video' ? { ...x, video: [...(x.video ?? []), p] } : { ...x, foto: [...x.foto, p] }))
          URL.revokeObjectURL(m.url)
        }
      } catch (e) {
        setError(`Gagal menyimpan foto/video: ${pesan(e)}`)
      } finally {
        setBusy(null)
      }
    })()
  }, [app.backend, id])
  const guard = useLeaveGuard({ active: true, title: 'Keluar tanpa mengirim laporan?', detail: 'Isian laporan kejadian ini belum dikirim.' })
  if (!app.loaded) return <Loading />

  const s = app.settings
  const lokasi = [...lokasiOptions(s.jumlahPulau ?? 0, s.aparArea ?? DEFAULT_AREAS), 'Area lain']
  const aset = [...(s.dispensers ?? []).map((x) => x.nama), ...(s.nozzles ?? []).map((x) => x.nama), 'Tangki pendam', 'ATG', 'Genset', 'Kanopi', 'Kendaraan pelanggan']
  const set = (p: Partial<InsidenData>) => {
    setError(null)
    setD((x) => ({ ...x, ...p }))
  }
  const fotoWajib = d.jenis !== 'nearmiss'

  const tambahFoto = async (files: File[]) => {
    setBusy('foto')
    try {
      const baru: Photo[] = []
      for (const f of files) baru.push(await app.backend.uploadPhoto(`daily-${id}`, await compressImage(f), 'kejadian.jpg'))
        setError(null)
      setD((x) => ({ ...x, foto: [...x.foto, ...baru] }))
    } catch (e) {
      setError(`Gagal menyimpan foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const kirim = async () => {
    if (!tanggal || tanggal > todayIso()) return setError('Isi tanggal kejadian (tidak boleh di masa depan).')
    if (!d.jam) return setError('Isi jam kejadian.')
    if (!d.lokasi) return setError('Pilih lokasi kejadian.')
    if (d.jenis === 'kerusakan' && !d.aset.trim()) return setError('Isi peralatan/fasilitas yang rusak.')
    if (d.uraian.trim().length < 10) return setError('Tulis uraian kejadian (minimal 10 karakter).')
    if (d.jenis === 'insiden' && !d.dampak.trim()) return setError('Isi dampak / korban kejadian.')
    if (!d.tindakanSegera.trim()) return setError('Isi tindakan yang sudah dilakukan.')
    if (fotoWajib && !d.foto.length && !d.video?.length) return setError('Foto atau video kejadian wajib diunggah.')
    if (!d.pelapor.trim()) return setError('Isi nama pelapor.')
    setBusy('kirim')
    try {
      const shift = shiftKey(tanggal, d.jam)?.shift ?? 1
      const data: InsidenData = {
        ...d,
        pelapor: d.pelapor.trim(),
        riwayat: [{ at: isoNow(), oleh: d.pelapor.trim(), status: 'terbuka', catatan: 'Laporan dibuat' }],
      }
      await app.saveDaily({ id, kind: 'insiden', tanggal, shift, data, createdAt: stamp(), updatedAt: stamp(), createdBy: app.session.user?.id ?? null })
      guard.bypass()
      keTerkirim({
        judul: `Laporan ${jenisLabel(d.jenis).toLowerCase()} terkirim`,
        detail: `${d.kategori}, ${formatTanggalIso(tanggal)} ${d.jam}`,
        baris: [
          ['Lokasi', d.lokasi],
          ...(d.aset.trim() ? ([['Peralatan', d.aset.trim()]] as [string, string][]) : []),
          ['Tingkat risiko', d.tingkat],
          ['Foto', `${d.foto.length} foto${d.video?.length ? ` + ${d.video.length} video` : ''}`],
          ['Pelapor', d.pelapor.trim()],
        ],
        aksi: [
          { to: `/laporan/insiden/${encodeURIComponent(id)}`, label: 'Lihat laporan & tindak lanjut' },
          { to: '/insiden/baru', label: 'Laporkan kejadian lain' },
        ],
      })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="text-tag uppercase text-primary">Jenis kejadian</span>
        <span className="text-headline-md font-bold text-on-surface">{jenisLabel(d.jenis)}</span>
        <span className="text-body-sm text-on-surface-variant">{JENIS_INSIDEN.find((j) => j.value === d.jenis)?.desc}</span>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Kategori" htmlFor="ins-kategori" className="col-span-2">
            <Select value={d.kategori} onValueChange={(v) => set({ kategori: v })}>
              <SelectTrigger id="ins-kategori">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KATEGORI_INSIDEN[d.jenis].map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tanggal kejadian" htmlFor="ins-tgl">
            <Input id="ins-tgl" type="date" max={todayIso()} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </Field>
          <Field label="Jam kejadian" htmlFor="ins-jam">
            <Input id="ins-jam" type="time" value={d.jam} onChange={(e) => set({ jam: e.target.value })} />
          </Field>
          <Field label="Lokasi" htmlFor="ins-lokasi">
            <Select value={d.lokasi || undefined} onValueChange={(v) => set({ lokasi: v })}>
              <SelectTrigger id="ins-lokasi">
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
          <Field label={d.jenis === 'kerusakan' ? 'Peralatan yang rusak' : 'Peralatan terkait (opsional)'} htmlFor="ins-aset">
            <Input id="ins-aset" list="ins-aset-list" autoComplete="off" placeholder="Mis. Nozzle 2" value={d.aset} onChange={(e) => set({ aset: e.target.value })} />
            <datalist id="ins-aset-list">
              {aset.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
        </div>
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
        <Field label="Uraian kejadian" htmlFor="ins-uraian">
          <Textarea id="ins-uraian" placeholder="Apa yang terjadi, siapa yang terlibat, bagaimana kronologinya" value={d.uraian} onChange={(e) => set({ uraian: e.target.value })} />
        </Field>
        {d.jenis !== 'nearmiss' && (
          <Field label={d.jenis === 'insiden' ? 'Dampak / korban' : 'Dampak ke operasional (opsional)'} htmlFor="ins-dampak">
            <Textarea id="ins-dampak" className="min-h-[64px]" placeholder={d.jenis === 'insiden' ? 'Mis. 1 orang luka ringan, 5 L BBM tumpah' : 'Mis. nozzle tidak bisa dipakai'} value={d.dampak} onChange={(e) => set({ dampak: e.target.value })} />
          </Field>
        )}
        <Field label="Dugaan penyebab (opsional)" htmlFor="ins-penyebab">
          <Input id="ins-penyebab" autoComplete="off" value={d.penyebab} onChange={(e) => set({ penyebab: e.target.value })} />
        </Field>
        {d.jenis === 'kerusakan' && (
          <Link to="/stop-penyaluran/baru" className="flex items-center gap-space-sm rounded-md bg-surface-container-low p-space-sm text-body-sm">
            <Ban aria-hidden="true" className="size-5 shrink-0 text-error" />
            <span className="min-w-0 flex-1 text-on-surface">
              Kerusakan membuat penyaluran harus dihentikan? Laporkan juga di <b>Stop Penyaluran</b> agar jam berhenti & penyaluran kembali tercatat.
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
          </Link>
        )}
        <Field label="Tindakan yang sudah dilakukan" htmlFor="ins-tindakan">
          <Textarea id="ins-tindakan" className="min-h-[64px]" placeholder="Mis. area diamankan, tumpahan dibersihkan, nozzle dipasang tanda rusak" value={d.tindakanSegera} onChange={(e) => set({ tindakanSegera: e.target.value })} />
        </Field>
        <Field label="Tingkat risiko">
          <Choice label="Tingkat risiko" value={d.tingkat} onChange={(v) => set({ tingkat: v })} options={TINGKAT_INSIDEN} />
        </Field>
        <PhotoSlot
          label={fotoWajib ? 'Foto kejadian (wajib)' : 'Foto kejadian (opsional)'}
          photos={d.foto}
          required={fotoWajib}
          busy={busy === 'foto'}
          srcOf={srcOf}
          onAdd={(f) => void tambahFoto(f)}
          onRemove={(i) => {
            const t = d.foto[i]
            set({ foto: d.foto.filter((_, j) => j !== i) })
            if (t) void app.backend.deletePhoto(t).catch(() => {})
          }}
        />
        {(d.video ?? []).map((v, i) => (
          <div key={v.id} className="flex flex-col gap-space-xs">
            <span className="text-tag uppercase text-on-surface-variant">Video kejadian</span>
            {srcOf(v) ? <video src={srcOf(v)} controls playsInline className="max-h-72 w-full rounded-md bg-black" /> : <span className="h-40 animate-pulse rounded-md bg-surface-container" />}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                set({ video: (d.video ?? []).filter((_, j) => j !== i) })
                void app.backend.deletePhoto(v).catch(() => {})
              }}
            >
              Hapus video
            </Button>
          </div>
        ))}
        <Field label="Pelapor" htmlFor="ins-pelapor">
          <Input id="ins-pelapor" value={d.pelapor} onChange={(e) => set({ pelapor: e.target.value })} />
        </Field>
        <ErrorBox text={error} />
        <Button size="lg" disabled={busy !== null} onClick={kirim}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          Kirim laporan {jenisLabel(d.jenis).toLowerCase()}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

type Row = { r: InsidenRecord }
const COLS: Col<Row>[] = [
  { header: 'Tanggal', cell: (x) => <span className="tabular whitespace-nowrap">{`${formatTanggalIso(x.r.tanggal)} ${x.r.data.jam}`}</span>, mobile: 'sub' },
  { header: 'Jenis', cell: (x) => <span className="font-semibold">{jenisLabel(x.r.data.jenis)}</span>, mobileCell: (x) => `${jenisLabel(x.r.data.jenis)}: ${x.r.data.kategori}`, mobile: 'title' },
  { header: 'Kategori', cell: (x) => x.r.data.kategori, mobile: 'hide' },
  { header: 'Lokasi', cell: (x) => `${x.r.data.lokasi}${x.r.data.aset ? `, ${x.r.data.aset}` : ''}`, mobile: 'sub' },
  { header: 'Penyaluran', cell: (x) => (x.r.data.henti ? <span className={cn('font-semibold', !x.r.data.henti.selesai && 'text-error')}>{x.r.data.henti.selesai ? 'Sempat berhenti' : `Berhenti: ${x.r.data.henti.produk.join(', ')}`}</span> : '-'), mobile: 'hide' },
  { header: 'Risiko', cell: (x) => <span className={cn('font-semibold capitalize', tingkatTone(x.r.data.tingkat))}>{x.r.data.tingkat}</span>, mobile: 'hide' },
  { header: 'Pelapor', cell: (x) => x.r.data.pelapor || '-', mobile: 'hide' },
  { header: 'Status', cell: (x) => <StatusPill s={x.r.data.status} />, mobile: 'badge' },
]

/** Laporan > Riwayat Lapor Kejadian (insiden, near miss, temuan, kerusakan). */
export function RiwayatInsiden() {
  const app = useApp()
  useSyncOnOpen()
  const [params] = useSearchParams()
  const baru = params.get('baru')
  const [range, setRange] = useDateRange('month')
  const [jenis, setJenis] = useState<'semua' | JenisInsiden>('semua')
  const [status, setStatus] = useState<'semua' | StatusInsiden>('semua')
  const semua = useInsiden()
  if (!app.loaded) return <Loading />

  const all = semua.filter(bukanHenti).sort((a, b) => (b.tanggal + b.data.jam).localeCompare(a.tanggal + a.data.jam))
  const inDate = all.filter((r) => inRange(r.tanggal, range) || r.id === baru)
  const n = (f: (r: InsidenRecord) => boolean) => inDate.filter(f).length
  const rows: Row[] = inDate.filter((r) => (jenis === 'semua' || r.data.jenis === jenis) && (status === 'semua' || r.data.status === status)).map((r) => ({ r }))
  const terbuka = all.filter((r) => r.data.status !== 'selesai').length

  return (
    <div className="flex flex-col gap-space-md">
      {baru && <BannerTerkirim teks="Laporan terkirim dan disorot di bawah. Pengawas/ABH akan menindaklanjuti." />}
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-center gap-space-sm">
          <ShieldAlert aria-hidden="true" className="size-5 text-error" />
          <span className="flex-1 text-body-md font-bold text-on-surface">{terbuka} laporan belum selesai</span>
          {app.can('/insiden/baru') && (
            <Link to="/insiden/baru" className={buttonVariants({ size: 'sm' })}>
              <Plus aria-hidden="true" />
              Laporkan
            </Link>
          )}
        </div>
        <DateFilter id="insiden-range" value={range} onChange={setRange} />
        <ChipFilter
          label="Jenis"
          value={jenis}
          onChange={setJenis}
          options={[{ value: 'semua' as const, label: `Semua ${inDate.length}` }, ...JENIS_INSIDEN.map((j) => ({ value: j.value, label: `${j.label} ${n((r) => r.data.jenis === j.value)}` }))]}
        />
        <ChipFilter
          label="Status"
          value={status}
          onChange={setStatus}
          options={[{ value: 'semua' as const, label: 'Semua status' }, ...STATUS_INSIDEN.map((x) => ({ value: x.value, label: `${x.label} ${n((r) => r.data.status === x.value)}` }))]}
        />
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable
          title="Riwayat Lapor Kejadian"
          rows={rows}
          total={all.length}
          cols={COLS}
          rowKey={(x) => x.r.id}
          to={(x) => `/laporan/insiden/${encodeURIComponent(x.r.id)}`}
          rowClass={(x) => (x.r.id === baru ? BARIS_BARU : x.r.data.status === 'terbuka' ? BARIS_ORANYE : undefined)}
          empty="Belum ada laporan pada rentang ini."
        />
      </div>
    </div>
  )
}

/** Detail satu laporan kejadian + tindak lanjut (status, PIC, target, catatan). */
export function InsidenDetail() {
  const app = useApp()
  const toast = useToast()
  useSyncOnOpen()
  const { id = '' } = useParams()
  const semua = useInsiden()
  const rec = semua.find((r) => r.id === id)
  const srcOf = usePhotoSrc([...(rec?.data.foto ?? []), ...(rec?.data.video ?? []), ...(rec?.data.riwayat ?? []).flatMap((l) => [...(l.foto ?? []), ...(l.ba ?? [])])])
  const [status, setStatus] = useState<StatusInsiden | ''>('')
  // Lampiran tindak lanjut: foto (dikompres) dan berita acara (foto dokumen atau PDF), diunggah saat disimpan.
  const [tlFoto, setTlFoto] = useState<FotoLokal[]>([])
  const [tlBa, setTlBa] = useState<(FotoLokal & { nama: string; pdf: boolean })[]>([])
  const [olahFoto, setOlahFoto] = useState(false)
  const baRef = useRef<HTMLInputElement>(null)
  const [pic, setPic] = useState('')
  const [target, setTarget] = useState('')
  const [catatan, setCatatan] = useState('')
  // Jam penyaluran dibuka kembali (wajib saat stop penyaluran ditutup).
  const [jamKembali, setJamKembali] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Form tindak lanjut sebagai pop up dari tahap terbaru stepper.
  const [buka, setBuka] = useState(false)
  if (!app.loaded) return <Loading />
  if (!rec)
    return (
      <GlassCard level={1} className="flex flex-col items-center gap-space-sm p-space-md text-center">
        <span className="text-body-md font-semibold text-on-surface">Laporan tidak ditemukan</span>
        <Link to="/laporan/insiden" className={buttonVariants({ size: 'pill' })}>
          Ke riwayat
        </Link>
      </GlassCard>
    )
  const d = rec.data
  // Semua anggota SPBU (termasuk security, cleaning service, Admin/Cashier) dapat menindaklanjuti dan menutup laporan.
  const bolehTL = !!app.role
  // Bawaan form: laporan terbuka → ditindaklanjuti.
  const statusBaru = status || (d.status === 'terbuka' ? 'proses' : d.status)
  const hentiAktif = !!d.henti && !d.henti.selesai
  // Penyaluran dibuka kembali bila jam kembali diisi (bisa saat progress), wajib saat selesai.
  const bukaKembali = hentiAktif && (!!jamKembali || statusBaru === 'selesai')
  const kembali = jamKembali || waktuLokal()

  const simpanTL = async () => {
    if (!catatan.trim()) return setError('Tulis catatan tindak lanjut.')
    if (statusBaru === 'selesai' && d.status !== 'selesai' && catatan.trim().length < 10) return setError('Jelaskan penyelesaiannya (minimal 10 karakter).')
    if (bukaKembali && !jamKembali) return setError('Isi jam penyaluran kembali.')
    if (bukaKembali && kembali < d.henti!.mulai) return setError('Jam penyaluran kembali tidak boleh sebelum penyaluran dihentikan.')
    if (bukaKembali && kembali > waktuLokal()) return setError('Jam penyaluran kembali tidak boleh di masa depan.')
    setBusy(true)
    try {
      const oleh = app.displayName === 'Mode lokal' ? app.settings.namaPengawasDefault || 'Pengawas' : app.displayName
      const foto: Photo[] = []
      for (const [i, f] of tlFoto.entries()) foto.push(await app.backend.uploadPhoto(`daily-${rec.id}`, f.blob, `tindak-lanjut-${i + 1}.jpg`))
      const ba: Photo[] = []
      for (const f of tlBa) ba.push(await app.backend.uploadPhoto(`daily-${rec.id}`, f.blob, f.nama))
      const data: InsidenData = {
        ...d,
        status: statusBaru,
        pic: pic.trim() || d.pic,
        targetSelesai: target || d.targetSelesai,
        riwayat: [
          ...d.riwayat,
          {
            at: isoNow(),
            oleh,
            status: statusBaru,
            catatan: `${catatan.trim()}${bukaKembali ? ` (penyaluran ${d.henti!.produk.join(', ')} kembali ${labelWaktu(kembali, formatTanggalIso)}, berhenti ${durasiHenti({ ...d.henti!, selesai: kembali })})` : ''}`,
            ...(foto.length ? { foto } : {}),
            ...(ba.length ? { ba } : {}),
          },
        ],
        ...(bukaKembali ? { henti: { ...d.henti!, selesai: kembali } } : {}),
      }
      await app.saveDaily({ ...rec, data, updatedAt: stamp() })
      setCatatan('')
      setStatus('')
      setJamKembali('')
      ;[...tlFoto, ...tlBa].forEach((f) => URL.revokeObjectURL(f.url))
      setTlFoto([])
      setTlBa([])
      setError(null)
      setBuka(false)
      toast('Tindak lanjut tersimpan')
    } catch (e) {
      setError(pesan(e))
    } finally {
      setBusy(false)
    }
  }

  const bisaTL = bolehTL && d.status !== 'selesai'
  const aksiTL = { label: 'Tambah tindak lanjut', icon: Send, onClick: () => (setError(null), setBuka(true)) }
  const lampiran = (l: InsidenLangkah) =>
    !!(l.foto?.length || l.ba?.length) && (
      <div className="mt-1 flex flex-wrap gap-space-xs">
        {(l.foto ?? []).map((p) =>
          srcOf(p) ? (
            <a key={p.id} href={srcOf(p)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              <img src={srcOf(p)} alt="Foto tindak lanjut" className="size-16 rounded-md object-cover" />
            </a>
          ) : (
            <span key={p.id} className="size-16 animate-pulse rounded-md bg-surface-container" />
          ),
        )}
        {(l.ba ?? []).map((p) => (
          <a key={p.id} href={srcOf(p)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex h-16 items-center gap-1.5 rounded-md bg-primary/10 px-space-sm font-semibold text-primary">
            <FileText aria-hidden="true" className="size-4" />
            <span className="max-w-36 truncate">{p.name || 'Berita acara'}</span>
          </a>
        ))}
      </div>
    )
  // Laporan lama tanpa catatan awal: tahap "dilaporkan" dibuat dari data laporan.
  const riwayat: InsidenLangkah[] = d.riwayat.length ? d.riwayat : [{ at: `${rec.tanggal}T${d.jam || '00:00'}`, oleh: d.pelapor, status: 'terbuka', catatan: 'Laporan dibuat' }]
  const akhir = riwayat.length - 1
  const langkah: Langkah[] = [
    ...riwayat.map((l, i): Langkah => ({
      key: `${l.at}_${i}`,
      judul: i === 0 ? (d.jenis === 'henti' ? 'Stop penyaluran dilaporkan' : `${jenisLabel(d.jenis)} dilaporkan`) : l.status === 'selesai' ? 'Selesai' : l.status === 'terbuka' ? 'Dibuka kembali' : 'Tindak lanjut',
      waktu: l.at,
      oleh: l.oleh || '-',
      tag: statusMeta(l.status).label,
      nada: i === akhir && bisaTL ? 'aktif' : 'selesai',
      isi: (
        <>
          <span className="whitespace-pre-line text-on-surface">{l.catatan}</span>
          {lampiran(l)}
        </>
      ),
      aksi: i === akhir && bisaTL ? aksiTL : undefined,
    })),
    ...(d.status !== 'selesai'
      ? [
          {
            key: 'selesai',
            judul: 'Selesai / closing',
            nada: 'nanti' as const,
            kosong: d.targetSelesai ? `Target ${formatTanggalIso(d.targetSelesai)}` : 'Belum',
            isi: d.pic ? <span>PIC {d.pic}</span> : undefined,
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className={cn('animate-entrance-1 flex flex-col gap-space-sm p-space-md', d.jenis === 'insiden' && 'ring-1 ring-error/40')}>
        <TandaRevisi dari={rec} />
        <div className="flex items-start gap-space-sm">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className={cn('text-tag uppercase', d.jenis === 'henti' ? 'text-error' : 'text-primary')}>{d.jenis === 'henti' ? `${JENIS_HENTI.label} · alasan` : jenisLabel(d.jenis)}</span>
            <span className="text-headline-md font-bold text-on-surface">{d.kategori}</span>
            <span className="tabular text-body-sm text-on-surface-variant">
              {formatTanggalIso(rec.tanggal)} {d.jam}, {d.lokasi}
              {d.aset ? `, ${d.aset}` : ''}
            </span>
          </div>
          <StatusPill s={d.status} />
        </div>
        <span className={cn('text-body-sm font-semibold capitalize', tingkatTone(d.tingkat))}>Risiko {d.tingkat}</span>
        {d.henti && <HentiInfo h={d.henti} />}
        <dl className="flex flex-col gap-space-xs text-body-sm">
          <Item label="Uraian" value={d.uraian} />
          {d.dampak && <Item label="Dampak / korban" value={d.dampak} />}
          {d.penyebab && <Item label="Dugaan penyebab" value={d.penyebab} />}
          <Item label="Tindakan yang sudah dilakukan" value={d.tindakanSegera} />
          <Item label="Pelapor" value={d.pelapor} />
          {(d.pic || d.targetSelesai) && <Item label="PIC & target" value={`${d.pic || '-'}${d.targetSelesai ? `, target ${formatTanggalIso(d.targetSelesai)}` : ''}`} />}
        </dl>
        {d.foto.length > 0 && (
          <div className="flex gap-space-xs overflow-x-auto">
            {d.foto.map((p) => {
              const src = srcOf(p)
              return src ? (
                <a key={p.id} href={src} target="_blank" rel="noreferrer" className="shrink-0">
                  <img src={src} alt="Foto kejadian" className="size-24 rounded-md object-cover" />
                </a>
              ) : (
                <span key={p.id} className="size-24 shrink-0 animate-pulse rounded-md bg-surface-container" />
              )
            })}
          </div>
        )}
      </GlassCard>

      {(d.video ?? []).map((v) =>
        srcOf(v) ? <video key={v.id} src={srcOf(v)} controls playsInline aria-label="Video kejadian" className="animate-entrance-1 max-h-80 w-full rounded-md bg-black" /> : null,
      )}
      {/* Pelaporan & tindak lanjut sebagai stepper; tahap terbaru diketuk untuk membuka form tindak lanjut. */}
      <GlassCard level={2} className="animate-entrance-2 flex flex-col p-space-md">
        <Stepper judul="Pelaporan & tindak lanjut" langkah={langkah} />
      </GlassCard>

      <Sheet
        open={buka}
        onOpenChange={setBuka}
        title="Tambah tindak lanjut"
        description={`Status saat ini: ${statusMeta(d.status).label}`}
        footer={
          <div className="flex flex-col gap-space-xs">
            <ErrorBox text={error} />
            <Button size="lg" disabled={busy} onClick={simpanTL}>
              {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
              Simpan tindak lanjut
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-space-sm pb-space-sm">
            <Field label="Status">
              <Choice label="Status tindak lanjut" value={statusBaru} onChange={(v) => setStatus(v)} options={STATUS_INSIDEN.map((x) => ({ value: x.value, label: x.label }))} />
            </Field>
            <div className="grid grid-cols-2 gap-space-sm">
              <Field label="PIC" htmlFor="ins-pic">
                <Input id="ins-pic" autoComplete="off" placeholder={d.pic || 'Nama penanggung jawab'} value={pic} onChange={(e) => setPic(e.target.value)} />
              </Field>
              <Field label="Target selesai" htmlFor="ins-target">
                <Input id="ins-target" type="date" value={target || d.targetSelesai} onChange={(e) => setTarget(e.target.value)} />
              </Field>
            </div>
            <Field label="Catatan" htmlFor="ins-catatan">
              <Textarea id="ins-catatan" className="min-h-[64px]" value={catatan} onChange={(e) => (setError(null), setCatatan(e.target.value))} />
            </Field>
            <FotoWajib
              label="Foto tindak lanjut"
              hint="Kondisi setelah ditangani, perbaikan, atau penggantian komponen (maks. 4)."
              wajib={false}
              kamera={false}
              fotos={tlFoto}
              busy={olahFoto}
              disabled={busy}
              onAdd={(files) => {
                setOlahFoto(true)
                void (async () => {
                  try {
                    const baru: FotoLokal[] = []
                    for (const f of files.slice(0, 4 - tlFoto.length)) {
                      const blob = await compressImage(f)
                      baru.push({ id: genId('f'), blob, url: URL.createObjectURL(blob) })
                    }
                    setTlFoto((x) => [...x, ...baru].slice(0, 4))
                  } catch (e) {
                    setError(`Gagal memproses foto: ${pesan(e)}`)
                  } finally {
                    setOlahFoto(false)
                  }
                })()
              }}
              onRemove={(fid) => setTlFoto((x) => x.filter((f) => f.id !== fid))}
            />
            <div className="flex flex-col gap-space-xs">
              <span className="text-tag uppercase text-on-surface-variant">Berita acara / dokumen (opsional)</span>
              <span className="text-body-sm text-on-surface-variant">BA perbaikan, BA serah terima, laporan vendor: PDF (maks. 8 MB) atau foto dokumen.</span>
              {tlBa.map((f) => (
                <span key={f.id} className="flex items-center gap-space-xs rounded-md bg-surface-container-low px-space-sm py-space-xs text-body-sm">
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate">{f.nama}</span>
                  <button type="button" aria-label={`Hapus ${f.nama}`} onClick={() => setTlBa((x) => x.filter((y) => y.id !== f.id))} className="flex size-8 items-center justify-center rounded-full text-on-surface-variant">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </span>
              ))}
              <input
                ref={baRef}
                type="file"
                accept="application/pdf,image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = [...(e.target.files ?? [])]
                  e.target.value = ''
                  void (async () => {
                    const baru: (FotoLokal & { nama: string; pdf: boolean })[] = []
                    for (const f of files.slice(0, 3 - tlBa.length)) {
                      const pdf = f.type === 'application/pdf'
                      if (pdf && f.size > 8 * 1024 * 1024) {
                        setError(`${f.name} lebih dari 8 MB.`)
                        continue
                      }
                      const blob = pdf ? f : await compressImage(f)
                      baru.push({ id: genId('b'), blob, url: URL.createObjectURL(blob), nama: f.name || (pdf ? 'berita-acara.pdf' : 'berita-acara.jpg'), pdf })
                    }
                    setTlBa((x) => [...x, ...baru].slice(0, 3))
                  })()
                }}
              />
              <Button variant="soft" className="self-start" disabled={busy || tlBa.length >= 3} onClick={() => baRef.current?.click()}>
                <Paperclip aria-hidden="true" />
                Lampirkan berita acara
              </Button>
            </div>
            {hentiAktif && (
              <div className={cn('flex flex-col gap-space-sm rounded-md p-space-sm', jamKembali ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'bg-error-container/50')}>
                <span className="text-body-sm font-semibold text-on-surface">
                  Penyaluran {d.henti!.produk.join(', ')} masih berhenti sejak {labelWaktu(d.henti!.mulai, formatTanggalIso)}
                </span>
                <Field
                  label={statusBaru === 'selesai' ? 'Jam penyaluran kembali (wajib)' : 'Jam penyaluran kembali (isi bila sudah disalurkan lagi)'}
                  htmlFor="ins-kembali"
                >
                  <Input id="ins-kembali" type="datetime-local" min={d.henti!.mulai} max={waktuLokal()} value={jamKembali} onChange={(e) => (setError(null), setJamKembali(e.target.value))} />
                </Field>
                <div className="flex flex-wrap items-center gap-space-xs">
                  <Button variant="soft" size="sm" onClick={() => (setError(null), setJamKembali(waktuLokal()))}>
                    Isi waktu sekarang
                  </Button>
                  {jamKembali && (
                    <Button variant="ghost" size="sm" onClick={() => setJamKembali('')}>
                      Kosongkan
                    </Button>
                  )}
                </div>
                <span className="tabular text-body-sm text-on-surface-variant">
                  {jamKembali && jamKembali >= d.henti!.mulai
                    ? `Penyaluran kembali ${labelWaktu(jamKembali, formatTanggalIso)} · lama berhenti ${durasiHenti({ ...d.henti!, selesai: jamKembali })}`
                    : statusBaru === 'selesai'
                      ? 'Laporan selesai: isi jam penyaluran kembali.'
                      : 'Biarkan kosong bila penyaluran masih berhenti; laporan tetap dapat ditindaklanjuti.'}
                </span>
              </div>
            )}
        </div>
      </Sheet>
    </div>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="whitespace-pre-line text-on-surface">{value}</dd>
    </div>
  )
}

type RowHenti = { r: InsidenRecord; h: HentiPenyaluran }
const COLS_HENTI: Col<RowHenti>[] = [
  { header: 'Produk', cell: (x) => <span className="font-semibold">{x.h.produk.join(', ')}</span>, mobile: 'title' },
  { header: 'Mulai berhenti', cell: (x) => <span className="tabular whitespace-nowrap">{labelWaktu(x.h.mulai, formatTanggalIso)}</span>, mobileCell: (x) => `${labelWaktu(x.h.mulai, formatTanggalIso)} – ${x.h.selesai ? labelWaktu(x.h.selesai, formatTanggalIso) : 'sekarang'}`, mobile: 'sub' },
  { header: 'Dibuka kembali', cell: (x) => <span className="tabular whitespace-nowrap">{x.h.selesai ? labelWaktu(x.h.selesai, formatTanggalIso) : <b className="text-error">Masih berhenti</b>}</span>, mobile: 'hide' },
  { header: 'Lama', cell: (x) => <span className="tabular whitespace-nowrap">{durasiHenti(x.h)}</span>, mobile: 'sub' },
  { header: 'Alasan', cell: (x) => `${x.r.data.kategori}${x.r.data.aset ? `, ${x.r.data.aset}` : ''}`, mobile: 'sub' },
  { header: 'Uraian', cell: (x) => <span className="line-clamp-2">{x.r.data.uraian}</span>, mobile: 'hide' },
  { header: 'Status', cell: (x) => (x.h.selesai ? <Pill tone="success">Normal</Pill> : <Pill tone="error">Berhenti</Pill>), mobile: 'badge' },
]

/** Report > Riwayat Stop Penyaluran: dari laporan stop penyaluran (dan laporan kerusakan lama yang memuat pemberhentian). */
export function RiwayatHenti() {
  const app = useApp()
  useSyncOnOpen()
  const [range, setRange] = useDateRange('month')
  const semua = useInsiden()
  if (!app.loaded) return <Loading />
  const all: RowHenti[] = semua
    .filter((r): r is InsidenRecord & { data: { henti: HentiPenyaluran } } => !!r.data.henti)
    .map((r) => ({ r, h: r.data.henti! }))
    .sort((a, b) => b.h.mulai.localeCompare(a.h.mulai))
  const aktif = all.filter((x) => !x.h.selesai)
  const rows = all.filter((x) => !x.h.selesai || inRange(x.h.mulai.slice(0, 10), range))
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        {aktif.length ? (
          aktif.map((x) => (
            <Link key={x.r.id} to={`/laporan/insiden/${encodeURIComponent(x.r.id)}`}>
              <HentiInfo h={x.h} />
            </Link>
          ))
        ) : (
          <span className="text-body-md font-semibold text-on-surface">Semua produk tersalurkan normal</span>
        )}
        <span className="text-body-sm text-on-surface-variant">Dicatat dari laporan Stop Penyaluran dan berakhir pada jam penyaluran kembali yang diisi saat tindak lanjut / closing.</span>
        <div className="grid grid-cols-2 gap-space-sm">
          <Link to="/stop-penyaluran/baru" className={buttonVariants({ size: 'sm' })}>
            <Plus aria-hidden="true" />
            Laporkan stop
          </Link>
          <Link to="/stop-penyaluran" className={buttonVariants({ size: 'sm', variant: 'glass' })}>
            Dashboard
          </Link>
        </div>
        <DateFilter id="henti-range" value={range} onChange={setRange} />
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable
          title="Stop Penyaluran"
          rows={rows}
          total={all.length}
          cols={COLS_HENTI}
          rowKey={(x) => x.r.id}
          to={(x) => `/laporan/insiden/${encodeURIComponent(x.r.id)}`}
          rowClass={(x) => (!x.h.selesai ? BARIS_ORANYE : undefined)}
          empty="Belum ada pemberhentian penyaluran pada rentang ini."
        />
      </div>
    </div>
  )
}
