import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Copy, EyeOff, LoaderCircle, Lock, Trash2 } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { LayarKirimWa, PratinjauWa, salinTeks } from '@/components/bongkaran/kirim-wa'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { PilihShift, useKunciShift } from '@/components/bongkaran/pilih-shift'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { idShift } from '@/lib/catatan'
import {
  hitungCash,
  labelSelisih,
  NON_FUEL,
  NON_TUNAI,
  PECAHAN,
  penjualanDari,
  ringkasClosing,
  rupiah,
  teksWaClosing,
  type ClosingData,
  type ClosingRecord,
  type NonFuelKey,
  type NonTunaiKey,
} from '@/lib/closing'
import { addDays, formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { formatLiter, parseAngka } from '@/lib/format'
import { namaSpbuWa } from '@/lib/gts'
import { capWaktu, compressImage, genId, zonaWaktu } from '@/lib/image'
import { buatKolaseGrid } from '@/lib/kolase'
import { shiftLabel, type Shift } from '@/lib/shift'
import { PRODUK_OPTIONS } from '@/lib/sop'
import { statusShift } from '@/lib/status-isi'
import { totalizerLengkap, type TotalizerData, type TotalizerRecord } from '@/lib/totalizer'
import { useCatatan } from '@/lib/use-catatan'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const angka = (s: string | undefined) => Math.max(0, Math.round(parseAngka(s ?? '') ?? 0))

/** Harga jual per liter per produk (ABH & pengawas). */
function HargaProduk() {
  const app = useApp()
  const toast = useToast()
  const [ubah, setUbah] = useState<Record<string, string>>({})
  const harga = app.settings.hargaProduk ?? {}
  const produk = [...new Set([...(app.settings.nozzles ?? []).map((n) => n.produk), ...Object.keys(harga)])]
  const daftar = (produk.length ? PRODUK_OPTIONS.filter((p) => produk.includes(p)).concat(produk.filter((p) => !PRODUK_OPTIONS.includes(p))) : PRODUK_OPTIONS)
  return (
    <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
      <SectionHeader id="cl-harga" title="Harga jual per liter" />
      <div className="grid grid-cols-2 gap-space-sm">
        {daftar.map((p) => (
          <Field key={p} label={`${p} (Rp)`} htmlFor={`cl-h-${p}`}>
            <Input id={`cl-h-${p}`} numeric inputMode="numeric" value={ubah[p] ?? (harga[p] ? String(harga[p]) : '')} onChange={(e) => setUbah((x) => ({ ...x, [p]: e.target.value }))} />
          </Field>
        ))}
      </div>
      <Button
        variant="glass"
        disabled={!Object.keys(ubah).length}
        onClick={() => {
          const baru = { ...harga }
          for (const [p, v] of Object.entries(ubah)) {
            const n = parseAngka(v)
            if (n && n > 0) baru[p] = n
            else delete baru[p]
          }
          app.updateSettings({ hargaProduk: baru })
          setUbah({})
          toast('Harga jual disimpan')
        }}
      >
        Simpan harga
      </Button>
    </GlassCard>
  )
}

/** Finance > Closing Shift: pilih shift; hijau = sudah closing, merah = terlewat. */
export function ClosingMenu() {
  const app = useApp()
  const hariIni = todayIso()
  const dari = todayIso(addDays(new Date(`${hariIni}T00:00:00`), -40))
  const { recs, error } = useCatatan<ClosingData>('closing', dari, hariIni)
  if (!app.loaded || !recs) return <Loading />
  const rec = (tanggal: string, shift: Shift) => recs.find((r) => r.id === idShift(tanggal, shift))
  return (
    <div className="flex flex-col gap-space-md">
      <p className="animate-entrance-1 px-space-xs text-body-sm text-on-surface-variant">
        Closing setiap akhir shift oleh kepala shift dengan hitung buta: hitung fisik uang dan isi non tunai dari struk, angka penjualan baru tampil setelah dikirim. Penjualan BBM ditarik dari Totalizer shift yang sama × harga jual. Format sama dengan closing shift aplikasi One Touch Solution; laporan dikirim ke WhatsApp.
      </p>
      <ErrorBox text={error} />
      <PilihShift
        status={(k) => statusShift(k, !!rec(k.tanggal, k.shift))}
        keHalaman={(k) => `/finance/closing/${k.tanggal}/${k.shift}`}
        keterangan={(k) => {
          const r = rec(k.tanggal, k.shift)
          if (!r) return undefined
          return `${labelSelisih(ringkasClosing(r.data).selisih)} · ${r.data.jam} · ${r.data.petugas || '-'}`
        }}
      />
      {app.canManage && <HargaProduk />}
    </div>
  )
}

type Selesai = { rec: ClosingRecord; teks: string; files: File[]; urls: string[] }

/** Satu closing shift: form hitung buta (belum closing) atau ringkasan + rekonsiliasi (sudah, terkunci). */
export function ClosingShift() {
  const app = useApp()
  const { tanggal, shift, valid } = useKunciShift()
  const id = idShift(tanggal, shift)
  const { recs, muat } = useCatatan<ClosingData>('closing', tanggal, tanggal)
  const tot = useCatatan<TotalizerData>('totalizer', tanggal, tanggal)
  if (!app.loaded || !recs || !tot.recs) return <Loading />
  if (!valid) return <GlassCard className="p-space-md">Shift tidak dikenal.</GlassCard>
  const lama = recs.find((r) => r.id === id)
  const totalizer = tot.recs.find((r) => r.id === id)
  if (lama) return <ClosingDetail rec={lama} onHapus={() => void muat()} />
  if (!['kashift', 'abh'].includes(app.role ?? ''))
    return (
      <GlassCard level={2} className="flex flex-col gap-space-xs p-space-md">
        <span className="text-body-md font-semibold text-on-surface">Belum closing</span>
        <span className="text-body-sm text-on-surface-variant">Closing {shiftLabel(shift)} {formatTanggalIso(tanggal)} diisi kepala shift.</span>
      </GlassCard>
    )
  return <ClosingForm tanggal={tanggal} shift={shift} totalizer={totalizer} />
}

function ClosingForm({ tanggal, shift, totalizer }: { tanggal: string; shift: Shift; totalizer: TotalizerRecord | undefined }) {
  const app = useApp()
  const [pecahan, setPecahan] = useState<Record<string, string>>({})
  const [nonTunai, setNonTunai] = useState<Partial<Record<NonTunaiKey, string>>>({})
  const [nonFuel, setNonFuel] = useState<Partial<Record<NonFuelKey, string>>>({})
  const [petugas, setPetugas] = useState(() => (app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName))
  const [catatan, setCatatan] = useState('')
  const [foto, setFoto] = useState<FotoLokal[]>([])
  const [waktuFoto, setWaktuFoto] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selesai, setSelesai] = useState<Selesai | null>(null)
  const [dibagikan, setDibagikan] = useState(false)
  const namaShift = shiftLabel(shift).split(' (')[0]
  const guard = useLeaveGuard({
    active: !selesai || !dibagikan,
    title: selesai ? 'Laporan belum dikirim ke WhatsApp' : `Keluar dari closing ${namaShift}?`,
    detail: selesai ? 'Closing sudah tersimpan, tetapi foto struk tidak disimpan di aplikasi dan akan hilang bila keluar sekarang.' : 'Hitungan yang belum dikirim akan hilang.',
  })
  const nozzles = app.settings.nozzles ?? []
  const lengkap = totalizerLengkap(totalizer, nozzles)
  const cash = hitungCash(Object.fromEntries(PECAHAN.map(([k]) => [k, angka(pecahan[k])])))

  if (selesai)
    return (
      <>
        <LayarKirimWa
          judul={`Closing ${namaShift} terkirim`}
          keterangan={<>Data terkunci. {labelSelisih(ringkasClosing(selesai.rec.data).selisih)}. Kirim laporan ke grup WhatsApp sekarang; foto struk tidak disimpan di aplikasi.</>}
          teks={selesai.teks}
          files={selesai.files}
          urls={selesai.urls}
          dibagikan={dibagikan}
          onDibagikan={() => setDibagikan(true)}
        >
          <Link to="/finance/closing" replace className={buttonVariants({ variant: 'glass', size: 'lg' })}>
            Kembali ke Closing Shift
          </Link>
        </LayarKirimWa>
        {guard.dialog}
      </>
    )

  const ambil = async (files: File[]) => {
    setBusy('foto')
    try {
      const baru: FotoLokal[] = []
      const w: Record<string, string> = {}
      for (const f of files.slice(0, 4 - foto.length)) {
        const blob = await compressImage(f, { maxSize: 1600, quality: 0.85 })
        const x = { id: genId('f'), blob, url: URL.createObjectURL(blob) }
        w[x.id] = capWaktu()
        baru.push(x)
      }
      setFoto((x) => [...x, ...baru].slice(0, 4))
      setWaktuFoto((x) => ({ ...x, ...w }))
    } catch (e) {
      setError(`Gagal memproses foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const kirim = async () => {
    if (cash <= 0) return setError('Isi jumlah lembar/keping uang fisik.')
    if (!foto.length) return setError('Foto struk settlement EDC / amplop setoran wajib (minimal 1).')
    if (!petugas.trim()) return setError('Isi nama kepala shift.')
    if (!window.confirm(`Kirim & kunci closing ${namaShift}? Fisik kas ${rupiah(cash)}. Setelah dikirim hanya ABH yang dapat mengubah.`)) return
    setBusy('kirim')
    try {
      const data: ClosingData = {
        petugas: petugas.trim(),
        jam: nowHm(),
        pecahan: Object.fromEntries(PECAHAN.map(([k]) => [k, angka(pecahan[k])]).filter(([, v]) => v)),
        cash,
        nonTunai: Object.fromEntries(NON_TUNAI.map(([k]) => [k, angka(nonTunai[k])])) as ClosingData['nonTunai'],
        nonFuel: Object.fromEntries(NON_FUEL.map(([k]) => [k, angka(nonFuel[k])])) as ClosingData['nonFuel'],
        penjualan: penjualanDari(totalizer, app.settings.hargaProduk),
        totalizerLengkap: lengkap,
        catatan: catatan.trim(),
      }
      const rec: ClosingRecord = { id: idShift(tanggal, shift), tanggal, shift, data, createdAt: Date.now(), updatedAt: Date.now(), createdBy: app.session.user?.id ?? null }
      await app.backend.saveCatatan('closing', rec)
      guard.bypass()
      const spbu = namaSpbuWa(app.settings)
      const kolase = await buatKolaseGrid(foto.map((f, i) => ({ blob: f.blob, cap: [waktuFoto[f.id] ?? capWaktu(), spbu, `Closing ${namaShift} · struk ${i + 1}`] })))
      setSelesai({ rec, teks: teksWaClosing(rec, app.settings, zonaWaktu()), files: [new File([kolase], `Closing_${tanggal}_S${shift}.jpg`, { type: 'image/jpeg' })], urls: [URL.createObjectURL(kolase)] })
      setBusy(null)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  const kolomPecahan = (t: 'k' | 'l') =>
    PECAHAN.filter((x) => x[3] === t).map(([k, l, v]) => (
      <div key={k} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-space-xs">
        <label htmlFor={`cl-p-${k}`} className="tabular text-body-sm font-semibold text-on-surface">
          Rp {l}
        </label>
        <Input id={`cl-p-${k}`} numeric inputMode="numeric" placeholder="0" value={pecahan[k] ?? ''} onChange={(e) => (setError(null), setPecahan((x) => ({ ...x, [k]: e.target.value })))} />
        <span className="tabular w-24 text-right text-body-sm text-on-surface-variant">{angka(pecahan[k]) ? (angka(pecahan[k]) * v).toLocaleString('id-ID') : ''}</span>
      </div>
    ))

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <span className="text-tag uppercase text-primary">Closing shift · {formatTanggalIso(tanggal)}</span>
        <span className="text-headline-md font-bold text-on-surface">{shiftLabel(shift)}</span>
        <span className="flex items-start gap-space-xs text-body-sm text-on-surface-variant">
          <EyeOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Hitung buta: angka penjualan disembunyikan sampai hitungan dikirim.
        </span>
        {lengkap ? (
          <Pill tone="success">Totalizer {namaShift} lengkap</Pill>
        ) : (
          <span className="rounded-md bg-error-container/70 p-space-sm text-body-sm font-semibold text-on-error-container">
            Totalizer {namaShift} belum lengkap: penjualan BBM & selisih tidak dapat dihitung.{' '}
            <Link to={`/totalizer/${tanggal}/${shift}`} className="underline">
              Isi totalizer
            </Link>
          </span>
        )}
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
        <SectionHeader id="cl-kertas" title="Uang kertas" />
        {kolomPecahan('k')}
        <SectionHeader id="cl-logam" title="Uang logam" />
        {kolomPecahan('l')}
        <div className="flex items-center justify-between rounded-md bg-primary-fixed/50 px-space-sm py-space-xs">
          <span className="text-body-sm text-on-surface-variant">Fisik kas</span>
          <span className="tabular text-headline-md font-bold text-on-surface">{rupiah(cash)}</span>
        </div>
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-3 flex flex-col gap-space-sm p-space-md">
        <SectionHeader id="cl-nontunai" title="Non tunai (dari struk fisik)" />
        <div className="grid grid-cols-2 gap-space-sm">
          {NON_TUNAI.map(([k, l]) => (
            <Field key={k} label={`${l} (Rp)`} htmlFor={`cl-n-${k}`}>
              <Input id={`cl-n-${k}`} numeric inputMode="numeric" placeholder="0" value={nonTunai[k] ?? ''} onChange={(e) => setNonTunai((x) => ({ ...x, [k]: e.target.value }))} />
            </Field>
          ))}
        </div>
        <SectionHeader id="cl-nonfuel" title="Penjualan non BBM (ikut disetor)" />
        <div className="grid grid-cols-3 gap-space-sm">
          {NON_FUEL.map(([k, l]) => (
            <Field key={k} label={`${l} (Rp)`} htmlFor={`cl-f-${k}`}>
              <Input id={`cl-f-${k}`} numeric inputMode="numeric" placeholder="0" value={nonFuel[k] ?? ''} onChange={(e) => setNonFuel((x) => ({ ...x, [k]: e.target.value }))} />
            </Field>
          ))}
        </div>
      </GlassCard>

      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <FotoWajib
          label="Foto struk settlement EDC / amplop setoran"
          hint="Struk settlement EDC & QRIS, rekap non tunai, amplop/cash bag. Maks. 4 foto, digabung menjadi kolase untuk WhatsApp (tidak disimpan)."
          fotos={foto}
          busy={busy === 'foto'}
          disabled={busy === 'kirim'}
          kamera={false}
          onAdd={(f) => void ambil(f)}
          onRemove={(fid) =>
            setFoto((x) => {
              const t = x.find((f) => f.id === fid)
              if (t) URL.revokeObjectURL(t.url)
              return x.filter((f) => f.id !== fid)
            })
          }
        />
        <Field label="Kepala shift" htmlFor="cl-petugas">
          <Input id="cl-petugas" value={petugas} onChange={(e) => setPetugas(e.target.value)} />
        </Field>
        <Field label="Catatan (opsional)" htmlFor="cl-catatan">
          <Input id="cl-catatan" autoComplete="off" value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Field>
        <ErrorBox text={error} />
        <Button size="lg" disabled={busy !== null} onClick={() => void kirim()}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Lock aria-hidden="true" />}
          Kirim & kunci closing {namaShift}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

function Baris({ k, v, tebal, merah }: { k: string; v: string; tebal?: boolean; merah?: boolean }) {
  return (
    <div className="flex justify-between gap-space-sm py-1 text-body-sm">
      <span className="text-on-surface-variant">{k}</span>
      <span className={cn('tabular text-right text-on-surface', tebal && 'font-bold', merah && 'font-bold text-error')}>{v}</span>
    </div>
  )
}

/** Closing yang sudah terkirim (terkunci): rekonsiliasi, rincian, salin teks WhatsApp, hapus (ABH). */
function ClosingDetail({ rec, onHapus }: { rec: ClosingRecord; onHapus: () => void }) {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const d = rec.data
  const r = ringkasClosing(d)
  const teks = teksWaClosing(rec, app.settings, zonaWaktu())
  const hapus = async () => {
    if (!window.confirm('Hapus closing ini? Kepala shift dapat mengisi ulang.')) return
    try {
      await app.backend.deleteCatatan('closing', rec.id)
      toast('Closing dihapus')
      onHapus()
      navigate('/finance/closing', { replace: true })
    } catch (e) {
      toast(pesan(e))
    }
  }
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <div className="flex items-start justify-between gap-space-sm">
          <span className="flex flex-col">
            <span className="text-tag uppercase text-primary">Closing · {formatTanggalIso(rec.tanggal)}</span>
            <span className="text-headline-md font-bold text-on-surface">{shiftLabel(rec.shift as Shift)}</span>
          </span>
          <Pill tone={r.selisih === null ? 'neutral' : r.selisih < 0 ? 'error' : 'success'}>{labelSelisih(r.selisih)}</Pill>
        </div>
        <div className="divide-y divide-outline-variant/40">
          {d.penjualan.map((p) => (
            <Baris key={p.produk} k={`${p.produk} ${formatLiter(p.liter, 2)}${p.harga ? ` × ${p.harga.toLocaleString('id-ID')}` : ''}`} v={p.rupiah === null ? 'harga belum diatur' : rupiah(p.rupiah)} />
          ))}
          <Baris k="1. Penjualan BBM (totalizer)" v={d.totalizerLengkap ? rupiah(r.bbm) : 'Totalizer belum lengkap'} tebal />
          {r.nonFuel > 0 && <Baris k="Penjualan non BBM" v={rupiah(r.nonFuel)} />}
          <Baris k="2. Total non tunai" v={rupiah(r.nonTunai)} />
          <Baris k="3. Tunai seharusnya" v={r.bbmLengkap ? rupiah(r.seharusnya) : '-'} tebal />
          <Baris k="4. Fisik kas diterima" v={rupiah(d.cash)} tebal />
          <Baris k="Selisih" v={labelSelisih(r.selisih)} tebal merah={(r.selisih ?? 0) < 0} />
        </div>
        <span className="text-body-sm text-on-surface-variant">
          Dikirim {d.jam} oleh {d.petugas || '-'}. Data terkunci{app.role === 'abh' ? '' : '; perubahan hanya oleh ABH'}.
        </span>
      </GlassCard>

      <GlassCard level={2} className="flex flex-col gap-space-xs p-space-md">
        <SectionHeader id="cl-rincian" title="Rincian uang & non tunai" />
        <div className="divide-y divide-outline-variant/40">
          {PECAHAN.filter(([k]) => d.pecahan[k]).map(([k, l, v, t]) => (
            <Baris key={k} k={`Rp ${l} ${t === 'l' ? '(logam)' : ''} × ${d.pecahan[k]}`} v={rupiah(d.pecahan[k] * v)} />
          ))}
          {NON_TUNAI.filter(([k]) => d.nonTunai[k]).map(([k, l]) => (
            <Baris key={k} k={l} v={rupiah(d.nonTunai[k])} />
          ))}
          {NON_FUEL.filter(([k]) => d.nonFuel[k]).map(([k, l]) => (
            <Baris key={k} k={l} v={rupiah(d.nonFuel[k])} />
          ))}
        </div>
        {d.catatan && <span className="text-body-sm text-on-surface">Catatan: {d.catatan}</span>}
      </GlassCard>

      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <SectionHeader id="cl-wa" title="Teks laporan WhatsApp" />
        <PratinjauWa teks={teks} />
        <Button variant="glass" onClick={() => void salinTeks(teks).then((ok) => toast(ok ? 'Teks laporan disalin' : 'Gagal menyalin'))}>
          <Copy aria-hidden="true" />
          Salin teks
        </Button>
        {app.role === 'abh' && (
          <Button variant="danger" onClick={() => void hapus()}>
            <Trash2 aria-hidden="true" />
            Hapus closing
          </Button>
        )}
      </GlassCard>
    </div>
  )
}

