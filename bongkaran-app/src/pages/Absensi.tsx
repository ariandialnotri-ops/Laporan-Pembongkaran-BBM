import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, Coffee, Crosshair, Download, FileSpreadsheet, LoaderCircle, LogIn, LogOut, MapPin, QrCode, RefreshCw, Save, ScanLine, Settings2, Trash2, Undo2, UserRound } from 'lucide-react'
import { QrImg, QrScanner } from '@/components/apar/qr'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import {
  AKSI,
  absensiSiap,
  bolehAbsenkanLain,
  catatanTerbuka,
  cekArea,
  jamDari,
  LABEL_ABSEN,
  labelMenit,
  menitIstirahat,
  menitKerja,
  menitTerlambat,
  RADIUS_BAWAAN,
  statusAbsen,
  tanggalAbsen,
  type AbsenData,
  type AbsenRecord,
  type AbsensiSetting,
  type JenisAbsen,
  type StatusAbsen,
} from '@/lib/absen'
import { ekspor } from '@/lib/ekspor'
import { useApp } from '@/lib/app-state'
import { addDays, formatTanggalIso, todayIso } from '@/lib/date'
import { kodeInfo, personilAktif } from '@/lib/personil'
import { downloadBlob } from '@/lib/report/export'
import type { Personil } from '@/lib/sop'
import { useCatatan } from '@/lib/use-catatan'
import { useJadwal } from '@/lib/use-jadwal'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const KUNCI_PERSONIL = 'floq-absen-personil'
/** Lokasi & QR absensi diatur ABH / pengawas (sama dengan RPC bbm_save_settings_terbatas). */
const bolehAtur = (role: string) => role === 'abh' || role === 'pengawas'
/** Rekap absensi: ABH, pengawas, kepala shift, admin. */
const bolehRekap = (role: string) => ['abh', 'pengawas', 'kashift', 'admin'].includes(role)

const STATUS: Record<StatusAbsen, { label: string; tone: 'neutral' | 'success' | 'cyan' | 'primary' }> = {
  belum: { label: 'Belum absen', tone: 'neutral' },
  bekerja: { label: 'Bekerja', tone: 'success' },
  istirahat: { label: 'Istirahat', tone: 'cyan' },
  pulang: { label: 'Sudah pulang', tone: 'primary' },
}
const IKON_AKSI: Record<JenisAbsen, typeof LogIn> = { masuk: LogIn, istirahat: Coffee, kembali: Undo2, keluar: LogOut }

function bacaSimpan(k: string) {
  try {
    return localStorage.getItem(k) ?? ''
  } catch {
    return ''
  }
}

/** Posisi GPS akurasi tinggi (maks. 20 detik). */
function ambilPosisi(): Promise<{ lat: number; lng: number; akurasi: number }> {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Perangkat tidak mendukung GPS.'))
    navigator.geolocation.getCurrentPosition(
      (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude, akurasi: p.coords.accuracy }),
      (e) =>
        rej(
          new Error(
            e.code === e.PERMISSION_DENIED
              ? 'Akses lokasi ditolak. Izinkan Lokasi untuk FLOQ (iPhone: Pengaturan > Privasi > Layanan Lokasi > Safari), lalu coba lagi.'
              : e.code === e.TIMEOUT
                ? 'GPS belum mendapat lokasi. Pindah ke area terbuka lalu coba lagi.'
                : 'Lokasi tidak dapat dibaca. Aktifkan GPS lalu coba lagi.',
          ),
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  })
}

/** Catatan absensi kemarin & hari ini (shift 3 keluar keesokan pagi). */
function useAbsenHariIni() {
  const hariIni = todayIso()
  const kemarin = todayIso(addDays(new Date(`${hariIni}T00:00:00`), -1))
  return { ...useCatatan<AbsenData>('absen', kemarin, hariIni), hariIni }
}

function Baris({ k, v, tebal }: { k: string; v: string; tebal?: boolean }) {
  return (
    <span className="flex justify-between gap-space-sm text-body-sm">
      <span className="text-on-surface-variant">{k}</span>
      <span className={cn('tabular text-right text-on-surface', tebal && 'font-bold')}>{v}</span>
    </span>
  )
}

/** Operation > Absensi: absen masuk, istirahat, keluar dengan pindai QR SPBU & GPS. */
export function AbsensiMenu() {
  const app = useApp()
  const toast = useToast()
  const { recs, error: errMuat, muat, hariIni } = useAbsenHariIni()
  const { jadwal } = useJadwal(hariIni.slice(0, 7))
  const [pilih, setPilih] = useState(() => bacaSimpan(KUNCI_PERSONIL))
  const [aksi, setAksi] = useState<{ jenis: JenisAbsen; pos: { lat: number; lng: number; akurasi: number }; jarak: number } | null>(null)
  const [busy, setBusy] = useState<JenisAbsen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errScan, setErrScan] = useState<string | null>(null)
  const [hasil, setHasil] = useState<{ jenis: JenisAbsen; nama: string; jam: string } | null>(null)
  if (!app.loaded || !recs) return <Loading />

  const semuaAktif = personilAktif(app.settings)
  // Selain ABH/pengawas hanya dapat absen untuk personil yang tertaut ke akunnya (mode lokal: semua).
  const uid = app.session.user?.id
  const aktif = bolehAbsenkanLain(app.role) || !uid ? semuaAktif : semuaAktif.filter((x) => x.akunId === uid)
  const p = aktif.find((x) => x.id === pilih) ?? (aktif.length === 1 ? aktif[0] : null)
  const a = app.settings.absensi
  const siap = absensiSiap(a)
  const buka = p ? catatanTerbuka(recs, p.id) : undefined
  const selesaiHariIni = p ? recs.find((r) => r.data.personilId === p.id && r.tanggal === hariIni && r.data.keluar) : undefined
  const st: StatusAbsen = buka ? statusAbsen(buka.data) : selesaiHariIni ? 'pulang' : 'belum'
  const kodeHariIni = (id: string) => jadwal?.data.roster[id]?.[String(Number(hariIni.slice(8)))]

  const pilihPersonil = (id: string) => {
    setPilih(id)
    setError(null)
    setHasil(null)
    try {
      localStorage.setItem(KUNCI_PERSONIL, id)
    } catch {
      /* penyimpanan perangkat tidak tersedia */
    }
  }

  // Langkah 1: GPS & cek area; langkah 2: pindai QR; langkah 3: kirim.
  const mulai = async (jenis: JenisAbsen) => {
    if (!p || !siap) return
    setError(null)
    setHasil(null)
    setBusy(jenis)
    try {
      const pos = await ambilPosisi()
      const area = cekArea(a, pos)
      if (!area.ok) throw new Error(`Anda di luar area SPBU: ${Math.round(area.jarak)} m dari titik absensi (batas ${a.radius} m, akurasi GPS ±${Math.round(pos.akurasi)} m). Absen di lokasi SPBU.`)
      setErrScan(null)
      setAksi({ jenis, pos, jarak: area.jarak })
    } catch (e) {
      setError(pesan(e))
    } finally {
      setBusy(null)
    }
  }
  const kirim = async (kode: string) => {
    if (!aksi || !p) return
    if (!kode.startsWith('FLOQ-ABSEN|')) return setErrScan('Ini bukan QR absensi FLOQ. Pindai QR absensi yang terpasang di SPBU.')
    const { jenis, pos } = aksi
    setAksi(null)
    setBusy(jenis)
    try {
      await app.backend.absen({ personilId: p.id, jenis, tanggal: tanggalAbsen(), lat: pos.lat, lng: pos.lng, akurasi: pos.akurasi, kode })
      await muat()
      const jam = jamDari(new Date().toISOString())
      setHasil({ jenis, nama: p.nama, jam })
      toast(`${LABEL_ABSEN[jenis]} ${p.nama} ${jam}`)
    } catch (e) {
      setError(pesan(e))
    } finally {
      setBusy(null)
    }
  }

  const hariIniSemua = semuaAktif.map((x) => {
    const r = catatanTerbuka(recs, x.id) ?? recs.find((z) => z.data.personilId === x.id && z.tanggal === hariIni)
    return { p: x, r, st: r ? statusAbsen(r.data) : ('belum' as StatusAbsen) }
  })
  const hadir = hariIniSemua.filter((x) => x.st !== 'belum').length

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary">
            <ScanLine className="size-5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-tag uppercase text-primary">Operation · Personil</span>
            <span className="text-headline-md font-bold text-on-surface">Absensi Personil</span>
            <span className="text-body-sm text-on-surface-variant">Pilih nama, ketuk absen, lalu pindai QR absensi di SPBU. Lokasi GPS harus di dalam area {app.spbu?.nama ?? 'SPBU'}.</span>
          </span>
        </div>
        {!siap && (
          <div className="flex flex-col gap-1 rounded-md bg-amber-50 p-space-sm text-body-sm text-amber-900">
            <b>Titik lokasi & QR absensi belum diatur.</b>
            {bolehAtur(app.role) ? (
              <Link to="/absen/pengaturan" className="font-semibold text-primary">
                Atur sekarang
              </Link>
            ) : (
              <span>Hubungi pengawas SPBU.</span>
            )}
          </div>
        )}
        {!aktif.length ? (
          <span className="text-body-sm text-on-surface-variant">
            {semuaAktif.length ? 'Akun Anda belum ditautkan ke data personil. Minta pengawas menautkan akun Anda di menu Personil & Jadwal Shift.' : 'Daftar personil belum diisi. Tambahkan di menu Personil & Jadwal Shift.'}
          </span>
        ) : (
          <Field label="Nama personil" htmlFor="absen-personil">
            <Select value={p?.id ?? ''} onValueChange={pilihPersonil}>
              <SelectTrigger id="absen-personil">
                <SelectValue placeholder="Pilih nama Anda" />
              </SelectTrigger>
              <SelectContent>
                {aktif.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.nama} · {x.jabatan}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {p && (
          <div className="flex flex-col gap-space-xs rounded-md bg-surface-container-low p-space-sm">
            <span className="flex items-center justify-between gap-2">
              <b className="text-body-md text-on-surface">{p.nama}</b>
              <Pill tone={STATUS[st].tone}>{STATUS[st].label}</Pill>
            </span>
            <Baris k="Jadwal hari ini" v={kodeInfo(kodeHariIni(p.id))?.label ?? 'Belum dijadwalkan'} />
            {(buka ?? selesaiHariIni) && <RingkasAbsen d={(buka ?? selesaiHariIni)!.data} tanggal={(buka ?? selesaiHariIni)!.tanggal} kode={kodeHariIni(p.id)} />}
          </div>
        )}
        {p && siap && (
          <div className={cn('grid gap-space-sm', AKSI[st].length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {AKSI[st].map((j) => {
              const Ikon = IKON_AKSI[j]
              return (
                <Button key={j} size="lg" variant={j === 'keluar' && st !== 'belum' ? 'glass' : 'primary'} disabled={busy !== null} onClick={() => void mulai(j)}>
                  {busy === j ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Ikon aria-hidden="true" />}
                  {LABEL_ABSEN[j]}
                </Button>
              )
            })}
            {!AKSI[st].length && <span className="text-body-sm text-on-surface-variant">Absensi {p.nama} hari ini sudah lengkap.</span>}
          </div>
        )}
        {busy && !aksi && <span className="text-body-sm text-on-surface-variant">Membaca lokasi GPS…</span>}
        {hasil && (
          <div className="rounded-md bg-emerald-50 p-space-sm text-body-md font-semibold text-emerald-900">
            {LABEL_ABSEN[hasil.jenis]} {hasil.nama} tercatat pukul {hasil.jam}.
          </div>
        )}
        <ErrorBox text={error ?? errMuat} />
      </GlassCard>

      <section aria-labelledby="absen-hari" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="absen-hari" title={`Hari ini · ${hadir} dari ${semuaAktif.length} hadir`} />
        <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
          {hariIniSemua.map(({ p: x, r, st: s }) => (
            <button key={x.id} type="button" onClick={() => pilihPersonil(x.id)} className="flex items-center gap-space-sm px-space-md py-space-sm text-left active:bg-surface-container-low">
              <UserRound aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-md font-semibold text-on-surface">{x.nama}</span>
                <span className="tabular text-body-sm text-on-surface-variant">
                  {x.jabatan}
                  {r ? ` · masuk ${jamDari(r.data.masuk.at)}${r.data.keluar ? ` · keluar ${jamDari(r.data.keluar.at)}` : ''}` : ''}
                </span>
              </span>
              <Pill tone={STATUS[s].tone}>{STATUS[s].label}</Pill>
            </button>
          ))}
          {!semuaAktif.length && <span className="p-space-md text-body-sm text-on-surface-variant">Belum ada personil aktif.</span>}
        </GlassCard>
      </section>

      <div className="grid gap-space-sm sm:grid-cols-2">
        {bolehRekap(app.role) && (
          <Link to="/absen/rekap" className={cn(buttonVariants({ variant: 'glass', size: 'lg' }), 'justify-start')}>
            <CalendarRange aria-hidden="true" />
            Rekap absensi bulanan
          </Link>
        )}
        {bolehAtur(app.role) && (
          <Link to="/absen/pengaturan" className={cn(buttonVariants({ variant: 'glass', size: 'lg' }), 'justify-start')}>
            <Settings2 aria-hidden="true" />
            Lokasi & QR absensi
          </Link>
        )}
      </div>

      <QrScanner
        open={!!aksi}
        onClose={() => setAksi(null)}
        onResult={(t) => void kirim(t)}
        title={aksi ? `${LABEL_ABSEN[aksi.jenis]} · ${p?.nama ?? ''}` : 'Pindai QR absensi'}
        description={aksi ? `Lokasi OK (${Math.round(aksi.jarak)} m dari titik absensi). Arahkan kamera ke QR absensi SPBU.` : ''}
        error={errScan}
      />
    </div>
  )
}

function RingkasAbsen({ d, tanggal, kode }: { d: AbsenData; tanggal: string; kode?: string }) {
  const telat = menitTerlambat(d, kodeInfo(kode)?.kode, tanggal)
  return (
    <>
      <Baris k="Masuk" v={`${jamDari(d.masuk.at)}${tanggal !== todayIso() ? ` (${formatTanggalIso(tanggal)})` : ''}`} />
      {telat ? <Baris k="Terlambat" v={labelMenit(telat)} /> : null}
      {d.istirahat.map((x, i) => (
        <Baris key={i} k={`Istirahat ${d.istirahat.length > 1 ? i + 1 : ''}`.trim()} v={`${jamDari(x.mulai.at)} – ${x.selesai ? jamDari(x.selesai.at) : 'berjalan'}`} />
      ))}
      <Baris k="Keluar" v={jamDari(d.keluar?.at)} />
      <Baris k="Jam kerja bersih" v={labelMenit(menitKerja(d))} tebal />
    </>
  )
}

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const labelBulan = (b: string) => `${BULAN[Number(b.slice(5, 7)) - 1]} ${b.slice(0, 4)}`
const akhirBulan = (b: string) => todayIso(new Date(Number(b.slice(0, 4)), Number(b.slice(5, 7)), 0))

interface RekapPersonil {
  p: Pick<Personil, 'id' | 'nama' | 'jabatan'>
  hadir: number
  kerja: number
  istirahat: number
  terlambat: number
  menitTelat: number
  tanpaKeluar: number
  terjadwal: number
}

function rekapBulan(recs: AbsenRecord[], personil: Personil[], roster: Record<string, Record<string, string>> | undefined) {
  const per = new Map<string, RekapPersonil>()
  const ambil = (id: string, nama: string, jabatan: string) => {
    let x = per.get(id)
    if (!x) {
      const p = personil.find((z) => z.id === id)
      x = { p: { id, nama: p?.nama ?? nama, jabatan: p?.jabatan ?? jabatan }, hadir: 0, kerja: 0, istirahat: 0, terlambat: 0, menitTelat: 0, tanpaKeluar: 0, terjadwal: 0 }
      per.set(id, x)
    }
    return x
  }
  for (const p of personil) {
    const x = ambil(p.id, p.nama, p.jabatan)
    x.terjadwal = Object.values(roster?.[p.id] ?? {}).filter((k) => k === '1' || k === '2' || k === '3').length
  }
  for (const r of recs) {
    const x = ambil(r.data.personilId, r.data.nama, r.data.jabatan)
    x.hadir++
    if (r.data.keluar) {
      x.kerja += menitKerja(r.data)
      x.istirahat += menitIstirahat(r.data)
    } else x.tanpaKeluar++
    const t = menitTerlambat(r.data, kodeInfo(roster?.[r.data.personilId]?.[String(Number(r.tanggal.slice(8)))])?.kode, r.tanggal)
    if (t) {
      x.terlambat++
      x.menitTelat += t
    }
  }
  return [...per.values()].sort((a, b) => a.p.nama.localeCompare(b.p.nama, 'id'))
}

/** Operation > Absensi > Rekap: per personil per bulan + detail harian, unduh Excel, hapus koreksi. */
export function AbsensiRekap() {
  const app = useApp()
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const [bulan, setBulan] = useState(() => todayIso().slice(0, 7))
  const { recs, error, muat } = useCatatan<AbsenData>('absen', `${bulan}-01`, akhirBulan(bulan))
  const { jadwal } = useJadwal(bulan)
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  if (!app.loaded || !recs) return <Loading />
  const rekap = rekapBulan(recs, app.settings.personil ?? [], jadwal?.data.roster)
  const detail = [...recs].filter((r) => !filter || r.data.personilId === filter).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || a.data.nama.localeCompare(b.data.nama))
  const bolehHapus = bolehAtur(app.role)

  const hapus = async (r: AbsenRecord) => {
    if (!(await konfirmasi({ jenis: 'hapus', judul: 'Hapus catatan absensi?', pesan: <>Absensi <b>{r.data.nama}</b> tanggal {formatTanggalIso(r.tanggal)} dihapus. Personil dapat absen ulang.</> }))) return
    try {
      await app.backend.deleteCatatan('absen', r.id)
      await muat()
      toast('Catatan absensi dihapus')
    } catch (e) {
      toast(pesan(e))
    }
  }
  const unduh = async () => {
    setBusy(true)
    try {
      await ekspor('Membuat Excel Absensi', async (lapor) => {
        lapor(15, 'Memuat modul laporan')
        const { absenXlsx } = await import('@/lib/report/absen-xlsx')
        lapor(35, `Menyusun rekap ${recs.length} catatan absen`)
        const blob = await absenXlsx({ bulan, label: labelBulan(bulan), spbu: app.settings.namaSpbu || app.spbu?.nama || 'SPBU', rekap, detail: [...recs].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.data.nama.localeCompare(b.data.nama)), roster: jadwal?.data.roster })
        lapor(95, 'Menyimpan file')
        downloadBlob(blob, `Absensi ${app.settings.namaSpbu || 'SPBU'} ${labelBulan(bulan)}.xlsx`)
      })
    } catch (e) {
      toast(`Gagal membuat Excel: ${pesan(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Bulan" htmlFor="rekap-bulan">
            <Input id="rekap-bulan" type="month" value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
          </Field>
          <div className="flex items-end">
            <Button variant="glass" className="w-full" disabled={busy || !recs.length} onClick={() => void unduh()}>
              {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileSpreadsheet aria-hidden="true" />}
              Unduh Excel
            </Button>
          </div>
        </div>
        <span className="text-body-sm text-on-surface-variant">
          {recs.length} catatan · terlambat dihitung dari jam mulai shift jadwal (06:00 / 14:00 / 22:00){jadwal ? '' : '; jadwal bulan ini belum dibuat'}.
        </span>
        <ErrorBox text={error} />
      </GlassCard>

      <section aria-labelledby="rekap-per" className="flex flex-col gap-space-sm">
        <SectionHeader id="rekap-per" title={`Rekap ${labelBulan(bulan)}`} />
        <GlassCard level={2} className="overflow-x-auto p-space-sm">
          <table className="tabular w-full min-w-[620px] text-body-sm">
            <thead>
              <tr className="text-left text-on-surface-variant">
                <th className="p-1.5 font-semibold">Personil</th>
                <th className="p-1.5 text-right font-semibold">Hadir / jadwal</th>
                <th className="p-1.5 text-right font-semibold">Terlambat</th>
                <th className="p-1.5 text-right font-semibold">Jam kerja</th>
                <th className="p-1.5 text-right font-semibold">Istirahat</th>
                <th className="p-1.5 text-right font-semibold">Tanpa keluar</th>
              </tr>
            </thead>
            <tbody>
              {rekap.map((x) => (
                <tr key={x.p.id} onClick={() => setFilter(filter === x.p.id ? '' : x.p.id)} className={cn('cursor-pointer border-t border-outline-variant/40', filter === x.p.id && 'bg-primary-fixed/40')}>
                  <td className="p-1.5">
                    <b className="text-on-surface">{x.p.nama}</b>
                    <span className="block text-on-surface-variant">{x.p.jabatan}</span>
                  </td>
                  <td className="p-1.5 text-right">
                    {x.hadir} / {x.terjadwal || '-'}
                  </td>
                  <td className={cn('p-1.5 text-right', x.terlambat > 0 && 'font-semibold text-error')}>{x.terlambat ? `${x.terlambat}× (${labelMenit(x.menitTelat)})` : '-'}</td>
                  <td className="p-1.5 text-right">{labelMenit(x.kerja)}</td>
                  <td className="p-1.5 text-right">{labelMenit(x.istirahat)}</td>
                  <td className={cn('p-1.5 text-right', x.tanpaKeluar > 0 && 'font-semibold text-amber-700')}>{x.tanpaKeluar || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rekap.length && <span className="block p-space-sm text-body-sm text-on-surface-variant">Belum ada personil.</span>}
        </GlassCard>
      </section>

      <section aria-labelledby="rekap-detail" className="flex flex-col gap-space-sm">
        <SectionHeader id="rekap-detail" title={filter ? `Detail · ${rekap.find((x) => x.p.id === filter)?.p.nama ?? ''}` : 'Detail harian'} action={filter ? <button type="button" className="text-body-sm font-semibold text-primary" onClick={() => setFilter('')}>Semua</button> : undefined} />
        <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
          {detail.map((r) => {
            const kode = jadwal?.data.roster[r.data.personilId]?.[String(Number(r.tanggal.slice(8)))]
            const telat = menitTerlambat(r.data, kodeInfo(kode)?.kode, r.tanggal)
            return (
              <div key={r.id} className="flex items-start gap-space-sm px-space-md py-space-sm">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-md font-semibold text-on-surface">
                    {formatTanggalIso(r.tanggal)} · {r.data.nama}
                  </span>
                  <span className="tabular text-body-sm text-on-surface-variant">
                    {kodeInfo(kode)?.label ?? 'Tidak terjadwal'} · masuk {jamDari(r.data.masuk.at)}
                    {telat ? ` (telat ${labelMenit(telat)})` : ''} · keluar {jamDari(r.data.keluar?.at)} · kerja {r.data.keluar ? labelMenit(menitKerja(r.data)) : '-'}
                    {r.data.istirahat.length ? ` · istirahat ${labelMenit(menitIstirahat(r.data))}` : ''}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                    <MapPin aria-hidden="true" className="size-3" />
                    {r.data.masuk.jarak} m · ±{r.data.masuk.akurasi} m{r.data.masuk.olehNama ? ` · oleh ${r.data.masuk.olehNama}` : ''}
                  </span>
                </span>
                {bolehHapus && (
                  <Button variant="ghost" size="icon" aria-label={`Hapus absensi ${r.data.nama} ${r.tanggal}`} onClick={() => void hapus(r)}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </div>
            )
          })}
          {!detail.length && <span className="p-space-md text-body-sm text-on-surface-variant">Belum ada absensi.</span>}
        </GlassCard>
      </section>
    </div>
  )
}

/** Pengaturan absensi (ABH/pengawas): titik lokasi SPBU, radius, QR absensi & poster PDF. */
export function AbsensiPengaturan() {
  const app = useApp()
  const toast = useToast()
  const konfirmasi = useKonfirmasi()
  const tersimpan = app.settings.absensi
  const [draf, setDraf] = useState<{ lat: string; lng: string; radius: string } | null>(null)
  const [busy, setBusy] = useState<'gps' | 'pdf' | 'qr' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Teks QR diambil dari server (token tidak tersimpan di pengaturan yang terbaca semua anggota).
  const [qr, setQr] = useState<{ spbu: string | null; teks: string } | null>(null)
  const siapQr = absensiSiap(tersimpan) && bolehAtur(app.role)
  useEffect(() => {
    if (!siapQr) return
    let hidup = true
    app.backend.absenQr().then(
      (teks) => hidup && setQr({ spbu: app.spbuId, teks }),
      (e) => hidup && setError(pesan(e)),
    )
    return () => {
      hidup = false
    }
  }, [siapQr, app.backend, app.spbuId])
  if (!app.loaded) return <Loading />
  if (!bolehAtur(app.role)) return <ErrorBox text="Hanya ABH atau pengawas yang dapat mengatur lokasi & QR absensi." />
  const isi = draf ?? { lat: tersimpan?.lat?.toString() ?? '', lng: tersimpan?.lng?.toString() ?? '', radius: String(tersimpan?.radius ?? RADIUS_BAWAAN) }
  const teksQr = qr?.spbu === app.spbuId ? qr.teks : null
  const angka = (s: string) => {
    const v = Number(s.replace(',', '.'))
    return s.trim() && Number.isFinite(v) ? v : null
  }

  const simpan = () => {
    const lat = angka(isi.lat)
    const lng = angka(isi.lng)
    const radius = angka(isi.radius)
    if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return setError('Isi koordinat lintang & bujur yang benar (mis. -7.8166 dan 112.0115).')
    if (radius === null || radius < 20 || radius > 1000) return setError('Radius 20 – 1.000 meter.')
    const a: AbsensiSetting = { lat, lng, radius: Math.round(radius) }
    app.updateSettings({ absensi: a })
    setDraf(null)
    setError(null)
    toast('Lokasi & QR absensi tersimpan')
  }
  const pakaiLokasi = async () => {
    setBusy('gps')
    setError(null)
    try {
      const pos = await ambilPosisi()
      setDraf({ ...isi, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) })
      toast(`Lokasi terbaca (akurasi ±${Math.round(pos.akurasi)} m). Tekan Simpan.`)
    } catch (e) {
      setError(pesan(e))
    } finally {
      setBusy(null)
    }
  }
  const gantiQr = async () => {
    if (!(await konfirmasi({ jenis: 'ubah', judul: 'Buat QR absensi baru?', pesan: 'QR lama tidak berlaku lagi. Cetak dan pasang QR baru di SPBU.', ya: 'Ya, buat baru' }))) return
    setBusy('qr')
    try {
      setQr({ spbu: app.spbuId, teks: await app.backend.absenQr(true) })
      toast('QR absensi baru dibuat. Cetak & pasang poster yang baru.')
    } catch (e) {
      setError(pesan(e))
    } finally {
      setBusy(null)
    }
  }
  const unduhPoster = async () => {
    if (!teksQr) return
    setBusy('pdf')
    try {
      await ekspor('Membuat PDF poster QR absensi', async (lapor) => {
        lapor(20, 'Memuat modul laporan')
        const { posterAbsenPdf } = await import('@/lib/report/absen-xlsx')
        lapor(45, 'Menggambar poster & kode QR')
        const blob = await posterAbsenPdf(teksQr, app.settings.namaSpbu || app.spbu?.nama || 'SPBU', app.settings.kodeSpbu || '')
        lapor(95, 'Menyimpan file')
        downloadBlob(blob, `QR Absensi ${app.settings.namaSpbu || 'SPBU'}.pdf`)
      })
    } catch (e) {
      setError(pesan(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="text-tag uppercase text-primary">Titik lokasi absensi</span>
        <span className="text-body-sm text-on-surface-variant">Berdiri di tengah area SPBU (mis. kantor / pulau pompa), ketuk Pakai lokasi saya, lalu Simpan. Absen hanya diterima di dalam radius ini.</span>
        <Button variant="glass" disabled={busy !== null} onClick={() => void pakaiLokasi()}>
          {busy === 'gps' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Crosshair aria-hidden="true" />}
          Pakai lokasi saya sekarang
        </Button>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Lintang (latitude)" htmlFor="abs-lat">
            <Input id="abs-lat" inputMode="decimal" placeholder="-7.816600" value={isi.lat} onChange={(e) => setDraf({ ...isi, lat: e.target.value })} />
          </Field>
          <Field label="Bujur (longitude)" htmlFor="abs-lng">
            <Input id="abs-lng" inputMode="decimal" placeholder="112.011500" value={isi.lng} onChange={(e) => setDraf({ ...isi, lng: e.target.value })} />
          </Field>
          <Field label="Radius area" htmlFor="abs-rad">
            <Input id="abs-rad" numeric inputMode="numeric" suffix="m" value={isi.radius} onChange={(e) => setDraf({ ...isi, radius: e.target.value })} />
          </Field>
          <div className="flex items-end pb-2">
            {angka(isi.lat) !== null && angka(isi.lng) !== null && (
              <a className="text-body-sm font-semibold text-primary" href={`https://maps.google.com/?q=${angka(isi.lat)},${angka(isi.lng)}`} target="_blank" rel="noreferrer">
                Lihat di peta
              </a>
            )}
          </div>
        </div>
        <ErrorBox text={error} />
        <Button size="lg" onClick={() => simpan()}>
          <Save aria-hidden="true" />
          Simpan lokasi absensi
        </Button>
      </GlassCard>

      <GlassCard level={2} className="flex flex-col items-center gap-space-sm p-space-md">
        <span className="self-start text-tag uppercase text-primary">QR absensi SPBU</span>
        {absensiSiap(tersimpan) && teksQr ? (
          <>
            <QrImg text={teksQr} size={200} alt="QR absensi SPBU" className="rounded-md" />
            <span className="text-center text-body-sm text-on-surface-variant">Cetak dan tempel di lokasi SPBU (mis. dekat kantor). Hanya berlaku untuk {app.settings.namaSpbu || 'SPBU ini'}.</span>
            <div className="grid w-full grid-cols-2 gap-space-sm">
              <Button variant="glass" disabled={busy !== null} onClick={() => void unduhPoster()}>
                {busy === 'pdf' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
                Poster PDF
              </Button>
              <Button variant="glass" disabled={busy !== null} onClick={() => void gantiQr()}>
                {busy === 'qr' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
                Buat QR baru
              </Button>
            </div>
          </>
        ) : (
          <span className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <QrCode aria-hidden="true" className="size-5" />
            {absensiSiap(tersimpan) ? 'Memuat QR absensi…' : 'QR dibuat otomatis setelah lokasi absensi disimpan.'}
          </span>
        )}
      </GlassCard>
    </div>
  )
}
