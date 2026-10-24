// Kirim laporan Whistle Blowing System (WBS). Semua anggota SPBU boleh melapor; hanya ABH yang dapat membaca.
// Laporan & foto bukti disimpan dengan service role, sehingga laporan anonim tidak menyimpan akun pelapor
// (termasuk pemilik objek foto di storage). Pemanggil diverifikasi dari JWT-nya sebagai anggota SPBU itu.
//   { spbuId, id, data: {kategori, tanggal, jam, lokasi, terlibat, uraian, anonim, kontak}, foto: [base64 JPEG] }
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const balas = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const teks = (v: unknown, maks: number) => String(v ?? '').trim().slice(0, maks)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return balas(405, { error: 'Metode tidak didukung' })
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: caller } = await admin.auth.getUser(token)
  const uid = caller.user?.id
  if (!uid) return balas(401, { error: 'Sesi tidak valid, silakan masuk ulang.' })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return balas(400, { error: 'Data tidak valid' })
  }
  const spbuId = String(body.spbuId ?? '')
  const id = String(body.id ?? '')
  if (!/^[A-Za-z0-9_-]{4,60}$/.test(id)) return balas(400, { error: 'Nomor laporan tidak valid' })

  // Anggota SPBU itu (pengawas/kashift/security/cs) atau ABH pengendalinya.
  const [{ data: m }, { data: abh }] = await Promise.all([
    admin.from('bbm_members').select('spbu_id').eq('user_id', uid).maybeSingle(),
    admin.from('bbm_abh_spbu').select('spbu_id').eq('user_id', uid).eq('spbu_id', spbuId).maybeSingle(),
  ])
  if (m?.spbu_id !== spbuId && !abh) return balas(403, { error: 'Anda bukan anggota SPBU ini.' })

  const d = (body.data ?? {}) as Record<string, unknown>
  const anonim = d.anonim !== false
  const data = {
    kategori: teks(d.kategori, 80),
    tanggal: teks(d.tanggal, 10),
    jam: teks(d.jam, 5),
    lokasi: teks(d.lokasi, 200),
    terlibat: teks(d.terlibat, 500),
    uraian: teks(d.uraian, 5000),
    anonim,
    kontak: anonim ? '' : teks(d.kontak, 200),
    foto: [] as { id: string; name: string; at: string; path: string }[],
    riwayat: [] as unknown[],
  }
  if (!data.kategori) return balas(400, { error: 'Pilih kategori pelanggaran.' })
  if (data.uraian.length < 20) return balas(400, { error: 'Uraikan kejadian minimal 20 karakter.' })

  const foto = Array.isArray(body.foto) ? body.foto.slice(0, 5) : []
  for (const [i, f] of foto.entries()) {
    const b64 = String(f).replace(/^data:image\/\w+;base64,/, '')
    let bytes: Uint8Array
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    } catch {
      return balas(400, { error: 'Foto tidak valid' })
    }
    if (bytes.length > 4 * 1024 * 1024) return balas(400, { error: 'Foto terlalu besar (maks. 4 MB).' })
    const path = `${spbuId}/wbs-${id}/${i + 1}.jpg`
    const { error } = await admin.storage.from('bbm-evidence').upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
    if (error) return balas(500, { error: `Gagal menyimpan foto: ${error.message}` })
    data.foto.push({ id: `wbs-${id}-${i + 1}`, name: `bukti-${i + 1}.jpg`, at: new Date().toISOString(), path })
  }

  const { error } = await admin.from('bbm_wbs').insert({ spbu_id: spbuId, id, data, created_by: anonim ? null : uid })
  if (error) {
    if (data.foto.length) await admin.storage.from('bbm-evidence').remove(data.foto.map((x) => x.path))
    return balas(400, { error: /duplicate/i.test(error.message) ? 'Laporan ini sudah terkirim.' : error.message })
  }
  return balas(200, { ok: true, id })
})
