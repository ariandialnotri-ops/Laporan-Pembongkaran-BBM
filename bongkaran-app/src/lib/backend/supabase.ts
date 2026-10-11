/**
 * Mode Supabase: data bersama untuk semua perangkat, wajib login.
 * Tabel bbm_* & aturan akses ada di supabase/migrations/. Foto disimpan di
 * bucket privat "bbm-evidence"; database hanya menyimpan metadata foto.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DailyRecord } from '@/lib/daily'
import { blobToDataUrl, genId } from '@/lib/image'
import { normalizePlan } from '@/lib/plan'
import type { Photo, Photos, Plan, Report, ReportStatus, ReportSummary, Settings } from '@/lib/sop'
import type { TankDef, TankTabel } from '@/lib/tank'
import type { Backend, Member, RingkasanUnit, Role } from './types'

const BUCKET = 'bbm-evidence'

type PlanMeta = Pick<Plan, 'ms2Tanggal' | 'ms2Jam' | 'ms2Shift' | 'poSap' | 'shipTo' | 'supplyPoint'>
type PlanRow = { id: string; tanggal: string | null; no_so: string; produk: string; sold_to: string | null; los: Plan['los']; meta: Partial<PlanMeta> | null; created_at: string }
type DailyRow = { id: string; kind: DailyRecord['kind']; tanggal: string; shift: number; data: DailyRecord['data']; created_at: string; updated_at: string; created_by: string | null }
type TankRow = { id: string; produk: string; tank_no: string; tanggal_kalibrasi: string | null; catatan: string | null; tabel: TankTabel; urut: number }
type RingkasanRow = {
  spbu_id: string
  kode: string | null
  nama: string
  identitas_lengkap: boolean
  tangki: number
  anggota: number
  pengawas: number
  bongkaran_bulan: number
  anomali_bulan: number
  draft: number
  qq_7hari: number[]
  stok_hari_ini: number
  apar_unit: number
  apar_cek_bulan: number
  insiden_terbuka: number
  terakhir_aktif: string | null
}
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
  if (/bbm_spbu_kode_key/i.test(msg)) return 'Kode SPBU sudah dipakai SPBU lain.'
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

// Ringkasan lama (dibuat sebelum kolom hitungan ada) diisi nilai kosong.
const SUMMARY_DEFAULTS: Pick<ReportSummary, 'volumeDO' | 'gainLoss' | 'densityAnomaly' | 'doneCount'> = { volumeDO: null, gainLoss: null, densityAnomaly: false, doneCount: 0 }

const toDaily = (r: DailyRow) =>
  ({
    id: r.id,
    kind: r.kind,
    tanggal: r.tanggal,
    shift: r.shift,
    data: r.data,
    createdAt: Date.parse(r.created_at),
    updatedAt: Date.parse(r.updated_at),
    createdBy: r.created_by,
  }) as DailyRecord

export function createSupabaseBackend(sb: SupabaseClient): Backend {
  let currentUserId: string | null = null
  // SPBU aktif; semua data dibaca & ditulis untuk SPBU ini.
  let spbu: string | null = null
  const aktif = () => {
    if (!spbu) throw new Error('Pilih SPBU terlebih dahulu.')
    return spbu
  }
  const dataCache = new Map<string, string>()
  const urlCache = new Map<string, { url: string; exp: number }>()

  // Edge function bbm-akun (khusus ABH): buat akun & atur ulang kata sandi.
  const akun = async (body: Record<string, string>) => {
    const { data, error } = await sb.functions.invoke('bbm-akun', { body })
    if (error) {
      const res = (error as { context?: Response }).context
      const detail = res && typeof res.json === 'function' ? ((await res.json().catch(() => null)) as { error?: string } | null)?.error : null
      throw new Error(translateError(detail || error.message))
    }
    if ((data as { error?: string } | null)?.error) throw new Error((data as { error: string }).error)
  }

  const toPlan = (r: PlanRow): Plan =>
    normalizePlan({
      ...(r.meta ?? {}),
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
      currentUserId = user?.id ?? null
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
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        // Supabase mengirim SIGNED_IN lagi setiap kali tab kembali terlihat
        // (mis. setelah kamera ditutup); abaikan bila penggunanya sama.
        if (event === 'SIGNED_IN' && session?.user.id === currentUserId) return
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

    async listSpbu() {
      return check(await sb.from('bbm_spbu').select('id,kode,nama').order('nama')) as { id: string; kode: string | null; nama: string }[]
    },
    pilihSpbu(id) {
      spbu = id
    },
    async buatSpbu(nama, kode) {
      return check(await sb.rpc('bbm_buat_spbu', { p_nama: nama, p_kode: kode })) as string
    },
    async ringkasanUnit(hariIni) {
      const rows = check(await sb.rpc('bbm_ringkasan_unit', { p_hari: hariIni })) as RingkasanRow[]
      return rows.map(
        (r): RingkasanUnit => ({
          spbuId: r.spbu_id,
          kode: r.kode,
          nama: r.nama,
          identitasLengkap: r.identitas_lengkap,
          tangki: r.tangki,
          anggota: r.anggota,
          pengawas: r.pengawas,
          bongkaranBulan: r.bongkaran_bulan,
          anomaliBulan: r.anomali_bulan,
          draft: r.draft,
          qq7Hari: r.qq_7hari ?? [],
          stokHariIni: r.stok_hari_ini,
          aparUnit: r.apar_unit,
          aparCekBulan: r.apar_cek_bulan,
          insidenTerbuka: r.insiden_terbuka,
          terakhirAktif: r.terakhir_aktif,
        }),
      )
    },

    async getSettings() {
      const row = check(await sb.from('bbm_settings').select('value').eq('spbu_id', aktif()).maybeSingle()) as { value: Settings } | null
      return row?.value ?? null
    },
    async saveSettings(settings) {
      const s = aktif()
      check(await sb.from('bbm_settings').upsert({ id: s, spbu_id: s, value: settings }))
    },
    async saveSettingsTerbatas(d) {
      const p_patch = {
        namaSpbu: d.namaSpbu ?? '',
        kodeSpbu: d.kodeSpbu ?? '',
        alamatSpbu: d.alamatSpbu ?? '',
        jumlahPulau: d.jumlahPulau ?? 0,
        jumlahDispenser: d.jumlahDispenser ?? 0,
        apar: d.apar ?? [],
        apab: d.apab ?? [],
        aparArea: d.aparArea ?? [],
        soldTo: d.soldTo ?? '',
        shipTo: d.shipTo ?? {},
      }
      check(await sb.rpc('bbm_save_settings_terbatas', { p_spbu: aktif(), p_patch }))
    },

    async listTanks() {
      const rows = check(await sb.from('bbm_tanks').select('id,produk,tank_no,tanggal_kalibrasi,catatan,tabel,urut').eq('spbu_id', aktif())) as TankRow[]
      return rows.map((r): TankDef => ({ id: r.id, produk: r.produk, tankNo: r.tank_no, tanggalKalibrasi: r.tanggal_kalibrasi, catatan: r.catatan, tabel: r.tabel, urut: r.urut }))
    },
    async saveTank(t) {
      check(
        await sb.from('bbm_tanks').upsert({
          spbu_id: aktif(),
          id: t.id,
          produk: t.produk,
          tank_no: t.tankNo,
          tanggal_kalibrasi: t.tanggalKalibrasi || null,
          catatan: t.catatan || null,
          tabel: t.tabel,
          urut: t.urut,
        }),
      )
    },
    async deleteTank(id) {
      const rows = check(await sb.from('bbm_tanks').delete().eq('spbu_id', aktif()).eq('id', id).select('id'))
      if (!rows?.length) throw new Error('Anda tidak berhak menghapus tangki ini.')
    },

    async listPlans() {
      const rows = check(await sb.from('bbm_plans').select('*').eq('spbu_id', aktif()).order('tanggal', { ascending: false })) as PlanRow[]
      return rows.map(toPlan)
    },
    async savePlan(p) {
      check(
        await sb.from('bbm_plans').upsert({
          spbu_id: aktif(),
          id: p.id,
          tanggal: p.tanggal || null,
          no_so: p.noSO,
          produk: p.produk,
          sold_to: p.soldTo || null,
          los: p.los,
          meta: { ms2Tanggal: p.ms2Tanggal, ms2Jam: p.ms2Jam, ms2Shift: p.ms2Shift, poSap: p.poSap, shipTo: p.shipTo, supplyPoint: p.supplyPoint } satisfies PlanMeta,
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
        await sb.from('bbm_reports').select('id,status,summary,created_by').eq('spbu_id', aktif()).order('created_at', { ascending: false }).limit(500),
      ) as Pick<ReportRow, 'id' | 'status' | 'summary' | 'created_by'>[]
      return rows.map((r) => ({ ...SUMMARY_DEFAULTS, ...r.summary, id: r.id, status: r.status, createdBy: r.created_by }))
    },
    async getReport(id) {
      const r = check(await sb.from('bbm_reports').select('*').eq('spbu_id', aktif()).eq('id', id).maybeSingle()) as ReportRow | null
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
          spbu_id: aktif(),
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
      // Foto di folder SPBU, dan folder lama (sebelum multi SPBU).
      for (const folder of [`${aktif()}/${id}`, id]) {
        const files = check(await sb.storage.from(BUCKET).list(folder, { limit: 1000 }))
        if (files?.length) await sb.storage.from(BUCKET).remove(files.map((f) => `${folder}/${f.name}`))
      }
    },

    async listDaily(since) {
      const s = aktif()
      const [harian, takar] = await Promise.all([
        sb.from('bbm_daily').select('*').eq('spbu_id', s).gte('tanggal', since).order('tanggal', { ascending: false }).limit(2000),
        sb.from('bbm_takar').select('*').eq('spbu_id', s).gte('tanggal', since).order('tanggal', { ascending: false }).limit(2000),
      ])
      // Uji takaran ada di tabel sendiri (bbm_takar), dibaca sebagai catatan harian kind 'takar'.
      return [...(check(harian) as DailyRow[]), ...(check(takar) as Omit<DailyRow, 'kind'>[]).map((r) => ({ ...r, kind: 'takar' as const }))].map(toDaily)
    },
    async listApar(from, to) {
      const rows = check(await sb.from('bbm_daily').select('*').eq('spbu_id', aktif()).eq('kind', 'apar').gte('tanggal', from).lte('tanggal', to).order('tanggal').limit(5000)) as DailyRow[]
      return rows.map(toDaily)
    },
    async saveDaily(rec) {
      if (rec.kind === 'takar') {
        check(
          await sb.from('bbm_takar').upsert(
            { spbu_id: aktif(), id: rec.id, tanggal: rec.tanggal, shift: rec.shift, data: rec.data, created_at: new Date(rec.createdAt).toISOString() },
            { onConflict: 'spbu_id,id' },
          ),
        )
        return
      }
      check(
        await sb.from('bbm_daily').upsert(
          {
            spbu_id: aktif(),
            id: rec.id,
            kind: rec.kind,
            tanggal: rec.tanggal,
            shift: rec.shift,
            data: rec.data,
            created_at: new Date(rec.createdAt).toISOString(),
          },
          { onConflict: 'spbu_id,id' },
        ),
      )
    },
    async deleteDaily(id) {
      const tabel = id.startsWith('takar_') ? 'bbm_takar' : 'bbm_daily'
      const rows = check(await sb.from(tabel).delete().eq('spbu_id', aktif()).eq('id', id).select('id'))
      if (!rows?.length) throw new Error('Anda tidak berhak menghapus catatan ini.')
    },

    async uploadPhoto(reportId, blob, name) {
      const id = genId('p')
      const path = `${aktif()}/${reportId}/${id}.jpg`
      check(await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false }))
      return { id, name, at: new Date().toISOString(), path }
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

    // Anggota SPBU aktif: yang bertugas di SPBU ini dan ABH pengendalinya.
    async listMembers() {
      const s = aktif()
      const abh = (check(await sb.from('bbm_abh_spbu').select('user_id').eq('spbu_id', s)) as { user_id: string }[]).map((r) => r.user_id)
      const filter = abh.length ? `spbu_id.eq.${s},user_id.in.(${abh.join(',')})` : `spbu_id.eq.${s}`
      return check(await sb.from('bbm_members').select('*').or(filter).order('created_at')) as Member[]
    },
    async addMember(email, nama, role) {
      check(await sb.rpc('bbm_add_member', { p_email: email, p_nama: nama, p_role: role, p_spbu: aktif() }))
    },
    async setMemberRole(userId, role) {
      const rows = check(await sb.from('bbm_members').update({ role }).eq('user_id', userId).select('user_id'))
      if (!rows?.length) throw new Error('Tidak berhak mengubah peran anggota.')
    },
    async removeMember(userId) {
      const rows = check(await sb.from('bbm_members').delete().eq('user_id', userId).select('user_id'))
      if (!rows?.length) throw new Error('Tidak dapat menghapus anggota ini.')
    },
    async createAccount(email, password, nama, role) {
      await akun({ aksi: 'buat', email, password, nama, role, spbuId: aktif() })
    },
    async resetPassword(userId, password) {
      await akun({ aksi: 'sandi', userId, password })
    },
    async changePassword(password) {
      const { error } = await sb.auth.updateUser({ password })
      if (error) throw new Error(translateError(error.message))
    },
  }
}
