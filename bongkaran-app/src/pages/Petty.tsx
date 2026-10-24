import { useCallback, useEffect, useMemo, useState } from 'react'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronRight, ClipboardList, FilePlus2, FileSpreadsheet, FileText, HandCoins, LoaderCircle, PackageCheck, ReceiptText, Send, Trash2, X } from 'lucide-react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { MenuCard } from '@/components/bongkaran/menu-card'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { InfoPop } from '@/components/ui/info-pop'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { PilihCari } from '@/components/ui/pilih-cari'
import { SignaturePad } from '@/components/bongkaran/signature-pad'
import { Sheet } from '@/components/ui/sheet'
import { Stepper, type Langkah } from '@/components/ui/stepper'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { COA, coaByNo } from '@/lib/coa'
import { formatBulanTahun, formatTanggalIso, todayIso } from '@/lib/date'
import { parseAngka } from '@/lib/format'
import { compressImage, genId } from '@/lib/image'
import { KATEGORI_PETTY, kategoriPetty, bolehLihatAnggaran, bolehLihatNominal, bolehLihatPetty, bolehRealisasi, coaPetty, JENIS_PETTY, jenisPetty, labelStatus, namaModulPetty, nomorPetty, PERAN_PENGAJU, perluSettlement, pettyId, rekapCoa, rupiah, voucherBulan, voucherRentang, type JenisPetty, type PettyRecord, type Settlement, type StatusPetty, type Tanda } from '@/lib/petty'
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
  'Menunggu Settlement': 'info',
  Settlement: 'primary',
  Terealisasi: 'success',
  Dibayar: 'success',
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

/** Pengajuan dibuat pengguna ini (admin tidak menyetujui pengajuannya sendiri). Mode lokal: satu pengguna tanpa akun. */
const milikSendiri = (r: PettyRecord, uid: string | null) => (!!uid && r.createdBy === uid) || (uid === null && r.createdBy === null)
/** Pengajuan yang menunggu tindakan peran ini. */
const perluTindakan = (r: PettyRecord, role: string | null, uid: string | null) =>
  (r.status === 'Menunggu Admin' && (role === 'abh' || (role === 'admin' && !milikSendiri(r, uid)))) || (r.status === 'Menunggu ABH' && role === 'abh')

function Ringkas({ items }: { items: [string, string, boolean?][] }) {
  return (
    <div className="grid grid-cols-2 gap-space-xs">
      {items.map(([k, v, merah]) => (
        <div key={k} className={cn('rounded-md p-space-xs', merah ? 'bg-error-container' : 'bg-surface-container-low')}>
          <span className={cn('tabular block text-body-md font-bold', merah ? 'text-on-error-container' : 'text-on-surface')}>{v}</span>
          <span className="text-xs uppercase text-on-surface-variant">{k}</span>
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
  const belumReal = disetujui.filter((r) => !r.data.realisasi && !perluSettlement(r)).length
  const settlementSaya = data.filter((r) => perluSettlement(r) && milikSendiri(r, app.session.user?.id ?? null)).length
  const plafonNilai = s.pettyPlafon ?? 0

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start justify-between gap-space-sm">
          <span className="text-tag uppercase text-primary">
            {namaModulPetty(app.role)} · {formatBulanTahun(new Date(`${bulan}-01T00:00:00`))}
          </span>
          <InfoPop judul={namaModulPetty(app.role)}>
            <p>Pengajuan pengadaan atau reimburse oleh seluruh personil SPBU (kecuali ABH), persetujuan 1 Admin/Cashier, persetujuan akhir ABH.</p>
            <p>Setelah disetujui, pengaju membuat Settlement: foto struk pembelian dan foto barang yang dibeli. Admin/Cashier lalu merealisasi dengan akun COA dan mencetak voucher petty cash beserta lampirannya.</p>
          </InfoPop>
        </div>
        {/* Plafon, anggaran & realisasi hanya untuk Admin/Cashier dan ABH. */}
        {bolehLihatAnggaran(app.role) && (
          <Ringkas
            items={[
              ['Plafon bulan ini', plafonNilai ? rupiah(plafonNilai) : 'Belum diatur'],
              ['Anggaran disetujui', rupiah(anggaran), plafonNilai > 0 && anggaran > plafonNilai],
              ['Realisasi', rupiah(realisasi)],
              ['Sisa plafon', plafonNilai ? rupiah(plafonNilai - realisasi) : '-', plafonNilai > 0 && realisasi > plafonNilai],
            ]}
          />
        )}
        <ErrorBox text={error} />
      </GlassCard>

      <nav aria-label="Menu Petty Cash" className="animate-entrance-2 grid grid-cols-2 gap-space-sm lg:grid-cols-3">
        <MenuCard
          index={0}
          m={{
            to: '/finance/petty/pengajuan',
            icon: FilePlus2,
            title: app.role === 'abh' ? 'Persetujuan Pengajuan' : app.role === 'admin' ? 'Pengajuan Pengadaan & Reimburse' : 'Pengajuan Anggaran',
            desc: app.role === 'abh' ? 'Persetujuan akhir pengajuan dari personil SPBU' : 'Pengadaan barang/jasa atau reimburse, disetujui Admin/Cashier lalu ABH; setelah disetujui buat Settlement (struk & foto barang)',
            status: recs === null ? 'Memuat…' : tindakan ? `${tindakan} perlu persetujuan Anda` : settlementSaya ? `${settlementSaya} perlu Create Settlement` : `${data.length} pengajuan bulan ini`,
            badge: tindakan + settlementSaya,
          }}
        />
        {bolehRealisasi(app.role) && (
          <MenuCard
            index={1}
            m={{
              to: '/finance/petty/realisasi',
              icon: ReceiptText,
              title: 'Realisasi & Voucher',
              desc: 'Pilih akun COA, realisasi settlement, bayar reimburse, cetak voucher petty cash dengan lampiran struk & barang',
              status: recs === null ? 'Memuat…' : belumReal ? `${belumReal} disetujui belum direalisasi` : 'Semua terealisasi',
              badge: belumReal,
            }}
          />
        )}
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

function KartuPengajuan({ r, nominal }: { r: PettyRecord; nominal: boolean }) {
  const st = labelStatus(r)
  return (
    <Link to={`/finance/petty/pengajuan/${encodeURIComponent(r.id)}`} className="flex items-center gap-space-sm px-space-md py-space-sm active:bg-surface-container-low">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="tabular text-tag uppercase text-on-surface-variant">
          {r.no} · {formatTanggalIso(r.tanggal)}
        </span>
        <span className="truncate text-body-md font-semibold text-on-surface">{r.data.uraian}</span>
        <span className="truncate text-body-sm text-on-surface-variant">
          {jenisPetty(r) === 'reimburse' ? 'Reimburse' : 'Pengadaan'} · {coaPetty(r)?.activity ?? 'COA saat realisasi'} · {r.data.diajukanNama}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {nominal && <span className="tabular text-body-sm font-bold text-on-surface">{rupiah(r.total)}</span>}
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
  const data = (recs ?? []).filter((r) => bolehLihatPetty(r, app.role, uid))
  const tampil = data.filter((r) =>
    saring === 'semua' ? true : saring === 'tindakan' ? perluTindakan(r, app.role, uid) : saring === 'menunggu' ? r.status.startsWith('Menunggu') : r.status === saring,
  )
  const nTindakan = data.filter((r) => perluTindakan(r, app.role, uid)).length
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        {PERAN_PENGAJU.includes(app.role) ? (
          <Link to="/finance/petty/pengajuan/baru" className={buttonVariants({ size: 'lg' })}>
            <FilePlus2 aria-hidden="true" />
            {app.role === 'admin' ? 'Ajukan pengadaan / reimburse' : 'Ajukan anggaran'}
          </Link>
        ) : (
          <span className="text-body-sm text-on-surface-variant">ABH memberi persetujuan akhir; pengajuan dibuat oleh seluruh personil SPBU.</span>
        )}
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
            <KartuPengajuan key={r.id} r={r} nominal={bolehLihatNominal(r, app.role, uid)} />
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
  const [jenis, setJenis] = useState<JenisPetty>('pengadaan')
  const [kategori, setKategori] = useState('')
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
  if (!PERAN_PENGAJU.includes(app.role)) return <GlassCard className="p-space-md">Pengajuan anggaran dibuat oleh seluruh personil SPBU. ABH memberi persetujuan akhir.</GlassCard>
  const reimburse = jenis === 'reimburse'
  const nQty = parseAngka(qty) ?? 0
  const nHarga = parseAngka(harga) ?? 0
  const total = Math.round(nQty * nHarga)
  const set = (f: (v: string) => void) => (v: string) => {
    setError(null)
    f(v)
  }

  const kirim = async () => {
    if (!kategori) return setError('Pilih kategori pengajuan.')
    if (uraian.trim().length < 3) return setError('Isi barang/jasa yang diadakan.')
    if (nQty <= 0) return setError('Isi jumlah.')
    if (nHarga <= 0) return setError('Isi harga satuan.')
    if (alasan.trim().length < 5) return setError(reimburse ? 'Isi keperluan pembelian yang di-reimburse.' : 'Isi keperluan / alasan pengadaan.')
    if (reimburse && !lampiran.length) return setError('Reimburse wajib melampirkan foto nota / kuitansi pembayaran.')
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
          jenis,
          kategori,
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
        detail: `Status: ${rec!.status}. Akun COA dipilih Admin/Cashier saat realisasi.`,
        baris: [
          ['Jenis', reimburse ? 'Reimburse' : 'Pengadaan'],
          ['Kategori', kategoriPetty(kategori)?.label ?? '-'],
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
        <Field label="Jenis pengajuan">
          <Choice label="Jenis pengajuan" value={jenis} onChange={(v) => (setError(null), setJenis(v))} options={JENIS_PETTY.map((j) => ({ value: j.value, label: j.label }))} />
        </Field>
        <span className="rounded-md bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">{JENIS_PETTY.find((j) => j.value === jenis)?.desc}. Akun COA dipilih Admin/Cashier saat realisasi.</span>
        <Field label="Kategori" htmlFor="pp-kategori">
          <PilihCari
            id="pp-kategori"
            judul="Kategori pengajuan"
            deskripsi="Pilih yang paling sesuai; Admin/Cashier memakai kategori ini sebagai saran akun COA."
            placeholder="Pilih kategori"
            value={kategori}
            onChange={(v) => (setError(null), setKategori(v))}
            options={KATEGORI_PETTY.map((k) => ({ value: k.value, label: k.label, sub: k.desc }))}
          />
        </Field>
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
          <span className="text-body-sm text-on-surface-variant">{reimburse ? 'Total reimburse' : 'Total pengajuan'}</span>
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
          label={reimburse ? 'Nota / kuitansi pembayaran' : 'Lampiran'}
          hint={reimburse ? 'Nota pembelian atau kuitansi jasa yang sudah Anda bayar (nominal & tanggal terbaca).' : 'Foto penawaran, contoh barang, atau kerusakan yang akan diperbaiki.'}
          fotos={lampiran}
          busy={busy === 'foto'}
          disabled={busy === 'kirim'}
          wajib={reimburse}
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

/** Detail pengajuan + persetujuan 1 Admin/Cashier / persetujuan akhir ABH + hapus. */
export function PengajuanPettyDetail() {
  const app = useApp()
  const konfirmasi = useKonfirmasi()
  const toast = useToast()
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const { rec, loading, error, muat } = useSatuPetty(id)
  const [catatan, setCatatan] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  // Form persetujuan sebagai pop up dari tahap terbaru stepper.
  const [bukaSetuju, setBukaSetuju] = useState(false)
  if (loading) return <Loading />
  if (!rec) return <GlassCard className="p-space-md">{error ?? 'Pengajuan tidak ditemukan.'}</GlassCard>
  const uid = app.session.user?.id ?? null
  const d = rec.data
  const st = labelStatus(rec)
  const bisaPeriksa = rec.status === 'Menunggu Admin' && (app.role === 'abh' || (app.role === 'admin' && !milikSendiri(rec, uid)))
  const bisaPutus = rec.status === 'Menunggu ABH' && app.role === 'abh'
  const bisaHapus = app.role === 'abh' || (rec.status === 'Menunggu Admin' && rec.createdBy === uid)
  const lihatNominal = bolehLihatNominal(rec, app.role, uid)
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
      setBukaSetuju(false)
      void muat()
    } catch (e) {
      setErr(pesan(e))
    } finally {
      setBusy(null)
    }
  }
  const hapus = async () => {
    if (!(await konfirmasi({ judul: 'Hapus pengajuan?', pesan: <>Pengajuan petty cash <b>{rec.no}</b> beserta lampirannya akan dihapus.</> }))) return
    try {
      await app.backend.deletePetty(rec.id)
      for (const p of [...d.lampiran, ...(d.realisasi?.nota ?? []), ...(d.settlement?.struk ?? []), ...(d.settlement?.barang ?? [])]) void app.backend.deletePhoto(p).catch(() => {})
      toast('Pengajuan dihapus')
      navigate('/finance/petty/pengajuan', { replace: true })
    } catch (e) {
      setErr(pesan(e))
    }
  }

  const jenis = jenisPetty(rec)
  const ditolak = rec.status === 'Ditolak'
  // Ditolak di persetujuan 1 bila ABH belum memberi keputusan.
  const tolakAdmin = ditolak && !d.keputusan
  const aksiSetuju = { label: 'Beri persetujuan', icon: Check, onClick: () => (setErr(null), setBukaSetuju(true)) }
  const catatanTanda = (t?: Tanda) => (t?.catatan ? <span className="text-on-surface">“{t.catatan}”</span> : undefined)
  const langkah: Langkah[] = [
    {
      key: 'aju',
      judul: jenis === 'reimburse' ? 'Reimburse diajukan' : 'Pengajuan dibuat',
      waktu: rec.createdAt,
      oleh: d.diajukanNama,
      tag: 'Submit',
      nada: 'selesai',
      isi: <span>{d.alasan}</span>,
    },
    {
      key: 'p1',
      judul: 'Persetujuan 1 Admin/Cashier',
      waktu: d.review?.at,
      oleh: d.review?.nama,
      tag: d.review ? (tolakAdmin ? 'Ditolak' : 'Disetujui') : d.keputusan ? 'Dilewati' : undefined,
      nada: d.review ? (tolakAdmin ? 'error' : 'selesai') : rec.status === 'Menunggu Admin' ? 'aktif' : d.keputusan ? 'selesai' : 'nanti',
      kosong: rec.status === 'Menunggu Admin' ? 'Menunggu Admin/Cashier' : d.keputusan ? 'Diputuskan langsung oleh ABH' : undefined,
      isi: catatanTanda(d.review),
      aksi: bisaPeriksa ? aksiSetuju : undefined,
    },
  ]
  if (!tolakAdmin)
    langkah.push({
      key: 'p2',
      judul: 'Persetujuan akhir ABH',
      waktu: d.keputusan?.at,
      oleh: d.keputusan?.nama,
      tag: d.keputusan ? (ditolak ? 'Ditolak' : 'Disetujui') : undefined,
      nada: d.keputusan ? (ditolak ? 'error' : 'selesai') : rec.status === 'Menunggu ABH' ? 'aktif' : 'nanti',
      kosong: rec.status === 'Menunggu ABH' ? 'Menunggu ABH' : undefined,
      isi: catatanTanda(d.keputusan),
      aksi: bisaPutus ? aksiSetuju : undefined,
    })
  if (!ditolak && jenis === 'pengadaan') {
    const s = d.settlement
    const bisaSettle = rec.status === 'Disetujui' && !s && (milikSendiri(rec, uid) || bolehRealisasi(app.role))
    langkah.push({
      key: 'settle',
      judul: 'Settlement',
      waktu: s?.at,
      oleh: s?.nama,
      tag: s ? 'Struk & barang' : undefined,
      nada: s ? 'selesai' : rec.status === 'Disetujui' ? 'aktif' : 'nanti',
      kosong: rec.status === 'Disetujui' && !s ? 'Menunggu pengaju (foto struk & barang)' : undefined,
      isi: s ? (
        <>
          <span>
            Belanja {formatTanggalIso(s.tanggal)}
            {lihatNominal ? ` · ${rupiah(s.nominal)} (sisa ${rupiah(rec.total - s.nominal)})` : ''}
          </span>
          {catatanTanda(s)}
          <FotoList fotos={[...s.struk, ...s.barang]} alt="Struk / barang yang dibeli" />
        </>
      ) : undefined,
      aksi: bisaSettle ? { label: 'Create Settlement', icon: PackageCheck, onClick: () => navigate(`/finance/petty/settlement/${encodeURIComponent(rec.id)}`) } : undefined,
    })
  }
  if (!ditolak) {
    const r = d.realisasi
    const siap = rec.status === 'Disetujui' && !r && !perluSettlement(rec)
    langkah.push({
      key: 'real',
      judul: jenis === 'reimburse' ? 'Pembayaran reimburse' : 'Realisasi',
      waktu: r?.at,
      oleh: r?.nama,
      tag: r ? 'Selesai' : undefined,
      nada: r ? 'selesai' : siap ? 'aktif' : 'nanti',
      kosong: siap ? 'Menunggu Admin/Cashier' : undefined,
      isi: r ? (
        <>
          <span>
            {formatTanggalIso(r.tanggal)}
            {r.coa ? ` · COA ${r.coa.accountNo} ${r.coa.activity}` : ''}
            {lihatNominal ? ` · ${rupiah(r.nominal)}` : ''}
          </span>
          {catatanTanda(r)}
          <FotoList fotos={r.nota} alt="Nota realisasi" />
          {r.ttd && (
            <span className="flex flex-wrap gap-space-sm">
              {(
                [
                  ['Dibayar', r.ttd.kasir],
                  ['Diterima', r.ttd.penerima],
                ] as [string, { img: string; nama: string } | undefined][]
              )
                .filter((x): x is [string, { img: string; nama: string }] => !!x[1])
                .map(([k, t]) => (
                <span key={k} className="flex flex-col items-center rounded-md border border-outline-variant/50 bg-white px-space-xs py-1">
                  <img src={t.img} alt={`Tanda tangan ${t.nama}`} className="h-10 w-24 object-contain" />
                  <span className="text-xs text-on-surface-variant">
                    {k} · {t.nama}
                  </span>
                </span>
              ))}
            </span>
          )}
        </>
      ) : undefined,
      aksi: siap && bolehRealisasi(app.role) ? { label: jenis === 'reimburse' ? 'Bayar reimburse' : 'Catat realisasi', icon: ReceiptText, onClick: () => navigate(`/finance/petty/realisasi/${encodeURIComponent(rec.id)}`) } : undefined,
    })
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
        {lihatNominal && <span className="tabular text-headline-md font-bold text-primary">{rupiah(rec.total)}</span>}
        <div className="divide-y divide-outline-variant/40">
          <Baris k="Jenis" v={jenisPetty(rec) === 'reimburse' ? 'Reimburse (sudah dibayar pengaju)' : 'Pengadaan'} />
          {d.kategori && <Baris k="Kategori" v={kategoriPetty(d.kategori)?.label ?? d.kategori} />}
          <Baris k="Akun COA" v={coaPetty(rec) ? `${coaPetty(rec)!.accountNo} · ${coaPetty(rec)!.activity}` : 'Dipilih Admin/Cashier saat realisasi'} />
          {coaPetty(rec) && <Baris k="Akun SAP / COA ID" v={`${coaPetty(rec)!.sapAccount} · ${coaPetty(rec)!.coaId}`} />}
          <Baris k="Jumlah" v={lihatNominal ? `${d.qty} ${d.satuan} × ${rupiah(d.harga)}` : `${d.qty} ${d.satuan}`} />
          {d.vendor && <Baris k="Vendor" v={d.vendor} />}
          <Baris k="Keperluan" v={d.alasan} />
          <Baris k="Diajukan" v={d.diajukanNama} />
        </div>
        <FotoList fotos={d.lampiran} alt={jenisPetty(rec) === 'reimburse' ? 'Nota reimburse' : 'Lampiran pengajuan'} />
      </GlassCard>

      {/* Pengajuan → persetujuan → settlement → realisasi sebagai stepper; tahap terbaru diketuk untuk bertindak. */}
      <GlassCard level={2} className="animate-entrance-2 flex flex-col p-space-md">
        <Stepper judul="Alur pengajuan" langkah={langkah} />
      </GlassCard>

      <Sheet
        open={bukaSetuju}
        onOpenChange={setBukaSetuju}
        title={bisaPutus || app.role === 'abh' ? 'Persetujuan akhir ABH' : 'Persetujuan 1 Admin/Cashier'}
        description={`${rec.no} · ${d.uraian}${lihatNominal ? ` · ${rupiah(rec.total)}` : ''}`}
        footer={
          <div className="flex flex-col gap-space-xs">
            <ErrorBox text={err} />
            <div className="grid grid-cols-2 gap-space-xs">
              <Button disabled={!!busy} onClick={() => void putuskan(app.role === 'admin' ? 'Menunggu ABH' : 'Disetujui')}>
                <Check aria-hidden="true" />
                Setujui
              </Button>
              <Button variant="danger" disabled={!!busy} onClick={() => void putuskan('Ditolak')}>
                <X aria-hidden="true" />
                Tolak
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-space-sm pb-space-sm">
          <Field label="Catatan (wajib bila ditolak)" htmlFor="pp-catatan">
            <Input id="pp-catatan" autoComplete="off" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>
          {app.role === 'admin' && <span className="text-body-sm text-on-surface-variant">Setelah disetujui, pengajuan diteruskan ke ABH untuk persetujuan akhir.</span>}
        </div>
      </Sheet>

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
  const toast = useToast()
  const [bulan, setBulan] = useState(todayIso().slice(0, 7))
  // Pengajuan sampai 3 bulan sebelumnya: realisasi bisa jatuh di bulan berikutnya (voucher per tanggal realisasi).
  const dari = `${todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)) - 4, 1)).slice(0, 7)}-01`
  const { recs: semua, error } = usePetty(dari, akhirBulan(bulan))
  const recs = useMemo(() => semua?.filter((r) => r.tanggal.startsWith(bulan)) ?? null, [semua, bulan])
  const rekap = useMemo(() => rekapCoa((semua ?? []).filter((r) => r.data.realisasi?.tanggal.startsWith(bulan))), [semua, bulan])
  const vouchers = useMemo(() => voucherBulan(semua ?? [], bulan), [semua, bulan])
  const [busy, setBusy] = useState(false)
  // Cetak voucher petty cash: rentang tanggal pengajuan (mis. 1 s.d. 7), hanya yang sudah direalisasi dengan COA.
  const [vDari, setVDari] = useState(`${todayIso().slice(0, 7)}-01`)
  const [vSampai, setVSampai] = useState(todayIso())
  const [cetak, setCetak] = useState(false)
  const { recs: rentang } = usePetty(vDari, vSampai)
  const barisCetak = useMemo(() => voucherRentang(rentang ?? [], vDari, vSampai), [rentang, vDari, vSampai])
  const belumCoa = (rentang ?? []).filter((r) => r.status === 'Disetujui' && !r.data.realisasi).length
  if (!app.loaded) return <Loading />
  const cetakVoucher = async () => {
    setCetak(true)
    try {
      const fotos = barisCetak.flatMap((b) => [...b.struk, ...b.barang])
      const fotoData: Record<string, string> = {}
      await Promise.all(fotos.map(async (p) => (fotoData[p.id] = await app.backend.photoDataUrl(p).catch(() => ''))))
      const { voucherPdf } = await import('@/lib/report/voucher-pdf')
      const hari = todayIso()
      const blob = voucherPdf({
        nomor: `${Number(hari.slice(8))}/COCO/${hari.slice(5, 7)}/${hari.slice(0, 4)}`,
        tanggal: hari,
        dari: vDari,
        sampai: vSampai,
        baris: barisCetak,
        settings: app.settings,
        ttd: { buh: app.settings.namaPengawasDefault ?? '', admin: app.role === 'admin' ? app.displayName : '', kasir: '' },
        fotoData,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Voucher_Petty_Cash_${(app.settings.kodeSpbu || 'SPBU').replace(/[^0-9A-Za-z]/g, '')}_${vDari}_sd_${vSampai}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch (e) {
      toast(`Gagal mencetak voucher: ${pesan(e)}`)
    } finally {
      setCetak(false)
    }
  }
  const unduhVoucher = async () => {
    setBusy(true)
    try {
      const { exportVoucherXlsx } = await import('@/lib/report/voucher')
      const kode = (app.settings.kodeSpbu || 'SPBU').replace(/[^0-9A-Za-z]/g, '')
      await exportVoucherXlsx(
        { bulan, vouchers, settings: app.settings, ttd: { buh: app.settings.namaPengawasDefault ?? '', admin: app.role === 'admin' ? app.displayName : '', kasir: '' } },
        `Voucher_Realisasi_Petty_Cash_${kode}_${bulan}.xlsx`,
      )
    } catch (e) {
      toast(`Gagal membuat voucher: ${pesan(e)}`)
    } finally {
      setBusy(false)
    }
  }
  const anggaran = (recs ?? []).filter((r) => r.status === 'Disetujui').reduce((n, r) => n + r.total, 0)
  const realisasi = (semua ?? []).filter((r) => r.data.realisasi?.tanggal.startsWith(bulan)).reduce((n, r) => n + (r.data.realisasi?.nominal ?? 0), 0)
  const plafon = app.settings.pettyPlafon ?? 0
  // Menunggu realisasi: semua pengajuan disetujui yang belum direalisasi (termasuk dari bulan sebelumnya).
  const menunggu = (semua ?? []).filter((r) => r.status === 'Disetujui' && !r.data.realisasi && !perluSettlement(r))
  const tungguSettlement = (semua ?? []).filter((r) => perluSettlement(r)).length
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
        <SectionHeader id="rp-tunggu" title={`Menunggu realisasi (${menunggu.length})`} action={tungguSettlement ? <span className="text-body-sm font-semibold text-amber-800">{tungguSettlement} menunggu settlement pengaju</span> : undefined} />
        {!menunggu.length ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Semua pengajuan yang disetujui sudah direalisasi.
          </GlassCard>
        ) : (
          <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
            {menunggu.map((r) => (
              <Link
                key={r.id}
                to={bolehRealisasi(app.role) ? `/finance/petty/realisasi/${encodeURIComponent(r.id)}` : `/finance/petty/pengajuan/${encodeURIComponent(r.id)}`}
                className="flex items-center gap-space-sm px-space-md py-space-sm active:bg-surface-container-low"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="tabular text-tag uppercase text-on-surface-variant">
                    {r.no} · {jenisPetty(r) === 'reimburse' ? 'Reimburse · bayar ke pengaju' : 'Pengadaan'} · {r.data.diajukanNama}
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

      <section aria-labelledby="rp-cetak" className="flex flex-col gap-space-sm">
        <SectionHeader id="rp-cetak" title="Cetak voucher petty cash" />
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Pengajuan dari" htmlFor="vc-dari">
              <Input id="vc-dari" type="date" max={vSampai} value={vDari} onChange={(e) => e.target.value && setVDari(e.target.value)} />
            </Field>
            <Field label="Sampai" htmlFor="vc-sampai">
              <Input id="vc-sampai" type="date" min={vDari} max={todayIso()} value={vSampai} onChange={(e) => e.target.value && setVSampai(e.target.value)} />
            </Field>
          </div>
          {rentang === null ? (
            <Loading />
          ) : !barisCetak.length ? (
            <span className="text-body-sm text-on-surface-variant">Belum ada pengajuan pada rentang ini yang sudah direalisasi dengan akun COA.</span>
          ) : (
            <div className="flex flex-col divide-y divide-outline-variant/40 rounded-md bg-surface-container-low">
              {barisCetak.map((b) => (
                <div key={b.no} className="flex items-center justify-between gap-space-sm px-space-sm py-space-xs">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-body-sm font-semibold text-on-surface">{b.uraian}</span>
                    <span className="truncate text-xs text-on-surface-variant">
                      {b.no} · {b.coa} · {b.struk.length} struk · {b.barang.length} foto barang
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-body-sm font-bold text-on-surface">{rupiah(b.jumlah)}</span>
                </div>
              ))}
              <div className="flex justify-between px-space-sm py-space-xs text-body-sm font-bold text-on-surface">
                <span>Total</span>
                <span className="tabular">{rupiah(barisCetak.reduce((a, b) => a + b.jumlah, 0))}</span>
              </div>
            </div>
          )}
          {belumCoa > 0 && <span className="text-body-sm font-semibold text-amber-800">{belumCoa} pengajuan disetujui pada rentang ini belum direalisasi (belum ada COA) dan tidak ikut voucher.</span>}
          <Button disabled={cetak || !barisCetak.length} onClick={() => void cetakVoucher()}>
            {cetak ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileText aria-hidden="true" />}
            Cetak voucher PDF + lampiran struk & barang
          </Button>
        </GlassCard>
      </section>

      <section aria-labelledby="rp-voucher" className="flex flex-col gap-space-sm">
        <SectionHeader id="rp-voucher" title={`Voucher per tanggal realisasi (${vouchers.length})`} />
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          <span className="text-body-sm text-on-surface-variant">
            Satu voucher per tanggal realisasi (nomor tanggal/COCO/bulan/tahun), berisi akun COA, keterangan, jumlah, total & terbilang, serta tanda tangan BUH SPBU, Admin, Kasir.
          </span>
          {vouchers.map((v) => (
            <div key={v.nomor} className="flex items-center justify-between gap-space-sm rounded-md bg-surface-container-low px-space-sm py-space-xs">
              <span className="flex min-w-0 flex-col">
                <span className="tabular text-body-md font-semibold text-on-surface">No. {v.nomor}</span>
                <span className="truncate text-body-sm text-on-surface-variant">
                  {formatTanggalIso(v.tanggal)} · {v.baris.length} akun · {v.baris.map((b) => b.coa).join(', ')}
                </span>
              </span>
              <span className="tabular shrink-0 text-body-sm font-bold text-on-surface">{rupiah(v.total)}</span>
            </div>
          ))}
          <Button variant="glass" disabled={busy || !vouchers.length} onClick={() => void unduhVoucher()}>
            {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileSpreadsheet aria-hidden="true" />}
            Unduh voucher Excel {formatBulanTahun(new Date(`${bulan}-01T00:00:00`))}
          </Button>
        </GlassCard>
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
  const [coa, setCoa] = useState<string | null>(null)
  // E-sign realisasi: Admin/Cashier yang membayar (wajib) & penerima dana (opsional).
  const [ttdKasir, setTtdKasir] = useState('')
  const [ttdPenerima, setTtdPenerima] = useState('')
  const [namaPenerima, setNamaPenerima] = useState<string | null>(null)
  const [busy, setBusy] = useState<'foto' | 'kirim' | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari realisasi?', detail: 'Realisasi dan foto nota yang belum disimpan akan hilang.' })
  if (loading) return <Loading />
  if (!bolehRealisasi(app.role)) return <GlassCard className="p-space-md">Realisasi petty cash dicatat oleh Admin/Cashier.</GlassCard>
  if (!rec) return <GlassCard className="p-space-md">{error ?? 'Pengajuan tidak ditemukan.'}</GlassCard>
  if (rec.status !== 'Disetujui') return <GlassCard className="p-space-md">Realisasi hanya untuk pengajuan yang sudah disetujui.</GlassCard>
  if (rec.data.realisasi) return <GlassCard className="p-space-md">Pengajuan {rec.no} sudah direalisasi.</GlassCard>
  if (perluSettlement(rec))
    return (
      <GlassCard className="flex flex-col gap-space-sm p-space-md">
        <span className="text-body-md font-semibold text-on-surface">Menunggu Settlement {rec.no}</span>
        <span className="text-body-sm text-on-surface-variant">Pengaju belum melampirkan foto struk pembelian dan foto barang. Realisasi dicatat setelah Settlement dibuat.</span>
        <Link to={`/finance/petty/settlement/${encodeURIComponent(rec.id)}`} className={buttonVariants({ variant: 'glass' })}>
          Buat Settlement atas nama pengaju
        </Link>
      </GlassCard>
    )
  const st = rec.data.settlement
  const nilai = nominal ?? String(st?.nominal ?? rec.total)
  const n = parseAngka(nilai) ?? 0
  const reimburse = jenisPetty(rec) === 'reimburse'
  // Pengajuan lama sudah punya COA; pengajuan baru: COA dipilih di sini.
  // Saran COA dari kategori pengajuan (dapat diganti).
  const kat = kategoriPetty(rec.data.kategori)
  const noCoa = coa ?? rec.data.coa?.accountNo ?? kat?.coa ?? ''
  const akun = coaByNo(noCoa)
  const penerima = namaPenerima ?? rec.data.diajukanNama

  const simpan = async () => {
    if (!akun) return setErr('Pilih akun COA.')
    if (!ttdKasir) return setErr('Tanda tangan Admin/Cashier (e-sign) wajib.')
    if (n <= 0) return setErr(reimburse ? 'Isi nominal yang dibayarkan.' : 'Isi nominal realisasi.')
    // Reimburse: nota sudah dilampirkan pengaju; bukti bayar opsional.
    if (!reimburse && !st && !nota.length) return setErr('Foto nota/kuitansi wajib (pengaju belum membuat Settlement).')
    setBusy('kirim')
    try {
      const foto: Photo[] = []
      for (const [i, f] of nota.entries()) foto.push(await app.backend.uploadPhoto(`petty-${rec.id}`, f.blob, `nota-${i + 1}.jpg`))
      const realisasi = {
        tanggal,
        nominal: n,
        coa: { accountNo: akun.accountNo, activity: akun.activity, sapAccount: akun.sapAccount, coaId: akun.coaId },
        catatan: catatan.trim(),
        nota: foto,
        ttd: { kasir: { img: ttdKasir, nama: app.displayName }, ...(ttdPenerima ? { penerima: { img: ttdPenerima, nama: penerima.trim() || rec.data.diajukanNama } } : {}) },
        by: app.session.user?.id ?? null,
        nama: app.displayName,
        at: new Date().toISOString(),
      }
      await app.backend.savePetty({ ...rec, data: { ...rec.data, realisasi } }, false)
      guard.bypass()
      nota.forEach((f) => URL.revokeObjectURL(f.url))
      keTerkirim({
        judul: reimburse ? `Reimburse ${rec.no} dibayar` : `Realisasi ${rec.no} tersimpan`,
        detail: `${rec.data.uraian} · ${akun.activity} · voucher ${Number(tanggal.slice(8))}/COCO/${tanggal.slice(5, 7)}/${tanggal.slice(0, 4)}`,
        peringatan: n > rec.total ? `Realisasi melebihi pengajuan sebesar ${rupiah(n - rec.total)}.` : undefined,
        baris: [
          ['Pengajuan', rupiah(rec.total)],
          ['Realisasi', rupiah(n)],
          ['Selisih', rupiah(rec.total - n)],
        ],
        aksi: [{ to: '/finance/petty/realisasi', label: 'Kembali ke Realisasi Petty Cash' }],
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
          {rec.no} · {reimburse ? 'Reimburse' : 'Pengadaan'} · {rec.data.diajukanNama}
        </span>
        <span className="text-headline-md font-bold text-on-surface">{rec.data.uraian}</span>
        <span className="text-body-sm text-on-surface-variant">Disetujui {rupiah(rec.total)}</span>
        {reimburse && <FotoList fotos={rec.data.lampiran} alt="Nota reimburse" />}
        {st && (
          <div className="mt-space-xs flex flex-col gap-space-xs rounded-md border-2 border-emerald-300 bg-emerald-50 p-space-sm">
            <span className="text-body-sm font-bold text-emerald-900">
              Settlement {formatTanggalIso(st.tanggal)} · {rupiah(st.nominal)} · {st.nama}
            </span>
            <FotoList fotos={st.struk} alt="Struk pembelian" />
            <FotoList fotos={st.barang} alt="Barang yang dibeli" />
          </div>
        )}
      </GlassCard>
      <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
        <Field label="Akun COA (wajib)" htmlFor="rl-coa">
          <PilihCari
            id="rl-coa"
            judul="Akun COA"
            deskripsi={kat ? `Saran dari kategori ${kat.label}` : 'Cari nama aktivitas, nomor akun, atau keterangan'}
            placeholder="Pilih akun COA"
            value={noCoa}
            invalid={!akun && !!err}
            onChange={(v) => (setErr(null), setCoa(v))}
            options={COA.map((c) => ({ value: c.accountNo, label: c.activity, sub: `${c.accountNo} · ${c.description}`, kunci: `${c.sapAccount} ${c.coaId}`, tanda: c.accountNo === kat?.coa ? 'Saran' : undefined }))}
          />
        </Field>
        {akun && (
          <span className="rounded-md bg-surface-container-low p-space-sm text-body-sm text-on-surface-variant">
            <b className="text-on-surface">{akun.sapAccount}</b> · COA ID {akun.coaId}
            <br />
            {akun.description}
          </span>
        )}
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label={reimburse ? 'Tanggal dibayar' : 'Tanggal realisasi'} htmlFor="rl-tgl">
            <Input id="rl-tgl" type="date" max={todayIso()} value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
          </Field>
          <Field label={reimburse ? 'Nominal dibayar (Rp)' : 'Nominal realisasi (Rp)'} htmlFor="rl-nom">
            <Input id="rl-nom" numeric inputMode="numeric" value={nilai} onChange={(e) => (setErr(null), setNominal(e.target.value))} />
          </Field>
        </div>
        {n > rec.total && <span className="text-body-sm font-semibold text-error">Melebihi pengajuan sebesar {rupiah(n - rec.total)}.</span>}
        <FotoWajib
          label={reimburse ? 'Bukti pembayaran ke pengaju' : st ? 'Nota tambahan (opsional)' : 'Foto nota / kuitansi'}
          hint={reimburse ? 'Bukti transfer / tanda terima uang reimburse (opsional).' : st ? 'Struk & foto barang sudah dilampirkan pengaju lewat Settlement.' : 'Nota pembelian atau kuitansi jasa terbaca (nominal & tanggal).'}
          wajib={!reimburse && !st}
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
        {/* E-sign: tanda tangan pembayar (wajib) dan penerima dana (opsional), tercetak di voucher. */}
        <div className="flex flex-col gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
          <span className="text-tag uppercase text-on-surface-variant">E-sign realisasi</span>
          <Field label={`Admin/Cashier · ${app.displayName}`}>
            <SignaturePad label="Admin/Cashier" value={ttdKasir} onChange={(v) => (setErr(null), setTtdKasir(v))} />
          </Field>
          <Field label="Nama penerima dana" htmlFor="rl-penerima">
            <Input id="rl-penerima" autoComplete="off" value={penerima} onChange={(e) => setNamaPenerima(e.target.value)} />
          </Field>
          <Field label="Tanda tangan penerima (opsional)">
            <SignaturePad label="penerima dana" value={ttdPenerima} onChange={setTtdPenerima} />
          </Field>
        </div>
        <ErrorBox text={err} />
        <Button size="lg" disabled={busy !== null} onClick={() => void simpan()}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <HandCoins aria-hidden="true" />}
          {busy === 'kirim' ? 'Menyimpan…' : 'Simpan realisasi'}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

/** Unggah foto (maks. 3) untuk form settlement. */
function useFotoList() {
  const [fotos, setFotos] = useState<FotoLokal[]>([])
  const [busy, setBusy] = useState(false)
  const tambah = async (files: File[]) => {
    setBusy(true)
    try {
      const baru: FotoLokal[] = []
      for (const f of files.slice(0, 3 - fotos.length)) {
        const blob = await compressImage(f)
        baru.push({ id: genId('f'), blob, url: URL.createObjectURL(blob) })
      }
      setFotos((x) => [...x, ...baru].slice(0, 3))
    } finally {
      setBusy(false)
    }
  }
  const hapus = (fid: string) =>
    setFotos((x) => {
      const t = x.find((f) => f.id === fid)
      if (t) URL.revokeObjectURL(t.url)
      return x.filter((f) => f.id !== fid)
    })
  return { fotos, busy, tambah, hapus }
}

/**
 * Create Settlement: pertanggungjawaban pengaju setelah pengajuan pengadaan disetujui. Foto struk pembelian
 * dan foto barang yang dibeli (keduanya wajib), tanggal & nominal belanja. Setelah itu Admin/Cashier merealisasi
 * dengan akun COA dan mencetak voucher petty cash beserta lampiran ini.
 */
export function SettlementPetty() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const { id = '' } = useParams()
  const { rec, loading, error } = useSatuPetty(id)
  const [tanggal, setTanggal] = useState(todayIso())
  const [nominal, setNominal] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')
  const struk = useFotoList()
  const barang = useFotoList()
  const [kirim, setKirim] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari settlement?', detail: 'Foto struk dan barang yang belum dikirim akan hilang.' })
  if (loading) return <Loading />
  if (!rec) return <GlassCard className="p-space-md">{error ?? 'Pengajuan tidak ditemukan.'}</GlassCard>
  const uid = app.session.user?.id ?? null
  if (!(milikSendiri(rec, uid) || bolehRealisasi(app.role))) return <GlassCard className="p-space-md">Settlement dibuat oleh pengaju.</GlassCard>
  if (rec.status !== 'Disetujui') return <GlassCard className="p-space-md">Settlement hanya untuk pengajuan yang sudah disetujui.</GlassCard>
  if (rec.data.realisasi) return <GlassCard className="p-space-md">Pengajuan {rec.no} sudah direalisasi.</GlassCard>
  const nilai = nominal ?? String(rec.total)
  const n = parseAngka(nilai) ?? 0

  const simpan = async () => {
    if (n <= 0) return setErr('Isi nominal yang dibelanjakan.')
    if (!struk.fotos.length) return setErr('Foto struk / nota pembelian wajib.')
    if (!barang.fotos.length) return setErr('Foto barang yang dibeli wajib.')
    setKirim(true)
    try {
      const up = async (fotos: FotoLokal[], nama: string) => {
        const out: Photo[] = []
        for (const [i, f] of fotos.entries()) out.push(await app.backend.uploadPhoto(`petty-${rec.id}`, f.blob, `${nama}-${i + 1}.jpg`))
        return out
      }
      const settlement: Settlement = {
        tanggal,
        nominal: n,
        struk: await up(struk.fotos, 'settlement-struk'),
        barang: await up(barang.fotos, 'settlement-barang'),
        catatan: catatan.trim(),
        by: uid,
        nama: app.displayName,
        at: new Date().toISOString(),
      }
      await app.backend.savePetty({ ...rec, data: { ...rec.data, settlement } }, false)
      guard.bypass()
      keTerkirim({
        judul: `Settlement ${rec.no} terkirim`,
        detail: `${rec.data.uraian} · menunggu realisasi Admin/Cashier`,
        peringatan: n > rec.total ? `Belanja melebihi pengajuan sebesar ${rupiah(n - rec.total)}.` : undefined,
        baris: [
          ['Pengajuan', rupiah(rec.total)],
          ['Dibelanjakan', rupiah(n)],
          ['Sisa dikembalikan', rupiah(Math.max(0, rec.total - n))],
        ],
        aksi: [{ to: `/finance/petty/pengajuan/${encodeURIComponent(rec.id)}`, label: 'Lihat pengajuan' }],
      })
    } catch (e) {
      setErr(pesan(e))
      setKirim(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <span className="tabular text-tag uppercase text-on-surface-variant">
          {rec.no} · Create Settlement
        </span>
        <span className="text-headline-md font-bold text-on-surface">{rec.data.uraian}</span>
        <span className="text-body-sm text-on-surface-variant">
          Disetujui {rupiah(rec.total)} · {rec.data.qty} {rec.data.satuan}
        </span>
      </GlassCard>
      <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Tanggal belanja" htmlFor="st-tgl">
            <Input id="st-tgl" type="date" max={todayIso()} value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
          </Field>
          <Field label="Nominal dibelanjakan (Rp)" htmlFor="st-nom">
            <Input id="st-nom" numeric inputMode="numeric" value={nilai} onChange={(e) => (setErr(null), setNominal(e.target.value))} />
          </Field>
        </div>
        {n > rec.total && <span className="text-body-sm font-semibold text-error">Melebihi pengajuan sebesar {rupiah(n - rec.total)}.</span>}
        <FotoWajib label="Foto struk / nota pembelian" hint="Struk atau nota terbaca: toko, tanggal, barang, dan nominal." fotos={struk.fotos} busy={struk.busy} disabled={kirim} onAdd={(f) => void struk.tambah(f)} onRemove={struk.hapus} />
        <FotoWajib label="Foto barang yang dibeli" hint="Barang/jasa yang dibeli, terlihat jelas." fotos={barang.fotos} busy={barang.busy} disabled={kirim} onAdd={(f) => void barang.tambah(f)} onRemove={barang.hapus} />
        <Field label="Catatan (opsional)" htmlFor="st-cat">
          <Input id="st-cat" autoComplete="off" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>
        <ErrorBox text={err} />
        <Button size="lg" disabled={kirim || struk.busy || barang.busy} onClick={() => void simpan()}>
          {kirim ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {kirim ? 'Mengirim…' : 'Kirim settlement'}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}
