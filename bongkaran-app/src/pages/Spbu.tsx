import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, CircleCheck, ClipboardCheck, Cylinder, LogOut, Plus, RefreshCw, Search, ShieldAlert, Truck, TriangleAlert } from 'lucide-react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Field, JumlahField } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { RecordTable, BARIS_ORANYE, type Col } from '@/components/bongkaran/record-table'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { StatTile } from '@/components/bongkaran/stat-tile'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import type { RingkasanUnit } from '@/lib/backend'
import { useApp } from '@/lib/app-state'
import { addDays, formatTanggalIso, todayIso } from '@/lib/date'
import { roleLabel } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { DaftarTangki } from '@/pages/Tangki'

type Saring = 'semua' | 'perhatian' | 'belum' | 'siap'

const siap = (r: RingkasanUnit) => r.identitasLengkap && r.tangki > 0
const perluPerhatian = (r: RingkasanUnit) => !siap(r) || r.anomaliBulan > 0 || r.insidenTerbuka > 0 || r.qq7Hari[r.qq7Hari.length - 1] === 0

/** Q&Q 7 hari terakhir: kotak per hari (abu = belum uji, kuning = sebagian shift, hijau = 3 shift). */
function GarisQq({ hari, akhir }: { hari: number[]; akhir: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Uji Q&Q 7 hari terakhir: ${hari.join(', ')} shift`}>
      {hari.map((n, i) => (
        <span
          key={i}
          title={`${formatTanggalIso(todayIso(addDays(new Date(`${akhir}T00:00:00`), i - hari.length + 1)))}: ${n} shift`}
          className={cn('size-3.5 rounded-[3px]', n >= 3 ? 'bg-emerald-500' : n > 0 ? 'bg-amber-400' : 'bg-outline-variant/70')}
        />
      ))}
    </span>
  )
}

/**
 * Dashboard Unit Bisnis (ABH): semua SPBU yang dikendalikan dalam satu tabel progres,
 * seperti dashboard ABH di aplikasi Monitoring JBT. Ketuk baris untuk membuka SPBU itu.
 */
export function UnitBisnis() {
  const app = useApp()
  const navigate = useNavigate()
  const hariIni = todayIso()
  const [rows, setRows] = useState<RingkasanUnit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [muat, setMuat] = useState(0)
  const [saring, setSaring] = useState<Saring>('semua')
  const [cari, setCari] = useState('')
  const [tambah, setTambah] = useState(false)
  const jumlahUnit = app.spbuList.length

  useEffect(() => {
    let hidup = true
    app.backend.ringkasanUnit(hariIni).then(
      (r) => hidup && (setRows(r), setError(null)),
      (e: unknown) => hidup && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      hidup = false
    }
  }, [app.backend, hariIni, muat, jumlahUnit])

  const buka = useCallback(
    (r: RingkasanUnit) => {
      if (r.spbuId === app.spbuId) navigate('/')
      else app.pilihSpbu(r.spbuId)
    },
    [app, navigate],
  )

  if (!rows && !error) return <Loading />
  const semua = rows ?? []
  const q = cari.trim().toLowerCase()
  const tampil = semua.filter(
    (r) =>
      (saring === 'semua' || (saring === 'perhatian' && perluPerhatian(r)) || (saring === 'belum' && !siap(r)) || (saring === 'siap' && siap(r))) &&
      (!q || r.nama.toLowerCase().includes(q) || (r.kode ?? '').toLowerCase().includes(q)),
  )
  const nSiap = semua.filter(siap).length
  const qqHariIni = semua.filter((r) => (r.qq7Hari[r.qq7Hari.length - 1] ?? 0) > 0).length
  const bongkaran = semua.reduce((n, r) => n + r.bongkaranBulan, 0)
  const anomali = semua.reduce((n, r) => n + r.anomaliBulan, 0)
  const insiden = semua.reduce((n, r) => n + r.insidenTerbuka, 0)

  const cols: Col<RingkasanUnit>[] = [
    {
      header: 'SPBU',
      mobile: 'title',
      cell: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-on-surface">{r.nama || 'SPBU tanpa nama'}</span>
          <span className="tabular text-body-sm text-on-surface-variant">{r.kode || 'Kode belum diisi'}</span>
        </span>
      ),
      mobileCell: (r) => r.nama || 'SPBU tanpa nama',
    },
    {
      header: 'Data SPBU',
      mobile: 'badge',
      cell: (r) =>
        siap(r) ? (
          <Pill tone="success">Siap</Pill>
        ) : (
          <Pill tone="error">{!r.identitasLengkap && r.tangki === 0 ? 'Belum diisi' : !r.identitasLengkap ? 'Identitas kurang' : 'Tangki kosong'}</Pill>
        ),
    },
    { header: 'Q&Q 7 hari', mobile: 'hide', cell: (r) => <GarisQq hari={r.qq7Hari} akhir={hariIni} /> },
    {
      header: 'Bongkar (bln)',
      align: 'right',
      mobile: 'hide',
      cell: (r) => (
        <span className="tabular">
          {r.bongkaranBulan}
          {r.anomaliBulan > 0 && <span className="ml-1 font-semibold text-error">({r.anomaliBulan} anomali)</span>}
        </span>
      ),
    },
    { header: 'APAR (bln)', align: 'right', mobile: 'hide', cell: (r) => (r.aparUnit ? `${Math.min(r.aparCekBulan, r.aparUnit)}/${r.aparUnit}` : '-') },
    { header: 'Insiden', align: 'right', mobile: 'hide', cell: (r) => <span className={cn(r.insidenTerbuka > 0 && 'font-semibold text-error')}>{r.insidenTerbuka}</span> },
    { header: 'Pengawas / akun', align: 'right', mobile: 'hide', cell: (r) => `${r.pengawas} / ${r.anggota}` },
    {
      header: 'Ringkas',
      desktop: false,
      mobile: 'sub',
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{r.kode || 'Kode belum diisi'}</span>
          <GarisQq hari={r.qq7Hari} akhir={hariIni} />
          <span>
            {r.bongkaranBulan} bongkar{r.anomaliBulan ? `, ${r.anomaliBulan} anomali` : ''}
            {r.insidenTerbuka ? `, ${r.insidenTerbuka} insiden` : ''}
          </span>
        </span>
      ),
    },
    {
      header: 'Terakhir aktif',
      mobile: 'hide',
      cell: (r) => (r.terakhirAktif ? formatTanggalIso(todayIso(new Date(r.terakhirAktif))) : '-'),
    },
  ]

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <Building2 className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-primary">Area Business Head</span>
            <span className="text-headline-md font-bold text-on-surface">{semua.length} unit bisnis</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-space-xs sm:flex">
          <Button variant="glass" size="sm" onClick={() => setMuat((n) => n + 1)}>
            <RefreshCw aria-hidden="true" />
            Sinkronkan
          </Button>
          <Button size="sm" onClick={() => setTambah(true)}>
            <Plus aria-hidden="true" />
            Tambah SPBU
          </Button>
        </div>
      </GlassCard>

      <ErrorBox text={error} />

      <section aria-label="Ringkasan unit bisnis" className="animate-entrance-2 grid grid-cols-2 gap-space-xs md:grid-cols-4">
        <StatTile label="Data siap" value={`${nSiap}/${semua.length}`} hint="identitas & tangki lengkap" icon={CircleCheck} tone={nSiap === semua.length ? 'success' : 'error'} />
        <StatTile label="Q&Q hari ini" value={`${qqHariIni}/${semua.length}`} hint="SPBU sudah uji" icon={ClipboardCheck} tone={qqHariIni === semua.length ? 'success' : 'default'} />
        <StatTile label="Bongkaran bulan ini" value={bongkaran} hint={anomali ? `${anomali} anomali` : 'tanpa anomali'} icon={Truck} tone={anomali ? 'error' : 'primary'} />
        <StatTile label="Insiden terbuka" value={insiden} hint="insiden, near miss, kerusakan" icon={ShieldAlert} tone={insiden ? 'error' : 'default'} />
      </section>

      <section aria-labelledby="progres-spbu" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="progres-spbu" title="Progres per SPBU" />
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <Input aria-label="Cari SPBU" placeholder="Cari nama atau kode SPBU" className="pl-9" value={cari} onChange={(e) => setCari(e.target.value)} />
        </div>
        <ChipFilter
          label="Saring SPBU"
          value={saring}
          onChange={setSaring}
          options={[
            { value: 'semua' as const, label: `Semua ${semua.length}` },
            { value: 'perhatian' as const, label: `Perlu perhatian ${semua.filter(perluPerhatian).length}` },
            { value: 'belum' as const, label: `Belum siap ${semua.length - nSiap}` },
            { value: 'siap' as const, label: `Siap ${nSiap}` },
          ]}
        />
        <RecordTable
          title="Unit bisnis"
          rows={tampil}
          total={semua.length}
          cols={cols}
          rowKey={(r) => r.spbuId}
          onRow={buka}
          rowClass={(r) => (perluPerhatian(r) ? BARIS_ORANYE : undefined)}
          empty={semua.length ? 'Tidak ada SPBU yang cocok dengan pencarian atau saringan ini.' : 'Belum ada SPBU. Tambahkan unit bisnis pertama Anda.'}
        />
        <span className="flex flex-wrap items-center gap-x-space-sm gap-y-1 text-body-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-emerald-500" /> Q&Q 3 shift
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-amber-400" /> sebagian shift
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-outline-variant" /> belum uji
          </span>
          <span>Baris oranye: data belum siap, anomali, insiden terbuka, atau belum uji Q&Q hari ini.</span>
        </span>
      </section>

      <TambahSpbu open={tambah} onClose={() => setTambah(false)} onDibuat={() => navigate('/siapkan')} />
    </div>
  )
}

function TambahSpbu({ open, onClose, onDibuat }: { open: boolean; onClose: () => void; onDibuat: () => void }) {
  const app = useApp()
  const toast = useToast()
  const [nama, setNama] = useState('')
  const [kode, setKode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [simpan, setSimpan] = useState(false)
  const kirim = async () => {
    if (!nama.trim()) return setError('Isi nama SPBU.')
    if (!kode.trim()) return setError('Isi kode / nomor SPBU.')
    if (app.spbuList.some((s) => (s.kode ?? '').trim().toUpperCase() === kode.trim().toUpperCase())) return setError(`Kode ${kode.trim()} sudah terdaftar.`)
    setSimpan(true)
    try {
      await app.buatSpbu(nama, kode)
      toast(`${nama.trim()} ditambahkan`)
      setNama('')
      setKode('')
      onClose()
      onDibuat()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSimpan(false)
    }
  }
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Tambah SPBU" description="Unit bisnis baru yang Anda kendalikan sebagai ABH.">
      <Field label="Nama SPBU" htmlFor="spbu-nama">
        <Input id="spbu-nama" autoComplete="off" placeholder="Mis. SPBU COCO Kertosono" value={nama} onChange={(e) => (setError(null), setNama(e.target.value))} />
      </Field>
      <Field label="Kode / nomor SPBU" htmlFor="spbu-kode">
        <Input id="spbu-kode" autoComplete="off" placeholder="Mis. 54.644.01" value={kode} onChange={(e) => (setError(null), setKode(e.target.value))} />
      </Field>
      <span className="text-body-sm text-on-surface-variant">
        Setelah dibuat, buat akun pengawas SPBU ini di Profil &gt; Anggota. Pengawas wajib melengkapi identitas SPBU dan database tangki saat pertama masuk.
      </span>
      <ErrorBox text={error} />
      <Button size="lg" disabled={simpan} onClick={() => void kirim()}>
        <Plus aria-hidden="true" />
        {simpan ? 'Menyimpan…' : 'Tambah SPBU'}
      </Button>
    </Sheet>
  )
}

/**
 * Wajib sebelum memakai FLOQ: pengawas (atau ABH) melengkapi identitas SPBU dan database tangki
 * SPBU yang belum punya data.
 */
export function SiapkanSpbu() {
  const app = useApp()
  const navigate = useNavigate()
  if (!app.loaded) return <Loading />
  const s = app.settings
  const langkah = [
    { no: 1, judul: 'Identitas SPBU', selesai: app.identitasLengkap },
    { no: 2, judul: 'Database tangki', selesai: app.tanks.length > 0 },
  ]
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <Building2 className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-primary">{app.spbu?.nama || 'SPBU baru'}</span>
            <span className="text-headline-md font-bold text-on-surface">Lengkapi data SPBU dulu</span>
            <span className="text-body-sm text-on-surface-variant">
              SPBU ini belum punya database. Isi identitas SPBU dan database tangki (tabel kalibrasi) sebelum memakai modul lain. Cukup sekali; data bisa diubah lagi kapan saja.
            </span>
          </div>
        </div>
        <ol className="grid grid-cols-2 gap-space-xs">
          {langkah.map((l) => (
            <li key={l.no} className={cn('flex items-center gap-2 rounded-md px-space-sm py-space-xs text-body-sm font-semibold', l.selesai ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
              <span aria-hidden="true" className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold', l.selesai ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white')}>
                {l.selesai ? '✓' : l.no}
              </span>
              <span>
                {l.judul}
                <span className="sr-only">{l.selesai ? ', sudah lengkap' : ', belum lengkap'}</span>
              </span>
            </li>
          ))}
        </ol>
      </GlassCard>

      <section aria-labelledby="siap-identitas" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="siap-identitas" title="1. Identitas SPBU" />
        <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
          <Field label="Nama SPBU" htmlFor="siap-nama">
            <Input id="siap-nama" autoComplete="off" value={s.namaSpbu} onChange={(e) => app.updateSettings({ namaSpbu: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Kode / nomor SPBU" htmlFor="siap-kode">
              <Input id="siap-kode" autoComplete="off" value={s.kodeSpbu} onChange={(e) => app.updateSettings({ kodeSpbu: e.target.value })} />
            </Field>
            <Field label="Alamat" htmlFor="siap-alamat">
              <Input id="siap-alamat" value={s.alamatSpbu} onChange={(e) => app.updateSettings({ alamatSpbu: e.target.value })} />
            </Field>
            <JumlahField id="siap-pulau" label="Jumlah pulau pompa" value={s.jumlahPulau ?? 0} max={30} onChange={(n) => app.updateSettings({ jumlahPulau: n })} />
            <JumlahField id="siap-dispenser" label="Jumlah dispenser" value={s.jumlahDispenser ?? 0} max={60} onChange={(n) => app.updateSettings({ jumlahDispenser: n })} />
          </div>
          {!app.identitasLengkap && (
            <span className="flex items-start gap-1.5 text-body-sm text-amber-800">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Wajib: nama, kode SPBU, dan jumlah pulau pompa.
            </span>
          )}
        </GlassCard>
      </section>

      <section aria-labelledby="siap-tangki" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="siap-tangki" title={`2. Database tangki (${app.tanks.length})`} />
        <DaftarTangki kembali="/siapkan" />
      </section>

      <Button size="lg" disabled={!app.spbuSiap} onClick={() => navigate('/')}>
        <CircleCheck aria-hidden="true" />
        {app.spbuSiap ? 'Data lengkap, mulai pakai FLOQ' : 'Lengkapi kedua langkah di atas'}
      </Button>
    </div>
  )
}

/** Kepala shift & security: SPBU belum disiapkan pengawas. */
export function SpbuBelumSiap() {
  const app = useApp()
  return (
    <GlassCard level={2} className="flex flex-col items-center gap-space-sm p-space-md text-center">
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <Cylinder className="size-6" />
      </span>
      <span className="text-body-md font-bold text-on-surface">Data {app.spbu?.nama || 'SPBU'} belum lengkap</span>
      <span className="text-body-sm text-on-surface-variant">
        Pengawas SPBU perlu mengisi identitas SPBU dan database tangki terlebih dahulu. Setelah itu modul untuk peran {roleLabel(app.role)} dapat dipakai.
      </span>
      <Button variant="glass" size="pill" onClick={() => window.location.reload()}>
        <RefreshCw aria-hidden="true" />
        Periksa lagi
      </Button>
      <Button variant="ghost" onClick={() => void app.signOut()}>
        <LogOut aria-hidden="true" />
        Keluar
      </Button>
    </GlassCard>
  )
}

/** Akun yang belum ditautkan ke SPBU mana pun (bukan ABH). */
export function TanpaSpbu() {
  const app = useApp()
  return (
    <GlassCard level={2} className="flex flex-col items-center gap-space-sm p-space-md text-center">
      <Building2 aria-hidden="true" className="size-8 text-on-surface-variant" />
      <span className="text-body-md font-bold text-on-surface">Akun belum terhubung ke SPBU</span>
      <span className="text-body-sm text-on-surface-variant">Minta ABH mendaftarkan akun {app.session.user?.email} sebagai anggota SPBU tempat Anda bertugas.</span>
      <Button variant="ghost" onClick={() => void app.signOut()}>
        <LogOut aria-hidden="true" />
        Keluar
      </Button>
    </GlassCard>
  )
}
