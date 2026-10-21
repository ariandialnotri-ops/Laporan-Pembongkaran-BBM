import { useMenu } from '@/components/shell/menu-data'
import { statusKedaluwarsa } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import { berlakuSertifikat, statusSertifikat, statusTanggal } from '@/lib/berlaku'
import { todayIso } from '@/lib/date'

export type JenisInbox = 'tugas' | 'berlaku'

export interface ItemInbox {
  id: string
  jenis: JenisInbox
  judul: string
  detail: string
  to: string
  /** Grup menu / kategori. */
  grup: string
  /** 'lewat' & tugas = merah/oranye, 'segera' = kuning. */
  tingkat: 'lewat' | 'segera' | 'tugas'
}

/**
 * Inbox (sidebar): notifikasi tugas yang perlu dikerjakan (badge menu: stok awal, kualitas, totalizer,
 * bongkaran, APAR, insiden, stop penyaluran, petty cash, dll.) dan masa berlaku yang lewat / ≤ 30 hari
 * (tera metrologi nozzle, isi ulang APAR/APAB, pemeriksaan instansi). Dihitung dari data aplikasi.
 */
export function useInbox(): ItemInbox[] {
  const app = useApp()
  const grup = useMenu()
  const hariIni = todayIso()
  const out: ItemInbox[] = []

  for (const g of grup) {
    if (g.key === 'report') continue
    for (const i of g.items) if (i.badge) out.push({ id: `tugas:${i.to}`, jenis: 'tugas', judul: i.title, detail: i.status, to: i.to, grup: g.label, tingkat: 'tugas' })
  }

  const s = app.settings
  for (const n of s.nozzles ?? []) {
    const st = statusSertifikat(n.teraTanggal, hariIni)
    if (st === 'ok') continue
    out.push({
      id: `tera:${n.id}`,
      jenis: 'berlaku',
      judul: `Tera metrologi nozzle ${n.nama}`,
      detail: st === 'belum' ? 'Tanggal tera belum dicatat' : `${st === 'lewat' ? 'Habis sejak' : 'Berakhir'} ${berlakuSertifikat(n.teraTanggal)}`,
      to: app.can('/pengaturan/nozzle') ? '/pengaturan/nozzle' : '/inbox',
      grup: 'Masa berlaku',
      tingkat: st === 'segera' ? 'segera' : 'lewat',
    })
  }
  for (const u of [...(s.apar ?? []), ...(s.apab ?? [])]) {
    const isi = statusKedaluwarsa(u.kedaluwarsa, hariIni)
    if (isi === 'lewat' || isi === 'segera')
      out.push({ id: `apar:${u.id}`, jenis: 'berlaku', judul: `Isi ulang ${u.kode}`, detail: `${u.lokasi || '-'} · ${isi === 'lewat' ? 'kedaluwarsa sejak' : 'kedaluwarsa'} ${u.kedaluwarsa}`, to: app.can('/apar/data') ? '/apar/data' : '/apar', grup: 'Masa berlaku', tingkat: isi })
    const ins = u.periksaInstansi ? statusTanggal(berlakuSertifikat(u.periksaInstansi), hariIni) : null
    if (ins === 'lewat' || ins === 'segera')
      out.push({ id: `instansi:${u.id}`, jenis: 'berlaku', judul: `Pemeriksaan instansi ${u.kode}`, detail: `${u.instansi || 'Instansi berwenang'} · berlaku s.d. ${berlakuSertifikat(u.periksaInstansi)}`, to: app.can('/apar/data') ? '/apar/data' : '/apar', grup: 'Masa berlaku', tingkat: ins })
  }
  return out
}
