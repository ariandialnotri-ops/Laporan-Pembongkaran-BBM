import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { LoaderCircle, Plus, Send, ShieldAlert } from 'lucide-react'
import { BannerTerkirim } from '@/components/bongkaran/banner-terkirim'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { DateFilter, inRange, useDateRange } from '@/components/bongkaran/date-filter'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { PhotoSlot } from '@/components/bongkaran/photo-slot'
import { BARIS_BARU, BARIS_ORANYE, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { DEFAULT_AREAS, lokasiOptions } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { InsidenRecord } from '@/lib/daily'
import { formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { compressImage, genId } from '@/lib/image'
import {
  JENIS_INSIDEN,
  jenisLabel,
  KATEGORI_INSIDEN,
  STATUS_INSIDEN,
  statusMeta,
  TINGKAT_INSIDEN,
  type InsidenData,
  type JenisInsiden,
  type StatusInsiden,
  type TingkatInsiden,
} from '@/lib/insiden'
import { shiftKey } from '@/lib/shift'
import type { Photo } from '@/lib/sop'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const stamp = () => Date.now()
const isoNow = () => new Date().toISOString()

function useInsiden() {
  const app = useApp()
  return useMemo(() => app.daily.filter((d): d is InsidenRecord => d.kind === 'insiden'), [app.daily])
}

function StatusPill({ s }: { s: StatusInsiden }) {
  const m = statusMeta(s)
  return <Pill tone={m.tone}>{m.label}</Pill>
}

const tingkatTone = (t: TingkatInsiden) => (t === 'tinggi' ? 'text-error' : t === 'sedang' ? 'text-amber-700' : 'text-on-surface-variant')

/** Input > Pelaporan Insiden: form satu laporan insiden / near miss / kerusakan. Kirim lalu ke riwayat. */
export function InsidenBaru() {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [id] = useState(() => genId('insiden'))
  const [tanggal, setTanggal] = useState(() => todayIso())
  const [d, setD] = useState<InsidenData>(() => ({
    jenis: 'nearmiss',
    kategori: KATEGORI_INSIDEN.nearmiss[0],
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
  const [dirty, setDirty] = useState(false)
  const srcOf = usePhotoSrc(d.foto)
  const guard = useLeaveGuard({ active: dirty, title: 'Keluar tanpa mengirim laporan?', detail: 'Isian laporan kejadian ini belum dikirim.' })
  if (!app.loaded) return <Loading />

  const s = app.settings
  const lokasi = [...lokasiOptions(s.jumlahPulau ?? 0, s.aparArea ?? DEFAULT_AREAS), 'Area lain']
  const aset = [...(s.dispensers ?? []).map((x) => x.nama), ...(s.nozzles ?? []).map((x) => x.nama), 'Tangki pendam', 'ATG', 'Genset', 'Kanopi', 'Kendaraan pelanggan']
  const set = (p: Partial<InsidenData>) => {
    setError(null)
    setDirty(true)
    setD((x) => ({ ...x, ...p }))
  }
  const fotoWajib = d.jenis !== 'nearmiss'

  const tambahFoto = async (files: File[]) => {
    setBusy('foto')
    try {
      const baru: Photo[] = []
      for (const f of files) baru.push(await app.backend.uploadPhoto(`daily-${id}`, await compressImage(f), 'kejadian.jpg'))
      setDirty(true)
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
    if (fotoWajib && !d.foto.length) return setError('Foto kejadian wajib diunggah.')
    if (!d.pelapor.trim()) return setError('Isi nama pelapor.')
    setBusy('kirim')
    try {
      const shift = shiftKey(tanggal, d.jam)?.shift ?? 1
      const data: InsidenData = { ...d, pelapor: d.pelapor.trim(), riwayat: [{ at: isoNow(), oleh: d.pelapor.trim(), status: 'terbuka', catatan: 'Laporan dibuat' }] }
      await app.saveDaily({ id, kind: 'insiden', tanggal, shift, data, createdAt: stamp(), updatedAt: stamp(), createdBy: app.session.user?.id ?? null })
      guard.bypass()
      toast(`Laporan ${jenisLabel(d.jenis).toLowerCase()} terkirim`)
      navigate(`/laporan/insiden?baru=${encodeURIComponent(id)}`)
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="text-tag uppercase text-primary">Jenis kejadian</span>
        <div role="radiogroup" aria-label="Jenis kejadian" className="grid grid-cols-1 gap-space-xs sm:grid-cols-3">
          {JENIS_INSIDEN.map((j) => {
            const on = d.jenis === j.value
            return (
              <button
                key={j.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ jenis: j.value, kategori: KATEGORI_INSIDEN[j.value][0] })}
                className={cn('flex min-h-14 flex-col items-start justify-center rounded-md px-space-sm py-space-xs text-left', on ? 'bg-primary text-on-primary' : 'inset-field text-on-surface')}
              >
                <span className="text-body-md font-bold">{j.label}</span>
                <span className={cn('text-body-sm', on ? 'text-on-primary' : 'text-on-surface-variant')}>{j.desc}</span>
              </button>
            )
          })}
        </div>
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
            <Input id="ins-tgl" type="date" max={todayIso()} value={tanggal} onChange={(e) => (setDirty(true), setTanggal(e.target.value))} />
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
  { header: 'Risiko', cell: (x) => <span className={cn('font-semibold capitalize', tingkatTone(x.r.data.tingkat))}>{x.r.data.tingkat}</span>, mobile: 'hide' },
  { header: 'Pelapor', cell: (x) => x.r.data.pelapor || '-', mobile: 'hide' },
  { header: 'Status', cell: (x) => <StatusPill s={x.r.data.status} />, mobile: 'badge' },
]

/** Laporan > Riwayat Insiden, Near miss & Kerusakan. */
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

  const all = [...semua].sort((a, b) => (b.tanggal + b.data.jam).localeCompare(a.tanggal + a.data.jam))
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
          title="Insiden, Near miss & Kerusakan"
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
  const srcOf = usePhotoSrc(rec?.data.foto ?? [])
  const [status, setStatus] = useState<StatusInsiden | ''>('')
  const [pic, setPic] = useState('')
  const [target, setTarget] = useState('')
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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
  const bolehTL = app.role !== 'security'
  const statusBaru = status || d.status

  const simpanTL = async () => {
    if (!catatan.trim()) return setError('Tulis catatan tindak lanjut.')
    if (statusBaru === 'selesai' && d.status !== 'selesai' && catatan.trim().length < 10) return setError('Jelaskan penyelesaiannya (minimal 10 karakter).')
    setBusy(true)
    try {
      const oleh = app.displayName === 'Mode lokal' ? app.settings.namaPengawasDefault || 'Pengawas' : app.displayName
      const data: InsidenData = {
        ...d,
        status: statusBaru,
        pic: pic.trim() || d.pic,
        targetSelesai: target || d.targetSelesai,
        riwayat: [...d.riwayat, { at: isoNow(), oleh, status: statusBaru, catatan: catatan.trim() }],
      }
      await app.saveDaily({ ...rec, data, updatedAt: stamp() })
      setCatatan('')
      setStatus('')
      setError(null)
      toast('Tindak lanjut tersimpan')
    } catch (e) {
      setError(pesan(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className={cn('animate-entrance-1 flex flex-col gap-space-sm p-space-md', d.jenis === 'insiden' && 'ring-1 ring-error/40')}>
        <div className="flex items-start gap-space-sm">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-tag uppercase text-primary">{jenisLabel(d.jenis)}</span>
            <span className="text-headline-md font-bold text-on-surface">{d.kategori}</span>
            <span className="tabular text-body-sm text-on-surface-variant">
              {formatTanggalIso(rec.tanggal)} {d.jam}, {d.lokasi}
              {d.aset ? `, ${d.aset}` : ''}
            </span>
          </div>
          <StatusPill s={d.status} />
        </div>
        <span className={cn('text-body-sm font-semibold capitalize', tingkatTone(d.tingkat))}>Risiko {d.tingkat}</span>
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

      <section aria-labelledby="ins-riwayat" className="animate-entrance-2 flex flex-col gap-space-xs">
        <SectionHeader id="ins-riwayat" title="Tindak lanjut" />
        <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
          {[...d.riwayat].reverse().map((l, i) => (
            <div key={`${l.at}_${i}`} className="flex flex-col gap-0.5 px-space-sm py-space-xs text-body-sm">
              <span className="flex items-center justify-between gap-space-xs">
                <span className="tabular text-on-surface-variant">
                  {formatTanggalIso(l.at.slice(0, 10))} {new Date(l.at).toTimeString().slice(0, 5)}, {l.oleh || '-'}
                </span>
                <StatusPill s={l.status} />
              </span>
              <span className="text-on-surface">{l.catatan}</span>
            </div>
          ))}
        </GlassCard>
      </section>

      {bolehTL && d.status !== 'selesai' && (
        <GlassCard level={2} className="animate-entrance-3 flex flex-col gap-space-sm p-space-md">
          <span className="text-tag uppercase text-primary">Tambah tindak lanjut</span>
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
          <ErrorBox text={error} />
          <Button size="lg" disabled={busy} onClick={simpanTL}>
            <Send aria-hidden="true" />
            Simpan tindak lanjut
          </Button>
        </GlassCard>
      )}
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
