import { METHOD_LABEL } from '@/lib/density'
import { formatTanggalIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatMaybe, formatSigned, parseAngka } from '@/lib/format'
import { shiftLabel } from '@/lib/shift'
import type { Derived, Report, Settings } from '@/lib/sop'

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
  L.push(`Density 15°C depot: ${formatDensity(x.d15Depot)}`)
  for (const r of x.densityResults) {
    L.push(
      `Komp ${r.kompartemenNo}: obs ${formatDensity(r.obs)} @${formatMaybe(parseAngka(r.suhu), 1)}°C → D15 ${r.d15 ? formatDensity(r.d15.value) : '-'} | selisih ${formatDensitySigned(r.selisih)} ${r.ok === null ? '' : ok(r.ok)}`,
    )
  }
  if (x.densityResults.some((r) => r.d15?.method === 'formula')) L.push(`_*D15 dihitung dengan ${METHOD_LABEL.formula}_`)
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
