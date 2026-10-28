import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Beaker, Camera, ChevronRight, CircleCheck, Flag, Lock, Plus, Send, Trash2, TriangleAlert } from 'lucide-react'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Field, Ladder } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { LayarKirimWa } from '@/components/bongkaran/kirim-wa'
import { PilihHarian } from '@/components/bongkaran/pilih-harian'
import { useKunciShift } from '@/components/bongkaran/pilih-shift'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { SimpanBaris } from '@/components/bongkaran/simpan-baris'
import { StokGate, useStokShift } from '@/components/bongkaran/stok-gate'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import {
  newQqKualitas,
  qqD15,
  qqRecordId,
  totalPumpTest,
  type QqData,
  type QqKualitas,
  type QqRecord,
} from '@/lib/daily'
import { formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatNumber } from '@/lib/format'
import { namaSpbuWa, tanggalPanjang } from '@/lib/gts'
import { BATAS_HARIAN, lewatBatas, statusHarian } from '@/lib/harian'
import { simpanFotoHarian } from '@/lib/foto-harian'
import { capWaktu, compressImage, genId, zonaWaktu } from '@/lib/image'
import { buatKolaseGrid } from '@/lib/kolase'
import { acuanD15 } from '@/lib/ringkasan'
import { PRODUK_OPTIONS } from '@/lib/sop'
import { cn } from '@/lib/utils'
import { buildWaQq, type BarisQqWa } from '@/lib/wa'

/** Waktu (di luar render). */
const stamp = () => Date.now()
const isoNow = () => new Date().toISOString()
const jamDari = (iso?: string) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '')
const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

const kualitasValid = (k: QqKualitas) => (!qqD15(k).d15 ? 'Lengkapi density dan suhu.' : null)

function upsert<T extends { id: string }>(list: T[], item: T) {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
}

/** Operation > Kualitas Harian > Density Harian: sekali sehari di shift 1, paling lambat 10:00 (hijau selesai, oranye belum, merah terlewat). */
export function QqHarianMenu() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  // Catatan lama per shift tetap dihitung untuk tanggalnya.
  const rec = (tanggal: string) =>
    app.daily.find((d): d is QqRecord => d.kind === 'qq' && d.id === qqRecordId(tanggal, 1)) ??
    app.daily.find((d): d is QqRecord => d.kind === 'qq' && d.tanggal === tanggal && !!d.data.selesaiAt)
  return (
    <div className="flex flex-col gap-space-md">
      <PilihHarian
        judul="Density harian"
        status={(t) => statusHarian(t, !!rec(t)?.data.selesaiAt)}
        keHalaman={(t) => `/kualitas/${t}/1`}
        keterangan={(t, st) => {
          const r = rec(t)
          if (r?.data.selesaiAt) return `Selesai ${r.data.jam}${r.data.terlambat ? ' (terlambat)' : ''} · ${r.data.kualitas.map((x) => x.produk).join(', ') || '-'}`
          if (r) return `${st === 'terlewat' ? 'Terlewat' : 'Belum selesai'} · sebagian tersimpan`
          return st === 'belum' ? `Belum diuji · batas ${BATAS_HARIAN}` : undefined
        }}
      />
    </div>
  )
}

type SelesaiQq = { teks: string; files: File[]; urls: string[] }
type FotoUmum = 'struk'
/** Foto struk pump test: disimpan di riwayat aplikasi, tidak pernah ikut kolase WhatsApp grup SPBU. */
const FOTO_UMUM: { key: FotoUmum; label: string; hint: string }[] = [
  { key: 'struk', label: 'Foto struk pump test', hint: 'Struk pump test uji kualitas terbaca. Disimpan di riwayat aplikasi, tidak ikut kolase WhatsApp grup SPBU.' },
]

/**
 * Halaman form Density Harian (hari ini, shift 1, paling lambat 10:00): density per produk (disimpan
 * per baris), foto hydrometer tiap produk (kolase WhatsApp) dan struk pump test (disimpan
 * di riwayat aplikasi). Foto kolase juga disimpan sementara di HP untuk laporan gabungan Kualitas Harian.
 */
export function QqHarian() {
  const app = useApp()
  const toast = useToast()
  const { tanggal, shift, valid } = useKunciShift()
  const bolehIsi = tanggal === todayIso() && shift === 1
  const key = { tanggal, shift }
  const { key: now, missing: stokKosong } = useStokShift()
  const records = useMemo(() => app.daily.filter((d): d is QqRecord => d.kind === 'qq'), [app.daily])
  const id = qqRecordId(key.tanggal, key.shift)
  const existing = records.find((r) => r.id === id) ?? null
  const [draft, setDraft] = useState<{ id: string; data: QqData } | null>(null)
  const [rowError, setRowError] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const fresh = (): QqData => ({
    petugas: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName,
    jam: nowHm(),
    kualitas: [newQqKualitas(PRODUK_OPTIONS[0])],
    kuantitas: [],
    catatan: '',
  })
  const data: QqData = draft?.id === id ? draft.data : (existing?.data ?? fresh())
  // Foto hanya di HP sampai dikirim ke WhatsApp: per baris produk + struk pump test.
  const [foto, setFoto] = useState<Record<string, FotoLokal>>({})
  const [waktuFoto, setWaktuFoto] = useState<Record<string, string>>({})
  const [selesaiWa, setSelesaiWa] = useState<SelesaiQq | null>(null)
  const [dibagikan, setDibagikan] = useState(false)
  const belumSimpan = draft?.id === id && !data.selesaiAt ? data.kualitas.filter((k) => !k.savedAt).length + data.kuantitas.filter((n) => !n.savedAt).length : 0
  const guard = useLeaveGuard({
    active: bolehIsi && (!selesaiWa || !dibagikan),
    title: selesaiWa ? 'Foto belum dikirim ke WhatsApp' : 'Keluar dari density harian?',
    detail: selesaiWa
      ? 'Hasil uji sudah tersimpan, tetapi foto tidak disimpan di aplikasi dan akan hilang bila keluar sekarang.'
      : belumSimpan
        ? `${belumSimpan} baris uji belum disimpan dan akan hilang. Simpan tiap baris dengan tombol Simpan sebelum keluar.`
        : 'Baris yang sudah disimpan tetap ada; uji baru dianggap selesai setelah dikirim. Foto yang sudah diambil akan hilang.',
  })

  if (!app.loaded) return <Loading />
  if (!valid) return <GlassCard className="p-space-md">Shift tidak dikenal.</GlassCard>
  if (!bolehIsi)
    return (
      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <span className="text-body-md font-bold text-on-surface">Uji kualitas harian {formatTanggalIso(tanggal)}</span>
        <span className="text-body-sm text-on-surface-variant">
          Uji kualitas harian diisi sekali sehari pada hari yang sama, shift 1, paling lambat pukul {BATAS_HARIAN}.{existing?.data.selesaiAt ? ` Uji tanggal ini selesai pukul ${existing.data.jam}.` : ''}
        </span>
        <Link to="/laporan/kualitas" className={buttonVariants({ variant: 'glass' })}>
          Lihat riwayat kualitas
        </Link>
      </GlassCard>
    )

  const setData = (patch: Partial<QqData>) => {
    setError(null)
    setDraft({ id, data: { ...data, ...patch } })
  }
  // Mengubah baris membatalkan tanda "tersimpan" sampai disimpan lagi.
  const setK = (i: number, patch: Partial<QqKualitas>) => setData({ kualitas: data.kualitas.map((k, j) => (j === i ? { ...k, ...patch, savedAt: undefined } : k)) })

  /** Simpan ke server berdasar data yang sudah tersimpan (baris lain yang belum disimpan tidak ikut). */
  const persist = async (mutate: (base: QqData) => QqData) => {
    const base: QqData = existing?.data ?? { ...data, kualitas: [], kuantitas: [], foto: {}, selesaiAt: undefined }
    const next = mutate({ ...base, petugas: data.petugas, jam: data.jam })
    const rec: QqRecord = {
      id,
      kind: 'qq',
      tanggal: key.tanggal,
      shift: key.shift,
      data: next,
      createdAt: existing?.createdAt ?? stamp(),
      updatedAt: stamp(),
      createdBy: existing?.createdBy ?? app.session.user?.id ?? null,
    }
    await app.saveDaily(rec)
  }

  const simpanKualitas = async (i: number) => {
    const row = data.kualitas[i]
    const adaNozzle = (app.settings.nozzles ?? []).some((n) => n.produk === row.produk)
    const err = kualitasValid(row) ?? (adaNozzle && !row.nozzleId ? 'Pilih nozzle tempat sampel pump test diambil.' : null)
    if (err) return setRowError({ ...rowError, [row.id]: err })
    const saved = { ...row, savedAt: isoNow() }
    setBusy(row.id)
    try {
      await persist((b) => ({ ...b, kualitas: upsert(b.kualitas, saved) }))
      setDraft({ id, data: { ...data, kualitas: data.kualitas.map((k) => (k.id === row.id ? saved : k)) } })
      setRowError({ ...rowError, [row.id]: '' })
      toast(`Uji ${row.produk} tersimpan`)
    } catch (e) {
      setRowError({ ...rowError, [row.id]: pesan(e) })
    } finally {
      setBusy(null)
    }
  }

  const hapusBaris = async (kind: 'kualitas' | 'kuantitas', rowId: string) => {
    const tersimpan = (existing?.data[kind] as { id: string }[] | undefined)?.some((x) => x.id === rowId)
    if (kind === 'kualitas') {
      setData({ kualitas: data.kualitas.filter((x) => x.id !== rowId) })
      buangFoto(rowId)
    }
    else setData({ kuantitas: data.kuantitas.filter((x) => x.id !== rowId) })
    if (tersimpan) {
      try {
        await persist((b) => ({ ...b, [kind]: (b[kind] as { id: string }[]).filter((x) => x.id !== rowId) }) as QqData)
      } catch (e) {
        setError(pesan(e))
      }
    }
  }

  const ambilFoto = async (key: string, files: File[]) => {
    setBusy(`foto-${key}`)
    try {
      // Satu foto per bagian: foto baru menggantikan yang lama. Cap ditulis saat kolase dibuat.
      const waktu = capWaktu()
      const blob = await compressImage(files[files.length - 1], { maxSize: 1600, quality: 0.85 })
      const baru: FotoLokal = { id: genId('f'), blob, url: URL.createObjectURL(blob) }
      setFoto((x) => {
        if (x[key]) URL.revokeObjectURL(x[key].url)
        return { ...x, [key]: baru }
      })
      setWaktuFoto((w) => ({ ...w, [baru.id]: waktu }))
    } catch (e) {
      setError(`Gagal memproses foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }
  const buangFoto = (key: string) =>
    setFoto((x) => {
      if (x[key]) URL.revokeObjectURL(x[key].url)
      const { [key]: _, ...sisa } = x
      return sisa
    })
  const fotoSlot = (key: string, label: string, hint: string) => (
    <FotoWajib
      key={key}
      label={label}
      hint={hint}
      fotos={foto[key] ? [foto[key]] : []}
      busy={busy === `foto-${key}`}
      disabled={busy === 'selesai'}
      onAdd={(files) => void ambilFoto(key, files)}
      onRemove={() => buangFoto(key)}
    />
  )

  /** Baris laporan per produk (D15, acuan uji pasca penerimaan terbaru, selisih). */
  const barisWa = (): BarisQqWa[] =>
    data.kualitas.map((k) => {
      const { obs, d15 } = qqD15(k)
      const ref = acuanD15(app.reports, k.produk, key.tanggal)
      const selisih = d15 && ref ? Math.round((d15.value - ref.d15) * 10000) / 10000 : null
      return { produk: k.produk, obs, suhu: k.suhu, d15: d15?.value ?? null, acuan: ref?.d15 ?? null, selisih, ok: selisih === null ? null : Math.abs(selisih) <= app.rules.densityTolerance + 1e-9, pumpTest: k.pumpTest }
    })

  const selesaikan = async () => {
    if (!data.kualitas.length) return setError('Isi minimal satu uji kualitas.')
    if (data.kualitas.some((k) => !k.savedAt)) return setError('Simpan dulu setiap baris uji (tombol Simpan di tiap produk).')
    const tanpaFoto = data.kualitas.filter((k) => !foto[k.id]).map((k) => k.produk)
    if (tanpaFoto.length) return setError(`Foto hydrometer belum ada: ${tanpaFoto.join(', ')}.`)
    const kurang = FOTO_UMUM.filter((f) => !foto[f.key]).map((f) => f.label)
    if (kurang.length) return setError(`Foto wajib belum ada: ${kurang.join(', ')}.`)
    if (!data.petugas.trim()) return setError('Isi nama petugas.')
    setBusy('selesai')
    try {
      const jam = nowHm()
      const terlambat = lewatBatas(jam)
      // Struk pump test disimpan di aplikasi (riwayat kualitas), bukan dikirim ke grup WhatsApp.
      const struk = await app.backend.uploadPhoto(`daily-${id}`, foto.struk.blob, `qq-struk-${key.tanggal}.jpg`)
      await persist(() => ({ ...data, jam, foto: { kualitasStruk: [struk] }, selesaiAt: isoNow(), terlambat }))
      const spbu = namaSpbuWa(app.settings)
      const baris = barisWa()
      const cap = (f: FotoLokal, ket: string) => ({ blob: f.blob, cap: [waktuFoto[f.id] ?? capWaktu(), spbu, ket] })
      // Kolase hanya foto hydrometer per produk (struk pump test tidak pernah ikut).
      const bagian = data.kualitas.map((k, i) => {
        const b = baris[i]
        return cap(foto[k.id], `${k.produk} · Density std. 15 °C ${formatDensity(b.d15)}${b.selisih === null ? '' : ` · selisih ${formatDensitySigned(b.selisih)}`}`)
      })
      const kolase = await buatKolaseGrid(bagian)
      // Disimpan sementara di HP untuk menu Kirim ke grup WA (gabungan density & water content).
      void simpanFotoHarian(app.spbuId, key.tanggal, 'density', bagian)
      const files = [new File([kolase], `Kontrol_Kualitas_Harian_${key.tanggal}.jpg`, { type: 'image/jpeg' })]
      const teks = buildWaQq(
        { tanggal: key.tanggal, jam, petugas: data.petugas.trim(), terlambat, totalPumpTest: totalPumpTest(data).kualitas, catatan: data.catatan?.trim() ?? '' },
        baris,
        spbu,
        tanggalPanjang(key.tanggal),
        zonaWaktu(),
      )
      setSelesaiWa({ teks, files, urls: [URL.createObjectURL(kolase)] })
      setBusy(null)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  if (selesaiWa) {
    const lewat = barisWa().filter((b) => b.ok === false).map((b) => b.produk)
    return (
      <>
        <LayarKirimWa
          judul="Density harian tersimpan"
          keterangan={lewat.length ? `${lewat.join(', ')} melebihi toleransi density. Kirim laporan ke WhatsApp sekarang.` : 'Semua produk sesuai toleransi. Kirim sekarang ke grup WhatsApp, atau kirim gabungan dengan water content dari menu Kualitas Harian.'}
          teks={selesaiWa.teks}
          files={selesaiWa.files}
          urls={selesaiWa.urls}
          dibagikan={dibagikan}
          onDibagikan={() => setDibagikan(true)}
        >
          <Link to={`/laporan/kualitas?baru=${encodeURIComponent(`h.${id}.`)}`} replace className={buttonVariants({ variant: 'glass', size: 'lg' })}>
            Lihat riwayat kualitas
          </Link>
          <Link to="/kualitas" replace className={buttonVariants({ variant: 'glass', size: 'lg' })}>
            Kembali ke Kualitas Harian
          </Link>
        </LayarKirimWa>
        {guard.dialog}
      </>
    )
  }

  const pump = totalPumpTest(data)
  const isNow = key.tanggal === now.tanggal && key.shift === now.shift
  const selesai = !!existing?.data.selesaiAt && !draft
  // Sama dengan Input Bongkaran: form shift berjalan dikunci sampai stok awal shift diisi.
  const kunci = isNow && stokKosong

  return (
    <div className="flex flex-col gap-space-md">
      {isNow && <StokGate action="uji Q&Q" />}

      <fieldset disabled={kunci} className="flex min-w-0 flex-col gap-space-md disabled:*:not-last:[filter:opacity(0.6)]">

      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <h2 className="text-headline-md font-bold text-on-surface">Density harian</h2>
            <span className="text-body-sm text-on-surface-variant">
              {formatTanggalIso(key.tanggal)} · Shift 1 · batas {BATAS_HARIAN}
            </span>
            {lewatBatas(nowHm()) && !existing?.data.selesaiAt && <span className="text-body-sm font-semibold text-error">Sudah lewat pukul {BATAS_HARIAN}: laporan dicatat terlambat.</span>}
          </div>
          {existing?.data.selesaiAt ? <Pill tone="success">Selesai</Pill> : existing ? <Pill tone="cyan">Sebagian tersimpan</Pill> : <Pill>Belum diuji</Pill>}
        </div>
        <Field label="Jam uji" htmlFor="qq-jam">
          <Input id="qq-jam" type="time" value={data.jam} onChange={(e) => setData({ jam: e.target.value })} />
        </Field>
        <Field label="Petugas" htmlFor="qq-petugas">
          <Input id="qq-petugas" value={data.petugas} onChange={(e) => setData({ petugas: e.target.value })} />
        </Field>
      </GlassCard>

      <section aria-labelledby="uji-kualitas" className="flex flex-col gap-space-sm">
        <SectionHeader id="uji-kualitas" title="Uji kualitas (density)" />
        {data.kualitas.map((k, i) => {
          const { obs, d15 } = qqD15(k)
          const ref = acuanD15(app.reports, k.produk, key.tanggal)
          const selisih = d15 && ref ? Math.round((d15.value - ref.d15) * 10000) / 10000 : null
          const ok = selisih === null ? null : Math.abs(selisih) <= app.rules.densityTolerance + 1e-9
          return (
            <GlassCard key={k.id} level={2} className={cn('flex flex-col gap-space-sm p-space-md', !k.savedAt && 'border border-amber-300')}>
              <div className="grid grid-cols-[1fr_auto] items-end gap-space-xs">
                <Field label="Produk" htmlFor={`qk-p-${k.id}`}>
                  <Select value={k.produk} onValueChange={(v) => setK(i, { produk: v, nozzleId: undefined, nozzle: undefined })}>
                    <SelectTrigger id={`qk-p-${k.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUK_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button variant="ghost" size="icon" aria-label={`Hapus uji ${k.produk}`} onClick={() => void hapusBaris('kualitas', k.id)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              {(() => {
                const pilihan = (app.settings.nozzles ?? []).filter((n) => n.produk === k.produk)
                return pilihan.length ? (
                  <Field label="Nozzle pump test" htmlFor={`qk-n-${k.id}`}>
                    <Select
                      value={pilihan.some((n) => n.id === k.nozzleId) ? k.nozzleId : undefined}
                      onValueChange={(v) => setK(i, { nozzleId: v, nozzle: pilihan.find((n) => n.id === v)?.nama })}
                    >
                      <SelectTrigger id={`qk-n-${k.id}`}>
                        <SelectValue placeholder="Pilih nozzle sampel" />
                      </SelectTrigger>
                      <SelectContent>
                        {pilihan.map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            Nozzle {n.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null
              })()}
              <div className="grid grid-cols-3 gap-space-sm">
                <Field label="Density" htmlFor={`qk-d-${k.id}`} hint="Contoh: 0,7450">
                  <Input id={`qk-d-${k.id}`} numeric inputMode="decimal" value={k.densityObs} onChange={(e) => setK(i, { densityObs: e.target.value })} />
                </Field>
                <Field label="Suhu" htmlFor={`qk-s-${k.id}`}>
                  <Input id={`qk-s-${k.id}`} numeric inputMode="decimal" suffix="°C" value={k.suhu} onChange={(e) => setK(i, { suhu: e.target.value })} />
                </Field>
                <Field label="Pump test" htmlFor={`qk-v-${k.id}`}>
                  <Input id={`qk-v-${k.id}`} numeric inputMode="decimal" suffix="L" value={k.pumpTest} onChange={(e) => setK(i, { pumpTest: e.target.value })} />
                </Field>
              </div>
              <Ladder
                rows={[
                  ['Density observasi', formatDensity(obs)],
                  ['Density std. 15 °C', d15 ? formatDensity(d15.value) : '-'],
                  [`Acuan Density std. 15 °C pasca penerimaan ${ref ? formatTanggalIso(ref.tanggal) : 'terbaru'}`, ref ? formatDensity(ref.d15) : 'belum ada'],
                ]}
                total={['Selisih', selisih !== null ? formatDensitySigned(selisih) : '-']}
              />
              {fotoSlot(k.id, `Foto hydrometer ${k.produk}`, 'Hydrometer & termometer di gelas ukur, angka density dan suhu terbaca.')}
              <SimpanBaris
                ok={ok}
                okText={ok ? 'Sesuai toleransi' : `Melebihi toleransi ${formatDensity(app.rules.densityTolerance)}`}
                savedAt={k.savedAt}
                busy={busy === k.id}
                error={rowError[k.id]}
                onSave={() => void simpanKualitas(i)}
                label={`Simpan uji ${k.produk}`}
              />
            </GlassCard>
          )
        })}
        <Button variant="glass" size="pill" className="self-center" onClick={() => setData({ kualitas: [...data.kualitas, newQqKualitas(PRODUK_OPTIONS[0])] })}>
          <Plus aria-hidden="true" />
          Uji produk lain
        </Button>
      </section>


      {data.kualitas.length > 0 && (
        <GlassCard level={1} className="flex flex-col gap-space-sm p-space-md">
          <span className="flex items-center gap-space-xs text-body-sm font-bold text-on-surface">
            <Flag aria-hidden="true" className="size-4 text-primary" />
            Langkah terakhir
          </span>
          {FOTO_UMUM.map((f) => fotoSlot(f.key, f.label, f.hint))}
          <Field label="Catatan (opsional)" htmlFor="qq-catatan">
            <Input id="qq-catatan" autoComplete="off" value={data.catatan ?? ''} onChange={(e) => setData({ catatan: e.target.value })} />
          </Field>
          <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
            <Camera aria-hidden="true" className="size-4 shrink-0" />
            Foto hydrometer tiap produk digabung otomatis menjadi satu kolase bercap jam, SPBU, dan hasil untuk WhatsApp grup SPBU. Foto struk pump test tidak ikut kolase: disimpan di riwayat kualitas aplikasi.
          </span>
        </GlassCard>
      )}

      {/* Tera takaran bejana 20 L kini modul tersendiri: Input > Uji Takaran. */}
      {app.can('/takaran') && (
        <Link to="/takaran" className="glass-1 flex min-h-14 items-center gap-space-sm rounded-lg p-space-sm active:scale-[0.99]">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <Beaker className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-md font-semibold text-on-surface">Tera takaran bejana 20 L</span>
            <span className="text-body-sm text-on-surface-variant">Menu Operation &gt; Uji Takaran (per nozzle, opsi Preset & Manual, foto)</span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
        </Link>
      )}

      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <Ladder rows={[['Pump test uji kualitas', `${formatNumber(pump.kualitas, 1)} L`]]} total={['Total pump test', `${formatNumber(pump.kualitas + pump.kuantitas, 1)} L`]} />
        {error && (
          <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
            <span className="text-body-sm font-semibold text-on-error-container">{error}</span>
          </div>
        )}
        {selesai && (
          <span className="flex items-center gap-1.5 text-body-sm font-semibold text-primary">
            <CircleCheck aria-hidden="true" className="size-4" />
            Uji selesai {jamDari(existing?.data.selesaiAt)}; kirim ulang bila ada koreksi (ambil foto lagi).
          </span>
        )}
        {kunci ? (
          <Button size="lg" variant="soft" className="w-full bg-neutral-200 text-neutral-700 shadow-none disabled:opacity-100" disabled>
            <Lock aria-hidden="true" />
            Isi stok awal dulu
          </Button>
        ) : (
          <Button size="lg" className="w-full" disabled={busy !== null} onClick={selesaikan}>
            <Send aria-hidden="true" />
            {busy === 'selesai' ? 'Menyimpan…' : selesai ? 'Kirim ulang laporan ke WhatsApp' : 'Selesaikan & lanjut kirim ke WhatsApp'}
          </Button>
        )}
      </GlassCard>
      </fieldset>

      {guard.dialog}
    </div>
  )
}
