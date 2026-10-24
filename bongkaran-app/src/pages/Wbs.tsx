import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, EyeOff, LoaderCircle, LockKeyhole, Megaphone, Send } from 'lucide-react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { CheckRow, Choice, Field } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { Stepper, type Langkah } from '@/components/ui/stepper'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { compressImage, genId } from '@/lib/image'
import { useKeTerkirim } from '@/lib/terkirim'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { KATEGORI_WBS, kategoriWbs, nomorWbs, STATUS_WBS, statusWbs, type StatusWbs, type WbsInput, type WbsRecord } from '@/lib/wbs'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** HSSE & Guard Patrol System > Whistleblowing System: penjelasan kerahasiaan lalu pilih kategori pelanggaran. */
export function WbsMenu() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <Megaphone className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-primary">Whistleblowing System</span>
            <span className="text-headline-md font-bold text-on-surface">Laporkan pelanggaran</span>
            <span className="text-body-sm text-on-surface-variant">Untuk semua petugas SPBU. Laporan bersifat rahasia.</span>
          </div>
        </div>
        <ul className="flex flex-col gap-space-xs text-body-sm text-on-surface">
          <li className="flex items-start gap-2">
            <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            Laporan hanya dapat dibaca <b>ABH</b>. Pengawas, kepala shift, dan rekan kerja tidak dapat melihatnya.
          </li>
          <li className="flex items-start gap-2">
            <EyeOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            Pilihan anonim: akun Anda tidak disimpan bersama laporan maupun foto bukti.
          </li>
        </ul>
      </GlassCard>
      <section aria-labelledby="wbs-kategori" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="wbs-kategori" title="Pilih jenis pelanggaran" />
        <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
          {KATEGORI_WBS.map((k) => (
            <Link key={k.value} to={`/wbs/${k.value}`} className="flex min-h-16 items-center gap-space-sm px-space-md py-space-sm active:bg-surface-container-low">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-md font-semibold text-on-surface">{k.label}</span>
                <span className="text-body-sm text-on-surface-variant">{k.desc}</span>
              </span>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
            </Link>
          ))}
        </GlassCard>
      </section>
    </div>
  )
}

/** Halaman form laporan WBS untuk satu kategori. */
export function WbsForm() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const { kategori = '' } = useParams()
  const k = kategoriWbs(kategori)
  const [d, setD] = useState<WbsInput>(() => ({ kategori, tanggal: todayIso(), jam: nowHm(), lokasi: '', terlibat: '', uraian: '', anonim: true, kontak: '' }))
  const [foto, setFoto] = useState<FotoLokal[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'foto' | 'kirim' | null>(null)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari laporan WBS?', detail: 'Laporan yang belum dikirim akan hilang.' })
  if (!app.loaded) return <Loading />
  if (!k) return <GlassCard className="p-space-md">Jenis pelanggaran tidak dikenal.</GlassCard>
  const set = (p: Partial<WbsInput>) => {
    setError(null)
    setD((x) => ({ ...x, ...p }))
  }

  const tambahFoto = async (files: File[]) => {
    setBusy('foto')
    try {
      const baru: FotoLokal[] = []
      for (const f of files.slice(0, 5 - foto.length)) {
        const blob = await compressImage(f, { maxSize: 1280, quality: 0.7 })
        baru.push({ id: genId('f'), blob, url: URL.createObjectURL(blob) })
      }
      setFoto((x) => [...x, ...baru])
    } catch (e) {
      setError(`Gagal memproses foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const kirim = async () => {
    if (!d.tanggal || d.tanggal > todayIso()) return setError('Isi tanggal kejadian (tidak boleh di masa depan).')
    if (d.uraian.trim().length < 20) return setError('Uraikan kejadian minimal 20 karakter: apa, siapa, kapan, di mana.')
    if (!d.anonim && !d.kontak.trim()) return setError('Isi kontak yang dapat dihubungi ABH, atau pilih kirim sebagai anonim.')
    setBusy('kirim')
    const id = nomorWbs()
    try {
      await app.backend.kirimWbs(id, { ...d, lokasi: d.lokasi.trim(), terlibat: d.terlibat.trim(), uraian: d.uraian.trim(), kontak: d.anonim ? '' : d.kontak.trim() }, foto.map((f) => f.blob))
      foto.forEach((f) => URL.revokeObjectURL(f.url))
      guard.bypass()
      keTerkirim({
        judul: 'Laporan WBS terkirim',
        detail: 'Laporan Anda hanya dapat dibaca ABH. Simpan nomor laporan ini bila perlu menanyakan tindak lanjutnya.',
        baris: [
          ['Nomor laporan', id],
          ['Jenis', k.label],
          ['Pelapor', d.anonim ? 'Anonim' : 'Bersedia dihubungi'],
          ['Foto bukti', `${foto.length} foto`],
        ],
      })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <span className="text-tag uppercase text-primary">Laporan rahasia · hanya ABH</span>
        <span className="text-headline-md font-bold text-on-surface">{k.label}</span>
        <span className="text-body-sm text-on-surface-variant">{k.desc}</span>
      </GlassCard>
      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-md p-space-md">
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Tanggal kejadian" htmlFor="wbs-tgl">
            <Input id="wbs-tgl" type="date" max={todayIso()} value={d.tanggal} onChange={(e) => set({ tanggal: e.target.value })} />
          </Field>
          <Field label="Perkiraan jam" htmlFor="wbs-jam">
            <Input id="wbs-jam" type="time" value={d.jam} onChange={(e) => set({ jam: e.target.value })} />
          </Field>
        </div>
        <Field label="Lokasi (opsional)" htmlFor="wbs-lokasi">
          <Input id="wbs-lokasi" autoComplete="off" placeholder="Mis. Pulau pompa 2, kantor" value={d.lokasi} onChange={(e) => set({ lokasi: e.target.value })} />
        </Field>
        <Field label="Pihak yang terlibat (opsional)" htmlFor="wbs-terlibat">
          <Input id="wbs-terlibat" autoComplete="off" placeholder="Nama / jabatan / nopol kendaraan" value={d.terlibat} onChange={(e) => set({ terlibat: e.target.value })} />
        </Field>
        <Field label="Uraian kejadian" htmlFor="wbs-uraian" hint="Apa yang terjadi, siapa, kapan, dan bagaimana Anda mengetahuinya.">
          <Textarea id="wbs-uraian" className="min-h-[140px]" value={d.uraian} onChange={(e) => set({ uraian: e.target.value })} />
        </Field>
        <FotoWajib
          label="Foto bukti"
          hint="Maks. 5 foto. Boleh dari galeri."
          wajib={false}
          kamera={false}
          fotos={foto}
          busy={busy === 'foto'}
          disabled={busy === 'kirim' || foto.length >= 5}
          onAdd={(files) => void tambahFoto(files)}
          onRemove={(fid) =>
            setFoto((x) => {
              const t = x.find((f) => f.id === fid)
              if (t) URL.revokeObjectURL(t.url)
              return x.filter((f) => f.id !== fid)
            })
          }
        />
        <CheckRow checked={d.anonim} onChange={(v) => set({ anonim: v })}>
          Kirim sebagai anonim
          <span className="block text-body-sm text-on-surface-variant">Akun Anda tidak disimpan. ABH tidak dapat menghubungi Anda untuk klarifikasi.</span>
        </CheckRow>
        {!d.anonim && (
          <Field label="Kontak yang dapat dihubungi ABH" htmlFor="wbs-kontak">
            <Input id="wbs-kontak" autoComplete="off" placeholder="No. HP / WhatsApp" value={d.kontak} onChange={(e) => set({ kontak: e.target.value })} />
          </Field>
        )}
        <ErrorBox text={error} />
        <Button size="lg" disabled={busy !== null} onClick={() => void kirim()}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {busy === 'kirim' ? 'Mengirim…' : 'Kirim laporan rahasia'}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

/** Laporan WBS SPBU aktif (hanya ABH mendapat data dari server). */
function useWbs() {
  const app = useApp()
  const kunci = String(app.spbuId)
  const [hasil, setHasil] = useState<{ kunci: string; recs: WbsRecord[]; error: string | null } | null>(null)
  const muat = useCallback(
    () =>
      app.backend.listWbs().then(
        (recs) => setHasil({ kunci, recs, error: null }),
        (e) => setHasil({ kunci, recs: [], error: pesan(e) }),
      ),
    [app.backend, kunci],
  )
  useEffect(() => {
    void muat()
  }, [muat])
  const kini = hasil?.kunci === kunci ? hasil : null
  return { recs: kini?.recs ?? null, error: kini?.error ?? null }
}

/** Report > Laporan WBS (khusus ABH). */
export function LaporanWbs() {
  const app = useApp()
  const { recs, error } = useWbs()
  const [saring, setSaring] = useState<StatusWbs | 'semua'>('semua')
  if (!app.loaded || !recs) return <Loading />
  if (app.role !== 'abh') return <GlassCard className="p-space-md">Laporan WBS hanya dapat dibaca ABH.</GlassCard>
  const n = (s: StatusWbs) => recs.filter((r) => r.status === s).length
  const rows = saring === 'semua' ? recs : recs.filter((r) => r.status === saring)
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <LockKeyhole aria-hidden="true" className="size-4 text-primary" />
          Rahasia: hanya Anda (ABH) yang dapat membaca laporan {app.spbu?.nama || 'SPBU ini'}.
        </span>
        <ChipFilter
          label="Saring status"
          value={saring}
          onChange={setSaring}
          options={[{ value: 'semua' as const, label: `Semua ${recs.length}` }, ...STATUS_WBS.map((s) => ({ value: s.value, label: `${s.label} ${n(s.value)}` }))]}
        />
        <ErrorBox text={error} />
      </GlassCard>
      {!rows.length ? (
        <GlassCard level={1} className="p-space-md text-center text-body-md text-on-surface-variant">
          Belum ada laporan.
        </GlassCard>
      ) : (
        <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
          {rows.map((r) => (
            <Link key={r.id} to={`/laporan/wbs/${encodeURIComponent(r.id)}`} className="flex min-h-16 items-center gap-space-sm px-space-md py-space-sm active:bg-surface-container-low">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="tabular text-tag uppercase text-on-surface-variant">
                  {r.id} · {formatTanggalIso(r.createdAt.slice(0, 10))}
                </span>
                <span className="text-body-md font-semibold text-on-surface">{kategoriWbs(r.data.kategori)?.label ?? r.data.kategori}</span>
                <span className="truncate text-body-sm text-on-surface-variant">{r.data.uraian}</span>
              </span>
              <Pill tone={statusWbs(r.status).tone}>{statusWbs(r.status).label}</Pill>
              <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
            </Link>
          ))}
        </GlassCard>
      )}
    </div>
  )
}

/** Report > Laporan WBS > detail & tindak lanjut ABH (halaman tersendiri). */
export function WbsDetail() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const { id = '' } = useParams()
  const { recs } = useWbs()
  const r = recs?.find((x) => x.id === id)
  const fotos = useMemo(() => r?.data.foto ?? [], [r])
  const srcOf = usePhotoSrc(fotos)
  const [status, setStatus] = useState<StatusWbs | null>(null)
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [buka, setBuka] = useState(false)
  const guard = useLeaveGuard({ active: !!catatan.trim(), title: 'Keluar dari tindak lanjut WBS?', detail: 'Catatan tindak lanjut yang belum disimpan akan hilang.' })
  if (!app.loaded || !recs) return <Loading />
  if (app.role !== 'abh') return <GlassCard className="p-space-md">Laporan WBS hanya dapat dibaca ABH.</GlassCard>
  if (!r) return <GlassCard className="p-space-md">Laporan tidak ditemukan.</GlassCard>
  const d = r.data
  const statusBaru = status ?? (r.status === 'baru' ? 'ditinjau' : r.status)

  const simpan = async () => {
    if (!catatan.trim()) return setError('Tulis catatan tindak lanjut.')
    setBusy(true)
    try {
      const oleh = app.displayName === 'Mode lokal' ? app.settings.namaAbhDefault || 'ABH' : app.displayName
      await app.backend.updateWbs(r.id, statusBaru, { ...d, riwayat: [...(d.riwayat ?? []), { at: new Date().toISOString(), oleh, status: statusBaru, catatan: catatan.trim() }] })
      guard.bypass()
      keTerkirim({
        judul: 'Tindak lanjut WBS tersimpan',
        detail: `${r.id}: ${statusWbs(statusBaru).label}`,
        baris: [['Catatan', catatan.trim()]],
        aksi: [{ to: '/laporan/wbs', label: 'Kembali ke Laporan WBS' }],
      })
    } catch (e) {
      setError(pesan(e))
      setBusy(false)
    }
  }

  // Tahap: laporan masuk, setiap tindak lanjut, lalu selesai (belum). Tahap terbaru membuka form tindak lanjut.
  const rw = d.riwayat ?? []
  const bisaTL = r.status !== 'selesai'
  const aksiTL = { label: 'Tambah tindak lanjut', icon: Send, onClick: () => (setError(null), setBuka(true)) }
  const langkah: Langkah[] = [
    { key: 'masuk', judul: 'Laporan masuk', waktu: r.createdAt, oleh: d.anonim ? 'Anonim' : 'Pelapor teridentifikasi', tag: 'Baru', nada: !rw.length && bisaTL ? 'aktif' : 'selesai', isi: <span>{kategoriWbs(d.kategori)?.label ?? d.kategori}</span>, aksi: !rw.length && bisaTL ? aksiTL : undefined },
    ...rw.map((l, i): Langkah => ({
      key: `${l.at}_${i}`,
      judul: l.status === 'selesai' ? 'Selesai' : 'Ditinjau',
      waktu: l.at,
      oleh: l.oleh,
      tag: statusWbs(l.status).label,
      nada: i === rw.length - 1 && bisaTL ? 'aktif' : 'selesai',
      isi: <span className="whitespace-pre-line text-on-surface">{l.catatan}</span>,
      aksi: i === rw.length - 1 && bisaTL ? aksiTL : undefined,
    })),
    ...(bisaTL ? [{ key: 'selesai', judul: 'Selesai', nada: 'nanti' as const }] : []),
  ]

  const baris: [string, string][] = [
    ['Jenis', kategoriWbs(d.kategori)?.label ?? d.kategori],
    ['Waktu kejadian', `${formatTanggalIso(d.tanggal)} ${d.jam || ''}`],
    ['Lokasi', d.lokasi || '-'],
    ['Pihak terlibat', d.terlibat || '-'],
    ['Pelapor', d.anonim ? 'Anonim' : `Teridentifikasi${d.kontak ? ` · kontak ${d.kontak}` : ''}`],
    ['Masuk', new Date(r.createdAt).toLocaleString('id-ID')],
  ]
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start justify-between gap-2">
          <span className="tabular text-tag uppercase text-primary">{r.id}</span>
          <Pill tone={statusWbs(r.status).tone}>{statusWbs(r.status).label}</Pill>
        </div>
        <dl className="flex flex-col divide-y divide-outline-variant/40">
          {baris.map(([l, v]) => (
            <div key={l} className="flex justify-between gap-space-sm py-1.5 text-body-sm">
              <dt className="text-on-surface-variant">{l}</dt>
              <dd className="text-right font-semibold text-on-surface">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="whitespace-pre-wrap rounded-md bg-surface-container-low p-space-sm text-body-md text-on-surface">{d.uraian}</p>
        {fotos.length > 0 && (
          <div className="grid grid-cols-3 gap-space-xs">
            {fotos.map((p) => (srcOf(p) ? <img key={p.id} src={srcOf(p)} alt="Foto bukti" className="aspect-square w-full rounded-md object-cover" /> : <span key={p.id} className="aspect-square rounded-md bg-surface-container" />))}
          </div>
        )}
      </GlassCard>

      {/* Laporan & tindak lanjut sebagai stepper; tahap terbaru diketuk untuk membuka form tindak lanjut. */}
      <GlassCard level={2} className="animate-entrance-2 flex flex-col p-space-md">
        <Stepper judul="Laporan & tindak lanjut" langkah={langkah} />
      </GlassCard>

      <Sheet
        open={buka}
        onOpenChange={setBuka}
        title="Tindak lanjut WBS"
        description={`${r.id} · status saat ini ${statusWbs(r.status).label}`}
        footer={
          <div className="flex flex-col gap-space-xs">
            <ErrorBox text={error} />
            <Button size="lg" disabled={busy} onClick={() => void simpan()}>
              {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
              Simpan tindak lanjut
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-space-md pb-space-sm">
          <Choice label="Status" value={statusBaru} onChange={(v) => setStatus(v)} options={STATUS_WBS.filter((s) => s.value !== 'baru').map((s) => ({ value: s.value, label: s.label }))} />
          <Field label="Catatan" htmlFor="wbs-tl">
            <Textarea id="wbs-tl" className="min-h-[88px]" placeholder="Mis. klarifikasi ke pihak terkait, hasil investigasi, sanksi" value={catatan} onChange={(e) => (setError(null), setCatatan(e.target.value))} />
          </Field>
        </div>
      </Sheet>
      {guard.dialog}
    </div>
  )
}
