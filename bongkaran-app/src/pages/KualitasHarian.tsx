import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Droplet, FlaskConical, LoaderCircle, Lock, Send } from 'lucide-react'
import { LayarKirimWa } from '@/components/bongkaran/kirim-wa'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { MenuCard, type MenuItem } from '@/components/bongkaran/menu-card'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { airId, airLengkap, tangkiBerair, type AirRecord } from '@/lib/air'
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
      desc: 'Density & suhu per produk, foto hydrometer, laporan WhatsApp sendiri',
      status: st.qq ? `Selesai ${st.qq.data.jam}` : lewat ? `Terlewat (batas ${BATAS_HARIAN})` : `Belum diuji (batas ${BATAS_HARIAN})`,
      badge: st.qq ? 0 : 1,
      nada: nada(!!st.qq),
    },
    {
      to: '/air',
      icon: Droplet,
      title: 'Water Content Harian',
      desc: 'Pasta air setiap tangki pendam, laporan WhatsApp sendiri',
      status: st.tanpaTangki ? 'Database tangki belum diisi' : st.airSelesai ? (berair.length ? `Ada air: ${berair.map((t) => tankName(t.tankNo)).join(', ')}` : `Selesai ${st.air?.data.jam ?? ''}, nihil`) : lewat ? `Terlewat (batas ${BATAS_HARIAN})` : `Belum diperiksa (batas ${BATAS_HARIAN})`,
      badge: st.airSelesai ? 0 : 1,
      nada: berair.length ? 'anomali' : nada(st.airSelesai),
    },
  ]
  const siap = !!st.qq && st.airSelesai
  return (
    <div className="flex flex-col gap-space-md">
      <div className="grid grid-cols-2 gap-space-sm">
        {items.map((m, i) => (
          <MenuCard key={m.to} m={m} index={i} />
        ))}
      </div>
      {siap ? (
        <Link to="/kualitas/kirim" className="animate-entrance-3 flex min-h-16 items-center gap-space-sm rounded-lg bg-[#1fa855] p-space-md text-white shadow-sm active:scale-[0.99]">
          <Send aria-hidden="true" className="size-6 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-md font-bold">Kirim ke grup WA</span>
            <span className="text-body-sm text-white/90">Foto & hasil density + water content hari ini dalam satu kolase dan satu laporan</span>
          </span>
        </Link>
      ) : (
        <div className="animate-entrance-3 flex min-h-16 items-center gap-space-sm rounded-lg bg-neutral-200 p-space-md text-neutral-700">
          <Lock aria-hidden="true" className="size-6 shrink-0" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-md font-bold">Kirim ke grup WA</span>
            <span className="text-body-sm">Selesaikan dulu {[!st.qq && 'Density Harian', !st.airSelesai && 'Water Content Harian'].filter(Boolean).join(' dan ')} hari ini.</span>
          </span>
        </div>
      )}
      {app.can('/laporan/kualitas') && (
        <Link to="/laporan/kualitas" className={buttonVariants({ variant: 'glass' })}>
          Riwayat kualitas harian
        </Link>
      )}
    </div>
  )
}

type Siap = { teks: string; files: File[]; urls: string[]; fotoKurang: string[] }

/**
 * Kualitas Harian > Kirim ke grup WA: gabungan density & water content hari ini. Hasil dibaca dari
 * database; foto dibaca dari HP ini (disimpan sementara saat masing-masing form dikirim).
 */
export function KirimGabungan() {
  const app = useApp()
  const st = useStatusHarian()
  const [siap, setSiap] = useState<Siap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dibagikan, setDibagikan] = useState(false)
  const guard = useLeaveGuard({ active: !!siap && !dibagikan, title: 'Laporan gabungan belum dikirim', detail: 'Laporan gabungan belum dibagikan ke WhatsApp.' })
  const lengkap = !!st.qq && st.airSelesai
  const mulai = useRef(false)

  useEffect(() => {
    if (!app.loaded || !st.airDimuat || !lengkap || mulai.current) return
    mulai.current = true
    const qq = st.qq!
    ;(async () => {
      try {
        const spbu = namaSpbuWa(app.settings)
        const baris: BarisQqWa[] = qq.data.kualitas.map((k) => {
          const { obs, d15 } = qqD15(k)
          const ref = acuanD15(app.reports, k.produk, qq.tanggal)
          const selisih = d15 && ref ? Math.round((d15.value - ref.d15) * 10000) / 10000 : null
          return { produk: k.produk, obs, suhu: k.suhu, d15: d15?.value ?? null, acuan: ref?.d15 ?? null, selisih, ok: selisih === null ? null : Math.abs(selisih) <= app.rules.densityTolerance + 1e-9, pumpTest: k.pumpTest }
        })
        const air: AirRecord | null = st.tanpaTangki ? null : st.air
        const teks = buildWaQq(
          { tanggal: qq.tanggal, jam: qq.data.jam, petugas: [...new Set([qq.data.petugas, air?.data.petugas].filter(Boolean))].join(' / '), terlambat: !!qq.data.terlambat || !!air?.data.terlambat, totalPumpTest: totalPumpTest(qq.data).kualitas, catatan: [qq.data.catatan, air?.data.catatan].filter(Boolean).join('; ') },
          baris,
          spbu,
          tanggalPanjang(qq.tanggal),
          zonaWaktu(),
          air ? { rec: air, tanks: TANKS } : undefined,
        )
        const fDensity = await bacaFotoHarian(app.spbuId, st.hariIni, 'density')
        const fAir = air ? await bacaFotoHarian(app.spbuId, st.hariIni, 'air') : []
        const fotoKurang = [!fDensity.length && 'density', air && !fAir.length && 'water content'].filter(Boolean) as string[]
        const semua: FotoHarian[] = [...fDensity, ...fAir]
        const files: File[] = []
        const urls: string[] = []
        if (semua.length) {
          const kolase = await buatKolaseGrid(semua)
          files.push(new File([kolase], `Kualitas_Harian_${st.hariIni}.jpg`, { type: 'image/jpeg' }))
          urls.push(URL.createObjectURL(kolase))
        }
        setSiap({ teks, files, urls, fotoKurang })
      } catch (e) {
        setError(pesan(e))
      }
    })()
  }, [app, st, lengkap])

  if (!app.loaded || !st.airDimuat) return <Loading />
  if (!lengkap)
    return (
      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        <span className="text-body-md font-bold text-on-surface">Belum dapat dikirim</span>
        <span className="text-body-sm text-on-surface-variant">Laporan gabungan tersedia setelah Density Harian dan Water Content Harian hari ini selesai.</span>
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
        Menyusun kolase & laporan gabungan…
      </GlassCard>
    )
  return (
    <>
      <LayarKirimWa
        judul="Laporan Kualitas Harian"
        keterangan={
          siap.fotoKurang.length
            ? `Foto ${siap.fotoKurang.join(' & ')} tidak ada di HP ini (diisi di HP lain atau sudah lebih dari 3 hari); laporan tetap berisi semua hasil.`
            : 'Density & water content hari ini dalam satu kolase dan satu laporan.'
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
