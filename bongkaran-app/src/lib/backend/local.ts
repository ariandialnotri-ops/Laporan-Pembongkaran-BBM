/**
 * Mode lokal: data di IndexedDB perangkat ini saja, tanpa login. Dipakai saat
 * Supabase belum dikonfigurasi (mis. `npm run dev` tanpa .env.local).
 * IndexedDB, bukan localStorage, karena satu laporan berisi belasan foto.
 */
import { blobToDataUrl, genId } from '@/lib/image'
import type { DailyRecord } from '@/lib/daily'
import { normalizePlan } from '@/lib/plan'
import type { Photos, Plan, Report, ReportSummary, Settings } from '@/lib/sop'
import { TANK_BAWAAN, type TankDef } from '@/lib/tank'
import type { Backend, RingkasanUnit, Spbu } from './types'

const DB_NAME = 'pantas-bongkaran'
const STORE = 'kv'
let dbPromise: Promise<IDBDatabase> | null = null

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const req = fn(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(req.result as T)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
        // Commit segera: transaksi yang belum ter-commit dibatalkan browser saat halaman ditutup/dimuat ulang.
        if (mode === 'readwrite') tx.commit?.()
      }),
  )
}

// Multi SPBU di perangkat ini: SPBU pertama ("lokal") memakai kunci lama tanpa awalan.
const SPBU_LOKAL: Spbu = { id: 'lokal', kode: null, nama: 'SPBU (mode lokal)' }
let spbu = SPBU_LOKAL.id
const kunci = (key: string, id = spbu) => (id === SPBU_LOKAL.id ? key : `${id}:${key}`)

const getRaw = <T>(key: string) => run<T | undefined>('readonly', (s) => s.get(key))
const setRaw = (key: string, value: unknown) => run<IDBValidKey>('readwrite', (s) => s.put(value, key))
const get = <T>(key: string, id?: string) => getRaw<T>(kunci(key, id))
const set = (key: string, value: unknown) => setRaw(kunci(key), value)
const del = (key: string) => run<undefined>('readwrite', (s) => s.delete(kunci(key)))
const daftarSpbu = () => getRaw<Spbu[]>('spbu-list').then((l) => (l?.length ? l : [SPBU_LOKAL]))
// Nama & kode di daftar SPBU mengikuti Identitas SPBU (seperti trigger di Supabase).
async function namaKeDaftar(st: Partial<Settings>) {
  const list = await daftarSpbu()
  const baru = list.map((u) => (u.id === spbu ? { ...u, nama: st.namaSpbu?.trim() || u.nama, kode: st.kodeSpbu?.trim() || u.kode } : u))
  if (JSON.stringify(baru) !== JSON.stringify(list)) await setRaw('spbu-list', baru)
}
const tangkiDi = (id = spbu) => get<TankDef[]>('tanks', id).then((t) => t ?? (id === SPBU_LOKAL.id ? TANK_BAWAAN : []))

function upsertById<T extends { id: string }>(list: T[], item: T) {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]
}

// Objek foto terakhir yang disimpan per laporan: mengetik di form tidak
// perlu menulis ulang belasan foto setiap kali.
const savedPhotos = new Map<string, Photos>()

export const localBackend: Backend = {
  mode: 'local',

  async getSession() {
    navigator.storage?.persist?.().catch(() => {})
    return { user: null, role: 'pengawas', nama: null }
  },
  onAuthChange: () => () => {},
  async signIn() {},
  async signOut() {},

  listSpbu: daftarSpbu,
  pilihSpbu(id) {
    spbu = id
  },
  async buatSpbu(nama, kode) {
    const id = genId('spbu')
    await setRaw('spbu-list', [...(await daftarSpbu()), { id, kode: kode.trim() || null, nama: nama.trim() }])
    await setRaw(kunci('settings', id), { namaSpbu: nama.trim(), kodeSpbu: kode.trim() })
    return id
  },
  async ringkasanUnit(hariIni) {
    const bulan = hariIni.slice(0, 7)
    return Promise.all(
      (await daftarSpbu()).map(async (u): Promise<RingkasanUnit> => {
        const [st, tanks, idx, daily] = await Promise.all([get<Partial<Settings>>('settings', u.id), tangkiDi(u.id), get<ReportSummary[]>('index', u.id), get<DailyRecord[]>('daily', u.id)])
        const d = daily ?? []
        const r = idx ?? []
        const hari = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(hariIni) - (6 - i) * 864e5).toISOString().slice(0, 10))
        const diBulan = (ms: number) => new Date(ms).toISOString().slice(0, 7) === bulan
        return {
          spbuId: u.id,
          kode: st?.kodeSpbu || u.kode,
          nama: st?.namaSpbu || u.nama,
          identitasLengkap: !!st?.namaSpbu?.trim() && !!st?.kodeSpbu?.trim() && (st?.jumlahPulau ?? 0) > 0,
          tangki: tanks.length,
          anggota: 0,
          pengawas: 0,
          bongkaranBulan: r.filter((x) => diBulan(x.createdAt)).length,
          anomaliBulan: r.filter((x) => x.status === 'anomali' && diBulan(x.createdAt)).length,
          draft: r.filter((x) => x.status === 'draft').length,
          qq7Hari: hari.map((h) => new Set(d.filter((x) => x.kind === 'qq' && x.tanggal === h).map((x) => x.shift)).size),
          stokHariIni: new Set(d.filter((x) => x.kind === 'stok' && x.tanggal === hariIni).map((x) => x.shift)).size,
          aparUnit: (st?.apar?.length ?? 0) + (st?.apab?.length ?? 0),
          aparCekBulan: new Set(d.filter((x) => x.kind === 'apar' && x.id.length > 16 && x.tanggal.startsWith(bulan)).map((x) => x.id.slice(16))).size,
          insidenTerbuka: d.filter((x) => x.kind === 'insiden' && x.data.status !== 'selesai').length,
          terakhirAktif: d.length ? new Date(Math.max(...d.map((x) => x.updatedAt))).toISOString() : null,
        }
      }),
    )
  },

  getSettings: () => get('settings').then((s) => (s as never) ?? null),
  async saveSettings(settings) {
    await set('settings', settings)
    await namaKeDaftar(settings)
  },
  async saveSettingsTerbatas(data) {
    await set('settings', { ...((await get<Settings>('settings')) ?? {}), ...data })
    await namaKeDaftar(data)
  },

  listTanks: () => tangkiDi(),
  async saveTank(tank) {
    await set('tanks', upsertById(await tangkiDi(), tank))
  },
  async deleteTank(id) {
    await set('tanks', (await tangkiDi()).filter((t) => t.id !== id))
  },

  listPlans: () => get<Plan[]>('plans').then((p) => (p ?? []).map((x) => normalizePlan(x))),
  async savePlan(plan) {
    await set('plans', upsertById(await this.listPlans(), plan))
  },
  async deletePlan(id) {
    await set('plans', (await this.listPlans()).filter((p) => p.id !== id))
  },

  listReports: () => get<ReportSummary[]>('index').then((i) => i ?? []),
  async getReport(id) {
    const [rest, photos] = await Promise.all([get<Omit<Report, 'photos'>>(`report:${id}`), get<Photos>(`photos:${id}`)])
    if (!rest) return null
    savedPhotos.set(id, photos ?? {})
    return { ...rest, photos: photos ?? {} }
  },
  async saveReport(report, summary) {
    const { photos, ...rest } = report
    await set(`report:${report.id}`, rest)
    if (savedPhotos.get(report.id) !== photos) {
      await set(`photos:${report.id}`, photos)
      savedPhotos.set(report.id, photos)
    }
    await set('index', upsertById(await this.listReports(), summary))
  },
  async deleteReport(id) {
    await Promise.all([del(`report:${id}`), del(`photos:${id}`)])
    savedPhotos.delete(id)
    await set('index', (await this.listReports()).filter((r) => r.id !== id))
  },

  listDaily: (since) => get<DailyRecord[]>('daily').then((d) => (d ?? []).filter((r) => r.tanggal >= since)),
  listApar: (from, to) => get<DailyRecord[]>('daily').then((d) => (d ?? []).filter((r) => r.kind === 'apar' && r.tanggal >= from && r.tanggal <= to)),
  async saveDaily(rec) {
    await set('daily', upsertById((await get<DailyRecord[]>('daily')) ?? [], rec))
  },
  async deleteDaily(id) {
    await set('daily', ((await get<DailyRecord[]>('daily')) ?? []).filter((r) => r.id !== id))
  },

  uploadPhoto: async (_reportId, blob, name) => ({ id: genId('p'), name, at: new Date().toISOString(), dataUrl: await blobToDataUrl(blob) }),
  deletePhoto: async () => {},
  signedUrls: async () => ({}),
  photoDataUrl: async (photo) => photo.dataUrl ?? '',

  listMembers: async () => [],
  addMember: async () => {
    throw new Error('Anggota hanya tersedia bila Supabase dikonfigurasi.')
  },
  setMemberRole: async () => {},
  removeMember: async () => {},
  createAccount: async () => {
    throw new Error('Akun hanya tersedia bila Supabase dikonfigurasi.')
  },
  resetPassword: async () => {},
  changePassword: async () => {},
}
