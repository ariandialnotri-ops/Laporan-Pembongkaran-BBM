import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronRight, ClipboardList, FilePlus2, LoaderCircle, PiggyBank, ReceiptText, Send, Trash2, X } from 'lucide-react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Field } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { MenuCard } from '@/components/bongkaran/menu-card'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { COA, coaByNo } from '@/lib/coa'
import { formatBulanTahun, formatTanggalIso, todayIso } from '@/lib/date'
import { parseAngka } from '@/lib/format'
import { compressImage, genId } from '@/lib/image'
import { labelStatus, nomorPetty, pettyId, rekapCoa, rupiah, type PettyRecord, type StatusPetty, type Tanda } from '@/lib/petty'
import type { Photo } from '@/lib/sop'
import { useKeTerkirim } from '@/lib/terkirim'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const akhirBulan = (bulan: string) => todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0))
const NADA: Record<string, 'neutral' | 'primary' | 'success' | 'error' | 'cyan' | 'info'> = {
  'Menunggu Admin': 'cyan',
  'Menunggu ABH': 'primary',
  Disetujui: 'success',
  Terealisasi: 'success',
  Ditolak: 'error',
}

/** Pengajuan petty cash pada rentang tanggal; dimuat ulang saat SPBU/rentang berubah. */
function usePetty(from: string, to: string) {
  const app = useApp()
  const kunci = `${app.spbuId}|${from}|${to}`
  const [hasil, setHasil] = useState<{ kunci: string; recs: PettyRecord[]; error: string | null } | null>(null)
  const muat = useCallback(
    () =>
      app.backend.listPetty(from, to).then(
        (recs) => setHasil({ kunci, recs, error: null }),
        (e) => setHasil({ kunci, recs: [], error: pesan(e) }),
      ),
    [app.backend, from, to, kunci],
  )
  useEffect(() => {
    void muat()
  }, [muat])
  const kini = hasil?.kunci === kunci ? hasil : null
  return { recs: kini?.recs ?? null, error: kini?.error ?? null, muat }
}

/** Pengajuan dibuat pengguna ini (admin tidak menyetujui pengajuannya sendiri). */
const milikSendiri = (r: PettyRecord, uid: string | null) => !!uid && r.createdBy === uid
/** Pengajuan yang menunggu tindakan peran ini. */
const perluTindakan = (r: PettyRecord, role: string | null, uid: string | null) =>
  (r.status === 'Menunggu Admin' && (role === 'abh' || (role === 'admin' && !milikSendiri(r, uid)))) || (r.status === 'Menunggu ABH' && role === 'abh')

function Ringkas({ items }: { items: [string, string, boolean?][] }) {
  return (
    <div className="grid grid-cols-2 gap-space-xs">
      {items.map(([k, v, merah]) => (
        <div key={k} className={cn('rounded-md p-space-xs', merah ? 'bg-error-container' : 'bg-surface-container-low')}>
          <span className={cn('tabular block text-body-md font-bold', merah ? 'text-on-error-container' : 'text-on-surface')}>{v}</span>
          <span className="text-[11px] uppercase text-on-surface-variant">{k}</span>
        </div>
      ))}
    </div>
  )
}

/** Finance > Petty Cash: ringkasan bulan berjalan, sub menu pengajuan & realisasi, pengaturan plafon (ABH). */
export function PettyMenu() {
  const app = useApp()
  const toast = useToast()
  const bulan = todayIso().slice(0, 7)
  const { recs, error } = usePetty(`${bulan}-01`, akhirBulan(bulan))
  const [plafon, setPlafon] = useState<string | null>(null)
  if (!app.loaded) return <Loading />
  const s = app.settings
  const data = recs ?? []
  const disetujui = data.filter((r) => r.status === 'Disetujui')
  const anggaran = disetujui.reduce((n, r) => n + r.total, 0)
  const realisasi = disetujui.reduce((n, r) => n + (r.data.realisasi?.nominal ?? 0), 0)
  const tindakan = data.filter((r) => perluTindakan(r, app.role, app.session.user?.id ?? null)).length
  const belumReal = disetujui.filter((r) => !r.data.realisasi).length
  const plafonNilai = s.pettyPlafon ?? 0

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="text-tag uppercase text-primary">Petty cash · {formatBulanTahun(new Date(`${bulan}-01T00:00:00`))}</span>
        <Ringkas
          items={[
            ['Plafon bulan ini', plafonNilai ? rupiah(plafonNilai) : 'Belum diatur'],
            ['Anggaran disetujui', rupiah(anggaran), plafonNilai > 0 && anggaran > plafonNilai],
            ['Realisasi', rupiah(realisasi)],
            ['Sisa plafon', plafonNilai ? rupiah(plafonNilai - realisasi) : '-', plafonNilai > 0 && realisasi > plafonNilai],
          ]}
        />
        <span className="text-body-sm text-on-surface-variant">
          Setiap pengajuan wajib akun COA (daftar COA One Touch Solution). Persetujuan 1 Admin/Cashier, persetujuan akhir ABH; realisasi wajib foto nota.
        </span>
        <ErrorBox text={error} />
      </GlassCard>

      <nav aria-label="Menu Petty Cash" className="animate-entrance-2 grid grid-cols-2 gap-space-sm lg:grid-cols-3">
        <MenuCard
          index={0}
          m={{
            to: '/finance/petty/pengajuan',
            icon: FilePlus2,
            title: 'Pengajuan Pengadaan Barang/Jasa',
            desc: 'Ajukan dengan akun COA, disetujui Admin/Cashier lalu ABH',
            status: recs === null ? 'Memuat…' : tindakan ? `${tindakan} perlu persetujuan Anda` : `${data.length} pengajuan bulan ini`,
            badge: tindakan,
          }}
        />
        <MenuCard
          index={1}
          m={{
            to: '/finance/petty/realisasi',
            icon: ReceiptText,
            title: 'Realisasi Anggaran',
            desc: 'Catat realisasi + nota, rekap per COA',
            status: recs === null ? 'Memuat…' : belumReal ? `${belumReal} disetujui belum direalisasi` : 'Semua terealisasi',
            badge: belumReal,
          }}
        />
      </nav>

      {app.role === 'abh' && (
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          <SectionHeader id="petty-atur" title="Pengaturan petty cash (ABH)" />
          <Field label="Plafon per bulan (Rp)" htmlFor="petty-plafon">
            <Input id="petty-plafon" numeric inputMode="numeric" placeholder="0 = tanpa plafon" value={plafon ?? (plafonNilai ? String(plafonNilai) : '')} onChange={(e) => setPlafon(e.target.value)} />
          </Field>
          <Button
            variant="glass"
            disabled={plafon === null}
            onClick={() => {
              app.updateSettings({ pettyPlafon: plafon === null ? plafonNilai : (parseAngka(plafon) ?? 0) })
              setPlafon(null)
              toast('Pengaturan petty cash disimpan')
            }}
          >
            Simpan pengaturan
          </Button>
        </GlassCard>
      )}
    </div>
  )
}

type Saring = 'semua' | 'tindakan' | 'menunggu' | 'Disetujui' | 'Ditolak'

function KartuPengajuan({ r }: { r: PettyRecord }) {
  const st = labelStatus(r)
  return (
    <Link to={`/finance/petty/pengajuan/${encodeURIComponent(r.id)}`} className="flex items-center gap-space-sm px-space-md py-space-sm active:bg-surface-container-low">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="tabular text-tag uppercase text-on-surface-variant">
          {r.no} · {formatTanggalIso(r.tanggal)}
        </span>
        <span className="truncate text-body-md font-semibold text-on-surface">{r.data.uraian}</span>
        <span className="truncate text-body-sm text-on-surface-variant">
          {r.data.coa.activity} · {r.data.diajukanNama}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="tabular text-body-sm font-bold text-on-surface">{rupiah(r.total)}</span>
        <Pill tone={NADA[st] ?? 'neutral'}>{st}</Pill>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
    </Link>
  )
}

/** Petty Cash > Pengajuan Pengadaan Barang/Jasa: daftar per bulan + ajukan baru. */
export function PengajuanPetty() {
  const app = useApp()
  const [bulan, setBulan] = useState(todayIso().slice(0, 7))
  const [saring, setSaring] = useState<Saring>('semua')
  const { recs, error } = usePetty(`${bulan}-01`, akhirBulan(bulan))
  if (!app.loaded) return <Loading />
  const uid = app.session.user?.id ?? null
  const data = recs ?? []
  const tampil = data.filter((r) =>
    saring === 'semua' ? true : saring === 'tindakan' ? perluTindakan(r, app.role, uid) : saring === 'menunggu' ? r.status.startsWith('Menunggu') : r.status === saring,
  )
  const nTindakan = data.filter((r) => perluTindakan(r, app.role, uid)).length
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <Link to="/finance/petty/pengajuan/baru" className={buttonVariants({ size: 'lg' })}>
          <FilePlus2 aria-hidden="true" />
          Ajukan pengadaan barang/jasa
        </Link>
        <Field label="Bulan" htmlFor="pp-bulan">
          <Input id="pp-bulan" type="month" max={todayIso().slice(0, 7)} value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
        </Field>
        <ChipFilter
          label="Saring status"
          value={saring}
          onChange={setSaring}
          options={[
            { value: 'semua' as const, label: `Semua ${data.length}` },
            ...(app.role === 'abh' || app.role === 'admin' ? [{ value: 'tindakan' as const, label: `Perlu tindakan ${nTindakan}` }] : []),
            { value: 'menunggu' as const, label: 'Menunggu' },
            { value: 'Disetujui' as const, label: 'Disetujui' },
            { value: 'Ditolak' as const, label: 'Ditolak' },
          ]}
        />
        <ErrorBox text={error} />
      </GlassCard>
      {recs === null ? (
        <Loading />
      ) : !tampil.length ? (
        <GlassCard level={1} className="p-space-md text-center text-body-md text-on-surface-variant">
          Tidak ada pengajuan.
        </GlassCard>
      ) : (
        <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
          {tampil.map((r) => (
            <KartuPengajuan key={r.id} r={r} />
          ))}
        </GlassCard>
      )}
    </div>
  )
}

/** Form pengajuan pengadaan barang/jasa (halaman tersendiri). */
export function PengajuanPettyForm() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const [coa, setCoa] = useState('')
  const [uraian, setUraian] = useState('')
  const [qty, setQty] = useState('1')
  const [satuan, setSatuan] = useState('pcs')
  const [harga, setHarga] = useState('')
  const [vendor, setVendor] = useState('')
  const [alasan, setAlasan] = useState('')
  const [lampiran, setLampiran] = useState<FotoLokal[]>([])
  const [busy, setBusy] = useState<'foto' | 'kirim' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari pengajuan?', detail: 'Pengajuan yang belum dikirim akan hilang.' })
  if (!app.loaded) return <Loading />
  if (!['abh', 'admin', 'pengawas', 'kashift'].includes(app.role ?? '')) return <GlassCard className="p-space-md">Pengajuan petty cash diisi kepala shift, pengawas, Admin/Cashier, atau ABH.</GlassCard>
  const akun = coaByNo(coa)
  const nQty = parseAngka(qty) ?? 0
  const nHarga = parseAngka(harga) ?? 0
  const total = Math.round(nQty * nHarga)
  const set = (f: (v: string) => void) => (v: string) => {
    setError(null)
    f(v)
  }

  const kirim = async () => {
    if (!akun) return setError('Pilih akun COA.')
    if (uraian.trim().length < 3) return setError('Isi barang/jasa yang diadakan.')
    if (nQty <= 0) return setError('Isi jumlah.')
    if (nHarga <= 0) return setError('Isi harga satuan.')
    if (alasan.trim().length < 5) return setError('Isi keperluan / alasan pengadaan.')
    setBusy('kirim')
    try {
      const id = pettyId()
      const tanggal = todayIso()
      const foto: Photo[] = []
      for (const [i, f] of lampiran.entries()) foto.push(await app.backend.uploadPhoto(`petty-${id}`, f.blob, `lampiran-${i + 1}.jpg`))
      const bulanIni = await app.backend.listPetty(`${tanggal.slice(0, 7)}-01`, akhirBulan(tanggal.slice(0, 7)))
      const base: PettyRecord = {
        id,
        no: '',
        tanggal,
        status: 'Menunggu Admin',
        total,
        createdAt: Date.now(),
        createdBy: app.session.user?.id ?? null,
        data: {
          coa: { accountNo: akun.accountNo, activity: akun.activity, sapAccount: akun.sapAccount, coaId: akun.coaId },
          uraian: uraian.trim(),
          qty: nQty,
          satuan: satuan.trim() || 'pcs',
          harga: nHarga,
          total,
          vendor: vendor.trim(),
          alasan: alasan.trim(),
          lampiran: foto,
          diajukanNama: app.displayName === 'Mode lokal' ? 'Pengaju' : app.displayName,
        },
      }
      // Nomor urut per bulan; bila bentrok (pengajuan bersamaan), coba nomor berikutnya.
      let rec: PettyRecord | null = null
      for (let k = 1; k <= 5 && !rec; k++) {
        try {
          rec = await app.backend.savePetty({ ...base, no: nomorPetty(tanggal, bulanIni.length + k) }, true)
        } catch (e) {
          if (!/duplicate|unique/i.test(pesan(e)) || k === 5) throw e
        }
      }
      guard.bypass()
      lampiran.forEach((f) => URL.revokeObjectURL(f.url))
      keTerkirim({
        judul: `Pengajuan ${rec!.no} terkirim`,
        detail: rec!.status === 'Disetujui' ? 'Disetujui (diajukan ABH).' : `Status: ${rec!.status}.`,
        baris: [
          ['Akun COA', `${akun.accountNo} · ${akun.activity}`],
          ['Barang/jasa', `${uraian.trim()} (${nQty} ${satuan})`],
          ['Total', rupiah(total)],
        ],
        aksi: [
          { to: `/finance/petty/pengajuan/${encodeURIComponent(rec!.id)}`, label: 'Lihat pengajuan' },
          { to: '/finance/petty/pengajuan', label: 'Daftar pengajuan' },
        ],
      })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <Field label="Akun COA (wajib)" htmlFor="pp-coa">
          <Select value={coa} onValueChange={set(setCoa)}>
            <SelectTrigger id="pp-coa">
              <SelectValue placeholder="Pilih akun COA" />
            </SelectTrigger>
            <SelectContent>
              {COA.map((c) => (
                <SelectItem key={c.accountNo} value={c.accountNo}>
                  {c.activity} · {c.accountNo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {akun && (
          <span className="rounded-md bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">
            <b className="text-on-surface">{akun.sapAccount}</b> · COA ID {akun.coaId}
            <br />
            {akun.description}
          </span>
        )}
        <Field label="Barang / jasa" htmlFor="pp-uraian">
          <Input id="pp-uraian" autoComplete="off" placeholder="Mis. Pasta air 2 tube, servis dispenser 2" value={uraian} onChange={(e) => set(setUraian)(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-space-sm">
          <Field label="Jumlah" htmlFor="pp-qty">
            <Input id="pp-qty" numeric inputMode="decimal" value={qty} onChange={(e) => set(setQty)(e.target.value)} />
          </Field>
          <Field label="Satuan" htmlFor="pp-satuan">
            <Input id="pp-satuan" autoComplete="off" value={satuan} onChange={(e) => set(setSatuan)(e.target.value)} />
          </Field>
          <Field label="Harga satuan (Rp)" htmlFor="pp-harga">
            <Input id="pp-harga" numeric inputMode="numeric" value={harga} onChange={(e) => set(setHarga)(e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-md bg-primary-fixed/50 px-space-sm py-space-xs">
          <span className="text-body-sm text-on-surface-variant">Total pengajuan</span>
          <span className="tabular text-headline-md font-bold text-on-surface">{rupiah(total)}</span>
        </div>
        <span className="text-body-sm text-on-surface-variant">Persetujuan 1 oleh Admin/Cashier, persetujuan akhir oleh ABH.</span>
        <Field label="Vendor / toko (opsional)" htmlFor="pp-vendor">
          <Input id="pp-vendor" autoComplete="off" value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </Field>
        <Field label="Keperluan / alasan" htmlFor="pp-alasan">
          <Textarea id="pp-alasan" className="min-h-[88px]" value={alasan} onChange={(e) => set(setAlasan)(e.target.value)} />
        </Field>
        <FotoWajib
          label="Lampiran (opsional)"
          hint="Foto penawaran, contoh barang, atau kerusakan yang akan diperbaiki."
          fotos={lampiran}
          busy={busy === 'foto'}
          disabled={busy === 'kirim'}
          wajib={false}
          kamera={false}
          onAdd={(files) => {
            setBusy('foto')
            void (async () => {
              try {
                const baru: FotoLokal[] = []
                for (const f of files.slice(0, 3 - lampiran.length)) {
                  const blob = await compressImage(f)
                  baru.push({ id: genId('f'), blob, url: URL.createObjectURL(blob) })
                }
                setLampiran((x) => [...x, ...baru].slice(0, 3))
              } catch (e) {
                setError(`Gagal memproses foto: ${pesan(e)}`)
              } finally {
                setBusy(null)
              }
            })()
          }}
          onRemove={(fid) =>
            setLampiran((x) => {
              const t = x.find((f) => f.id === fid)
              if (t) URL.revokeObjectURL(t.url)
              return x.filter((f) => f.id !== fid)
            })
          }
        />
        <ErrorBox text={error} />
        <Button size="lg" disabled={busy !== null} onClick={() => void kirim()}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {busy === 'kirim' ? 'Mengirim…' : 'Kirim pengajuan'}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

function useSatuPetty(id: string) {
  const app = useApp()
  // Rentang lebar: pengajuan dibuka dari tautan riwayat mana pun.
  const { recs, error, muat } = usePetty('2000-01-01', '2999-12-31')
  return { rec: recs?.find((r) => r.id === id) ?? null, loading: recs === null || !app.loaded, error, muat }
}

function Baris({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-space-sm py-1 text-body-sm">
      <span className="text-on-surface-variant">{k}</span>
      <span className="text-right font-semibold text-on-surface">{v}</span>
    </div>
  )
}

function FotoList({ fotos, alt }: { fotos: Photo[]; alt: string }) {
  const srcOf = usePhotoSrc(fotos)
  if (!fotos.length) return null
  return (
    <div className="flex flex-wrap gap-space-xs">
      {fotos.map((p) => {
        const src = srcOf(p)
        return src ? (
          <a key={p.id} href={src} target="_blank" rel="noreferrer">
            <img src={src} alt={alt} className="size-24 rounded-md object-cover" />
          </a>
        ) : (
          <span key={p.id} className="size-24 rounded-md bg-surface-container" />
        )
      })}
    </div>
  )
}

const tandaLabel = (t?: Tanda) => (t ? `${t.nama} · ${new Date(t.at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}${t.catatan ? ` · ${t.catatan}` : ''}` : '-')

/** Detail pengajuan + persetujuan 1 Admin/Cashier / persetujuan akhir ABH + hapus. */
export function PengajuanPettyDetail() {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const { rec, loading, error, muat } = useSatuPetty(id)
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  if (loading) return <Loading />
  if (!rec) return <GlassCard className="p-space-md">{error ?? 'Pengajuan tidak ditemukan.'}</GlassCard>
  const uid = app.session.user?.id ?? null
  const d = rec.data
  const st = labelStatus(rec)
  const bisaPeriksa = rec.status === 'Menunggu Admin' && (app.role === 'abh' || (app.role === 'admin' && !milikSendiri(rec, uid)))
  const bisaPutus = rec.status === 'Menunggu ABH' && app.role === 'abh'
  const bisaHapus = app.role === 'abh' || (rec.status === 'Menunggu Admin' && rec.createdBy === uid)
  const tanda = (): Tanda => ({ by: uid, nama: app.displayName, at: new Date().toISOString(), catatan: catatan.trim() })

  const putuskan = async (status: StatusPetty) => {
    if (status === 'Ditolak' && !catatan.trim()) return setErr('Isi alasan penolakan.')
    setBusy(status)
    setErr(null)
    try {
      // Persetujuan akhir ABH (tahap ABH, atau ABH langsung memutuskan); selain itu persetujuan 1 Admin/Cashier.
      const data = { ...rec.data, ...(app.role === 'abh' ? { keputusan: tanda() } : { review: tanda() }) }
      await app.backend.savePetty({ ...rec, status, data }, false)
      toast(status === 'Menunggu ABH' ? 'Disetujui, diteruskan ke ABH' : status === 'Disetujui' ? 'Pengajuan disetujui' : 'Pengajuan ditolak')
      setCatatan('')
      void muat()
    } catch (e) {
      setErr(pesan(e))
    } finally {
      setBusy(null)
    }
  }
  const hapus = async () => {
    if (!window.confirm(`Hapus pengajuan ${rec.no}?`)) return
    try {
      await app.backend.deletePetty(rec.id)
      for (const p of [...d.lampiran, ...(d.realisasi?.nota ?? [])]) void app.backend.deletePhoto(p).catch(() => {})
      toast('Pengajuan dihapus')
      navigate('/finance/petty/pengajuan', { replace: true })
    } catch (e) {
      setErr(pesan(e))
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <div className="flex items-start justify-between gap-space-sm">
          <span className="flex flex-col">
            <span className="tabular text-tag uppercase text-on-surface-variant">
              {rec.no} · {formatTanggalIso(rec.tanggal)}
            </span>
            <span className="text-headline-md font-bold text-on-surface">{d.uraian}</span>
          </span>
          <Pill tone={NADA[st] ?? 'neutral'}>{st}</Pill>
        </div>
        <span className="tabular text-headline-md font-bold text-primary">{rupiah(rec.total)}</span>
        <div className="divide-y divide-outline-variant/40">
          <Baris k="Akun COA" v={`${d.coa.accountNo} · ${d.coa.activity}`} />
          <Baris k="Akun SAP / COA ID" v={`${d.coa.sapAccount} · ${d.coa.coaId}`} />
          <Baris k="Jumlah" v={`${d.qty} ${d.satuan} × ${rupiah(d.harga)}`} />
          {d.vendor && <Baris k="Vendor" v={d.vendor} />}
          <Baris k="Keperluan" v={d.alasan} />
          <Baris k="Diajukan" v={d.diajukanNama} />
          <Baris k="Persetujuan 1 Admin/Cashier" v={tandaLabel(d.review)} />
          <Baris k="Persetujuan akhir ABH" v={tandaLabel(d.keputusan)} />
        </div>
        <FotoList fotos={d.lampiran} alt="Lampiran pengajuan" />
      </GlassCard>

      {(bisaPeriksa || bisaPutus) && (
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          <SectionHeader id="pp-tindak" title={bisaPutus || app.role === 'abh' ? 'Persetujuan akhir ABH' : 'Persetujuan 1 Admin/Cashier'} />
          <Field label="Catatan (wajib bila ditolak)" htmlFor="pp-catatan">
            <Input id="pp-catatan" autoComplete="off" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>
          <ErrorBox text={err} />
          <div className="grid grid-cols-2 gap-space-xs">
            {app.role === 'admin' ? (
              <Button disabled={!!busy} onClick={() => void putuskan('Menunggu ABH')}>
                <Check aria-hidden="true" />
                Setujui
              </Button>
            ) : (
              <Button disabled={!!busy} onClick={() => void putuskan('Disetujui')}>
                <Check aria-hidden="true" />
                Setujui
              </Button>
            )}
            <Button variant="danger" disabled={!!busy} onClick={() => void putuskan('Ditolak')}>
              <X aria-hidden="true" />
              Tolak
            </Button>
          </div>
          {app.role === 'admin' && <span className="text-body-sm text-on-surface-variant">Setelah disetujui, pengajuan diteruskan ke ABH untuk persetujuan akhir.</span>}
        </GlassCard>
      )}

      {rec.status === 'Disetujui' && (
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          <SectionHeader id="pp-real" title="Realisasi" />
          {d.realisasi ? (
            <>
              <div className="divide-y divide-outline-variant/40">
                <Baris k="Tanggal" v={formatTanggalIso(d.realisasi.tanggal)} />
                <Baris k="Nominal" v={rupiah(d.realisasi.nominal)} />
                <Baris k="Selisih dari pengajuan" v={rupiah(rec.total - d.realisasi.nominal)} />
                <Baris k="Dicatat" v={tandaLabel({ ...d.realisasi, catatan: d.realisasi.catatan })} />
              </div>
              <FotoList fotos={d.realisasi.nota} alt="Nota realisasi" />
            </>
          ) : (
            <Link to={`/finance/petty/realisasi/${encodeURIComponent(rec.id)}`} className={buttonVariants({ size: 'lg' })}>
              <ReceiptText aria-hidden="true" />
              Catat realisasi
            </Link>
          )}
        </GlassCard>
      )}

      {bisaHapus && (
        <Button variant="ghost" className="self-center text-error" onClick={() => void hapus()}>
          <Trash2 aria-hidden="true" />
          Hapus pengajuan
        </Button>
      )}
    </div>
  )
}

/** Petty Cash > Realisasi Anggaran: rekap per bulan & per COA, daftar yang menunggu realisasi. */
export function RealisasiPetty() {
  const app = useApp()
  const [bulan, setBulan] = useState(todayIso().slice(0, 7))
  const { recs, error } = usePetty(`${bulan}-01`, akhirBulan(bulan))
  const rekap = useMemo(() => rekapCoa(recs ?? []), [recs])
  if (!app.loaded) return <Loading />
  const disetujui = (recs ?? []).filter((r) => r.status === 'Disetujui')
  const anggaran = disetujui.reduce((n, r) => n + r.total, 0)
  const realisasi = disetujui.reduce((n, r) => n + (r.data.realisasi?.nominal ?? 0), 0)
  const plafon = app.settings.pettyPlafon ?? 0
  const menunggu = disetujui.filter((r) => !r.data.realisasi)
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <Field label="Bulan" htmlFor="rp-bulan">
          <Input id="rp-bulan" type="month" max={todayIso().slice(0, 7)} value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
        </Field>
        <Ringkas
          items={[
            ['Plafon', plafon ? rupiah(plafon) : 'Belum diatur'],
            ['Anggaran disetujui', rupiah(anggaran), plafon > 0 && anggaran > plafon],
            ['Realisasi', rupiah(realisasi)],
            ['Sisa anggaran', rupiah(anggaran - realisasi)],
          ]}
        />
        {plafon > 0 && (
          <div className="flex flex-col gap-1">
            <div className="h-2 overflow-hidden rounded-full bg-surface-container-high" role="img" aria-label={`Realisasi ${Math.round((realisasi / plafon) * 100)}% dari plafon`}>
              <div className={cn('h-full rounded-full', realisasi > plafon ? 'bg-error' : 'bg-primary')} style={{ width: `${Math.min(100, (realisasi / plafon) * 100)}%` }} />
            </div>
            <span className="text-body-sm text-on-surface-variant">Realisasi {Math.round((realisasi / plafon) * 100)}% dari plafon bulan ini</span>
          </div>
        )}
        <ErrorBox text={error} />
      </GlassCard>

      <section aria-labelledby="rp-tunggu" className="flex flex-col gap-space-sm">
        <SectionHeader id="rp-tunggu" title={`Menunggu realisasi (${menunggu.length})`} />
        {!menunggu.length ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Semua pengajuan yang disetujui sudah direalisasi.
          </GlassCard>
        ) : (
          <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
            {menunggu.map((r) => (
              <Link key={r.id} to={`/finance/petty/realisasi/${encodeURIComponent(r.id)}`} className="flex items-center gap-space-sm px-space-md py-space-sm active:bg-surface-container-low">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="tabular text-tag uppercase text-on-surface-variant">
                    {r.no} · {r.data.coa.activity}
                  </span>
                  <span className="truncate text-body-md font-semibold text-on-surface">{r.data.uraian}</span>
                </span>
                <span className="tabular shrink-0 text-body-sm font-bold text-on-surface">{rupiah(r.total)}</span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
              </Link>
            ))}
          </GlassCard>
        )}
      </section>

      <section aria-labelledby="rp-coa" className="flex flex-col gap-space-sm">
        <SectionHeader id="rp-coa" title="Realisasi per akun COA" />
        {!rekap.length ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Belum ada anggaran disetujui pada bulan ini.
          </GlassCard>
        ) : (
          <GlassCard level={2} className="overflow-x-auto p-0">
            <table className="w-full min-w-[520px] text-body-sm">
              <thead>
                <tr className="text-tag uppercase text-on-surface-variant">
                  <th className="px-space-sm py-space-xs text-left">Akun COA</th>
                  <th className="px-space-sm py-space-xs text-right">Anggaran</th>
                  <th className="px-space-sm py-space-xs text-right">Realisasi</th>
                  <th className="px-space-sm py-space-xs text-right">Selisih</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {rekap.map((x) => (
                  <tr key={x.coa.accountNo}>
                    <td className="px-space-sm py-space-xs">
                      <span className="block font-semibold text-on-surface">{x.coa.activity}</span>
                      <span className="tabular text-on-surface-variant">
                        {x.coa.accountNo} · {x.jumlah} pengajuan
                      </span>
                    </td>
                    <td className="tabular px-space-sm py-space-xs text-right">{rupiah(x.anggaran)}</td>
                    <td className="tabular px-space-sm py-space-xs text-right">{rupiah(x.realisasi)}</td>
                    <td className={cn('tabular px-space-sm py-space-xs text-right font-semibold', x.anggaran - x.realisasi < 0 && 'text-error')}>{rupiah(x.anggaran - x.realisasi)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlassCard>
        )}
      </section>

      <Link to="/finance/petty/pengajuan" className={buttonVariants({ variant: 'glass' })}>
        <ClipboardList aria-hidden="true" />
        Semua pengajuan
      </Link>
    </div>
  )
}

/** Form realisasi satu pengajuan yang disetujui: tanggal, nominal, nota wajib. */
export function RealisasiPettyForm() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const { id = '' } = useParams()
  const { rec, loading, error } = useSatuPetty(id)
  const [tanggal, setTanggal] = useState(todayIso())
  const [nominal, setNominal] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')
  const [nota, setNota] = useState<FotoLokal[]>([])
  const [busy, setBusy] = useState<'foto' | 'kirim' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari realisasi?', detail: 'Realisasi dan foto nota yang belum disimpan akan hilang.' })
  if (loading) return <Loading />
  if (!rec) return <GlassCard className="p-space-md">{error ?? 'Pengajuan tidak ditemukan.'}</GlassCard>
  if (rec.status !== 'Disetujui') return <GlassCard className="p-space-md">Realisasi hanya untuk pengajuan yang sudah disetujui.</GlassCard>
  if (rec.data.realisasi) return <GlassCard className="p-space-md">Pengajuan {rec.no} sudah direalisasi.</GlassCard>
  const nilai = nominal ?? String(rec.total)
  const n = parseAngka(nilai) ?? 0

  const simpan = async () => {
    if (n <= 0) return setErr('Isi nominal realisasi.')
    if (!nota.length) return setErr('Foto nota/kuitansi wajib.')
    setBusy('kirim')
    try {
      const foto: Photo[] = []
      for (const [i, f] of nota.entries()) foto.push(await app.backend.uploadPhoto(`petty-${rec.id}`, f.blob, `nota-${i + 1}.jpg`))
      const realisasi = { tanggal, nominal: n, catatan: catatan.trim(), nota: foto, by: app.session.user?.id ?? null, nama: app.displayName, at: new Date().toISOString() }
      await app.backend.savePetty({ ...rec, data: { ...rec.data, realisasi } }, false)
      guard.bypass()
      nota.forEach((f) => URL.revokeObjectURL(f.url))
      keTerkirim({
        judul: `Realisasi ${rec.no} tersimpan`,
        detail: `${rec.data.uraian} · ${rec.data.coa.activity}`,
        peringatan: n > rec.total ? `Realisasi melebihi pengajuan sebesar ${rupiah(n - rec.total)}.` : undefined,
        baris: [
          ['Pengajuan', rupiah(rec.total)],
          ['Realisasi', rupiah(n)],
          ['Selisih', rupiah(rec.total - n)],
        ],
        aksi: [{ to: '/finance/petty/realisasi', label: 'Kembali ke Realisasi Anggaran' }],
      })
    } catch (e) {
      setErr(pesan(e))
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <span className="tabular text-tag uppercase text-on-surface-variant">
          {rec.no} · {rec.data.coa.accountNo}
        </span>
        <span className="text-headline-md font-bold text-on-surface">{rec.data.uraian}</span>
        <span className="text-body-sm text-on-surface-variant">
          {rec.data.coa.activity} · disetujui {rupiah(rec.total)}
        </span>
      </GlassCard>
      <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Tanggal realisasi" htmlFor="rl-tgl">
            <Input id="rl-tgl" type="date" max={todayIso()} value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
          </Field>
          <Field label="Nominal realisasi (Rp)" htmlFor="rl-nom">
            <Input id="rl-nom" numeric inputMode="numeric" value={nilai} onChange={(e) => (setErr(null), setNominal(e.target.value))} />
          </Field>
        </div>
        {n > rec.total && <span className="text-body-sm font-semibold text-error">Melebihi pengajuan sebesar {rupiah(n - rec.total)}.</span>}
        <FotoWajib
          label="Foto nota / kuitansi"
          hint="Nota pembelian atau kuitansi jasa terbaca (nominal & tanggal)."
          fotos={nota}
          busy={busy === 'foto'}
          disabled={busy === 'kirim'}
          kamera={false}
          onAdd={(files) => {
            setBusy('foto')
            void (async () => {
              try {
                const baru: FotoLokal[] = []
                for (const f of files.slice(0, 3 - nota.length)) {
                  const blob = await compressImage(f)
                  baru.push({ id: genId('f'), blob, url: URL.createObjectURL(blob) })
                }
                setNota((x) => [...x, ...baru].slice(0, 3))
                setErr(null)
              } catch (e) {
                setErr(`Gagal memproses foto: ${pesan(e)}`)
              } finally {
                setBusy(null)
              }
            })()
          }}
          onRemove={(fid) =>
            setNota((x) => {
              const t = x.find((f) => f.id === fid)
              if (t) URL.revokeObjectURL(t.url)
              return x.filter((f) => f.id !== fid)
            })
          }
        />
        <Field label="Catatan (opsional)" htmlFor="rl-cat">
          <Input id="rl-cat" autoComplete="off" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>
        <ErrorBox text={err} />
        <Button size="lg" disabled={busy !== null} onClick={() => void simpan()}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <PiggyBank aria-hidden="true" />}
          {busy === 'kirim' ? 'Menyimpan…' : 'Simpan realisasi'}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}
