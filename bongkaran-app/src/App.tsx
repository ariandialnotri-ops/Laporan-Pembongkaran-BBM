import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Loading } from '@/components/bongkaran/load-state'
import { AppProvider } from '@/components/shell/app-provider'
import { AppShell } from '@/components/shell/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { titleFor } from '@/lib/nav'
import { Dashboard } from '@/pages/Dashboard'
import { FormInput } from '@/pages/FormInput'
import { Login, NotMember, SessionState } from '@/pages/Login'

// Halaman selain Beranda & Input dimuat saat dibuka, agar pembukaan awal ringan.
const Anggota = lazy(() => import('@/pages/Anggota').then((m) => ({ default: m.Anggota })))
const FormBongkar = lazy(() => import('@/pages/FormBongkar').then((m) => ({ default: m.FormBongkar })))
const Kalkulator = lazy(() => import('@/pages/Kalkulator').then((m) => ({ default: m.Kalkulator })))
const Laporan = lazy(() => import('@/pages/Laporan').then((m) => ({ default: m.Laporan })))
const Pengaturan = lazy(() => import('@/pages/Pengaturan').then((m) => ({ default: m.Pengaturan })))
const Plan = lazy(() => import('@/pages/Plan').then((m) => ({ default: m.Plan })))
const QqHarian = lazy(() => import('@/pages/QqHarian').then((m) => ({ default: m.QqHarian })))
const StokShift = lazy(() => import('@/pages/StokShift').then((m) => ({ default: m.StokShift })))
const Profil = lazy(() => import('@/pages/Profil').then((m) => ({ default: m.Profil })))

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
          <Route path="/input" element={<FormInput />} />
          <Route path="/input/:id" element={<FormBongkar />} />
          <Route path="/laporan" element={<Laporan />} />
          <Route path="/profil" element={<Profil />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/kalkulator" element={<Kalkulator />} />
          <Route path="/pengaturan" element={<Pengaturan />} />
          <Route path="/anggota" element={<Anggota />} />
          <Route path="/qq" element={<QqHarian />} />
          <Route path="/stok" element={<StokShift />} />
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
