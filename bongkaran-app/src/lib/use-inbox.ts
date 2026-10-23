import { useEffect, useState } from 'react'
import { useMenu } from '@/components/shell/menu-data'
import { statusKedaluwarsa } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import { berlakuSertifikat, statusSertifikat, statusTanggal } from '@/lib/berlaku'
import { addDays, todayIso } from '@/lib/date'
import { bolehParaf, formById, formKategori, formTampil, jatuhTempoAktivitas, judulForm, opsId, statusOps, tanggalSimpan, type OpsRecord } from '@/lib/ops'
import { jenisPetty, perluSettlement, type PettyRecord } from '@/lib/petty'
import type { SignerKey } from '@/lib/sop'
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
  // Pengajuan petty cash 3 bulan terakhir: persetujuan, settlement, realisasi yang menunggu PIC.
  const [petty, setPetty] = useState<{ kunci: string; recs: PettyRecord[] } | null>(null)
  const kunciPetty = `${app.spbuId}|${app.role}|${hariIni}`
  useEffect(() => {
    if (!app.loaded || !app.role || !app.can('/finance/petty')) return
    app.backend.listPetty(todayIso(addDays(new Date(`${hariIni}T00:00:00`), -92)), hariIni).then(
      (recs) => setPetty({ kunci: kunciPetty, recs }),
      () => setPetty({ kunci: kunciPetty, recs: [] }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dimuat ulang per SPBU/peran/hari
  }, [app.loaded, app.role, app.backend, app.spbuId, hariIni, kunciPetty])

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
  out.push(...inboxPersetujuan(app, petty?.kunci === kunciPetty ? petty.recs : []))
  return out
}

/** Grup Inbox untuk semua yang menunggu persetujuan, paraf, atau tanda tangan PIC. */
export const GRUP_PERSETUJUAN = 'Persetujuan & Paraf'
/** Penanda tangan Berita Acara bongkaran per peran. */
const TTD_PERAN: Partial<Record<string, SignerKey>> = { kashift: 'penerima', security: 'security', pengawas: 'pengawas', abh: 'abh' }

/**
 * Persetujuan & paraf yang menunggu pengguna ini (PIC): persetujuan 1 Admin/Cashier & persetujuan akhir ABH
 * petty cash, Create Settlement oleh pengaju, realisasi Admin/Cashier, tanda tangan Berita Acara bongkaran
 * sesuai peran, dan insiden yang PIC-nya pengguna ini.
 */
function inboxPersetujuan(app: ReturnType<typeof useApp>, petty: PettyRecord[]): ItemInbox[] {
  const out: ItemInbox[] = []
  const role = app.role
  const uid = app.session.user?.id ?? null
  const milik = (r: PettyRecord) => (!!uid && r.createdBy === uid) || (uid === null && r.createdBy === null)
  const tambah = (id: string, judul: string, recs: PettyRecord[], to: string, detail: (r: PettyRecord) => string) => {
    if (!recs.length) return
    out.push({ id, jenis: 'tugas', judul: `${judul} (${recs.length})`, detail: recs.slice(0, 2).map(detail).join('; ') + (recs.length > 2 ? ` +${recs.length - 2} lainnya` : ''), to, grup: GRUP_PERSETUJUAN, tingkat: 'tugas' })
  }
  const ringkas = (r: PettyRecord) => `${r.no} ${r.data.uraian} · ${r.data.diajukanNama}`
  if (role === 'admin' || role === 'abh')
    tambah('acc-admin', 'Persetujuan 1 petty cash', petty.filter((r) => r.status === 'Menunggu Admin' && !(role === 'admin' && milik(r))), '/finance/petty/pengajuan', ringkas)
  if (role === 'abh') tambah('acc-abh', 'Persetujuan akhir ABH', petty.filter((r) => r.status === 'Menunggu ABH'), '/finance/petty/pengajuan', ringkas)
  const settle = petty.filter((r) => perluSettlement(r) && milik(r))
  if (settle.length === 1) tambah('settlement', 'Buat settlement pengajuan', settle, `/finance/petty/settlement/${encodeURIComponent(settle[0].id)}`, (r) => `${r.no} ${r.data.uraian} disetujui, lampirkan struk & foto barang`)
  else tambah('settlement', 'Buat settlement pengajuan', settle, '/finance/petty/pengajuan', (r) => `${r.no} ${r.data.uraian}`)
  if (role === 'admin' || role === 'abh')
    tambah('realisasi', 'Realisasi petty cash', petty.filter((r) => r.status === 'Disetujui' && !r.data.realisasi && !perluSettlement(r)), '/finance/petty/realisasi', (r) => `${r.no} ${r.data.uraian}${jenisPetty(r) === 'reimburse' ? ' (reimburse)' : ''}`)
  // Tanda tangan Berita Acara bongkaran yang menunggu peran ini.
  const ttd = role ? TTD_PERAN[role] : undefined
  if (ttd) {
    const ba = app.reports.filter((r) => r.status !== 'draft' && r.ttdKurang?.includes(ttd))
    if (ba.length)
      out.push({
        id: 'ttd-ba',
        jenis: 'tugas',
        judul: `Tanda tangan Berita Acara (${ba.length})`,
        detail: ba.slice(0, 2).map((r) => `${r.produk} ${r.nopol || ''} ${r.tanggal}`).join('; ') + (ba.length > 2 ? ` +${ba.length - 2} lainnya` : ''),
        to: ba.length === 1 ? `/input/${encodeURIComponent(ba[0].id)}` : '/laporan/ba',
        grup: GRUP_PERSETUJUAN,
        tingkat: 'tugas',
      })
  }
  // Insiden terbuka dengan PIC = pengguna ini.
  const nama = app.displayName.trim().toLowerCase()
  const pic = app.daily.filter((d) => d.kind === 'insiden' && d.data.status !== 'selesai' && !!nama && d.data.pic?.trim().toLowerCase() === nama)
  if (pic.length)
    out.push({ id: 'pic-insiden', jenis: 'tugas', judul: `Tindak lanjut insiden sebagai PIC (${pic.length})`, detail: 'Laporan menunggu tindak lanjut Anda', to: '/laporan/insiden', grup: GRUP_PERSETUJUAN, tingkat: 'tugas' })
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
        grup: GRUP_PERSETUJUAN,
        tingkat: 'tugas',
      })
  }
  return out
}
