/**
 * Peran pengguna dan modul yang boleh dibuka. Satu tempat untuk menu dock, kartu menu
 * Input/Laporan, dan penjaga halaman. Aturan tulis di database (RLS) mengikuti tabel ini.
 */
export type Role = 'abh' | 'pengawas' | 'kashift' | 'security' | 'cs' | 'admin'

export const ROLES: { key: Role; label: string; desc: string }[] = [
  { key: 'abh', label: 'ABH', desc: 'Area Business Head: beberapa unit bisnis (SPBU), semua modul, anggota, pengaturan SPBU, data utama APAR' },
  { key: 'pengawas', label: 'Pengawas', desc: 'Pengajuan petty cash, laporan stock opname (BA bulanan), totalizer, harga jual, identitas SPBU (pulau pompa), data dispenser, nozzle & tera metrologi, database tangki, inspeksi APAR/APAB, water content tangki, bongkaran & TTD BA, stok awal, uji takaran, plan pengiriman & tracking SO/LO, data utama APAR/APAB & area, uji pasca penerimaan, dashboard monitoring, semua laporan' },
  { key: 'kashift', label: 'Kepala Shift', desc: 'Closing shift (hitung buta + WhatsApp), totalizer awal/akhir shift, pengajuan petty cash & realisasi, stok awal, water content tangki, bongkaran, kualitas harian, uji takaran, tracking SO & LO, inspeksi APAR/APAB, kartu perawatan & pantauan lingkungan (Operasional SPBU)' },
  { key: 'security', label: 'Security', desc: 'Totalizer awal/akhir shift, Guard Patrol System: sampling penyaluran subsidi JBT/JBKP tiap 2 jam, inspeksi APAR/APAB, sumur pantau & oil catcher, pelaporan insiden / near miss' },
  { key: 'cs', label: 'Cleaning Service', desc: 'Checklist housekeeping harian (Operasional SPBU) dan pelaporan insiden / near miss' },
  { key: 'admin', label: 'Admin / Cashier', desc: 'Finance: persetujuan 1 petty cash (pengajuan pengadaan barang/jasa) sebelum persetujuan akhir ABH, pengajuan & realisasi anggaran, laporan stock opname (BA bulanan)' },
]

export const roleLabel = (r: Role | null | undefined) => ROLES.find((x) => x.key === r)?.label ?? '-'

/**
 * Halaman per peran. Akhiran "/" = semua halaman di bawahnya (mis. "/input/" untuk form bongkaran).
 * ABH tidak dibatasi.
 */
const AKSES: Record<Exclude<Role, 'abh'>, string[]> = {
  pengawas: [
    '/',
    '/input',
    '/input/bongkar',
    '/input/',
    '/stok',
    '/stok/',
    '/kualitas',
    '/kualitas/',
    '/air',
    '/air/',
    '/totalizer',
    '/totalizer/',
    '/sample',
    '/sample/',
    '/takaran',
    '/takaran/uji',
    '/plan',
    '/plan/baru',
    '/plan/so/',
    '/apar',
    '/apar/inspeksi',
    '/apar/inspeksi/',
    '/apar/data',
    '/apar/data/area',
    '/apar/data/unit/',
    '/apar/label',
    '/apar/unit/',
    '/laporan',
    '/laporan/',
    '/pengaturan',
    '/pengaturan/sold-ship-to',
    '/pengaturan/identitas',
    '/pengaturan/dispenser',
    '/pengaturan/dispenser/',
    '/pengaturan/nozzle',
    '/pengaturan/nozzle/',
    '/pengaturan/tangki',
    '/pengaturan/tangki/',
    '/siapkan',
    '/kaleng',
    '/finance',
    '/finance/',
    '/ops',
    '/ops/',
    '/insiden/baru',
    '/insiden/baru/',
    '/profil', '/profil/sandi',
    '/kalkulator',
  ],
  kashift: [
    '/input',
    '/input/bongkar',
    '/input/',
    '/stok',
    '/stok/',
    '/kualitas',
    '/kualitas/',
    '/air',
    '/air/',
    '/totalizer',
    '/totalizer/',
    '/laporan/totalizer',
    '/takaran',
    '/takaran/uji',
    '/plan',
    '/plan/baru',
    '/plan/so/',
    '/apar',
    '/apar/inspeksi',
    '/apar/inspeksi/',
    '/apar/unit/',
    '/laporan',
    '/laporan/persediaan',
    '/laporan/bongkaran',
    '/laporan/ba',
    '/laporan/lo',
    '/laporan/kualitas',
    '/laporan/kualitas/',
    '/laporan/air',
    '/laporan/tera',
    '/laporan/takaran',
    '/laporan/pump-test',
    '/laporan/so',
    '/laporan/apar',
    '/finance',
    '/finance/',
    '/kaleng',
    '/ops',
    '/ops/',
    '/laporan/ops',
    '/insiden/baru',
    '/insiden/baru/',
    '/laporan/insiden',
    '/laporan/insiden/', '/laporan/henti',
    '/profil', '/profil/sandi',
    '/kalkulator',
  ],
  security: ['/input', '/totalizer', '/totalizer/', '/laporan/totalizer', '/gts', '/gts/', '/laporan/gts', '/apar', '/apar/inspeksi', '/apar/inspeksi/', '/apar/unit/', '/ops', '/ops/', '/insiden/baru', '/insiden/baru/', '/laporan/insiden', '/laporan/insiden/', '/laporan/henti', '/profil', '/profil/sandi'],
  admin: ['/finance', '/finance/', '/laporan/so', '/profil', '/profil/sandi'],
  cs: ['/input', '/ops', '/ops/', '/insiden/baru', '/insiden/baru/', '/laporan/insiden', '/laporan/insiden/', '/laporan/henti', '/profil', '/profil/sandi'],
}

/** Halaman ikhtisar grup menu: boleh dibuka semua peran, isinya disaring per peran. */
const IKHTISAR = ['/terkirim', '/patrol', '/operation', '/delivery', '/hsse', '/laporan', '/laporan/riwayat', '/laporan/export', '/input']

export function bolehBuka(role: Role, path: string) {
  if (role === 'abh') return true
  // Laporan WBS hanya untuk ABH (pengawas pun tidak, meski boleh membuka semua /laporan/).
  if (path === '/laporan/wbs' || path.startsWith('/laporan/wbs/')) return false
  // WBS: setiap anggota boleh melapor.
  if (path === '/wbs' || path.startsWith('/wbs/')) return true
  if (IKHTISAR.includes(path)) return true
  return AKSES[role].some((p) => (p.endsWith('/') && p !== '/' ? path.startsWith(p) : path === p))
}

/** Halaman awal peran yang tidak punya Dashboard. */
export const berandaPeran = (role: Role) => (bolehBuka(role, '/') ? '/' : role === 'security' ? '/hsse' : role === 'cs' ? '/ops' : role === 'admin' ? '/finance' : '/operation')
