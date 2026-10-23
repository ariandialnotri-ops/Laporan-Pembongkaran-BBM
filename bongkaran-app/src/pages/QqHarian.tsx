import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Beaker, Camera, ChevronRight, CircleCheck, CircleDot, Droplet, Flag, Lock, Plus, Save, Send, Trash2, TriangleAlert } from 'lucide-react'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Field, Ladder } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { LayarKirimWa } from '@/components/bongkaran/kirim-wa'
import { PilihHarian } from '@/components/bongkaran/pilih-harian'
import { useKunciShift } from '@/components/bongkaran/pilih-shift'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StokGate, useStokShift } from '@/components/bongkaran/stok-gate'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { airId, literAir, statusAir, tangkiBerair, type AirData, type AirRecord } from '@/lib/air'
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
import { formatDensity, formatDensitySigned, formatLiter, formatNumber } from '@/lib/format'
import { namaSpbuWa, tanggalPanjang } from '@/lib/gts'
import { BATAS_HARIAN, lewatBatas, statusHarian } from '@/lib/harian'
import { capWaktu, compressImage, genId, zonaWaktu } from '@/lib/image'
import { buatKolaseGrid } from '@/lib/kolase'
import { acuanD15 } from '@/lib/ringkasan'
import { PRODUK_OPTIONS } from '@/lib/sop'
import { TANKS, tankName, type Tank } from '@/lib/tank'
import { useAir } from '@/lib/use-air'
import { cn } from '@/lib/utils'
import { buildWaQq, type BarisQqWa } from '@/lib/wa'

/** Waktu (di luar render). */
const stamp = () => Date.now()
const isoNow = () => new Date().toISOString()
const jamDari = (iso?: string) => (iso ? new Date(iso).toTimeString().slice(0, 5) : '')
const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

const kualitasValid = (k: QqKualitas) => (!qqD15(k).d15 ? 'Lengkapi density dan suhu.' : null)
const namaTangki = (t: Tank) => `${tankName(t.tankNo)} · ${t.produk}`
/** Status water content dari isian form (belum disimpan). */
const stAir = (airMm: string) => statusAir({ airMm, liter: null, foto: [], tindakan: '' })

function upsert<T extends { id: string }>(list: T[], item: T) {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
}

/** Operation > Kualitas Harian: sekali sehari di shift 1, paling lambat 10:00 (hijau selesai, oranye belum, merah terlewat). */
export function QqHarianMenu() {
  const app = useApp()
  const hariIni = todayIso()
  const { recs: airRecs } = useAir(`${hariIni.slice(0, 7)}-01`, hariIni)
  if (!app.loaded) return <Loading />
  const air = (tanggal: string) => airRecs?.find((r) => r.id === airId(tanggal, 1))
  const ringkasAir = (tanggal: string) => {
    const a = air(tanggal)
    if (!a || !TANKS.length) return ''
    const berair = tangkiBerair(a, TANKS)
    return ` · ${berair.length ? `ada air: ${berair.map((t) => tankName(t.tankNo)).join(', ')}` : 'air nihil'}`
  }
  // Catatan lama per shift tetap dihitung untuk tanggalnya.
  const rec = (tanggal: string) =>
    app.daily.find((d): d is QqRecord => d.kind === 'qq' && d.id === qqRecordId(tanggal, 1)) ??
    app.daily.find((d): d is QqRecord => d.kind === 'qq' && d.tanggal === tanggal && !!d.data.selesaiAt)
  return (
    <div className="flex flex-col gap-space-md">
      <p className="animate-entrance-1 px-space-xs text-body-sm text-on-surface-variant">
        Sekali sehari di shift 1, paling lambat pukul {BATAS_HARIAN}: uji density & suhu per produk dan water content setiap tangki pendam. Foto hydrometer, stik pasta air, struk pump test, dan pengembalian minyak digabung menjadi satu kolase dan dikirim ke WhatsApp dalam satu laporan; foto tidak disimpan di aplikasi.
      </p>
      <PilihHarian
        judul="Kontrol kualitas harian"
        status={(t) => statusHarian(t, !!rec(t)?.data.selesaiAt)}
        keHalaman={(t) => `/kualitas/${t}/1`}
        keterangan={(t, st) => {
          const r = rec(t)
          if (r?.data.selesaiAt) return `Selesai ${r.data.jam}${r.data.terlambat ? ' (terlambat)' : ''} · ${r.data.kualitas.map((x) => x.produk).join(', ') || '-'}${ringkasAir(t)}`
          if (r) return `${st === 'terlewat' ? 'Terlewat' : 'Belum selesai'} · sebagian tersimpan`
          return st === 'belum' ? `Belum diuji · batas ${BATAS_HARIAN}` : undefined
        }}
      />
      {app.can('/laporan/air') && TANKS.length > 0 && (
        <Link to="/laporan/air" className={buttonVariants({ variant: 'glass' })}>
          Riwayat water content
        </Link>
      )}
    </div>
  )
}

type SelesaiQq = { teks: string; files: File[]; urls: string[]; air: AirRecord | null }
type FotoUmum = 'struk' | 'kembali'
const FOTO_UMUM: { key: FotoUmum; label: string; hint: string }[] = [
  { key: 'struk', label: 'Foto struk pump test', hint: 'Struk pump test uji kualitas terbaca.' },
  { key: 'kembali', label: 'Foto pengembalian minyak ke tangki', hint: 'Minyak sampel dituang kembali ke tangki pendam.' },
]

/**
 * Halaman form Kontrol Kualitas Harian (hari ini, shift 1, paling lambat 10:00): density per produk
 * (disimpan per baris) dan water content setiap tangki pendam, foto hydrometer, stik pasta air, struk
 * + pengembalian, lalu satu kolase foto & satu laporan WhatsApp. Uji kualitas tersimpan di bbm_daily
 * (kind qq) dan water content di bbm_air seperti sebelumnya. Foto tidak disimpan di aplikasi.
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
  const { recs: airRecs } = useAir(tanggal, tanggal)
  const lamaAir = airRecs?.find((r) => r.id === airId(tanggal, 1))
  const [isianAir, setIsianAir] = useState<Record<string, { airMm: string; tindakan: string }>>({})

  const fresh = (): QqData => ({
    petugas: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName,
    jam: nowHm(),
    kualitas: [newQqKualitas(PRODUK_OPTIONS[0])],
    kuantitas: [],
    catatan: '',
  })
  const data: QqData = draft?.id === id ? draft.data : (existing?.data ?? fresh())
  // Foto hanya di HP sampai dikirim ke WhatsApp: per baris produk + struk & pengembalian.
  const [foto, setFoto] = useState<Record<string, FotoLokal>>({})
  const [waktuFoto, setWaktuFoto] = useState<Record<string, string>>({})
  const [selesaiWa, setSelesaiWa] = useState<SelesaiQq | null>(null)
  const [dibagikan, setDibagikan] = useState(false)
  const belumSimpan = draft?.id === id && !data.selesaiAt ? data.kualitas.filter((k) => !k.savedAt).length + data.kuantitas.filter((n) => !n.savedAt).length : 0
  const guard = useLeaveGuard({
    active: bolehIsi && (!selesaiWa || !dibagikan),
    title: selesaiWa ? 'Foto belum dikirim ke WhatsApp' : 'Keluar dari kontrol kualitas harian?',
    detail: selesaiWa
      ? 'Hasil uji sudah tersimpan, tetapi foto tidak disimpan di aplikasi dan akan hilang bila keluar sekarang.'
      : belumSimpan
        ? `${belumSimpan} baris uji belum disimpan dan akan hilang. Simpan tiap baris dengan tombol Simpan sebelum keluar.`
        : 'Baris yang sudah disimpan tetap ada; uji baru dianggap selesai setelah dikirim. Foto yang sudah diambil akan hilang.',
  })

  if (!app.loaded || (TANKS.length > 0 && bolehIsi && airRecs === null)) return <Loading />
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
  const nilaiAir = (t: Tank) => isianAir[t.id] ?? { airMm: lamaAir?.data.tangki[t.id]?.airMm ?? '', tindakan: lamaAir?.data.tangki[t.id]?.tindakan ?? '' }
  const ubahAir = (t: Tank, patch: Partial<{ airMm: string; tindakan: string }>) => {
    setError(null)
    setIsianAir((x) => ({ ...x, [t.id]: { ...nilaiAir(t), ...patch } }))
  }
  const keteranganAir = (t: Tank) => {
    const v = nilaiAir(t)
    const st = stAir(v.airMm)
    if (st === 'nihil') return 'Air nihil'
    const l = literAir(t, v.airMm)
    return `Air ${v.airMm} mm${l ? ` ≈ ${formatLiter(l)}` : ''}`
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
    for (const t of TANKS) {
      const v = nilaiAir(t)
      const st = stAir(v.airMm)
      if (st === 'kosong') return setError(`Water content ${namaTangki(t)}: isi tinggi air (0 bila nihil).`)
      if (!foto[`air-${t.id}`]) return setError(`Water content ${namaTangki(t)}: foto stik pasta air wajib.`)
      if (st === 'ada' && !v.tindakan.trim()) return setError(`Water content ${namaTangki(t)}: ada air, isi tindakan yang dilakukan.`)
    }
    const kurang = FOTO_UMUM.filter((f) => !foto[f.key]).map((f) => f.label)
    if (kurang.length) return setError(`Foto wajib belum ada: ${kurang.join(', ')}.`)
    if (!data.petugas.trim()) return setError('Isi nama petugas.')
    setBusy('selesai')
    try {
      const jam = nowHm()
      const terlambat = lewatBatas(jam)
      await persist(() => ({ ...data, jam, foto: undefined, selesaiAt: isoNow(), terlambat }))
      // Water content tangki pendam: satu catatan per hari (shift 1) di bbm_air.
      let airRec: AirRecord | null = null
      if (TANKS.length) {
        const tangki: AirData['tangki'] = {}
        for (const t of TANKS) {
          const v = nilaiAir(t)
          tangki[t.id] = { airMm: v.airMm.trim(), liter: literAir(t, v.airMm), foto: [], tindakan: stAir(v.airMm) === 'nihil' ? '' : v.tindakan.trim() }
        }
        airRec = {
          id: airId(tanggal, 1),
          tanggal,
          shift: 1,
          data: { tangki, petugas: data.petugas.trim(), jam, catatan: data.catatan?.trim() ?? '', terlambat },
          createdAt: lamaAir?.createdAt ?? stamp(),
          updatedAt: stamp(),
          createdBy: lamaAir?.createdBy ?? app.session.user?.id ?? null,
        }
        await app.backend.saveAir(airRec)
      }
      const spbu = namaSpbuWa(app.settings)
      const baris = barisWa()
      const cap = (f: FotoLokal, ket: string) => ({ blob: f.blob, cap: [waktuFoto[f.id] ?? capWaktu(), spbu, ket] })
      const kolase = await buatKolaseGrid([
        ...data.kualitas.map((k, i) => {
          const b = baris[i]
          return cap(foto[k.id], `${k.produk} · Density std. 15 °C ${formatDensity(b.d15)}${b.selisih === null ? '' : ` · selisih ${formatDensitySigned(b.selisih)}`}`)
        }),
        ...TANKS.map((t) => cap(foto[`air-${t.id}`], `${namaTangki(t)} · ${keteranganAir(t)}`)),
        ...FOTO_UMUM.map((f) => cap(foto[f.key], f.label.replace('Foto ', ''))),
      ])
      const files = [new File([kolase], `Kontrol_Kualitas_Harian_${key.tanggal}.jpg`, { type: 'image/jpeg' })]
      const teks = buildWaQq(
        { tanggal: key.tanggal, jam, petugas: data.petugas.trim(), terlambat, totalPumpTest: totalPumpTest(data).kualitas, catatan: data.catatan?.trim() ?? '' },
        baris,
        spbu,
        tanggalPanjang(key.tanggal),
        zonaWaktu(),
        airRec ? { rec: airRec, tanks: TANKS } : undefined,
      )
      setSelesaiWa({ teks, files, urls: [URL.createObjectURL(kolase)], air: airRec })
      setBusy(null)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  if (selesaiWa) {
    const lewat = barisWa().filter((b) => b.ok === false).map((b) => b.produk)
    const berair = tangkiBerair(selesaiWa.air ?? undefined, TANKS)
    const masalah = [
      ...(lewat.length ? [`${lewat.join(', ')} melebihi toleransi density`] : []),
      ...(berair.length ? [`ada air di ${berair.map((t) => tankName(t.tankNo)).join(', ')} (lakukan penyedotan dan laporkan ke pengawas)`] : []),
    ]
    return (
      <>
        <LayarKirimWa
          judul="Kontrol kualitas harian tersimpan"
          keterangan={
            masalah.length
              ? `${masalah.join('; ')}. Kirim laporan ke WhatsApp sekarang.`
              : `Semua produk sesuai toleransi${selesaiWa.air ? ' dan semua tangki nihil air' : ''}. Foto tidak disimpan di aplikasi: kirim sekarang ke grup WhatsApp.`
          }
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
            Kembali ke Kontrol Kualitas Harian
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
            <h2 className="text-headline-md font-bold text-on-surface">Kontrol kualitas harian</h2>
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
            <GlassCard key={k.id} level={2} className="flex flex-col gap-space-sm p-space-md">
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

      {TANKS.length > 0 && (
        <section aria-labelledby="uji-air" className="flex flex-col gap-space-sm">
          <SectionHeader id="uji-air" title="Water content tangki pendam" />
          <p className="px-space-xs text-body-sm text-on-surface-variant">
            Oleskan pasta air di ujung stik ukur, celupkan sampai dasar tangki, tunggu perubahan warna, lalu baca tinggi air. Tidak berubah warna = nihil (0 mm).
            {lamaAir ? ` Sudah diperiksa pukul ${lamaAir.data.jam}.` : ''}
          </p>
          {TANKS.map((t) => {
            const v = nilaiAir(t)
            const st = stAir(v.airMm)
            const liter = literAir(t, v.airMm)
            return (
              <GlassCard key={t.id} level={2} className={cn('flex flex-col gap-space-sm p-space-md', st === 'ada' && 'border border-error/40')}>
                <div className="flex items-center justify-between gap-space-sm">
                  <span className="flex min-w-0 items-center gap-space-xs">
                    <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', st === 'ada' ? 'bg-error text-on-error' : st === 'nihil' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant')}>
                      <Droplet className="size-5" />
                    </span>
                    <span className="text-body-md font-bold text-on-surface">{namaTangki(t)}</span>
                  </span>
                  {st !== 'kosong' && <Pill tone={st === 'ada' ? 'error' : 'success'}>{st === 'ada' ? `Ada air${liter ? ` ≈ ${formatLiter(liter)}` : ''}` : 'Nihil'}</Pill>}
                </div>
                <div className="flex items-end gap-space-xs">
                  <Field label="Tinggi air" htmlFor={`air-${t.id}`} className="flex-1">
                    <Input id={`air-${t.id}`} numeric inputMode="decimal" suffix="mm" value={v.airMm} onChange={(e) => ubahAir(t, { airMm: e.target.value })} />
                  </Field>
                  <Button variant={st === 'nihil' ? 'primary' : 'glass'} className="h-12" onClick={() => ubahAir(t, { airMm: '0' })}>
                    Nihil
                  </Button>
                </div>
                {fotoSlot(`air-${t.id}`, 'Foto stik pasta air', 'Ujung stik dengan pasta air setelah dicelupkan, angka tinggi air terbaca.')}
                {st === 'ada' && (
                  <Field label="Tindakan (wajib)" htmlFor={`air-tl-${t.id}`}>
                    <Input id={`air-tl-${t.id}`} autoComplete="off" placeholder="Mis. penyedotan air, lapor pengawas" value={v.tindakan} onChange={(e) => ubahAir(t, { tindakan: e.target.value })} />
                  </Field>
                )}
              </GlassCard>
            )
          })}
        </section>
      )}

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
            Semua foto (hydrometer, stik pasta air, struk, pengembalian) digabung otomatis menjadi satu kolase bercap jam, SPBU, dan hasil, lalu dikirim ke WhatsApp dalam satu laporan; tidak disimpan di aplikasi.
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

/** Status hasil + tombol simpan untuk satu baris uji. */
function SimpanBaris({
  ok,
  okText,
  savedAt,
  busy,
  error,
  onSave,
  label,
}: {
  ok: boolean | null
  okText: string
  savedAt?: string
  busy: boolean
  error?: string
  onSave: () => void
  label: string
}) {
  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <span className="flex flex-wrap items-center gap-space-xs">
          {ok !== null && <Pill tone={ok ? 'success' : 'error'}>{okText}</Pill>}
          {savedAt ? (
            <span className="flex items-center gap-1 text-body-sm text-primary">
              <CircleCheck aria-hidden="true" className="size-4" />
              Tersimpan {jamDari(savedAt)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
              <CircleDot aria-hidden="true" className="size-4" />
              Belum disimpan
            </span>
          )}
        </span>
        <Button size="sm" variant={savedAt ? 'glass' : 'primary'} disabled={busy} onClick={onSave} aria-label={label}>
          <Save aria-hidden="true" />
          Simpan
        </Button>
      </div>
      {error && <span className="text-body-sm font-semibold text-error">{error}</span>}
    </div>
  )
}
