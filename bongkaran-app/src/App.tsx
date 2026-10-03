import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from '@/components/bongkaran/load-state'
import { AppProvider } from '@/components/shell/app-provider'
import { AppShell } from '@/components/shell/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { titleFor } from '@/lib/nav'
import { Dashboard } from '@/pages/Dashboard'
import { InputMenu } from '@/pages/InputMenu'
import { Login, NotMember, SessionState } from '@/pages/Login'

// Halaman selain Dashboard & menu Input dimuat saat dibuka, agar pembukaan awal ringan.
const Anggota = lazy(() => import('@/pages/Anggota').then((m) => ({ default: m.Anggota })))
const BeritaAcara = lazy(() => import('@/pages/BeritaAcara').then((m) => ({ default: m.BeritaAcara })))
const FormBongkar = lazy(() => import('@/pages/FormBongkar').then((m) => ({ default: m.FormBongkar })))
const FormInput = lazy(() => import('@/pages/FormInput').then((m) => ({ default: m.FormInput })))
const Kalkulator = lazy(() => import('@/pages/Kalkulator').then((m) => ({ default: m.Kalkulator })))
const LaporanMenu = lazy(() => import('@/pages/LaporanMenu').then((m) => ({ default: m.LaporanMenu })))
const Pengaturan = lazy(() => import('@/pages/Pengaturan').then((m) => ({ default: m.Pengaturan })))
const Persediaan = lazy(() => import('@/pages/Persediaan').then((m) => ({ default: m.Persediaan })))
const Plan = lazy(() => import('@/pages/Plan').then((m) => ({ default: m.Plan })))
const Profil = lazy(() => import('@/pages/Profil').then((m) => ({ default: m.Profil })))
const QqHarian = lazy(() => import('@/pages/QqHarian').then((m) => ({ default: m.QqHarian })))
const RiwayatBongkaran = lazy(() => import('@/pages/RiwayatBongkaran').then((m) => ({ default: m.RiwayatBongkaran })))
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
  }, [pathname])

  if (app.status === 'login') return <Login />
  if (app.status === 'nomember') return <NotMember />
  if (app.status !== 'ready') return <SessionState />

  return (
    <AppShell>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/input" element={<InputMenu />} />
          <Route path="/input/bongkar" element={<FormInput />} />
          <Route path="/input/:id" element={<FormBongkar />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/kualitas" element={<QqHarian />} />
          <Route path="/sample" element={<Sample2Jam />} />
          <Route path="/stok" element={<StokShift />} />
          <Route path="/laporan" element={<LaporanMenu />} />
          <Route path="/laporan/persediaan" element={<Persediaan />} />
          <Route path="/laporan/ba" element={<BeritaAcara />} />
          <Route path="/laporan/bongkaran" element={<RiwayatBongkaran />} />
          <Route path="/laporan/lo" element={<RiwayatLo />} />
          <Route path="/laporan/kualitas" element={<RiwayatKualitas />} />
          <Route path="/laporan/tera" element={<RiwayatTera />} />
          <Route path="/profil" element={<Profil />} />
          <Route path="/kalkulator" element={<Kalkulator />} />
          <Route path="/pengaturan" element={<Pengaturan />} />
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
