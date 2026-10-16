/**
 * Chart of Accounts (COA) petty cash SPBU, sama dengan aplikasi One Touch Solution
 * (ariandialnotri-ops/One-Touch-Solution-Apps, tabel spbu.coa di supabase/migrations/20261002000000_fuelcore_schema.sql).
 * Setiap pengajuan pengadaan barang/jasa wajib memakai salah satu akun ini.
 */
export interface Coa {
  /** Nomor akun (account_no). */
  accountNo: string
  activity: string
  sapAccount: string
  /** Penjelasan pemakaian akun. */
  description: string
  coaId: string
}

export const COA: Coa[] = [
  { accountNo: '07.5.01.1.01.01', activity: 'ENERGY COST - ELECTRICITY', sapAccount: 'ELECTRICITY EXPENSE', description: 'pembayaran listrik', coaId: '5001001276' },
  { accountNo: '07.5.01.1.01.03', activity: 'ENERGY COST - WATER RETRIBUTION', sapAccount: 'WATER EXPENSE', description: 'pembayaran air PAM', coaId: '5001001242' },
  { accountNo: '07.1.03.3.01.01', activity: 'INCENTIVE - PERTAMINA WAY', sapAccount: 'OH-EMPLOYEE INCENTIVE', description: 'biaya untuk insentive pasti pas atau pertamina way.', coaId: '5001000404' },
  { accountNo: '07.2.02.1.01.21', activity: 'OFFICE EXPENSE - COORDINATION', sapAccount: 'SECURITY EXPENSE', description: 'termasuk biaya entertain tamu, konsumsi tamu, koordinasi supir tangki', coaId: '5001001377' },
  { accountNo: '07.2.02.1.01.20', activity: 'OFFICE EXPENSE - COORDINATION GOVERNMENT', sapAccount: 'SECURITY EXPENSE', description: 'termasuk koordinasi dengan rt, rw, lingkungan setempat.', coaId: '5001001377' },
  { accountNo: '07.2.02.1.01.19', activity: 'OFFICE EXPENSE - COORDINATION SECURITY', sapAccount: 'SECURITY EXPENSE', description: 'termasuk biaya koordinasi dengan pihak kepolisian, satpol PP, dll', coaId: '5001001377' },
  { accountNo: '07.2.02.1.01.07', activity: 'OFFICE EXPENSE - DOCUMENTATION', sapAccount: 'MATERIAL NON STOCK CONSUMED', description: 'biaya terkait pengandaan seluruh pencetakkan dokumen dan fotocopy dijilid.', coaId: '5001001292' },
  { accountNo: '07.2.02.1.01.23', activity: 'OFFICE EXPENSE - EXTRA FOODING', sapAccount: 'MATERIAL NON STOCK CONSUMED', description: 'seluruh biaya yang dikeluarkan untuk pembelian makan dan minum pekerja spbu (Susu).', coaId: '5001001292' },
  { accountNo: '07.2.02.1.01.17', activity: 'OFFICE EXPENSE - MEDICINE', sapAccount: 'MEDICAL EQUIPMENT & SUPPLIES MATERIAL & EQUIP CONS', description: 'termasuk biaya terkait pembelian obat.', coaId: '5001001290' },
  { accountNo: '07.2.02.1.01.08', activity: 'OFFICE EXPENSE - MEMBERSHIP', sapAccount: 'MEMBERSHIP EXPENSE', description: 'keanggotaan hiswana migas, kegiatan olahraga unit', coaId: '5001001371' },
  { accountNo: '07.2.02.1.01.05', activity: 'OFFICE EXPENSE - NEWS PAPER & MAGAZINE', sapAccount: 'MATERIAL NON STOCK CONSUMED', description: 'biaya pembelian koran dan majalah', coaId: '5001001292' },
  { accountNo: '07.2.02.1.01.26', activity: 'OFFICE EXPENSE - OPERATIONAL BRIGHT OUTLET', sapAccount: 'OFFICE EXPENSE - OPERATIONAL BRIGHT OUTLET', description: 'seluruh biaya yang dikeluarkan terkait kebutuhan outlet bright, konsumsi stok opname Bright', coaId: '5001001417' },
  { accountNo: '07.2.02.1.01.01', activity: 'OFFICE EXPENSE - PRINTING AND STATIONARY', sapAccount: 'MATERIAL NON STOCK CONSUMED', description: 'termasuk biaya untuk alat2 printer (tinta printer),seluruh kebutuhan ATK, termasuk kertas dispenser, plastik, karet untuk kasir.', coaId: '5001001292' },
  { accountNo: '07.2.02.1.01.18', activity: 'OFFICE EXPENSE - RETRIBUTION', sapAccount: 'RETRIBUTION-LAYANAN KEBERSIHAN', description: 'termasuk biaya untuk pembayaran IPL (Iuran Perawatan Lingkungan), retribusi sampah,', coaId: '5001001315' },
  { accountNo: '07.2.02.1.01.03', activity: 'OFFICE EXPENSE - TELP, FAX AND COMUNICATION', sapAccount: 'OH-OH-TELEPHONE & FAX', description: 'biaya komunikasi termasuk telepon, fax, email, dan pulsa untuk koordinasi bbm', coaId: '5001000457' },
  { accountNo: '07.1.04.1.01.06', activity: 'OPERATING SUPPLIES - EMPLOYEE', sapAccount: 'INVENTORY/SUPPLIES EXP (LVA)', description: 'seluruh biaya yang dikeluarkan untuk kebutuhan pegawai, termasuk jas hujan, payung, name tag, tempah nama dll.', coaId: '5001001419' },
  { accountNo: '07.1.04.1.01.04', activity: 'OPERATING SUPPLIES - GROCERY / PANTRY SUPPLIES', sapAccount: 'INVENTORY/SUPPLIES EXP (LVA)', description: 'seluruh biaya untuk kebutuhan pantry seperti pembelian galon air minum, pengharum, keperluan dapur dan rumah tangga serta peralatan kebersihan cleening service, termasuk kain majun.', coaId: '5001001419' },
  { accountNo: '07.1.04.1.01.05', activity: 'OPERATING SUPPLIES - OFFICE', sapAccount: 'INVENTORY/SUPPLIES EXP (LVA)', description: 'seluruh biaya yang dikeluarkan untuk kebutuhan operasional kantor, sewa pengharum ruangan, biaya pembelian komputer,printer,mesin fax,mesin absen,dll.', coaId: '5001001419' },
  { accountNo: '07.1.04.1.01.01', activity: 'OPERATING SUPPLIES - SPBU SUPPLIES', sapAccount: 'INVENTORY/SUPPLIES EXP (LVA)', description: 'seluruh biaya untuk pembelian perlengkapan SPBU, termasuk noozle,pasta minyak&air,selang dispenser,dipstick,dll.', coaId: '5001001419' },
  { accountNo: '07.1.04.2.01.05', activity: 'OPERATION EQUIPMENT - AC AND REFRIGERATOR', sapAccount: 'ELECTRICAL MATERIAL & EQUIPMENT CONSUMED', description: 'biaya peralatan untuk operasional SPBU berkaitan dengan ac', coaId: '5001001283' },
  { accountNo: '07.1.04.2.01.03', activity: 'OPERATION EQUIPMENT - ATG', sapAccount: 'ELECTRICAL MATERIAL & EQUIPMENT CONSUMED', description: 'biaya peralatan untuk operasional SPBU berkaitan dengan atg', coaId: '5001001283' },
  { accountNo: '07.1.04.2.01.02', activity: 'OPERATION EQUIPMENT - DISPENSER', sapAccount: 'ELECTRICAL MATERIAL & EQUIPMENT CONSUMED', description: 'biaya peralatan untuk operasional SPBU berkaitan dengan dispenser', coaId: '5001001283' },
  { accountNo: '07.1.04.2.01.01', activity: 'OPERATION EQUIPMENT - ELECTRICAL EQUIPMENT', sapAccount: 'ELECTRICAL MATERIAL & EQUIPMENT CONSUMED', description: 'biaya yang dikeluarkan untuk pembelian lampu, stop kontak, batrei, lampu kanopi,dll', coaId: '5001001283' },
  { accountNo: '07.1.04.2.01.06', activity: 'OPERATION EQUIPMENT - OTHERS', sapAccount: 'MATERIAL NON STOCK CONSUMED', description: 'pembelian bendera, tali bendera, dan peralatan lain yang tidak berhubungan langsung dengan alat2 SPBU dll.', coaId: '5001001292' },
  { accountNo: '07.1.04.2.01.04', activity: 'OPERATION EQUIPMENT - TIKET PRINTER', sapAccount: 'ELECTRICAL MATERIAL & EQUIPMENT CONSUMED', description: 'biaya peralatan untuk operasional SPBU berkaitan dengan tiket printer', coaId: '5001001283' },
  { accountNo: '07.2.01.2.01.02', activity: 'TRAVEL - LOCAL TRANSPORTATION', sapAccount: 'EMPLOYEE TRAVEL EXPENSE', description: 'biaya yang dikeluarkan untuk transportasi dalam kota, sewa kendaraan utk pick up setoran.', coaId: '5001000429' },
  { accountNo: '6001027100', activity: 'BANK CHARGE', sapAccount: 'BANK CHARGE', description: 'Administrasi Bank', coaId: '6001027100' },
  { accountNo: '6001013240', activity: 'MATERIAL NON STOCK CONSUMED', sapAccount: 'MATERIAL NON STOCK CONSUMED', description: 'Termasuk biaya entertaint, kordinasi atau konsumsi tamu, pembelian kebutuhan operasional kantor, pencetakan dokumen, fotocopy, obat-obatan.', coaId: '6001013240' },
]

export const coaByNo = (no: string) => COA.find((c) => c.accountNo === no)
