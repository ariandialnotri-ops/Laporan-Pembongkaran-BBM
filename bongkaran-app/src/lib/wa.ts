import { barisWaAir, tangkiBerair, type AirRecord } from '@/lib/air'
import { METHOD_LABEL } from '@/lib/density'
import { formatTanggalIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatMaybe, formatSigned, parseAngka } from '@/lib/format'
import { shiftLabel } from '@/lib/shift'
import { BATAS_CEK, type Derived, type Report, type Settings } from '@/lib/sop'
import type { Tank } from '@/lib/tank'

const ok = (b: boolean) => (b ? '✅' : '❌')

/** Template laporan pembongkaran untuk grup WhatsApp SPBU (format tebal WhatsApp: *teks*). */
export function buildWaText(report: Report, x: Derived, settings: Settings) {
  const d = report.data
  const status =
    report.status === 'anomali' ? '❗ ANOMALI, PEMBONGKARAN DIHENTIKAN' : report.status === 'selesai' ? '✅ SELESAI' : '⏳ DALAM PROSES'
  const L: string[] = []
  L.push('*LAPORAN PEMBONGKARAN BBM*')
  L.push(`${settings.namaSpbu || 'SPBU'}${settings.kodeSpbu ? ` (${settings.kodeSpbu})` : ''}`)
  if (d.noBA) L.push(`No. BA: ${d.noBA}`)
  L.push('')
  L.push(`📅 ${formatTanggalIso(d.tanggalDatang)} | Datang ${d.jamDatang || '-'} | Keluar depot ${formatTanggalIso(d.tanggalKeluar)} ${d.jamKeluar}`.trim())
  L.push(`🕒 ${shiftLabel(x.shift)}`)
  L.push(`🚚 MT ${d.nopol || '-'} | Driver: ${d.namaDriver || '-'}`)
  L.push(`⛽ ${d.produk || '-'} | ${x.tank ? x.tank.label : '-'}`)
  L.push(`SO: ${d.noSO || '-'} | LO: ${d.noLOs.join(', ') || '-'} | Sold to: ${d.soldTo || '-'} | Ship to: ${d.shipTo || '-'}`)
  L.push(`Volume DO: ${formatMaybe(x.volumeDO)} L`)
  L.push('')
  L.push('*QUALITY*')
  L.push(`Density std. 15 °C depot: ${formatDensity(x.d15Depot)}`)
  for (const r of x.densityResults) {
    L.push(
      `Komp ${r.kompartemenNo}: obs ${formatDensity(r.obs)} @${formatMaybe(parseAngka(r.suhu), 1)}°C → Density std. 15 °C ${r.d15 ? formatDensity(r.d15.value) : '-'} | selisih ${formatDensitySigned(r.selisih)} ${r.ok === null ? '' : ok(r.ok)}`,
    )
  }
  if (x.densityResults.some((r) => r.d15?.method === 'formula')) L.push(`_*Density std. 15 °C dihitung dengan ${METHOD_LABEL.formula}_`)
  L.push(`Water content: ${d.airNihil === true ? 'Nihil ✅' : d.airNihil === false ? 'Terdapat air, sudah draining ⚠️' : '-'}`)
  L.push(`Sampel atas & bawah sesuai: ${ok(d.sampelSesuai)}`)
  L.push('')
  L.push('*QUANTITY*')
  for (const c of x.compartments) {
    L.push(
      `Komp ${c.no}: tera ${c.tinggiTera || '-'} mm, dip ${c.dipAktual || '-'} mm, selisih ${c.selisihMm === null ? '-' : formatSigned(c.selisihMm, 0, ' mm')} ${c.selisihMm === null ? '' : ok(!c.outOfLimit)}`,
    )
  }
  if (d.teraApproval) L.push(`Izin lanjut: ${d.teraApproval.nama} (${d.teraApproval.jabatan}): ${d.teraApproval.alasan}`)
  if (x.transportLoss !== null) {
    const lewat = x.transportLossLimit !== null && x.transportLoss < x.transportLossLimit
    L.push(`Transport loss: ${formatSigned(x.transportLoss, 2, ' L')} (batas ${formatMaybe(x.transportLossLimit, 2)} L) ${ok(!lewat)}`)
  }
  L.push(`Stok awal (ATG): ${formatMaybe(x.stokAwal)} L`)
  L.push(`Volume DO diterima: ${formatMaybe(x.volumeDO)} L`)
  if (x.penjualan) L.push(`Penjualan selama bongkar: ${formatMaybe(x.penjualan)} L`)
  L.push(`Stok akhir teoritis: ${formatMaybe(x.stokTeoritis)} L`)
  L.push(`Real stok (ATG): ${formatMaybe(x.realStok)} L`)
  L.push(`*Gain/Loss: ${x.gainLoss === null ? '-' : formatSigned(x.gainLoss, 0, ' L')} (${x.gainLossPct === null ? '-' : formatSigned(x.gainLossPct, 2, '%')})*`)
  L.push(
    `Deepstick sebelum/sesudah: ${d.dipBeforeMm || '-'} mm (${formatMaybe(x.dipBefore?.volume)} L) / ${d.dipAfterMm || '-'} mm (${formatMaybe(x.dipAfter?.volume)} L)`,
  )
  if (x.gainLossDip !== null) L.push(`Gain/Loss (deepstick): ${formatSigned(x.gainLossDip, 0, ' L')}`)
  const c = x.cek
  const sel = (mm: number | null, l: number | null) => `${mm === null ? '-' : formatSigned(mm, 0, ' mm')} / ${l === null ? '-' : formatSigned(l, 1, ' L')}`
  if (c.dipAtgMmBefore !== null || c.dipAtgMmAfter !== null) {
    L.push(`Selisih ATG vs deepstick sebelum: ${sel(c.dipAtgMmBefore, c.dipAtgLBefore)} ${ok(!(Math.abs(c.dipAtgMmBefore ?? 0) > BATAS_CEK.dipAtgMm))}`)
    L.push(`Selisih ATG vs deepstick sesudah: ${sel(c.dipAtgMmAfter, c.dipAtgLAfter)} ${ok(!(Math.abs(c.dipAtgLAfter ?? 0) > BATAS_CEK.dipAtgL))}`)
  }
  if (c.pinsyst !== null) L.push(`Penerimaan P-Insyst: ${formatMaybe(parseAngka(d.penerimaanPinsyst ?? ''))} L (selisih vs ATG ${formatSigned(c.pinsyst, 0, ' L')}) ${ok(!(Math.abs(c.pinsyst) > BATAS_CEK.pinsystL))}`)
  L.push('')
  L.push('*SAFETY & KELENGKAPAN*')
  L.push(`APAR ${ok(d.safetyApar)} | Arde ${ok(d.safetyArde)} | Atribut safety ${ok(d.safetyAtribut)}`)
  L.push(`Segel sesuai dokumen LO ${ok(d.segelSesuai)}${x.compartments.some((c) => c.noSegel) ? ` (${x.compartments.map((c) => c.noSegel || '-').join(', ')})` : ''}`)
  L.push(`Hose & fillport sesuai ${ok(d.fillportSesuai)}`)
  L.push('')
  L.push(`Status: *${status}*`)
  const t = d.ttd ?? {}
  L.push(`Penerima: ${t.penerima?.nama || d.namaPetugas || '-'} | Security: ${t.security?.nama || '-'} | Supir: ${t.supir?.nama || d.namaDriver || '-'}`)
  if (t.pengawas?.nama || t.abh?.nama) L.push(`Pengawas: ${t.pengawas?.nama || '-'} | ABH: ${t.abh?.nama || '-'}`)
  if (d.catatan) L.push(`Catatan: ${d.catatan}`)
  return L.join('\n')
}

export interface BarisQqWa {
  produk: string
  obs: number | null
  suhu: string
  d15: number | null
  acuan: number | null
  selisih: number | null
  ok: boolean | null
  pumpTest: string
}

/**
 * Teks WhatsApp uji kualitas harian (sekali sehari, shift 1): data per produk dalam blok monospace
 * WhatsApp (```) supaya titik dua sejajar di semua HP.
 */
export function buildWaQq(
  q: { tanggal: string; jam: string; petugas: string; terlambat: boolean; totalPumpTest: number; catatan: string },
  baris: BarisQqWa[],
  spbu: string,
  tanggalPanjang: string,
  zona = '',
  /** Laporan gabungan Kualitas Harian: hasil water content tangki pendam ikut dalam satu laporan. */
  air?: { rec: AirRecord; tanks: Tank[] },
) {
  const kv = (k: string, v: string) => `${k.padEnd(10)}: ${v}`
  const L: string[] = [
    air ? '*Laporan Kualitas Harian BBM (Density & Water Content)*' : '*Laporan Uji Kualitas Harian BBM*',
    spbu,
    `Tanggal ${tanggalPanjang}, ${q.jam}${zona ? ` ${zona}` : ''}`,
    '',
    '```',
    kv('Shift', '1'),
    kv('Petugas', q.petugas || '-'),
    kv('Status', q.terlambat ? 'Terlambat (lewat 10:00)' : 'Tepat waktu'),
    '```',
  ]
  for (const b of baris) {
    L.push(`*${b.produk}*`, '```')
    L.push(kv('Density', `${formatDensity(b.obs)} / ${b.suhu ? `${formatMaybe(parseAngka(b.suhu), 1)}°C` : '-'}`))
    L.push(kv('Density std. 15 °C', formatDensity(b.d15)))
    L.push(kv('Acuan Density std. 15 °C pasca penerimaan', b.acuan === null ? 'belum ada' : formatDensity(b.acuan)))
    L.push(kv('Selisih', b.selisih === null ? '-' : `${formatDensitySigned(b.selisih)} (${b.ok ? 'Sesuai' : 'Melebihi toleransi'})`))
    L.push(kv('Pump test', b.pumpTest ? `${b.pumpTest} L` : '-'))
    L.push('```')
  }
  const lewat = baris.filter((b) => b.ok === false).map((b) => b.produk)
  L.push(`Total pump test: ${formatMaybe(q.totalPumpTest, 1)} L`)
  L.push(lewat.length ? `Hasil: *${lewat.join(', ')} melebihi toleransi* ❗` : 'Hasil: *semua produk sesuai toleransi* ✅')
  if (air) {
    const w = barisWaAir(air.rec, air.tanks)
    L.push('', '*Water content tangki pendam*', '```', ...w.tangki, '```', ...w.hasil.map((h) => (h.startsWith('Hasil:') ? `${h}${tangkiBerair(air.rec, air.tanks).length ? ' ❗' : ' ✅'}` : h)))
  }
  if (q.catatan) L.push(`Catatan: ${q.catatan}`)
  return L.join('\n')
}
