import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Droplet, FlaskConical, Layers, LoaderCircle, Lock, Send } from 'lucide-react'
import { LayarKirimWa } from '@/components/bongkaran/kirim-wa'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { MenuCard, type MenuItem } from '@/components/bongkaran/menu-card'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { airId, airLengkap, tangkiBerair, teksWaAir, type AirRecord } from '@/lib/air'
import { useApp } from '@/lib/app-state'
import { qqD15, qqRecordId, totalPumpTest, type QqRecord } from '@/lib/daily'
import { nowHm, todayIso } from '@/lib/date'
import { bacaFotoHarian, type FotoHarian } from '@/lib/foto-harian'
import { namaSpbuWa, tanggalPanjang } from '@/lib/gts'
import { BATAS_HARIAN, lewatBatas } from '@/lib/harian'
import { zonaWaktu } from '@/lib/image'
import { buatKolaseGrid } from '@/lib/kolase'
import { acuanD15 } from '@/lib/ringkasan'
import { TANKS, tankName } from '@/lib/tank'
import { cn } from '@/lib/utils'
import { useAir } from '@/lib/use-air'
import { buildWaQq, type BarisQqWa } from '@/lib/wa'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** Status pemeriksaan harian hari ini: density (bbm_daily qq) & water content (bbm_air). */
function useStatusHarian() {
  const app = useApp()
  const hariIni = todayIso()
  const { recs } = useAir(hariIni, hariIni)
  const qq = app.daily.find((d): d is QqRecord => d.kind === 'qq' && d.id === qqRecordId(hariIni, 1) && !!d.data.selesaiAt) ?? null
  const air = recs?.find((r) => r.id === airId(hariIni, 1)) ?? null
  const tanpaTangki = TANKS.length === 0
  return { hariIni, qq, air, airDimuat: recs !== null, airSelesai: tanpaTangki || airLengkap(air ?? undefined, TANKS), tanpaTangki }
}

/** Operation > Kualitas Harian: submenu Density Harian, Water Content Harian, dan Kirim ke grup WA (gabungan). */
export function KualitasHarianMenu() {
  const app = useApp()
  const st = useStatusHarian()
  if (!app.loaded || !st.airDimuat) return <Loading />
  const lewat = lewatBatas(nowHm())
  const nada = (selesai: boolean) => (selesai ? 'ok' : lewat ? 'anomali' : 'pengingat') as MenuItem['nada']
  const berair = tangkiBerair(st.air ?? undefined, TANKS)
  const items: MenuItem[] = [
    {
      to: '/kualitas/density',
      icon: FlaskConical,
      title: 'Density Harian',
      desc: 'Density & suhu per produk, foto hydrometer',
      status: st.qq ? `Selesai ${st.qq.data.jam}` : lewat ? `Terlewat (batas ${BATAS_HARIAN})` : `Belum diuji (batas ${BATAS_HARIAN})`,
      badge: st.qq ? 0 : 1,
      nada: nada(!!st.qq),
    },
    {
      to: '/air',
      icon: Droplet,
      title: 'Water Content Harian',
      desc: 'Pasta air setiap tangki pendam',
      status: st.tanpaTangki ? 'Database tangki belum diisi' : st.airSelesai ? (berair.length ? `Ada air: ${berair.map((t) => tankName(t.tankNo)).join(', ')}` : `Selesai ${st.air?.data.jam ?? ''}, nihil`) : lewat ? `Terlewat (batas ${BATAS_HARIAN})` : `Belum diperiksa (batas ${BATAS_HARIAN})`,
      badge: st.airSelesai ? 0 : 1,
      nada: berair.length ? 'anomali' : nada(st.airSelesai),
    },
  ]
  return (
    <div className="flex flex-col gap-space-md">
      <div className="grid grid-cols-2 gap-space-sm">
        {items.map((m, i) => (
          <MenuCard key={m.to} m={m} index={i} />
        ))}
      </div>
      <KirimLaporan st={st} />
      {app.can('/laporan/kualitas') && (
        <Link to="/laporan/kualitas" className={buttonVariants({ variant: 'glass' })}>
          Riwayat kualitas harian
        </Link>
      )}
    </div>
  )
}

type Siap = { teks: string; files: File[]; urls: string[]; fotoKurang: string[] }
type JenisKirim = 'density' | 'air' | 'semua'

const PILIHAN_KIRIM: { jenis: JenisKirim; judul: string; sub: string; icon: typeof Send }[] = [
  { jenis: 'density', judul: 'Lapor Kualitas Harian', sub: 'Density & suhu per produk + kolase foto hydrometer', icon: FlaskConical },
  { jenis: 'air', judul: 'Lapor Water Content', sub: 'Pasta air tiap tangki pendam + kolase foto', icon: Droplet },
  { jenis: 'semua', judul: 'Lapor Semua', sub: 'Density & water content dalam satu kolase dan satu laporan', icon: Layers },
]

/** Syarat tiap pilihan kirim; null = siap, selain itu alasan belum bisa dikirim. */
function syaratKirim(st: ReturnType<typeof useStatusHarian>, jenis: JenisKirim): string | null {
  const kurang = [
    jenis !== 'air' && !st.qq && 'Density Harian',
    jenis !== 'density' && !st.tanpaTangki && !st.airSelesai && 'Water Content Harian',
  ].filter(Boolean)
  if (jenis === 'air' && st.tanpaTangki) return 'Database tangki belum diisi'
  return kurang.length ? `Submit dulu ${kurang.join(' dan ')} hari ini` : null
}

/** Kualitas Harian: dropdown "Kirim laporan ke grup WA" dengan pilihan density, water content, atau semua. */
function KirimLaporan({ st }: { st: ReturnType<typeof useStatusHarian> }) {
  const [buka, setBuka] = useState(false)
  const siapAda = PILIHAN_KIRIM.some((p) => !syaratKirim(st, p.jenis))
  return (
    <div className="animate-entrance-3 overflow-hidden rounded-lg bg-surface-container-lowest shadow-sm ring-1 ring-outline-variant/40">
      <button
        type="button"
        aria-expanded={buka}
        onClick={() => setBuka((b) => !b)}
        className={cn('flex min-h-16 w-full items-center gap-space-sm p-space-md text-left', siapAda ? 'bg-[#1fa855] text-white' : 'bg-neutral-200 text-neutral-700')}
      >
        <Send aria-hidden="true" className="size-6 shrink-0" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-md font-bold">Kirim laporan ke grup WA</span>
          <span className={cn('text-body-sm', siapAda ? 'text-white/90' : '')}>Pilih: kualitas harian, water content, atau semua</span>
        </span>
        <ChevronDown aria-hidden="true" className={cn('size-5 shrink-0 transition-transform duration-200', buka && 'rotate-180')} />
      </button>
      <div className={cn('grid transition-[grid-template-rows] duration-300 ease-out', buka ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-space-xs p-space-sm">
            {PILIHAN_KIRIM.map((p) => {
              const alasan = syaratKirim(st, p.jenis)
              const Ikon = p.icon
              const isi = (
                <>
                  <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', alasan ? 'bg-neutral-200 text-neutral-500' : 'bg-[#1fa855]/12 text-[#1a9149]')}>
                    {alasan ? <Lock aria-hidden="true" className="size-5" /> : <Ikon aria-hidden="true" className="size-5" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn('text-body-md font-bold', alasan ? 'text-on-surface-variant' : 'text-on-surface')}>{p.judul}</span>
                    <span className="text-body-sm text-on-surface-variant">{alasan ?? p.sub}</span>
                  </span>
                  {!alasan && <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />}
                </>
              )
              return alasan ? (
                <div key={p.jenis} aria-disabled="true" className="flex min-h-14 items-center gap-space-sm rounded-md p-space-xs">
                  {isi}
                </div>
              ) : (
                <Link key={p.jenis} to={`/kualitas/kirim?jenis=${p.jenis}`} className="flex min-h-14 items-center gap-space-sm rounded-md p-space-xs active:bg-surface-container-low">
                  {isi}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Kualitas Harian > Kirim laporan ke grup WA (?jenis=density|air|semua): hasil dibaca dari database;
 * foto dibaca dari HP ini (disimpan sementara saat masing-masing form di-submit).
 */
export function KirimGabungan() {
  const app = useApp()
  const st = useStatusHarian()
  const [siap, setSiap] = useState<Siap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dibagikan, setDibagikan] = useState(false)
  const [params] = useSearchParams()
  const jenis: JenisKirim = (['density', 'air', 'semua'] as const).find((j) => j === params.get('jenis')) ?? 'semua'
  const pilihan = PILIHAN_KIRIM.find((p) => p.jenis === jenis)!
  const guard = useLeaveGuard({ active: !!siap && !dibagikan, title: 'Laporan belum dikirim', detail: 'Laporan belum dibagikan ke WhatsApp.' })
  const alasan = syaratKirim(st, jenis)
  const lengkap = !alasan
  const mulai = useRef(false)

  useEffect(() => {
    if (!app.loaded || !st.airDimuat || !lengkap || mulai.current) return
    mulai.current = true
    ;(async () => {
      try {
        const spbu = namaSpbuWa(app.settings)
        const qq = jenis === 'air' ? null : st.qq!
        const air: AirRecord | null = jenis === 'density' || st.tanpaTangki ? null : st.air
        let teks: string
        if (qq) {
          const baris: BarisQqWa[] = qq.data.kualitas.map((k) => {
            const { obs, d15 } = qqD15(k)
            const ref = acuanD15(app.reports, k.produk, qq.tanggal)
            const selisih = d15 && ref ? Math.round((d15.value - ref.d15) * 10000) / 10000 : null
            return { produk: k.produk, obs, suhu: k.suhu, d15: d15?.value ?? null, acuan: ref?.d15 ?? null, selisih, ok: selisih === null ? null : Math.abs(selisih) <= app.rules.densityTolerance + 1e-9, pumpTest: k.pumpTest }
          })
          teks = buildWaQq(
            { tanggal: qq.tanggal, jam: qq.data.jam, petugas: [...new Set([qq.data.petugas, air?.data.petugas].filter(Boolean))].join(' / '), terlambat: !!qq.data.terlambat || !!air?.data.terlambat, totalPumpTest: totalPumpTest(qq.data).kualitas, catatan: [qq.data.catatan, air?.data.catatan].filter(Boolean).join('; ') },
            baris,
            spbu,
            tanggalPanjang(qq.tanggal),
            zonaWaktu(),
            air ? { rec: air, tanks: TANKS } : undefined,
          )
        } else teks = teksWaAir(air!, TANKS, app.settings, zonaWaktu())
        const fDensity = qq ? await bacaFotoHarian(app.spbuId, st.hariIni, 'density') : []
        const fAir = air ? await bacaFotoHarian(app.spbuId, st.hariIni, 'air') : []
        const fotoKurang = [qq && !fDensity.length && 'density', air && !fAir.length && 'water content'].filter(Boolean) as string[]
        const semua: FotoHarian[] = [...fDensity, ...fAir]
        const files: File[] = []
        const urls: string[] = []
        if (semua.length) {
          const kolase = await buatKolaseGrid(semua)
          const nama = { density: 'Kualitas_Harian', air: 'Water_Content', semua: 'Kualitas_Water_Content' }[jenis]
          files.push(new File([kolase], `${nama}_${st.hariIni}.jpg`, { type: 'image/jpeg' }))
          urls.push(URL.createObjectURL(kolase))
        }
        setSiap({ teks, files, urls, fotoKurang })
      } catch (e) {
        setError(pesan(e))
      }
    })()
  }, [app, st, lengkap, jenis])

  if (!app.loaded || !st.airDimuat) return <Loading />
  if (!lengkap)
    return (
      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <span className="text-body-md font-bold text-on-surface">{pilihan.judul}: belum dapat dikirim</span>
        <span className="text-body-sm text-on-surface-variant">{alasan}.</span>
        <Link to="/kualitas" className={buttonVariants({ variant: 'glass' })}>
          Kembali ke Kualitas Harian
        </Link>
      </GlassCard>
    )
  if (error) return <ErrorBox text={error} />
  if (!siap)
    return (
      <GlassCard level={2} className="flex items-center gap-space-sm p-space-md text-body-md text-on-surface-variant">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        Menyusun kolase & laporan…
      </GlassCard>
    )
  return (
    <>
      <LayarKirimWa
        judul={pilihan.judul}
        keterangan={
          siap.fotoKurang.length
            ? `Foto ${siap.fotoKurang.join(' & ')} tidak ada di HP ini (diisi di HP lain atau sudah lebih dari 3 hari); laporan tetap berisi semua hasil.`
            : pilihan.sub
        }
        teks={siap.teks}
        files={siap.files}
        urls={siap.urls}
        dibagikan={dibagikan}
        onDibagikan={() => setDibagikan(true)}
      >
        <Link to="/kualitas" replace className={buttonVariants({ variant: 'glass', size: 'lg' })}>
          Kembali ke Kualitas Harian
        </Link>
      </LayarKirimWa>
      {guard.dialog}
    </>
  )
}
