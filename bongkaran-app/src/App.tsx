import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider } from '@/components/shell/app-provider'
import { AppShell } from '@/components/shell/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { titleFor } from '@/lib/nav'
import { Anggota } from '@/pages/Anggota'
import { Dashboard } from '@/pages/Dashboard'
import { FormBongkar } from '@/pages/FormBongkar'
import { FormInput } from '@/pages/FormInput'
import { Kalkulator } from '@/pages/Kalkulator'
import { Laporan } from '@/pages/Laporan'
import { Login, NotMember, SessionState } from '@/pages/Login'
import { Pengaturan } from '@/pages/Pengaturan'
import { Plan } from '@/pages/Plan'
import { Profil } from '@/pages/Profil'

function Gate() {
  const app = useApp()
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = `${titleFor(pathname)} · Bongkaran BBM`
    window.scrollTo(0, 0)
  }, [pathname])

  if (app.status === 'login') return <Login />
  if (app.status === 'nomember') return <NotMember />
  if (app.status !== 'ready') return <SessionState />

  return (
    <AppShell>
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
        <Route path="*" element={<Dashboard />} />
      </Routes>
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
