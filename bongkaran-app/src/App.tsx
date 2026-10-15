import { lazy, Suspense, useEffect, type ReactNode } from 'react'
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
import { Login, NotMember, SessionState } from '@/pages/Login'

// Halaman selain Dashboard & menu Input dimuat saat dibuka, agar pembukaan awal ringan.
const Anggota = lazy(() => import('@/pages/Anggota').then((m) => ({ default: m.Anggota })))
const AnggotaBaru = lazy(() => import('@/pages/Anggota').then((m) => ({ default: m.AnggotaBaru })))
const AnggotaDaftar = lazy(() => import('@/pages/Anggota').then((m) => ({ default: m.AnggotaDaftar })))
const AnggotaSandi = lazy(() => import('@/pages/Anggota').then((m) => ({ default: m.AnggotaSandi })))
const BeritaAcara = lazy(() => import('@/pages/BeritaAcara').then((m) => ({ default: m.BeritaAcara })))
const UbahLo = lazy(() => import('@/pages/UbahLo').then((m) => ({ default: m.UbahLo })))
const FormBongkar = lazy(() => import('@/pages/FormBongkar').then((m) => ({ default: m.FormBongkar })))
const FormInput = lazy(() => import('@/pages/FormInput').then((m) => ({ default: m.FormInput })))
const AparDashboard = lazy(() => import('@/pages/AparDashboard').then((m) => ({ default: m.AparDashboard })))
const AparLabel = lazy(() => import('@/pages/AparLabel').then((m) => ({ default: m.AparLabel })))
const AparUnit = lazy(() => import('@/pages/AparUnit').then((m) => ({ default: m.AparUnit })))
const AparUnitForm = lazy(() => import('@/pages/AparUnitForm').then((m) => ({ default: m.AparUnitForm })))
const DataUtamaApar = lazy(() => import('@/pages/DataUtamaApar').then((m) => ({ default: m.DataUtamaApar })))
const TambahAreaApar = lazy(() => import('@/pages/DataUtamaApar').then((m) => ({ default: m.TambahAreaApar })))
const InspeksiUnit = lazy(() => import('@/pages/InspeksiUnit').then((m) => ({ default: m.InspeksiUnit })))
const InspeksiApar = lazy(() => import('@/pages/InspeksiApar').then((m) => ({ default: m.InspeksiApar })))
const InsidenBaru = lazy(() => import('@/pages/Insiden').then((m) => ({ default: m.InsidenBaru })))
const PilihJenisInsiden = lazy(() => import('@/pages/Insiden').then((m) => ({ default: m.PilihJenisInsiden })))
const RiwayatInsiden = lazy(() => import('@/pages/Insiden').then((m) => ({ default: m.RiwayatInsiden })))
const InsidenDetail = lazy(() => import('@/pages/Insiden').then((m) => ({ default: m.InsidenDetail })))
const Kalkulator = lazy(() => import('@/pages/Kalkulator').then((m) => ({ default: m.Kalkulator })))
const Pengaturan = lazy(() => import('@/pages/Pengaturan').then((m) => ({ default: m.Pengaturan })))
const IdentitasSpbu = lazy(() => import('@/pages/Pengaturan').then((m) => ({ default: m.IdentitasSpbu })))
const AturanPemeriksaan = lazy(() => import('@/pages/Pengaturan').then((m) => ({ default: m.AturanPemeriksaan })))
const DataAcuan = lazy(() => import('@/pages/Pengaturan').then((m) => ({ default: m.DataAcuan })))
const DataDispenser = lazy(() => import('@/pages/PengaturanAlat').then((m) => ({ default: m.DataDispenser })))
const DispenserEdit = lazy(() => import('@/pages/PengaturanAlat').then((m) => ({ default: m.DispenserEdit })))
const NozzleEdit = lazy(() => import('@/pages/PengaturanAlat').then((m) => ({ default: m.NozzleEdit })))
const NozzleTera = lazy(() => import('@/pages/PengaturanAlat').then((m) => ({ default: m.NozzleTera })))
const SoldShipTo = lazy(() => import('@/pages/PengaturanAlat').then((m) => ({ default: m.SoldShipTo })))
const MenuOperation = lazy(() => import('@/pages/MenuGrup').then((m) => ({ default: m.MenuOperation })))
const MenuGrup = lazy(() => import('@/pages/MenuGrup').then((m) => ({ default: m.MenuGrup })))
const MenuFinance = lazy(() => import('@/pages/MenuGrup').then((m) => ({ default: m.MenuFinance })))
const MenuReport = lazy(() => import('@/pages/MenuGrup').then((m) => ({ default: m.MenuReport })))
const MenuRiwayat = lazy(() => import('@/pages/MenuGrup').then((m) => ({ default: m.MenuRiwayat })))
const MenuExport = lazy(() => import('@/pages/MenuGrup').then((m) => ({ default: m.MenuExport })))
const HalamanKaleng = lazy(() => import('@/pages/MenuGrup').then((m) => ({ default: m.HalamanKaleng })))
const OpsMenu = lazy(() => import('@/pages/Operasional').then((m) => ({ default: m.OpsMenu })))
const OpsIsi = lazy(() => import('@/pages/Operasional').then((m) => ({ default: m.OpsIsi })))
const LaporanOps = lazy(() => import('@/pages/Operasional').then((m) => ({ default: m.LaporanOps })))
const Persediaan = lazy(() => import('@/pages/Persediaan').then((m) => ({ default: m.Persediaan })))
const Plan = lazy(() => import('@/pages/Plan').then((m) => ({ default: m.Plan })))
const PlanBaru = lazy(() => import('@/pages/Plan').then((m) => ({ default: m.PlanBaru })))
const EditLo = lazy(() => import('@/pages/EditLo').then((m) => ({ default: m.EditLo })))
const Profil = lazy(() => import('@/pages/Profil').then((m) => ({ default: m.Profil })))
const GantiSandi = lazy(() => import('@/pages/Profil').then((m) => ({ default: m.GantiSandi })))
const QqHarian = lazy(() => import('@/pages/QqHarian').then((m) => ({ default: m.QqHarian })))
const QqHarianMenu = lazy(() => import('@/pages/QqHarian').then((m) => ({ default: m.QqHarianMenu })))
const RiwayatApar = lazy(() => import('@/pages/RiwayatApar').then((m) => ({ default: m.RiwayatApar })))
const RiwayatBongkaran = lazy(() => import('@/pages/RiwayatBongkaran').then((m) => ({ default: m.RiwayatBongkaran })))
const KualitasDetail = lazy(() => import('@/pages/KualitasDetail').then((m) => ({ default: m.KualitasDetail })))
const RiwayatKualitas = lazy(() => import('@/pages/RiwayatKualitas').then((m) => ({ default: m.RiwayatKualitas })))
const RiwayatLo = lazy(() => import('@/pages/RiwayatLo').then((m) => ({ default: m.RiwayatLo })))
const Sample2Jam = lazy(() => import('@/pages/Sample2Jam').then((m) => ({ default: m.Sample2Jam })))
const Sample2JamForm = lazy(() => import('@/pages/Sample2Jam').then((m) => ({ default: m.Sample2JamForm })))
const UnitBisnis = lazy(() => import('@/pages/Spbu').then((m) => ({ default: m.UnitBisnis })))
const TambahSpbu = lazy(() => import('@/pages/Spbu').then((m) => ({ default: m.TambahSpbu })))
const SiapkanSpbu = lazy(() => import('@/pages/Spbu').then((m) => ({ default: m.SiapkanSpbu })))
const SpbuBelumSiap = lazy(() => import('@/pages/Spbu').then((m) => ({ default: m.SpbuBelumSiap })))
const TanpaSpbu = lazy(() => import('@/pages/Spbu').then((m) => ({ default: m.TanpaSpbu })))
const DatabaseTangki = lazy(() => import('@/pages/Tangki').then((m) => ({ default: m.DatabaseTangki })))
const TangkiForm = lazy(() => import('@/pages/Tangki').then((m) => ({ default: m.TangkiForm })))
const UjiTakaran = lazy(() => import('@/pages/Takaran').then((m) => ({ default: m.UjiTakaran })))
const MenuTakaran = lazy(() => import('@/pages/Takaran').then((m) => ({ default: m.MenuTakaran })))
const RiwayatTakaran = lazy(() => import('@/pages/Takaran').then((m) => ({ default: m.RiwayatTakaran })))
const StokShift = lazy(() => import('@/pages/StokShift').then((m) => ({ default: m.StokShift })))
const StokShiftForm = lazy(() => import('@/pages/StokShift').then((m) => ({ default: m.StokShiftForm })))
const WbsMenu = lazy(() => import('@/pages/Wbs').then((m) => ({ default: m.WbsMenu })))
const WbsForm = lazy(() => import('@/pages/Wbs').then((m) => ({ default: m.WbsForm })))
const LaporanWbs = lazy(() => import('@/pages/Wbs').then((m) => ({ default: m.LaporanWbs })))
const WbsDetail = lazy(() => import('@/pages/Wbs').then((m) => ({ default: m.WbsDetail })))
const GtsMenu = lazy(() => import('@/pages/Gts').then((m) => ({ default: m.GtsMenu })))
const GtsForm = lazy(() => import('@/pages/Gts').then((m) => ({ default: m.GtsForm })))
const LaporanGts = lazy(() => import('@/pages/Gts').then((m) => ({ default: m.LaporanGts })))
const Terkirim = lazy(() => import('@/pages/Terkirim').then((m) => ({ default: m.Terkirim })))

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

  // Multi SPBU: akun tanpa SPBU, dan SPBU yang belum punya identitas & database tangki.
  if (app.loaded && !app.spbuId) {
    if (!app.isAdmin) return <Layar isi={<TanpaSpbu />} />
    if (pathname !== '/unit' && pathname !== '/unit/baru' && pathname !== '/profil' && pathname !== '/terkirim') return <Navigate to="/unit" replace />
  }
  if (app.loaded && app.spbuId && !app.spbuSiap && !bebasSaatBelumSiap(pathname)) {
    if (app.role === 'abh' || app.role === 'pengawas') return <Navigate to="/siapkan" replace />
    return <Layar isi={<SpbuBelumSiap />} />
  }
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
          <Route path="/input" element={<Navigate to="/operation" replace />} />
          <Route path="/operation" element={<MenuOperation />} />
          <Route path="/delivery" element={<MenuGrup grup="delivery" />} />
          <Route path="/hsse" element={<MenuGrup grup="hsse" />} />
          <Route path="/finance" element={<MenuFinance />} />
          <Route path="/kaleng" element={<HalamanKaleng />} />
          <Route path="/input/bongkar" element={<FormInput />} />
          <Route path="/input/:id" element={<FormBongkar />} />
          <Route path="/input/:id/lo/:planId/:loId" element={<UbahLo />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/plan/baru" element={<PlanBaru />} />
          <Route path="/plan/so/:id" element={<EditLo />} />
          <Route path="/kualitas" element={<QqHarianMenu />} />
          <Route path="/kualitas/:tanggal/:shift" element={<QqHarian />} />
          <Route path="/sample" element={<Sample2Jam />} />
          <Route path="/sample/:id" element={<Sample2JamForm />} />
          <Route path="/stok" element={<StokShift />} />
          <Route path="/stok/:tanggal/:shift" element={<StokShiftForm />} />
          <Route path="/terkirim" element={<Terkirim />} />
          <Route path="/takaran" element={<MenuTakaran />} />
          <Route path="/takaran/uji" element={<UjiTakaran />} />
          <Route path="/laporan/takaran" element={<RiwayatTakaran />} />
          <Route path="/apar" element={<AparDashboard />} />
          <Route path="/apar/inspeksi" element={<InspeksiApar />} />
          <Route path="/apar/inspeksi/:id" element={<InspeksiUnit />} />
          <Route path="/apar/data" element={<DataUtamaApar />} />
          <Route path="/apar/data/area" element={<TambahAreaApar />} />
          <Route path="/apar/data/unit/:id" element={<AparUnitForm />} />
          <Route path="/apar/label" element={<AparLabel />} />
          <Route path="/apar/unit/:id" element={<AparUnit />} />
          <Route path="/laporan" element={<MenuReport />} />
          <Route path="/laporan/riwayat" element={<MenuRiwayat />} />
          <Route path="/laporan/export" element={<MenuExport />} />
          <Route path="/laporan/persediaan" element={<Persediaan />} />
          <Route path="/laporan/ba" element={<BeritaAcara />} />
          <Route path="/laporan/bongkaran" element={<RiwayatBongkaran />} />
          <Route path="/laporan/lo" element={<RiwayatLo />} />
          <Route path="/laporan/kualitas" element={<RiwayatKualitas />} />
          <Route path="/laporan/kualitas/:kunci" element={<KualitasDetail />} />
          {/* Riwayat tera lama kini Riwayat Uji Takaran. */}
          <Route path="/laporan/tera" element={<Navigate to="/laporan/takaran" replace />} />
          <Route path="/laporan/apar" element={<RiwayatApar />} />
          <Route path="/ops" element={<OpsMenu />} />
          <Route path="/ops/:form" element={<OpsIsi />} />
          <Route path="/laporan/ops" element={<LaporanOps />} />
          <Route path="/insiden/baru" element={<PilihJenisInsiden />} />
          <Route path="/insiden/baru/:jenis" element={<InsidenBaru />} />
          <Route path="/laporan/insiden" element={<RiwayatInsiden />} />
          <Route path="/laporan/insiden/:id" element={<InsidenDetail />} />
          <Route path="/wbs" element={<WbsMenu />} />
          <Route path="/wbs/:kategori" element={<WbsForm />} />
          <Route path="/laporan/wbs" element={<LaporanWbs />} />
          <Route path="/laporan/wbs/:id" element={<WbsDetail />} />
          <Route path="/gts" element={<GtsMenu />} />
          <Route path="/gts/isi" element={<GtsForm />} />
          <Route path="/laporan/gts" element={<LaporanGts />} />
          <Route path="/profil" element={<Profil />} />
          <Route path="/profil/sandi" element={<GantiSandi />} />
          <Route path="/kalkulator" element={<Kalkulator />} />
          <Route path="/pengaturan" element={<Pengaturan />} />
          <Route path="/pengaturan/identitas" element={<IdentitasSpbu />} />
          <Route path="/pengaturan/dispenser" element={<DataDispenser />} />
          <Route path="/pengaturan/dispenser/:id" element={<DispenserEdit />} />
          <Route path="/pengaturan/nozzle" element={<NozzleTera />} />
          <Route path="/pengaturan/nozzle/:id" element={<NozzleEdit />} />
          <Route path="/pengaturan/sold-ship-to" element={<SoldShipTo />} />
          <Route path="/pengaturan/aturan" element={<AturanPemeriksaan />} />
          <Route path="/pengaturan/acuan" element={<DataAcuan />} />
          <Route path="/anggota" element={<Anggota />} />
          <Route path="/anggota/baru" element={<AnggotaBaru />} />
          <Route path="/anggota/daftar" element={<AnggotaDaftar />} />
          <Route path="/anggota/sandi/:userId" element={<AnggotaSandi />} />
          <Route path="/pengaturan/tangki" element={<DatabaseTangki />} />
          <Route path="/pengaturan/tangki/:id" element={<TangkiForm />} />
          <Route path="/unit" element={<UnitBisnis />} />
          <Route path="/unit/baru" element={<TambahSpbu />} />
          <Route path="/siapkan" element={<SiapkanSpbu />} />
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

/** Halaman yang tetap terbuka saat data SPBU belum lengkap. */
function bebasSaatBelumSiap(path: string) {
  return ['/siapkan', '/pengaturan/identitas', '/pengaturan/tangki', '/profil', '/unit', '/unit/baru', '/anggota', '/kalkulator', '/terkirim'].includes(path) || path.startsWith('/pengaturan/tangki/') || path.startsWith('/anggota/')
}

function Layar({ isi }: { isi: ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<Loading />}>{isi}</Suspense>
    </AppShell>
  )
}

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
