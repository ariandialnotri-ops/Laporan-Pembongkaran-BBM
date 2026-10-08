// Kelola akun login FLOQ dari menu Profil > Anggota (khusus ABH).
//   { aksi: 'buat', email, password, nama, role }  -> buat akun (langsung aktif) + daftarkan sebagai anggota
//   { aksi: 'sandi', userId, password }            -> atur ulang kata sandi anggota
// Pemanggil diverifikasi dari JWT-nya; operasi admin memakai service role yang hanya ada di server.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1'

const PERAN = ['abh', 'pengawas', 'kashift', 'security']
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const balas = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return balas(405, { error: 'Metode tidak didukung' })

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: caller } = await admin.auth.getUser(token)
  if (!caller.user) return balas(401, { error: 'Sesi tidak valid, silakan masuk ulang.' })
  const { data: me } = await admin.from('bbm_members').select('role').eq('user_id', caller.user.id).maybeSingle()
  if (me?.role !== 'abh') return balas(403, { error: 'Hanya ABH yang dapat mengelola akun.' })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return balas(400, { error: 'Data tidak valid' })
  }
  const password = String(body.password ?? '')
  if (password.length < 8) return balas(400, { error: 'Kata sandi minimal 8 karakter.' })

  if (body.aksi === 'sandi') {
    const userId = String(body.userId ?? '')
    const { data: anggota } = await admin.from('bbm_members').select('user_id').eq('user_id', userId).maybeSingle()
    if (!anggota) return balas(404, { error: 'Anggota tidak ditemukan.' })
    const { error } = await admin.auth.admin.updateUserById(userId, { password })
    if (error) return balas(400, { error: error.message })
    return balas(200, { ok: true })
  }

  if (body.aksi !== 'buat') return balas(400, { error: 'Aksi tidak dikenal' })
  const email = String(body.email ?? '').trim().toLowerCase()
  const nama = String(body.nama ?? '').trim()
  const role = String(body.role ?? '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return balas(400, { error: 'Email tidak valid.' })
  if (!PERAN.includes(role)) return balas(400, { error: 'Peran tidak valid.' })

  const { data: dibuat, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nama } })
  if (error || !dibuat.user) {
    const pesan = /already|registered|exists/i.test(error?.message ?? '') ? `Email ${email} sudah terdaftar. Pakai "Daftarkan akun yang sudah ada".` : (error?.message ?? 'Gagal membuat akun')
    return balas(400, { error: pesan })
  }
  const { error: e2 } = await admin.from('bbm_members').upsert({ user_id: dibuat.user.id, email, nama: nama || null, role })
  if (e2) return balas(400, { error: e2.message })
  return balas(200, { ok: true, userId: dibuat.user.id })
})
