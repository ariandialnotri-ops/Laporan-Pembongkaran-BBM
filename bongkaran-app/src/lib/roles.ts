/**
 * Peran pengguna dan modul yang boleh dibuka. Satu tempat untuk menu dock, kartu menu
 * Input/Laporan, dan penjaga halaman. Aturan tulis di database (RLS) mengikuti tabel ini.
 */
export type Role = 'abh' | 'pengawas' | 'kashift' | 'security'

export const ROLES: { key: Role; label: string; desc: string }[] = [
  { key: 'abh', label: 'ABH', desc: 'Area Business Head: beberapa unit bisnis (SPBU), semua modul, anggota, pengaturan SPBU, data utama APAR' },
  { key: 'pengawas', label: 'Pengawas', desc: 'Identitas SPBU & database tangki, bongkaran & TTD BA, stok awal, plan pengiriman & tracking SO/LO, data utama APAR/APAB & area, uji pasca penerimaan, dashboard monitoring, semua laporan' },
  { key: 'kashift', label: 'Kepala Shift', desc: 'Stok awal, bongkaran, kualitas harian, tracking SO & LO, inspeksi APAR/APAB' },
  { key: 'security', label: 'Security', desc: 'Inspeksi APAR/APAB dan pelaporan insiden / near miss' },
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
    '/kualitas',
    '/sample',
    '/plan',
    '/plan/so/',
    '/apar',
    '/apar/data',
    '/apar/data/unit/',
    '/apar/label',
    '/apar/unit/',
    '/laporan',
    '/laporan/',
    '/pengaturan/sold-ship-to',
    '/pengaturan/identitas',
    '/pengaturan/tangki',
    '/pengaturan/tangki/',
    '/siapkan',
    '/insiden/baru',
    '/profil',
    '/kalkulator',
  ],
  kashift: [
    '/input',
    '/input/bongkar',
    '/input/',
    '/stok',
    '/kualitas',
    '/plan',
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
    '/laporan/tera',
    '/laporan/apar',
    '/insiden/baru',
    '/laporan/insiden',
    '/laporan/insiden/',
    '/profil',
    '/kalkulator',
  ],
  security: ['/input', '/apar', '/apar/inspeksi', '/apar/inspeksi/', '/apar/unit/', '/insiden/baru', '/laporan/insiden', '/laporan/insiden/', '/profil'],
}

export function bolehBuka(role: Role, path: string) {
  if (role === 'abh') return true
  return AKSES[role].some((p) => (p.endsWith('/') && p !== '/' ? path.startsWith(p) : path === p))
}

/** Halaman awal peran yang tidak punya Dashboard. */
export const berandaPeran = (role: Role) => (bolehBuka(role, '/') ? '/' : role === 'security' ? '/apar' : '/input')
