import type { CSSProperties, ReactNode, Ref } from 'react'
import { normalizeDensity } from '@/lib/density'
import { formatTanggalIso } from '@/lib/date'
import { formatDensity, formatDensitySigned, formatMaybe, formatSigned, parseAngka } from '@/lib/format'
import { STEPS, type Derived, type Report, type Rules, type Settings } from '@/lib/sop'

/*
 * Berita Acara untuk di-capture menjadi satu gambar JPG (html2canvas).
 * Sengaja memakai inline style ber-hex: html2canvas tidak mengenal warna
 * oklch() yang dipakai Tailwind v4.
 */
const C = { primary: '#0050cb', ink: '#0a1c30', muted: '#424656', line: '#c2c6d8', errBg: '#ffdad6', err: '#93000a', ok: '#003fa4' }
const th: CSSProperties = { padding: '6px 7px', textAlign: 'left', background: C.primary, color: '#fff', fontWeight: 600, border: `1px solid ${C.primary}` }
const td: CSSProperties = { padding: '5px 7px', border: `1px solid ${C.line}`, verticalAlign: 'top' }
const yn = (b: boolean) => (b ? 'Ya' : 'Tidak')

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6, color: C.ink }}>{title}</div>
      {children}
    </div>
  )
}

function Table({ head, rows, bad }: { head: string[]; rows: ReactNode[][]; bad?: (i: number) => boolean }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} style={th}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: bad?.(i) ? C.errBg : '#fff' }}>
            {r.map((c, j) => (
              <td key={j} style={td}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function BaPrintLayout({
  ref,
  report,
  derived: x,
  settings,
  rules,
  photoData,
}: {
  ref?: Ref<HTMLDivElement>
  report: Report
  derived: Derived
  settings: Settings
  rules: Rules
  photoData: Record<string, string>
}) {
  const d = report.data
  const info: [string, string, string, string][] = [
    ['No. Berita Acara', d.noBA || '-', 'Produk', d.produk || '-'],
    ['Tanggal / Jam Datang', `${formatTanggalIso(d.tanggalDatang)} ${d.jamDatang}`, 'Tangki Pendam', x.tank?.label ?? '-'],
    ['Keluar Depot', `${formatTanggalIso(d.tanggalKeluar)} ${d.jamKeluar}`, 'Nomor SO', d.noSO || '-'],
    ['No. Polisi MT', d.nopol || '-', 'Nomor LO', d.noLOs.join(', ') || '-'],
    ['Nama Driver', d.namaDriver || '-', 'No. Sold To', d.soldTo || '-'],
    ['Jumlah DO', `${d.jumlahDO || 0} DO (${formatMaybe(x.volumeDO)} L)`, 'Selesai Bongkar', d.jamSelesaiBongkar || '-'],
  ]
  const groups = STEPS.flatMap((step, si) =>
    step.photos
      .filter((p) => (report.photos[p.key] ?? []).length)
      .map((p) => ({ key: p.key, title: `Tahap ${si + 1} - ${step.title}: ${p.label}`, photos: report.photos[p.key] })),
  )

  return (
    <div ref={ref} style={{ width: 960, background: '#fff', padding: 36, fontFamily: 'Arial, sans-serif', color: C.ink, fontSize: 12.5, lineHeight: 1.4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${C.primary}`, paddingBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.primary }}>BERITA ACARA PEMBONGKARAN BBM</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>(QUALITY & QUANTITY)</div>
          <div style={{ color: C.muted, marginTop: 3 }}>
            {settings.namaSpbu || 'SPBU'}
            {settings.kodeSpbu ? ` (${settings.kodeSpbu})` : ''}
          </div>
        </div>
        {settings.logoDataUrl && <img src={settings.logoDataUrl} alt="logo" style={{ height: 50 }} />}
      </div>
      {report.status === 'anomali' && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: C.errBg, color: C.err, fontWeight: 700, borderRadius: 4 }}>
          STATUS: ANOMALI — pembongkaran dihentikan karena selisih density melebihi toleransi.
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <tbody>
          {info.map((r) => (
            <tr key={r[0]}>
              <td style={{ padding: '3px 0', color: C.muted, width: 150 }}>{r[0]}</td>
              <td style={{ padding: '3px 0', fontWeight: 700, width: 290 }}>{r[1]}</td>
              <td style={{ padding: '3px 0', color: C.muted, width: 120 }}>{r[2]}</td>
              <td style={{ padding: '3px 0', fontWeight: 700 }}>{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Section title="A. QUALITY">
        <Table
          head={['Komp', 'Density Obs', 'Suhu (°C)', 'Density 15°C', 'D15 Depot', 'Selisih', 'Metode', 'Status']}
          rows={x.densityResults.map((r) => [
            r.kompartemenNo,
            formatDensity(r.obs),
            formatMaybe(parseAngka(r.suhu), 1),
            r.d15 ? formatDensity(r.d15.value) : '-',
            formatDensity(x.d15Depot),
            formatDensitySigned(r.selisih),
            r.d15 ? (r.d15.method === 'table' ? 'Tabel ASTM 53' : 'Rumus ASTM 53B') : '-',
            <b key="status" style={{ color: r.ok === false ? C.err : C.ok }}>{r.ok === null ? '-' : r.ok ? 'Sesuai' : 'ANOMALI'}</b>,
          ])}
          bad={(i) => x.densityResults[i].ok === false}
        />
        <div style={{ marginTop: 6 }}>
          Toleransi selisih maks {String(rules.densityTolerance).replace('.', ',')} · OBS depot {formatDensity(normalizeDensity(d.densityObsDepot))} @{' '}
          {d.suhuObsDepot || '-'} °C · Water content: {d.airNihil === true ? 'Nihil' : d.airNihil === false ? 'Terdapat air (sudah draining)' : '-'} · Sampel sesuai:{' '}
          {yn(d.sampelSesuai)}
        </div>
      </Section>

      <Section title="B. QUANTITY - MOBIL TANGKI (DEEPSTICK vs BUKU TERA)">
        <Table
          head={['Komp', 'Tinggi Tera (mm)', 'Dip Aktual (mm)', 'Selisih (mm)', 'Kepekaan (L/mm)', 'Est. Selisih (L)', 'Status']}
          rows={x.compartments.map((c) => [
            c.no,
            formatMaybe(parseAngka(c.tinggiTera)),
            formatMaybe(parseAngka(c.dipAktual)),
            c.selisihMm === null ? '-' : formatSigned(c.selisihMm),
            formatMaybe(parseAngka(c.kepekaan), 2),
            c.estLiter === null ? '-' : formatSigned(c.estLiter, 1),
            <b key="status" style={{ color: c.outOfLimit ? C.err : C.ok }}>{c.selisihMm === null ? '-' : c.outOfLimit ? `Di luar batas ${rules.teraToleranceMm} mm` : 'Sesuai'}</b>,
          ])}
          bad={(i) => x.compartments[i].outOfLimit}
        />
        {d.teraApproval && (
          <div style={{ marginTop: 6 }}>
            Dilanjutkan atas izin <b>{d.teraApproval.nama}</b> ({d.teraApproval.jabatan}), {new Date(d.teraApproval.waktu).toLocaleString('id-ID')}. Alasan:{' '}
            {d.teraApproval.alasan}
          </div>
        )}
      </Section>

      <Section title="C. QUANTITY - TANGKI PENDAM">
        <Table
          head={['Uraian', 'Ketinggian (mm)', 'Volume (L)', 'Suhu (°C)', 'Keterangan']}
          rows={[
            ['Stok awal (ATG sebelum bongkar)', formatMaybe(parseAngka(d.atgBefore.tinggi)), formatMaybe(x.stokAwal), d.atgBefore.suhu || '-', `Tabel kalibrasi: ${formatMaybe(x.atgBeforeTable?.volume)} L`],
            ['Volume DO diterima', '', formatMaybe(x.volumeDO), '', `${d.jumlahDO || 0} DO x ${formatMaybe(rules.literPerDO)} L`],
            ['Penjualan selama bongkar', '', formatMaybe(x.penjualan), '', ''],
            ['Stok akhir teoritis', '', formatMaybe(x.stokTeoritis), '', 'Stok awal + DO - penjualan'],
            ['Real stok (ATG setelah pengisian)', formatMaybe(parseAngka(d.atgAfter.tinggi)), formatMaybe(x.realStok), d.atgAfter.suhu || '-', `Dibaca ${x.settleMinutes ?? '-'} menit setelah bongkar`],
            [<b key="label">Discharge gain / loss (ATG)</b>, '', <b key="value">{x.gainLoss === null ? '-' : formatSigned(x.gainLoss)}</b>, '', `${x.gainLossPct === null ? '-' : formatSigned(x.gainLossPct, 2)} % dari volume DO`],
            ['Deepstick manual sebelum bongkar', formatMaybe(parseAngka(d.dipBeforeMm)), formatMaybe(x.dipBefore?.volume), '', 'Volume dari tabel kalibrasi'],
            ['Deepstick manual sesudah bongkar', formatMaybe(parseAngka(d.dipAfterMm)), formatMaybe(x.dipAfter?.volume), '', 'Volume dari tabel kalibrasi'],
            ['Gain / loss (deepstick manual)', '', x.gainLossDip === null ? '-' : formatSigned(x.gainLossDip), '', 'Penerimaan deepstick - volume DO'],
          ]}
        />
      </Section>

      <Section title="D. SAFETY & KELENGKAPAN">
        <Table
          head={['Pemeriksaan', 'Hasil', 'Pemeriksaan', 'Hasil']}
          rows={[
            ['APAR DCP min. 9 kg tersedia', yn(d.safetyApar), 'Segel kompartemen sesuai DO/LO', yn(d.segelSesuai)],
            ['Kabel arde terpasang', yn(d.safetyArde), 'Fillport sesuai produk', yn(d.fillportSesuai)],
            ['Petugas memakai atribut safety', yn(d.safetyAtribut), 'Water content nihil', d.airNihil === null ? '-' : yn(d.airNihil)],
          ]}
        />
      </Section>

      {d.catatan && (
        <Section title="CATATAN">
          <div>{d.catatan}</div>
        </Section>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 34, textAlign: 'center' }}>
        {[
          ['Petugas Penerima SPBU', d.namaPetugas],
          ['Driver Mobil Tangki', d.namaDriver],
          ['Mengetahui, Pengawas SPBU', d.namaPengawas],
        ].map(([role, name]) => (
          <div key={role} style={{ width: 250 }}>
            <div style={{ color: C.muted, marginBottom: 50 }}>{role}</div>
            <div style={{ borderTop: `1px solid ${C.ink}`, paddingTop: 4, fontWeight: 700 }}>{name || '-'}</div>
          </div>
        ))}
      </div>

      {groups.length > 0 && (
        <div style={{ marginTop: 30, borderTop: `2px solid ${C.primary}`, paddingTop: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>LAMPIRAN FOTO EVIDENCE</div>
          {groups.map((g) => (
            <div key={g.key} style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{g.title}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {g.photos.map((p) => (
                  <img
                    key={p.id}
                    src={photoData[p.id] || p.dataUrl}
                    alt={p.name}
                    style={{ width: 284, height: 200, objectFit: 'cover', border: `1px solid ${C.line}`, borderRadius: 3, display: 'block' }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
