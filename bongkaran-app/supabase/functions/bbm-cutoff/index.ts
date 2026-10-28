// Cut-off foto bukti (bucket bbm-evidence) tiap tanggal 5, dipanggil pg_cron (lihat migrasi bbm_cutoff_jadwal).
// Menghapus foto yang diunggah sebelum tanggal 1 (bulan ini - fotoSimpanBulan SPBU, bawaan 3) lewat
// Storage API, lalu mencatat jumlahnya per SPBU di bbm_cutoff_log. Data teks laporan tidak disentuh.
// Pemanggil wajib membawa header x-cutoff-key yang cocok dengan rahasia Vault 'bbm_cutoff_key'.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

const balas = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Tanggal (1-31) saat ini di WIB. */
const tanggalWib = () => new Date(Date.now() + 7 * 3600_000).getUTCDate()

Deno.serve(async (req) => {
  if (req.method !== 'POST') return balas(405, { error: 'Metode tidak didukung' })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const { data: cocok } = await admin.rpc('bbm_cutoff_kunci_cocok', { p_key: req.headers.get('x-cutoff-key') ?? '' })
  if (cocok !== true) return balas(401, { error: 'Tidak diizinkan' })
  // Tanggal 1-4 adalah masa unduh arsip; penghapusan baru boleh mulai tanggal 5.
  if (tanggalWib() < 5) return balas(409, { error: 'Cut-off hanya berjalan mulai tanggal 5' })

  const rekap = new Map<string, { jumlah: number; ukuran: number; batas: string }>()
  const mulai = Date.now()
  let gagal = ''
  // Batch 1000 nama, hapus per 100; berhenti sebelum batas waktu edge function.
  while (Date.now() - mulai < 100_000) {
    const { data, error } = await admin.rpc('bbm_cutoff_kandidat', { p_limit: 1000 })
    if (error) {
      gagal = error.message
      break
    }
    const daftar = (data ?? []) as { name: string; spbu_id: string; ukuran: number; batas: string }[]
    if (!daftar.length) break
    let terhapus = 0
    for (let i = 0; i < daftar.length; i += 100) {
      const potong = daftar.slice(i, i + 100)
      const { data: hasil, error: e } = await admin.storage.from('bbm-evidence').remove(potong.map((d) => d.name))
      if (e) {
        gagal = e.message
        break
      }
      const nama = new Set((hasil ?? []).map((h: { name: string }) => h.name))
      for (const d of potong) {
        if (!nama.has(d.name)) continue
        terhapus++
        const r = rekap.get(d.spbu_id) ?? { jumlah: 0, ukuran: 0, batas: d.batas }
        r.jumlah++
        r.ukuran += Number(d.ukuran) || 0
        rekap.set(d.spbu_id, r)
      }
    }
    if (gagal || !terhapus) break
  }

  const baris = [...rekap].map(([spbu_id, r]) => ({ spbu_id, batas: r.batas, jumlah: r.jumlah, ukuran: r.ukuran, pesan: gagal || null }))
  if (!baris.length) baris.push({ spbu_id: null as unknown as string, batas: null as unknown as string, jumlah: 0, ukuran: 0, pesan: gagal || 'Tidak ada foto yang melewati batas simpan' })
  await admin.from('bbm_cutoff_log').insert(baris)
  return balas(gagal ? 500 : 200, { ok: !gagal, spbu: baris.length, jumlah: baris.reduce((n, b) => n + b.jumlah, 0), error: gagal || undefined })
})
