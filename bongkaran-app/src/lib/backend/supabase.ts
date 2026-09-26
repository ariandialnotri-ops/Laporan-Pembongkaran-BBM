/**
 * Mode Supabase: data bersama untuk semua perangkat, wajib login.
 * Tabel bbm_* & aturan akses ada di supabase/migrations/. Foto disimpan di
 * bucket privat "bbm-evidence"; database hanya menyimpan metadata foto.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { blobToDataUrl, genId } from '@/lib/image'
import type { Photo, Photos, Plan, Report, ReportStatus, ReportSummary, Settings } from '@/lib/sop'
import type { Backend, Member, Role } from './types'

const BUCKET = 'bbm-evidence'

type PlanRow = { id: string; tanggal: string | null; no_so: string; produk: string; sold_to: string | null; los: Plan['los']; created_at: string }
type ReportRow = {
  id: string
  status: ReportStatus
  data: Report['data']
  photos: Photos | null
  summary: ReportSummary
  created_at: string
  updated_at: string
  finished_at: string | null
  created_by: string | null
}

function translateError(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return 'Email atau password salah.'
  if (/Email not confirmed/i.test(msg)) return 'Email belum dikonfirmasi.'
  if (/row-level security/i.test(msg)) return 'Anda tidak berhak melakukan tindakan ini.'
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Tidak ada koneksi ke server. Periksa internet lalu coba lagi.'
  return msg
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(translateError(error.message))
  return data
}

// dataURL hanya hidup di memori (foto yang baru diambil), tidak disimpan ke database.
function stripDataUrls(photos: Photos): Photos {
  return Object.fromEntries(Object.entries(photos).map(([slot, list]) => [slot, list.map((p) => ({ id: p.id, name: p.name, at: p.at, path: p.path }))]))
}

export function createSupabaseBackend(sb: SupabaseClient): Backend {
  const dataCache = new Map<string, string>()
  const urlCache = new Map<string, { url: string; exp: number }>()

  const toPlan = (r: PlanRow): Plan => ({
    id: r.id,
    tanggal: r.tanggal ?? '',
    noSO: r.no_so,
    produk: r.produk,
    soldTo: r.sold_to ?? '',
    los: r.los ?? [],
    createdAt: Date.parse(r.created_at),
  })

  return {
    mode: 'supabase',

    async getSession() {
      const { data } = await sb.auth.getSession()
      const user = data.session?.user
      if (!user) return { user: null, role: null, nama: null }
      const role = check(await sb.rpc('bbm_claim_first')) as Role | null
      let nama: string | null = null
      if (role) {
        const me = check(await sb.from('bbm_members').select('nama').eq('user_id', user.id).maybeSingle())
        nama = (me as { nama: string | null } | null)?.nama ?? null
      }
      return { user: { id: user.id, email: user.email ?? '' }, role, nama }
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => {
        // Panggilan Supabase di dalam callback ini bisa macet; tunda satu tick.
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(cb, 0)
      })
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error(translateError(error.message))
    },
    async signOut() {
      await sb.auth.signOut()
      dataCache.clear()
      urlCache.clear()
    },

    async getSettings() {
      const row = check(await sb.from('bbm_settings').select('value').eq('id', 'default').maybeSingle()) as { value: Settings } | null
      return row?.value ?? null
    },
    async saveSettings(settings) {
      check(await sb.from('bbm_settings').upsert({ id: 'default', value: settings }))
    },

    async listPlans() {
      const rows = check(await sb.from('bbm_plans').select('*').order('tanggal', { ascending: false })) as PlanRow[]
      return rows.map(toPlan)
    },
    async savePlan(p) {
      check(
        await sb.from('bbm_plans').upsert({
          id: p.id,
          tanggal: p.tanggal || null,
          no_so: p.noSO,
          produk: p.produk,
          sold_to: p.soldTo || null,
          los: p.los,
          created_at: new Date(p.createdAt).toISOString(),
        }),
      )
    },
    async deletePlan(id) {
      const rows = check(await sb.from('bbm_plans').delete().eq('id', id).select('id'))
      if (!rows?.length) throw new Error('Anda tidak berhak menghapus plan ini.')
    },

    async listReports() {
      const rows = check(
        await sb.from('bbm_reports').select('id,status,summary,created_by').order('created_at', { ascending: false }).limit(500),
      ) as Pick<ReportRow, 'id' | 'status' | 'summary' | 'created_by'>[]
      return rows.map((r) => ({ ...r.summary, id: r.id, status: r.status, createdBy: r.created_by }))
    },
    async getReport(id) {
      const r = check(await sb.from('bbm_reports').select('*').eq('id', id).maybeSingle()) as ReportRow | null
      if (!r) return null
      return {
        id: r.id,
        status: r.status,
        data: r.data,
        photos: r.photos ?? {},
        createdBy: r.created_by,
        createdAt: Date.parse(r.created_at),
        updatedAt: Date.parse(r.updated_at),
        finishedAt: r.finished_at ? Date.parse(r.finished_at) : null,
      }
    },
    async saveReport(report, summary) {
      check(
        await sb.from('bbm_reports').upsert({
          id: report.id,
          status: report.status,
          data: report.data,
          photos: stripDataUrls(report.photos),
          summary,
          created_at: new Date(report.createdAt).toISOString(),
          finished_at: report.finishedAt ? new Date(report.finishedAt).toISOString() : null,
        }),
      )
    },
    async deleteReport(id) {
      const rows = check(await sb.from('bbm_reports').delete().eq('id', id).select('id'))
      if (!rows?.length) throw new Error('Anda tidak berhak menghapus laporan ini (hanya pengawas, atau pembuat laporan selama masih draft).')
      const files = check(await sb.storage.from(BUCKET).list(id, { limit: 1000 }))
      if (files?.length) await sb.storage.from(BUCKET).remove(files.map((f) => `${id}/${f.name}`))
    },

    async uploadPhoto(reportId, dataUrl, name) {
      const id = genId('p')
      const path = `${reportId}/${id}.jpg`
      const blob = await (await fetch(dataUrl)).blob()
      check(await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
      dataCache.set(path, dataUrl)
      return { id, name, at: new Date().toISOString(), path, dataUrl }
    },
    async deletePhoto(photo) {
      if (!photo.path) return
      check(await sb.storage.from(BUCKET).remove([photo.path]))
      dataCache.delete(photo.path)
      urlCache.delete(photo.path)
    },
    async signedUrls(photos) {
      const now = Date.now()
      const out: Record<string, string> = {}
      const need: Photo[] = []
      for (const p of photos) {
        if (!p.path) continue
        const cached = urlCache.get(p.path)
        if (cached && cached.exp > now) out[p.id] = cached.url
        else need.push(p)
      }
      if (need.length) {
        const res = check(await sb.storage.from(BUCKET).createSignedUrls(need.map((p) => p.path!), 3600))
        ;(res ?? []).forEach((r, i) => {
          if (!r.signedUrl) return
          urlCache.set(need[i].path!, { url: r.signedUrl, exp: now + 50 * 60 * 1000 })
          out[need[i].id] = r.signedUrl
        })
      }
      return out
    },
    async photoDataUrl(photo) {
      if (photo.dataUrl) return photo.dataUrl
      if (!photo.path) return ''
      const cached = dataCache.get(photo.path)
      if (cached) return cached
      const blob = check(await sb.storage.from(BUCKET).download(photo.path))
      if (!blob) return ''
      const dataUrl = await blobToDataUrl(blob)
      dataCache.set(photo.path, dataUrl)
      return dataUrl
    },

    listMembers: async () => check(await sb.from('bbm_members').select('*').order('created_at')) as Member[],
    async addMember(email, nama, role) {
      check(await sb.rpc('bbm_add_member', { p_email: email, p_nama: nama, p_role: role }))
    },
    async setMemberRole(userId, role) {
      const rows = check(await sb.from('bbm_members').update({ role }).eq('user_id', userId).select('user_id'))
      if (!rows?.length) throw new Error('Tidak berhak mengubah peran anggota.')
    },
    async removeMember(userId) {
      const rows = check(await sb.from('bbm_members').delete().eq('user_id', userId).select('user_id'))
      if (!rows?.length) throw new Error('Tidak dapat menghapus anggota ini.')
    },
  }
}
