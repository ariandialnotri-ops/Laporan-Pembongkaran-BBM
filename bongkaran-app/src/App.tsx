import { lazy, Suspense, useEffect } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Loading } from '@/components/bongkaran/load-state'
import { AppProvider } from '@/components/shell/app-provider'
import { AppShell } from '@/components/shell/app-shell'
import { lepasKunciGulir } from '@/components/shell/viewport'
import { buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { ToastProvider } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { titleFor } from '@/lib/nav'
import { berandaPeran, roleLabel } from '@/lib/roles'
import { Dashboard } from '@/pages/Dashboard'
import { InputMenu } from '@/pages/InputMenu'
import { Login, NotMember, SessionState } from '@/pages/Login'

// Halaman selain Dashboard & menu Input dimuat saat dibuka, agar pembukaan awal ringan.
const Anggota = lazy(() => import('@/pages/Anggota').then((m) => ({ default: m.Anggota })))
const BeritaAcara = lazy(() => import('@/pages/BeritaAcara').then((m) => ({ default: m.BeritaAcara })))
const FormBongkar = lazy(() => import('@/pages/FormBongkar').then((m) => ({ default: m.FormBongkar })))
const FormInput = lazy(() => import('@/pages/FormInput').then((m) => ({ default: m.FormInput })))
const AparDashboard = lazy(() => import('@/pages/AparDashboard').then((m) => ({ default: m.AparDashboard })))
const AparLabel = lazy(() => import('@/pages/AparLabel').then((m) => ({ default: m.AparLabel })))
const AparUnit = lazy(() => import('@/pages/AparUnit').then((m) => ({ default: m.AparUnit })))
const AparUnitForm = lazy(() => import('@/pages/AparUnitForm').then((m) => ({ default: m.AparUnitForm })))
const DataUtamaApar = lazy(() => import('@/pages/DataUtamaApar').then((m) => ({ default: m.DataUtamaApar })))
const InspeksiUnit = lazy(() => import('@/pages/InspeksiUnit').then((m) => ({ default: m.InspeksiUnit })))
const InspeksiApar = lazy(() => import('@/pages/InspeksiApar').then((m) => ({ default: m.InspeksiApar })))
const InsidenBaru = lazy(() => import('@/pages/Insiden').then((m) => ({ default: m.InsidenBaru })))
const RiwayatInsiden = lazy(() => import('@/pages/Insiden').then((m) => ({ default: m.RiwayatInsiden })))
const InsidenDetail = lazy(() => import('@/pages/Insiden').then((m) => ({ default: m.InsidenDetail })))
const Kalkulator = lazy(() => import('@/pages/Kalkulator').then((m) => ({ default: m.Kalkulator })))
const LaporanMenu = lazy(() => import('@/pages/LaporanMenu').then((m) => ({ default: m.LaporanMenu })))
const Pengaturan = lazy(() => import('@/pages/Pengaturan').then((m) => ({ default: m.Pengaturan })))
const IdentitasSpbu = lazy(() => import('@/pages/Pengaturan').then((m) => ({ default: m.IdentitasSpbu })))
const AturanPemeriksaan = lazy(() => import('@/pages/Pengaturan').then((m) => ({ default: m.AturanPemeriksaan })))
const DataAcuan = lazy(() => import('@/pages/Pengaturan').then((m) => ({ default: m.DataAcuan })))
const DataDispenser = lazy(() => import('@/pages/PengaturanAlat').then((m) => ({ default: m.DataDispenser })))
const NozzleTera = lazy(() => import('@/pages/PengaturanAlat').then((m) => ({ default: m.NozzleTera })))
const SoldShipTo = lazy(() => import('@/pages/PengaturanAlat').then((m) => ({ default: m.SoldShipTo })))
const Persediaan = lazy(() => import('@/pages/Persediaan').then((m) => ({ default: m.Persediaan })))
const Plan = lazy(() => import('@/pages/Plan').then((m) => ({ default: m.Plan })))
const EditLo = lazy(() => import('@/pages/EditLo').then((m) => ({ default: m.EditLo })))
const Profil = lazy(() => import('@/pages/Profil').then((m) => ({ default: m.Profil })))
const QqHarian = lazy(() => import('@/pages/QqHarian').then((m) => ({ default: m.QqHarian })))
const RiwayatApar = lazy(() => import('@/pages/RiwayatApar').then((m) => ({ default: m.RiwayatApar })))
const RiwayatBongkaran = lazy(() => import('@/pages/RiwayatBongkaran').then((m) => ({ default: m.RiwayatBongkaran })))
const KualitasDetail = lazy(() => import('@/pages/KualitasDetail').then((m) => ({ default: m.KualitasDetail })))
const RiwayatKualitas = lazy(() => import('@/pages/RiwayatKualitas').then((m) => ({ default: m.RiwayatKualitas })))
const RiwayatLo = lazy(() => import('@/pages/RiwayatLo').then((m) => ({ default: m.RiwayatLo })))
const RiwayatTera = lazy(() => import('@/pages/RiwayatTera').then((m) => ({ default: m.RiwayatTera })))
const Sample2Jam = lazy(() => import('@/pages/Sample2Jam').then((m) => ({ default: m.Sample2Jam })))
const StokShift = lazy(() => import('@/pages/StokShift').then((m) => ({ default: m.StokShift })))

function Gate() {
  const app = useApp()
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = `${titleFor(pathname)} · FLOQ`
    window.scrollTo(0, 0)
    lepasKunciGulir()
  }, [pathname])

  if (app.status === 'login') return <Login />
  if (app.status === 'nomember') return <NotMember />
  if (app.status !== 'ready') return <SessionState />
  // Halaman di luar hak akses peran: beranda dialihkan, halaman lain diberi keterangan.
  if (!app.can(pathname)) {
    if (pathname === '/') return <Navigate to={berandaPeran(app.role)} replace />
    return (
      <AppShell>
        <TanpaAkses peran={roleLabel(app.role)} beranda={berandaPeran(app.role)} />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/input" element={<InputMenu />} />
          <Route path="/input/bongkar" element={<FormInput />} />
          <Route path="/input/:id" element={<FormBongkar />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/plan/so/:id" element={<EditLo />} />
          <Route path="/kualitas" element={<QqHarian />} />
          <Route path="/sample" element={<Sample2Jam />} />
          <Route path="/stok" element={<StokShift />} />
          <Route path="/apar" element={<AparDashboard />} />
          <Route path="/apar/inspeksi" element={<InspeksiApar />} />
          <Route path="/apar/inspeksi/:id" element={<InspeksiUnit />} />
          <Route path="/apar/data" element={<DataUtamaApar />} />
          <Route path="/apar/data/unit/:id" element={<AparUnitForm />} />
          <Route path="/apar/label" element={<AparLabel />} />
          <Route path="/apar/unit/:id" element={<AparUnit />} />
          <Route path="/laporan" element={<LaporanMenu />} />
          <Route path="/laporan/persediaan" element={<Persediaan />} />
          <Route path="/laporan/ba" element={<BeritaAcara />} />
          <Route path="/laporan/bongkaran" element={<RiwayatBongkaran />} />
          <Route path="/laporan/lo" element={<RiwayatLo />} />
          <Route path="/laporan/kualitas" element={<RiwayatKualitas />} />
          <Route path="/laporan/kualitas/:kunci" element={<KualitasDetail />} />
          <Route path="/laporan/tera" element={<RiwayatTera />} />
          <Route path="/laporan/apar" element={<RiwayatApar />} />
          <Route path="/insiden/baru" element={<InsidenBaru />} />
          <Route path="/laporan/insiden" element={<RiwayatInsiden />} />
          <Route path="/laporan/insiden/:id" element={<InsidenDetail />} />
          <Route path="/profil" element={<Profil />} />
          <Route path="/kalkulator" element={<Kalkulator />} />
          <Route path="/pengaturan" element={<Pengaturan />} />
          <Route path="/pengaturan/identitas" element={<IdentitasSpbu />} />
          <Route path="/pengaturan/dispenser" element={<DataDispenser />} />
          <Route path="/pengaturan/nozzle" element={<NozzleTera />} />
          <Route path="/pengaturan/sold-ship-to" element={<SoldShipTo />} />
          <Route path="/pengaturan/aturan" element={<AturanPemeriksaan />} />
          <Route path="/pengaturan/acuan" element={<DataAcuan />} />
          <Route path="/anggota" element={<Anggota />} />
          {/* Alamat lama */}
          <Route path="/qq/*" element={<Navigate to="/kualitas" replace />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}

function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <Gate />
      </AppProvider>
    </ToastProvider>
  )
}

export default App

function TanpaAkses({ peran, beranda }: { peran: string; beranda: string }) {
  return (
    <GlassCard level={1} className="flex flex-col items-center gap-space-sm p-space-md text-center">
      <Lock aria-hidden="true" className="size-6 text-on-surface-variant" />
      <span className="text-body-md font-semibold text-on-surface">Halaman ini tidak tersedia untuk peran {peran}</span>
      <span className="text-body-sm text-on-surface-variant">Minta ABH mengubah peran akun Anda bila perlu membuka modul ini.</span>
      <Link to={beranda} className={buttonVariants({ size: 'pill' })}>
        Ke beranda
      </Link>
    </GlassCard>
  )
}
