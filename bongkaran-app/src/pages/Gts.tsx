import { useCallback, useEffect, useMemo, useState } from 'react'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { Link, useSearchParams } from 'react-router-dom'
import { Camera, ChevronRight, LoaderCircle, Save, ScanEye, Send, Trash2 } from 'lucide-react'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { LayarKirimWa } from '@/components/bongkaran/kirim-wa'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { GAYA_STATUS, LegendaStatus } from '@/components/bongkaran/pilih-status'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { addDays, formatTanggalIso, hariSingkat, nowHm, todayIso } from '@/lib/date'
import { parseAngka } from '@/lib/format'
import { FOTO_GTS, gtsId, JENIS_GTS, JENIS_KENDARAAN, jenisGts, JUMLAH_SLOT, labelSlot, namaSpbuWa, slotKini, statusSlot, teksWaGts, type FotoGtsKey, type GtsRecord, type JenisGts, type SesuaiGts } from '@/lib/gts'
import { capWaktu, compressImage, genId, zonaWaktu } from '@/lib/image'
import { buatKolase } from '@/lib/kolase'
import { currentShift } from '@/lib/shift'
import type { StatusIsi } from '@/lib/status-isi'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const SLOTS = Array.from({ length: JUMLAH_SLOT }, (_, i) => i)
const tanggalLalu = (tgl: string, n: number) => todayIso(addDays(new Date(`${tgl}T00:00:00`), -n))
/** Tanggal kalender sampling 00:00-05:59 (masih hari operasional sebelumnya). */
const tanggalBesok = (tgl: string) => todayIso(addDays(new Date(`${tgl}T00:00:00`), 1))

/** Sampling GTS pada rentang tanggal operasional; dimuat ulang saat SPBU/rentang berubah. */
function useGts(from: string, to: string) {
  const app = useApp()
  const kunci = `${app.spbuId}|${from}|${to}`
  const [hasil, setHasil] = useState<{ kunci: string; recs: GtsRecord[]; error: string | null } | null>(null)
  const muat = useCallback(
    () =>
      app.backend.listGts(from, to).then(
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

const ada = (recs: GtsRecord[], tanggal: string, slot: number, jenis: JenisGts) => recs.some((r) => r.tanggal === tanggal && r.slot === slot && r.jenis === jenis)

/** Kotak slot ringkas berwarna status, dengan tanda JBT/JBKP. */
function KotakSlot({ slot, status, jbt, jbkp, kini }: { slot: number; status: StatusIsi; jbt: boolean; jbkp: boolean; kini?: boolean }) {
  const g = GAYA_STATUS[status]
  return (
    <div className={cn('flex flex-col gap-1 rounded-lg border p-space-xs', g.kartu, kini && 'ring-2 ring-primary')}>
      <span className="tabular text-body-sm font-bold text-on-surface">{labelSlot(slot).replace(' - ', '–')}</span>
      <span className="flex gap-1">
        <span className={cn('rounded px-1.5 text-[11px] font-bold', jbt ? 'bg-emerald-600 text-white' : 'bg-white/80 text-on-surface-variant')}>JBT</span>
        <span className={cn('rounded px-1.5 text-[11px] font-bold', jbkp ? 'bg-emerald-600 text-white' : 'bg-white/80 text-on-surface-variant')}>JBKP</span>
      </span>
      <span className={cn('text-[11px] font-semibold', g.label)}>{status === 'sudah' ? 'Lengkap' : status === 'belum' ? 'Berjalan' : status === 'terlewat' ? 'Terlewat' : 'Nanti'}</span>
    </div>
  )
}

/**
 * HSSE & Guard Patrol System > Sampling Penyaluran Subsidi (khusus security). Minimal 1 transaksi JBT dan
 * 1 JBKP per 2 jam. Hanya slot yang sedang berjalan yang dapat diisi (foto diambil saat itu juga).
 */
export function GtsMenu() {
  const app = useApp()
  const now = slotKini()
  const [tanggal, setTanggal] = useState(now.tanggal)
  const { recs, error } = useGts(tanggalLalu(now.tanggal, 6), now.tanggal)
  if (!app.loaded) return <Loading />
  const hari = Array.from({ length: 7 }, (_, i) => tanggalLalu(now.tanggal, i))
  const data = recs ?? []
  const jbt = ada(data, now.tanggal, now.slot, 'JBT')
  const jbkp = ada(data, now.tanggal, now.slot, 'JBKP')
  const bisaIsi = app.role === 'security' || app.role === 'abh'
  const kurang: JenisGts | null = !jbt ? 'JBT' : !jbkp ? 'JBKP' : null
  const lengkap = (t: string) => SLOTS.filter((s) => statusSlot(t, s, data, now) === 'sudah').length
  const lewat = (t: string) => SLOTS.filter((s) => statusSlot(t, s, data, now) !== 'nanti').length

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className={cn('animate-entrance-1 flex flex-col gap-space-sm border p-space-md', GAYA_STATUS[kurang ? 'belum' : 'sudah'].kartu)}>
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', GAYA_STATUS[kurang ? 'belum' : 'sudah'].ikon)}>
            <ScanEye className="size-6" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-on-surface-variant">Slot berjalan · {formatTanggalIso(now.tanggal)}</span>
            <span className="tabular text-headline-md font-bold text-on-surface">{labelSlot(now.slot)}</span>
            <span className="text-body-sm text-on-surface-variant">
              JBT {jbt ? '✓' : 'belum'} · JBKP {jbkp ? '✓' : 'belum'} · minimal 1 transaksi tiap jenis per 2 jam
            </span>
          </div>
        </div>
        {bisaIsi ? (
          <Link to={`/gts/isi?jenis=${kurang ?? 'JBT'}`} className={buttonVariants({ size: 'lg' })}>
            <Camera aria-hidden="true" />
            Sampling Penyaluran Subsidi
          </Link>
        ) : (
          <span className="text-body-sm text-on-surface-variant">Sampling diisi oleh security.</span>
        )}
        <ErrorBox text={error} />
      </GlassCard>

      <div className="animate-entrance-2 -mx-margin overflow-x-auto px-margin pb-1">
        <div role="radiogroup" aria-label="Tanggal" className="flex min-w-max gap-space-xs">
          {hari.map((t) => {
            const d = new Date(`${t}T00:00:00`)
            const on = t === tanggal
            const n = lengkap(t)
            const m = lewat(t)
            const st: StatusIsi = recs === null ? 'nanti' : n >= m && m > 0 ? 'sudah' : t === now.tanggal ? 'belum' : 'terlewat'
            return (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTanggal(t)}
                className={cn('flex w-16 flex-col items-center gap-0.5 rounded-[14px] py-2', on ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-lowest/80 text-on-surface')}
              >
                <span className={cn('text-[11px] uppercase', on ? 'text-on-primary/80' : 'text-on-surface-variant')}>{hariSingkat(d)}</span>
                <span className="tabular text-body-md font-bold">{d.getDate()}</span>
                <span className={cn('tabular rounded-full px-1.5 text-[11px] font-bold', GAYA_STATUS[st].ikon)}>
                  {n}/{m || JUMLAH_SLOT}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <section aria-labelledby="gts-slot" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="gts-slot" title={`Slot ${formatTanggalIso(tanggal)}`} />
        {recs === null ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-3 gap-space-xs sm:grid-cols-4 lg:grid-cols-6">
            {SLOTS.map((s) => (
              <KotakSlot key={s} slot={s} status={statusSlot(tanggal, s, data, now)} jbt={ada(data, tanggal, s, 'JBT')} jbkp={ada(data, tanggal, s, 'JBKP')} kini={tanggal === now.tanggal && s === now.slot} />
            ))}
          </div>
        )}
        <LegendaStatus nanti />
        {app.can('/laporan/gts') && (
          <Link to={`/laporan/gts?tanggal=${tanggal}`} className={buttonVariants({ variant: 'glass' })}>
            Lihat foto sampling tanggal ini
            <ChevronRight aria-hidden="true" />
          </Link>
        )}
      </section>
    </div>
  )
}

type Selesai = { rec: GtsRecord; teks: string; files: File[]; urls: string[] }

/**
 * Halaman form satu sampling (slot berjalan): jenis, nopol, jenis kendaraan, volume, sesuai ketentuan,
 * foto EDC/struk/kendaraan. Isian disimpan; foto hanya diolah di HP (cap waktu & SPBU) lalu dikirim
 * ke WhatsApp bersama teks laporan, tidak disimpan di database/penyimpanan. Tiga foto digabung otomatis
 * menjadi satu kolase (kiri atas EDC, kiri bawah struk, kanan kendaraan) dengan garis putih tipis.
 */
export function GtsForm() {
  const app = useApp()
  const [params] = useSearchParams()
  const [jenis, setJenis] = useState<JenisGts>(params.get('jenis') === 'JBKP' ? 'JBKP' : 'JBT')
  const [nopol, setNopol] = useState('')
  const [kendaraan, setKendaraan] = useState('')
  const [liter, setLiter] = useState('')
  const [sesuai, setSesuai] = useState<SesuaiGts>('Sesuai')
  const [keterangan, setKeterangan] = useState('')
  const [petugas, setPetugas] = useState(() => (app.displayName === 'Mode lokal' ? app.settings.namaSecurityDefault || '' : app.displayName))
  const [catatan, setCatatan] = useState('')
  const [foto, setFoto] = useState<Record<FotoGtsKey, FotoLokal[]>>({ edc: [], struk: [], kendaraan: [] })
  // Jam pengambilan tiap foto (dicap pada kolase).
  const [waktuFoto, setWaktuFoto] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<FotoGtsKey | 'kirim' | 'wa' | null>(null)
  const [selesai, setSelesai] = useState<Selesai | null>(null)
  const [dibagikan, setDibagikan] = useState(false)
  // Sebelum simpan: isian & foto hilang. Sesudah simpan: data aman, tetapi foto belum terkirim ke WhatsApp.
  const guard = useLeaveGuard({
    active: !selesai || !dibagikan,
    title: selesai ? 'Foto belum dikirim ke WhatsApp' : 'Keluar dari sampling?',
    detail: selesai ? 'Data sampling sudah tersimpan, tetapi foto tidak disimpan di aplikasi dan akan hilang bila keluar sekarang.' : 'Foto dan isian sampling yang belum dikirim akan hilang.',
  })
  const kini = slotKini()
  const [recsSlot, setRecsSlot] = useState<GtsRecord[]>([])
  if (!app.loaded) return <Loading />
  if (app.role !== 'security' && app.role !== 'abh') return <GlassCard className="p-space-md">Sampling penyaluran subsidi diisi oleh security SPBU.</GlassCard>
  const j = jenisGts(jenis)
  const shift = currentShift().shift

  const ambil = async (key: FotoGtsKey, files: File[]) => {
    if (!nopol.trim()) return setError('Isi nomor polisi dulu: ikut tercetak pada foto.')
    setBusy(key)
    try {
      // Satu foto per bagian kolase: foto baru menggantikan yang lama. Cap ditulis saat kolase dibuat.
      const f = files[files.length - 1]
      const waktu = capWaktu()
      const blob = await compressImage(f, { maxSize: 1600, quality: 0.85 })
      const baru: FotoLokal = { id: genId('f'), blob, url: URL.createObjectURL(blob) }
      setFoto((x) => {
        for (const lama of x[key]) URL.revokeObjectURL(lama.url)
        return { ...x, [key]: [baru] }
      })
      setWaktuFoto((w) => ({ ...w, [baru.id]: waktu }))
      setError(null)
    } catch (e) {
      setError(`Gagal memproses foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const kirim = async () => {
    if (!nopol.trim()) return setError('Isi nomor polisi kendaraan.')
    if (!kendaraan.trim()) return setError('Isi jenis kendaraan.')
    if (parseAngka(liter) === null) return setError('Isi volume pembelian (liter).')
    if (sesuai === 'Tidak sesuai' && !keterangan.trim()) return setError('Isi keterangan ketidaksesuaian.')
    for (const f of FOTO_GTS) if (!foto[f.key].length) return setError(`${f.label} wajib diambil.`)
    if (!petugas.trim()) return setError('Isi nama petugas.')
    setBusy('kirim')
    // Slot mengikuti waktu kirim (foto diambil saat itu).
    const slot = slotKini()
    const nopolBesar = nopol.trim().toUpperCase()
    try {
      const rec: GtsRecord = {
        id: gtsId(),
        tanggal: slot.tanggal,
        slot: slot.slot,
        jenis,
        createdAt: Date.now(),
        createdBy: app.session.user?.id ?? null,
        data: {
          nopol: nopolBesar,
          produk: j.produk,
          jenisKendaraan: kendaraan.trim().toUpperCase(),
          liter: liter.trim(),
          jam: nowHm(),
          shift,
          petugas: petugas.trim(),
          sesuai,
          keterangan: sesuai === 'Tidak sesuai' ? keterangan.trim() : '',
          catatan: catatan.trim(),
        },
      }
      // Hanya isian yang disimpan; foto tetap di HP untuk dikirim ke WhatsApp.
      await app.backend.saveGts(rec)
      const nama = nopolBesar.replace(/[^0-9A-Z]+/g, '')
      const spbu = namaSpbuWa(app.settings)
      const bagian = (key: FotoGtsKey) => {
        const x = foto[key][0]
        const label = FOTO_GTS.find((f) => f.key === key)!.label
        return { blob: x.blob, cap: [waktuFoto[x.id] ?? capWaktu(), spbu, `${label} · ${jenis} ${j.produk} · ${nopolBesar}`] }
      }
      const kolase = await buatKolase([bagian('edc'), bagian('struk'), bagian('kendaraan')])
      const files = [new File([kolase], `GTS_${jenis}_${nama}_${todayIso()}.jpg`, { type: 'image/jpeg' })]
      const urls = [URL.createObjectURL(kolase)]
      setRecsSlot(await app.backend.listGts(slot.tanggal, slot.tanggal).catch(() => [rec]))
      setSelesai({ rec, teks: teksWaGts(rec, app.settings, todayIso(), zonaWaktu()), files, urls })
      setBusy(null)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  if (selesai) {
    const r = selesai.rec
    const lain: JenisGts = r.jenis === 'JBT' ? 'JBKP' : 'JBT'
    const lainBelum = !ada(recsSlot, r.tanggal, r.slot, lain)
    return (
      <>
        <LayarKirimWa
          judul={`Data sampling ${r.jenis} tersimpan`}
          keterangan={`Slot ${labelSlot(r.slot)}. Foto tidak disimpan di aplikasi: kirim sekarang ke grup WhatsApp bersama teks laporan.`}
          teks={selesai.teks}
          files={selesai.files}
          urls={selesai.urls}
          dibagikan={dibagikan}
          onDibagikan={() => setDibagikan(true)}
        >
          {lainBelum && (
            <Link to={`/gts/isi?jenis=${lain}`} replace className={buttonVariants({ variant: 'glass', size: 'lg' })}>
              Lanjut sampling {lain} slot ini
            </Link>
          )}
          <Link to="/gts" replace className={buttonVariants({ variant: 'glass', size: 'lg' })}>
            Kembali ke Sampling Penyaluran Subsidi
          </Link>
        </LayarKirimWa>
        {guard.dialog}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <div className="flex flex-col">
          <span className="text-tag uppercase text-primary">
            Sampling penyaluran subsidi · slot {labelSlot(kini.slot)} · Shift {shift}
          </span>
          <span className="text-headline-md font-bold text-on-surface">
            {j.label} · {j.produk}
          </span>
          <span className="text-body-sm text-on-surface-variant">{j.desc}</span>
        </div>
        <Choice label="Jenis penyaluran" value={jenis} onChange={(v) => (setError(null), setJenis(v))} options={JENIS_GTS.map((x) => ({ value: x.value, label: `${x.label} (${x.produk})` }))} />
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Nomor polisi" htmlFor="gts-nopol">
            <Input id="gts-nopol" autoComplete="off" autoCapitalize="characters" placeholder="AG 1234 XY" value={nopol} onChange={(e) => (setError(null), setNopol(e.target.value))} />
          </Field>
          <Field label="Volume pembelian" htmlFor="gts-liter">
            <Input id="gts-liter" numeric inputMode="decimal" suffix="L" value={liter} onChange={(e) => (setError(null), setLiter(e.target.value))} />
          </Field>
        </div>
        <Field label="Jenis kendaraan" htmlFor="gts-kendaraan">
          <Input id="gts-kendaraan" list="gts-kendaraan-list" autoComplete="off" autoCapitalize="characters" placeholder="Mis. KIJANG, MOTOR, PICK UP" value={kendaraan} onChange={(e) => (setError(null), setKendaraan(e.target.value))} />
        </Field>
        <datalist id="gts-kendaraan-list">
          {JENIS_KENDARAAN.map((k) => (
            <option key={k} value={k.toUpperCase()} />
          ))}
        </datalist>
        <Choice<SesuaiGts>
          label="Sesuai ketentuan"
          value={sesuai}
          onChange={(v) => (setError(null), setSesuai(v))}
          options={[
            { value: 'Sesuai', label: 'Sesuai' },
            { value: 'Tidak sesuai', label: 'Tidak sesuai' },
          ]}
        />
        {sesuai === 'Tidak sesuai' && (
          <Field label="Keterangan ketidaksesuaian" htmlFor="gts-ket">
            <Input id="gts-ket" autoComplete="off" placeholder="Mis. kendaraan tidak terdaftar QR, melebihi kuota" value={keterangan} onChange={(e) => (setError(null), setKeterangan(e.target.value))} />
          </Field>
        )}
      </GlassCard>
      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
        {FOTO_GTS.map((f) => (
          <FotoWajib
            key={f.key}
            label={f.label}
            hint={f.hint}
            fotos={foto[f.key]}
            busy={busy === f.key}
            disabled={busy === 'kirim'}
            onAdd={(files) => void ambil(f.key, files)}
            onRemove={(fid) =>
              setFoto((x) => {
                const t = x[f.key].find((p) => p.id === fid)
                if (t) URL.revokeObjectURL(t.url)
                return { ...x, [f.key]: x[f.key].filter((p) => p.id !== fid) }
              })
            }
          />
        ))}
        <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <Camera aria-hidden="true" className="size-4 shrink-0" />
          Ketiga foto otomatis digabung menjadi satu kolase (kiri: EDC & struk, kanan: kendaraan) dengan jam, nama SPBU, jenis, dan nomor polisi. Foto tidak disimpan di aplikasi, hanya dikirim ke WhatsApp.
        </span>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Petugas" htmlFor="gts-petugas">
            <Input id="gts-petugas" value={petugas} onChange={(e) => setPetugas(e.target.value)} />
          </Field>
          <Field label="Catatan (opsional)" htmlFor="gts-catatan">
            <Input id="gts-catatan" autoComplete="off" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>
        </div>
        <ErrorBox text={error} />
        <Button size="lg" disabled={busy !== null} onClick={() => void kirim()}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
          {busy === 'kirim' ? 'Menyimpan…' : `Simpan & lanjut kirim ke WhatsApp`}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

/** Report > Riwayat Sampling Penyaluran Subsidi: kepatuhan slot dan isian sampling per tanggal (pengawas/ABH/security); foto dikirim lewat WhatsApp. */
export function LaporanGts() {
  const app = useApp()
  const konfirmasi = useKonfirmasi()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const now = slotKini()
  const tanggal = params.get('tanggal') || now.tanggal
  const { recs, error, muat } = useGts(tanggal, tanggal)
  const fotos = useMemo(() => (recs ?? []).flatMap((r) => FOTO_GTS.flatMap((f) => r.data.foto?.[f.key] ?? [])), [recs])
  const srcOf = usePhotoSrc(fotos)
  if (!app.loaded) return <Loading />
  const data = recs ?? []
  const status = SLOTS.map((s) => statusSlot(tanggal, s, data, now))
  const lewat = status.filter((s) => s !== 'nanti').length
  const lengkap = status.filter((s) => s === 'sudah').length
  const bolehHapus = app.role === 'abh' || app.role === 'pengawas'

  const hapus = async (r: GtsRecord) => {
    if (!(await konfirmasi({ judul: 'Hapus sampling?', pesan: <>Sampling <b>{r.jenis} {r.data.nopol}</b> akan dihapus dari riwayat Guard Tour.</> }))) return
    try {
      await app.backend.deleteGts(r.id)
      for (const f of FOTO_GTS) for (const p of r.data.foto?.[f.key] ?? []) void app.backend.deletePhoto(p).catch(() => {})
      toast('Sampling dihapus')
      void muat()
    } catch (e) {
      toast(pesan(e))
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <Field label="Tanggal operasional (06:00–05:59)" htmlFor="lgts-tgl">
          <Input id="lgts-tgl" type="date" max={now.tanggal} value={tanggal} onChange={(e) => e.target.value && setParams({ tanggal: e.target.value }, { replace: true })} />
        </Field>
        <div className="grid grid-cols-3 gap-space-xs text-center">
          <div className="rounded-md bg-surface-container-low p-space-xs">
            <span className="tabular block text-numeric-md font-bold text-on-surface">
              {lengkap}/{lewat || 0}
            </span>
            <span className="text-[11px] uppercase text-on-surface-variant">Slot lengkap</span>
          </div>
          <div className="rounded-md bg-surface-container-low p-space-xs">
            <span className="tabular block text-numeric-md font-bold text-on-surface">{data.filter((r) => r.jenis === 'JBT').length}</span>
            <span className="text-[11px] uppercase text-on-surface-variant">Sampling JBT</span>
          </div>
          <div className="rounded-md bg-surface-container-low p-space-xs">
            <span className="tabular block text-numeric-md font-bold text-on-surface">{data.filter((r) => r.jenis === 'JBKP').length}</span>
            <span className="text-[11px] uppercase text-on-surface-variant">Sampling JBKP</span>
          </div>
        </div>
        <ErrorBox text={error} />
      </GlassCard>

      {recs === null ? (
        <Loading />
      ) : (
        <div className="grid grid-cols-3 gap-space-xs sm:grid-cols-4 lg:grid-cols-6">
          {SLOTS.map((s) => (
            <KotakSlot key={s} slot={s} status={status[s]} jbt={ada(data, tanggal, s, 'JBT')} jbkp={ada(data, tanggal, s, 'JBKP')} kini={tanggal === now.tanggal && s === now.slot} />
          ))}
        </div>
      )}

      <section aria-labelledby="lgts-daftar" className="flex flex-col gap-space-sm">
        <SectionHeader id="lgts-daftar" title={`Sampling (${data.length})`} />
        {!data.length && (
          <GlassCard level={1} className="p-space-md text-center text-body-md text-on-surface-variant">
            Belum ada sampling pada tanggal ini.
          </GlassCard>
        )}
        {[...data]
          .sort((a, b) => a.slot - b.slot || a.createdAt - b.createdAt)
          .map((r) => (
            <GlassCard key={r.id} level={2} className="flex flex-col gap-space-sm p-space-md">
              <div className="flex items-start justify-between gap-space-sm">
                <span className="flex min-w-0 flex-col">
                  <span className="tabular text-tag uppercase text-on-surface-variant">
                    Slot {labelSlot(r.slot)} · {r.data.jam}
                    {r.data.shift ? ` · Shift ${r.data.shift}` : ''}
                  </span>
                  <span className="tabular text-body-md font-bold text-on-surface">
                    {r.data.nopol}
                    {r.data.jenisKendaraan ? ` · ${r.data.jenisKendaraan}` : ''}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {r.data.produk}
                    {r.data.liter ? ` · ${parseAngka(r.data.liter) ?? r.data.liter} L` : ''} · {r.data.petugas}
                    {r.data.catatan ? ` · ${r.data.catatan}` : ''}
                  </span>
                  {r.data.sesuai === 'Tidak sesuai' && <span className="text-body-sm font-semibold text-error">Tidak sesuai ketentuan{r.data.keterangan ? `: ${r.data.keterangan}` : ''}</span>}
                </span>
                <span className="flex items-center gap-1">
                  <Pill tone={r.jenis === 'JBT' ? 'cyan' : 'primary'}>{r.jenis}</Pill>
                  {r.data.sesuai && <Pill tone={r.data.sesuai === 'Sesuai' ? 'success' : 'error'}>{r.data.sesuai}</Pill>}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(teksWaGts(r, app.settings, r.data.jam < '06:00' ? tanggalBesok(r.tanggal) : r.tanggal, zonaWaktu()))}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Kirim teks laporan ${r.data.nopol} ke WhatsApp`}
                    className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                  >
                    <Send aria-hidden="true" />
                  </a>
                  {bolehHapus && (
                    <Button variant="ghost" size="icon" aria-label={`Hapus sampling ${r.data.nopol}`} onClick={() => void hapus(r)}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </span>
              </div>
              {FOTO_GTS.some((f) => r.data.foto?.[f.key]?.length) && (
                <div className="grid grid-cols-3 gap-space-xs">
                  {FOTO_GTS.map((f) => {
                    const p = r.data.foto?.[f.key]?.[0]
                    const src = p ? srcOf(p) : undefined
                    return (
                      <figure key={f.key} className="flex flex-col gap-1">
                        {src ? (
                          <a href={src} target="_blank" rel="noreferrer">
                            <img src={src} alt={`${f.label} ${r.data.nopol}`} className="aspect-[3/4] w-full rounded-md bg-black object-cover" />
                          </a>
                        ) : (
                          <span className="aspect-[3/4] w-full rounded-md bg-surface-container" />
                        )}
                        <figcaption className="text-center text-[11px] text-on-surface-variant">{f.label.replace('Foto ', '')}</figcaption>
                      </figure>
                    )
                  })}
                </div>
              )}
            </GlassCard>
          ))}
      </section>
    </div>
  )
}
