import { useMemo, useState } from 'react'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { Link } from 'react-router-dom'
import { Camera, Droplet, LoaderCircle, Save, Trash2 } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { LayarKirimWa } from '@/components/bongkaran/kirim-wa'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { PilihHarian } from '@/components/bongkaran/pilih-harian'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { TangkiBelumAda } from '@/components/bongkaran/stok-gate'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { airId, airLengkap, literAir, statusAir, tangkiBerair, teksWaAir, type AirData, type AirRecord, type AirTangki } from '@/lib/air'
import { useApp } from '@/lib/app-state'
import { addDays, formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { formatLiter } from '@/lib/format'
import { namaSpbuWa } from '@/lib/gts'
import { BATAS_HARIAN, lewatBatas, statusHarian } from '@/lib/harian'
import { capWaktu, compressImage, genId, zonaWaktu } from '@/lib/image'
import { buatKolaseGrid } from '@/lib/kolase'
import { shiftLabel } from '@/lib/shift'
import { TANKS, tankName, type Tank } from '@/lib/tank'
import { useAir } from '@/lib/use-air'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const namaTangki = (t: Tank) => `${tankName(t.tankNo)} · ${t.produk}`
const keteranganMm = (t: AirTangki | undefined, tank: Tank | undefined) => {
  const st = statusAir(t)
  if (st === 'kosong' || !t) return '-'
  if (st === 'nihil') return 'Nihil'
  const l = t.liter ?? literAir(tank, t.airMm)
  return `${t.airMm} mm${l ? ` ≈ ${formatLiter(l)}` : ''}`
}

/** Operation > Water Content Tangki: sekali sehari di shift 1, paling lambat 10:00. */
export function AirMenu() {
  const app = useApp()
  const hariIni = todayIso()
  const { recs, error } = useAir(todayIso(addDays(new Date(`${hariIni}T00:00:00`), -60)), hariIni)
  if (!app.loaded || !recs) return <Loading />
  if (!TANKS.length) return <TangkiBelumAda className="animate-entrance-1" detail="Water content diperiksa per tangki pendam, jadi menunggu database tangki SPBU ini." />
  // Catatan lama per shift tetap dihitung untuk tanggalnya.
  const rec = (tanggal: string) => recs.find((r) => r.id === airId(tanggal, 1)) ?? recs.find((r) => r.tanggal === tanggal)
  return (
    <div className="flex flex-col gap-space-md">
      <p className="animate-entrance-1 px-space-xs text-body-sm text-on-surface-variant">
        Periksa air di dasar setiap tangki pendam dengan pasta air pada stik ukur, sekali sehari di shift 1 paling lambat pukul {BATAS_HARIAN}. Foto semua tangki digabung menjadi satu kolase dan dikirim ke WhatsApp; foto tidak disimpan di aplikasi.
      </p>
      <ErrorBox text={error} />
      <PilihHarian
        judul="Water content"
        status={(t) => statusHarian(t, airLengkap(rec(t), TANKS))}
        keHalaman={() => '/air/isi'}
        keterangan={(t, st) => {
          const r = rec(t)
          if (!r) return st === 'belum' ? `Belum diperiksa · batas ${BATAS_HARIAN}` : undefined
          const berair = tangkiBerair(r, TANKS)
          const isi = berair.length ? `Ada air: ${berair.map((x) => tankName(x.tankNo)).join(', ')}` : 'Semua tangki nihil'
          return `${isi} · ${r.data.jam}${r.data.terlambat ? ' (terlambat)' : ''} · ${r.data.petugas || '-'}`
        }}
      />
      {app.can('/laporan/air') && (
        <Link to="/laporan/air" className={buttonVariants({ variant: 'glass' })}>
          Riwayat water content
        </Link>
      )}
    </div>
  )
}

type IsianTangki = { airMm: string; tindakan: string; foto: FotoLokal | null }
type SelesaiAir = { rec: AirRecord; teks: string; files: File[]; urls: string[] }

/**
 * Form water content hari ini: semua tangki pendam. Isian disimpan; foto stik pasta air tiap tangki
 * digabung menjadi satu kolase lalu dikirim ke WhatsApp (tidak diunggah).
 */
export function AirForm() {
  const app = useApp()
  const tanggal = todayIso()
  const id = airId(tanggal, 1)
  const { recs } = useAir(tanggal, tanggal)
  const lama = recs?.find((r) => r.id === id)
  const konfirmasi = useKonfirmasi()
  const [isian, setIsian] = useState<Record<string, IsianTangki> | null>(null)
  const [waktuFoto, setWaktuFoto] = useState<Record<string, string>>({})
  const [petugas, setPetugas] = useState<string | null>(null)
  const [catatan, setCatatan] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selesai, setSelesai] = useState<SelesaiAir | null>(null)
  const [dibagikan, setDibagikan] = useState(false)
  const guard = useLeaveGuard({
    active: !selesai || !dibagikan,
    title: selesai ? 'Foto belum dikirim ke WhatsApp' : 'Keluar dari water content?',
    detail: selesai ? 'Data water content sudah tersimpan, tetapi foto tidak disimpan di aplikasi dan akan hilang bila keluar sekarang.' : 'Isian dan foto yang belum dikirim akan hilang.',
  })

  if (!app.loaded || !recs) return <Loading />
  if (!TANKS.length) return <TangkiBelumAda className="animate-entrance-1" />

  const awal = (t: Tank): IsianTangki => ({ airMm: lama?.data.tangki[t.id]?.airMm ?? '', tindakan: lama?.data.tangki[t.id]?.tindakan ?? '', foto: null })
  const nilai = (t: Tank) => isian?.[t.id] ?? awal(t)
  const ubah = (t: Tank, patch: Partial<IsianTangki>) => {
    setError(null)
    setIsian((x) => ({ ...(x ?? Object.fromEntries(TANKS.map((k) => [k.id, awal(k)]))), [t.id]: { ...nilai(t), ...patch } }))
  }
  const namaPetugas = petugas ?? lama?.data.petugas ?? (app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName)
  const isiCatatan = catatan ?? lama?.data.catatan ?? ''
  const telat = lewatBatas(nowHm())

  const ambil = async (t: Tank, files: File[]) => {
    setBusy(t.id)
    try {
      // Satu foto per tangki: foto baru menggantikan yang lama. Cap ditulis saat kolase dibuat.
      const waktu = capWaktu()
      const blob = await compressImage(files[files.length - 1], { maxSize: 1600, quality: 0.85 })
      const baru: FotoLokal = { id: genId('f'), blob, url: URL.createObjectURL(blob) }
      const lamaFoto = nilai(t).foto
      if (lamaFoto) URL.revokeObjectURL(lamaFoto.url)
      ubah(t, { foto: baru })
      setWaktuFoto((w) => ({ ...w, [baru.id]: waktu }))
    } catch (e) {
      setError(`Gagal memproses foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const kirim = async () => {
    for (const t of TANKS) {
      const v = nilai(t)
      const st = statusAir({ airMm: v.airMm, liter: null, foto: [], tindakan: '' })
      if (st === 'kosong') return setError(`${namaTangki(t)}: isi tinggi air (0 bila nihil).`)
      if (!v.foto) return setError(`${namaTangki(t)}: foto stik pasta air wajib.`)
      if (st === 'ada' && !v.tindakan.trim()) return setError(`${namaTangki(t)}: ada air, isi tindakan yang dilakukan.`)
    }
    if (!namaPetugas.trim()) return setError('Isi nama petugas.')
    if (lama && !(await konfirmasi({ jenis: 'ubah', judul: 'Ubah water content terkirim?', pesan: <>Water content <b>{formatTanggalIso(tanggal)}</b> sudah terkirim. Isian baru akan menggantikan data sebelumnya.</>, ya: 'Ya, ubah data' }))) return
    setBusy('kirim')
    try {
      const jam = nowHm()
      const tangki: AirData['tangki'] = {}
      for (const t of TANKS) {
        const v = nilai(t)
        const nihil = statusAir({ airMm: v.airMm, liter: null, foto: [], tindakan: '' }) === 'nihil'
        tangki[t.id] = { airMm: v.airMm.trim(), liter: literAir(t, v.airMm), foto: [], tindakan: nihil ? '' : v.tindakan.trim() }
      }
      const rec: AirRecord = {
        id,
        tanggal,
        shift: 1,
        data: { tangki, petugas: namaPetugas.trim(), jam, catatan: isiCatatan.trim(), terlambat: lewatBatas(jam) },
        createdAt: lama?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        createdBy: lama?.createdBy ?? app.session.user?.id ?? null,
      }
      // Hanya isian yang disimpan; foto tetap di HP untuk kolase WhatsApp.
      await app.backend.saveAir(rec)
      const spbu = namaSpbuWa(app.settings)
      const kolase = await buatKolaseGrid(
        TANKS.map((t) => {
          const f = nilai(t).foto!
          return { blob: f.blob, cap: [waktuFoto[f.id] ?? capWaktu(), spbu, `${namaTangki(t)} · ${keteranganMm(rec.data.tangki[t.id], t)}`] }
        }),
      )
      const files = [new File([kolase], `Water_Content_${tanggal}.jpg`, { type: 'image/jpeg' })]
      setSelesai({ rec, teks: teksWaAir(rec, TANKS, app.settings, zonaWaktu()), files, urls: [URL.createObjectURL(kolase)] })
      setBusy(null)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  if (selesai) {
    const berair = tangkiBerair(selesai.rec, TANKS)
    return (
      <>
        <LayarKirimWa
          judul="Water content tersimpan"
          keterangan={
            berair.length
              ? `Ada air di ${berair.map((t) => tankName(t.tankNo)).join(', ')}: lakukan penyedotan/pengurasan dan laporkan ke pengawas. Kirim laporan ke WhatsApp sekarang.`
              : 'Semua tangki nihil air. Foto tidak disimpan di aplikasi: kirim sekarang ke grup WhatsApp.'
          }
          teks={selesai.teks}
          files={selesai.files}
          urls={selesai.urls}
          dibagikan={dibagikan}
          onDibagikan={() => setDibagikan(true)}
        >
          <Link to="/air" replace className={buttonVariants({ variant: 'glass', size: 'lg' })}>
            Kembali ke Water Content
          </Link>
        </LayarKirimWa>
        {guard.dialog}
      </>
    )
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col p-space-md">
        <span className="text-tag uppercase text-primary">Water content tangki pendam · {formatTanggalIso(tanggal)}</span>
        <span className="text-headline-md font-bold text-on-surface">Shift 1 · batas {BATAS_HARIAN}</span>
        {telat && <span className="text-body-sm font-semibold text-error">Sudah lewat pukul {BATAS_HARIAN}: laporan dicatat terlambat.</span>}
        {lama && <span className="text-body-sm font-semibold text-primary">Sudah diperiksa pukul {lama.data.jam}; kirim ulang bila ada koreksi (ambil foto lagi).</span>}
        <span className="text-body-sm text-on-surface-variant">Oleskan pasta air di ujung stik ukur, celupkan sampai dasar tangki, tunggu perubahan warna, lalu baca tinggi air. Tidak berubah warna = nihil (0 mm).</span>
      </GlassCard>

      {TANKS.map((t, ti) => {
        const v = nilai(t)
        const st = statusAir({ airMm: v.airMm, liter: null, foto: [], tindakan: '' })
        const liter = literAir(t, v.airMm)
        return (
          <GlassCard key={t.id} level={2} className={cn('flex flex-col gap-space-sm p-space-md', ti < 3 && ['animate-entrance-2', 'animate-entrance-3', 'animate-entrance-4'][ti], st === 'ada' && 'border border-error/40')}>
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
                <Input id={`air-${t.id}`} numeric inputMode="decimal" suffix="mm" placeholder="0" value={v.airMm} onChange={(e) => ubah(t, { airMm: e.target.value })} />
              </Field>
              <Button variant={st === 'nihil' ? 'primary' : 'glass'} className="h-12" onClick={() => ubah(t, { airMm: '0' })}>
                Nihil
              </Button>
            </div>
            <FotoWajib
              label="Foto stik pasta air"
              hint="Ujung stik dengan pasta air setelah dicelupkan, angka tinggi air terbaca."
              fotos={v.foto ? [v.foto] : []}
              busy={busy === t.id}
              disabled={busy === 'kirim'}
              onAdd={(files) => void ambil(t, files)}
              onRemove={() => {
                if (v.foto) URL.revokeObjectURL(v.foto.url)
                ubah(t, { foto: null })
              }}
            />
            {st === 'ada' && (
              <Field label="Tindakan (wajib)" htmlFor={`air-tl-${t.id}`}>
                <Input id={`air-tl-${t.id}`} autoComplete="off" placeholder="Mis. penyedotan air, lapor pengawas, cek ulang setelah 1 jam" value={v.tindakan} onChange={(e) => ubah(t, { tindakan: e.target.value })} />
              </Field>
            )}
          </GlassCard>
        )
      })}

      <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Petugas" htmlFor="air-petugas">
            <Input id="air-petugas" value={namaPetugas} onChange={(e) => setPetugas(e.target.value)} />
          </Field>
          <Field label="Catatan (opsional)" htmlFor="air-catatan">
            <Input id="air-catatan" autoComplete="off" value={isiCatatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>
        </div>
        <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <Camera aria-hidden="true" className="size-4 shrink-0" />
          Foto semua tangki digabung otomatis menjadi satu kolase (jam, SPBU, tangki, hasil). Foto tidak disimpan di aplikasi, hanya dikirim ke WhatsApp.
        </span>
        <ErrorBox text={error} />
        <Button size="lg" disabled={busy !== null} onClick={() => void kirim()}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
          {busy === 'kirim' ? 'Menyimpan…' : 'Simpan & lanjut kirim ke WhatsApp'}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

/** Report > Riwayat Water Content: per bulan, temuan air disorot, foto stik pasta air. */
export function LaporanAir() {
  const app = useApp()
  const konfirmasi = useKonfirmasi()
  const toast = useToast()
  const hariIni = todayIso()
  const [bulan, setBulan] = useState(hariIni.slice(0, 7))
  const akhir = todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0))
  const { recs, error, muat } = useAir(`${bulan}-01`, akhir)
  const fotos = useMemo(() => (recs ?? []).flatMap((r) => Object.values(r.data.tangki).flatMap((t) => t.foto.slice(0, 1))), [recs])
  const srcOf = usePhotoSrc(fotos)
  if (!app.loaded) return <Loading />
  if (!TANKS.length) return <TangkiBelumAda className="animate-entrance-1" />
  const data = [...(recs ?? [])].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.shift - a.shift)
  const temuan = data.filter((r) => tangkiBerair(r, TANKS).length).length
  // Hari pada bulan ini yang sudah lewat batas 10:00 tanpa pemeriksaan (sekali sehari).
  const nHari = Number(akhir.slice(8))
  let wajib = 0
  let terlewat = 0
  for (let d = 1; d <= nHari; d++) {
    const t = `${bulan}-${String(d).padStart(2, '0')}`
    const st = statusHarian(t, data.some((r) => r.tanggal === t && airLengkap(r, TANKS)))
    if (st !== 'nanti') wajib++
    if (st === 'terlewat') terlewat++
  }
  const bolehHapus = app.role === 'abh' || app.role === 'pengawas'
  const hapus = async (r: AirRecord) => {
    if (!(await konfirmasi({ judul: 'Hapus water content?', pesan: <>Catatan water content <b>{formatTanggalIso(r.tanggal)} {shiftLabel(r.shift)}</b> akan dihapus dari riwayat.</> }))) return
    try {
      await app.backend.deleteAir(r.id)
      for (const t of Object.values(r.data.tangki)) for (const p of t.foto) void app.backend.deletePhoto(p).catch(() => {})
      toast('Catatan dihapus')
      void muat()
    } catch (e) {
      toast(pesan(e))
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <Field label="Bulan" htmlFor="lair-bulan">
          <Input id="lair-bulan" type="month" max={hariIni.slice(0, 7)} value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-space-xs text-center">
          <div className="rounded-md bg-surface-container-low p-space-xs">
            <span className="tabular block text-numeric-md font-bold text-on-surface">{data.length}</span>
            <span className="text-[11px] uppercase text-on-surface-variant">Pengecekan</span>
          </div>
          <div className={cn('rounded-md p-space-xs', temuan ? 'bg-error-container' : 'bg-surface-container-low')}>
            <span className={cn('tabular block text-numeric-md font-bold', temuan ? 'text-on-error-container' : 'text-on-surface')}>{temuan}</span>
            <span className="text-[11px] uppercase text-on-surface-variant">Ada air</span>
          </div>
          <div className="rounded-md bg-surface-container-low p-space-xs">
            <span className="tabular block text-numeric-md font-bold text-on-surface">
              {terlewat}/{wajib}
            </span>
            <span className="text-[11px] uppercase text-on-surface-variant">Hari terlewat</span>
          </div>
        </div>
        <ErrorBox text={error} />
      </GlassCard>

      <section aria-labelledby="lair-daftar" className="flex flex-col gap-space-sm">
        <SectionHeader id="lair-daftar" title={`Pengecekan (${data.length})`} />
        {recs === null ? (
          <Loading />
        ) : !data.length ? (
          <GlassCard level={1} className="p-space-md text-center text-body-md text-on-surface-variant">
            Belum ada pengecekan water content pada bulan ini.
          </GlassCard>
        ) : (
          data.map((r) => {
            const berair = tangkiBerair(r, TANKS).length > 0
            return (
              <GlassCard key={r.id} level={2} className={cn('flex flex-col gap-space-sm p-space-md', berair && 'border border-error/40')}>
                <div className="flex items-start justify-between gap-space-sm">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-md font-bold text-on-surface">
                      {formatTanggalIso(r.tanggal)} · {shiftLabel(r.shift).split(' (')[0]}
                      {r.data.terlambat ? ' · terlambat' : ''}
                    </span>
                    <span className="text-body-sm text-on-surface-variant">
                      {r.data.petugas || '-'} · {r.data.jam}
                      {r.data.catatan ? ` · ${r.data.catatan}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Pill tone={berair ? 'error' : 'success'}>{berair ? 'Ada air' : 'Nihil'}</Pill>
                    {bolehHapus && (
                      <Button variant="ghost" size="icon" aria-label="Hapus" onClick={() => void hapus(r)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-outline-variant/40 rounded-md bg-surface-container-low/60">
                  {TANKS.map((t) => {
                    const x = r.data.tangki[t.id]
                    const st = statusAir(x)
                    const foto = x?.foto[0]
                    const src = foto ? srcOf(foto) : undefined
                    return (
                      <div key={t.id} className="flex items-center gap-space-sm px-space-sm py-space-xs">
                        {src ? (
                          <a href={src} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={src} alt={`Pasta air ${namaTangki(t)}`} className="size-12 rounded-md object-cover" />
                          </a>
                        ) : (
                          <span className="size-12 shrink-0 rounded-md bg-surface-container" />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-body-sm font-semibold text-on-surface">{namaTangki(t)}</span>
                          {x?.tindakan && <span className="text-body-sm text-on-surface-variant">Tindakan: {x.tindakan}</span>}
                        </span>
                        <span className={cn('tabular shrink-0 text-body-sm font-bold', st === 'ada' ? 'text-error' : st === 'nihil' ? 'text-on-tertiary-fixed-variant' : 'text-on-surface-variant')}>{keteranganMm(x, t)}</span>
                      </div>
                    )
                  })}
                </div>
              </GlassCard>
            )
          })
        )}
      </section>
    </div>
  )
}
