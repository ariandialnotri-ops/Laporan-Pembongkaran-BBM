import { useMenu } from '@/components/shell/menu-data'
import { statusKedaluwarsa } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import { berlakuSertifikat, statusSertifikat, statusTanggal } from '@/lib/berlaku'
import { addDays, todayIso } from '@/lib/date'
import { bolehParaf, formById, formKategori, formTampil, jatuhTempoAktivitas, judulForm, opsId, statusOps, tanggalSimpan, type OpsRecord } from '@/lib/ops'
import { useOps } from '@/lib/use-ops'

export type JenisInbox = 'tugas' | 'berlaku'

export interface ItemInbox {
  id: string
  jenis: JenisInbox
  judul: string
  detail: string
  to: string
  /** Modul (label grup menu), atau Perawatan / Housekeeping / Paraf pengawas. */
  grup: string
  /** 'lewat' & tugas = merah/oranye, 'segera' = kuning. */
  tingkat: 'lewat' | 'segera' | 'tugas'
}

/**
 * Inbox (sidebar): notifikasi tugas yang perlu dikerjakan (badge menu: stok awal, kualitas, totalizer,
 * bongkaran, APAR, insiden, stop penyaluran, petty cash, dll.) dan masa berlaku yang lewat / ≤ 30 hari
 * (tera metrologi nozzle, isi ulang APAR/APAB, pemeriksaan instansi). Dihitung dari data aplikasi.
 * Operasional SPBU: checklist housekeeping (Cleaning Service) dan kartu perawatan (kepala shift, pengawas,
 * ABH) yang belum lengkap hari ini, aktivitas berkala jatuh tempo, form bulanan menjelang akhir bulan, dan
 * (pengawas/ABH) form 7 hari terakhir yang menunggu paraf.
 */
export function useInbox(): ItemInbox[] {
  const app = useApp()
  const grup = useMenu()
  const hariIni = todayIso()
  const out: ItemInbox[] = []
  const { recs: ops } = useOps(todayIso(addDays(new Date(`${hariIni}T00:00:00`), -62)), hariIni)

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
      grup: 'Operation',
      tingkat: st === 'segera' ? 'segera' : 'lewat',
    })
  }
  for (const u of [...(s.apar ?? []), ...(s.apab ?? [])]) {
    const isi = statusKedaluwarsa(u.kedaluwarsa, hariIni)
    if (isi === 'lewat' || isi === 'segera')
      out.push({ id: `apar:${u.id}`, jenis: 'berlaku', judul: `Isi ulang ${u.kode}`, detail: `${u.lokasi || '-'} · ${isi === 'lewat' ? 'kedaluwarsa sejak' : 'kedaluwarsa'} ${u.kedaluwarsa}`, to: app.can('/apar/data') ? '/apar/data' : '/apar', grup: 'HSSE & Guard Patrol System', tingkat: isi })
    const ins = u.periksaInstansi ? statusTanggal(berlakuSertifikat(u.periksaInstansi), hariIni) : null
    if (ins === 'lewat' || ins === 'segera')
      out.push({ id: `instansi:${u.id}`, jenis: 'berlaku', judul: `Pemeriksaan instansi ${u.kode}`, detail: `${u.instansi || 'Instansi berwenang'} · berlaku s.d. ${berlakuSertifikat(u.periksaInstansi)}`, to: app.can('/apar/data') ? '/apar/data' : '/apar', grup: 'HSSE & Guard Patrol System', tingkat: ins })
  }
  if (ops && app.role) out.push(...inboxOps(app.role, app.settings, ops, hariIni))
  return out
}

const KATEGORI_INBOX: Partial<Record<string, 'hk' | 'rawat'>> = { cs: 'hk', kashift: 'rawat', pengawas: 'rawat', abh: 'rawat' }

function inboxOps(role: Parameters<typeof formKategori>[0], settings: Parameters<typeof formKategori>[1], recs: OpsRecord[], hariIni: string): ItemInbox[] {
  const out: ItemInbox[] = []
  const kat = KATEGORI_INBOX[role]
  const byId = new Map(recs.map((r) => [r.id, r]))
  if (kat) {
    const grup = kat === 'hk' ? 'Housekeeping' : 'Perawatan'
    const forms = formKategori(role, settings, kat)
    const akhirBulan = Number(hariIni.slice(8)) >= 20
    const ringkas = (ids: string[]) => `${ids.slice(0, 3).map((id) => judulForm(id)).join(', ')}${ids.length > 3 ? ` +${ids.length - 3} lainnya` : ''}`
    const belum = (periode: 'harian' | 'bulanan') =>
      forms.filter((id) => {
        const f = formById(id)
        if (f?.periode !== periode) return false
        const st = statusOps(id, byId.get(opsId(id, tanggalSimpan(f, hariIni))))
        return st === 'kosong' || st === 'sebagian'
      })
    const harian = belum('harian')
    const nHarian = forms.filter((id) => formById(id)?.periode === 'harian').length
    if (harian.length)
      out.push({
        id: `ops-harian:${kat}`,
        jenis: 'tugas',
        judul: kat === 'hk' ? 'Checklist housekeeping hari ini' : 'Kartu perawatan hari ini',
        detail: `${harian.length} dari ${nHarian} ${kat === 'hk' ? 'area' : 'kartu'} belum lengkap: ${ringkas(harian)}`,
        to: kat === 'hk' ? '/ops/kalender?kategori=hk' : `/ops?grup=operasional&kategori=rawat&tanggal=${hariIni}`,
        grup,
        tingkat: 'tugas',
      })
    const bulanan = akhirBulan ? belum('bulanan') : []
    if (bulanan.length)
      out.push({ id: `ops-bulanan:${kat}`, jenis: 'tugas', judul: 'Kartu perawatan bulanan', detail: `${bulanan.length} kartu bulan ini belum lengkap: ${ringkas(bulanan)}`, to: `/ops?grup=operasional&tanggal=${hariIni}`, grup, tingkat: 'segera' })
    // Aktivitas berkala (mis. seminggu sekali) yang jatuh tempo hari ini.
    const tempo = jatuhTempoAktivitas(forms, recs, hariIni)
    if (tempo.length)
      out.push({
        id: `ops-tempo:${kat}`,
        jenis: 'tugas',
        judul: 'Aktivitas berkala jatuh tempo',
        detail: `${tempo.length} aktivitas: ${tempo.slice(0, 2).map((x) => `${x.item} (${judulForm(x.form)}, ${x.jadwal})`).join('; ')}${tempo.length > 2 ? ` +${tempo.length - 2} lainnya` : ''}`,
        to: `/ops/${tempo[0].form}?tanggal=${hariIni}`,
        grup,
        tingkat: 'segera',
      })
  }
  // Paraf pengawas: form terisi 7 hari terakhir (sebelum hari ini) yang belum diparaf.
  if (bolehParaf(role)) {
    const batas = todayIso(addDays(new Date(`${hariIni}T00:00:00`), -7))
    const forms = new Set(formTampil(role, settings).flatMap((g) => g.forms))
    const tunggu = recs.filter((r) => forms.has(r.form) && r.tanggal >= batas && r.tanggal < hariIni && formById(r.form)?.periode !== 'bulanan' && ['lengkap', 'temuan'].includes(statusOps(r.form, r)))
    if (tunggu.length)
      out.push({
        id: 'ops-paraf',
        jenis: 'tugas',
        judul: 'Paraf kartu perawatan & housekeeping',
        detail: `${tunggu.length} form 7 hari terakhir belum diparaf${tunggu.some((r) => statusOps(r.form, r) === 'temuan') ? ', ada temuan' : ''}`,
        to: '/ops/kalender',
        grup: 'Paraf pengawas',
        tingkat: 'tugas',
      })
  }
  return out
}
