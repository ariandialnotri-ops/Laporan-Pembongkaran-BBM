import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/shell/app-shell'
import { titleFor } from '@/lib/nav'
import { Dashboard } from '@/pages/Dashboard'
import { FormInput } from '@/pages/FormInput'
import { Laporan } from '@/pages/Laporan'
import { Profil } from '@/pages/Profil'

function App() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = `${titleFor(pathname)} · Bongkaran BBM`
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/input" element={<FormInput />} />
        <Route path="/laporan" element={<Laporan />} />
        <Route path="/profil" element={<Profil />} />
      </Routes>
    </AppShell>
  )
}

export default App
