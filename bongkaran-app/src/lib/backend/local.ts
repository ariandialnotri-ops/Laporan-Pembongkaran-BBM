/**
 * Mode lokal: data di IndexedDB perangkat ini saja, tanpa login. Dipakai saat
 * Supabase belum dikonfigurasi (mis. `npm run dev` tanpa .env.local).
 * IndexedDB, bukan localStorage, karena satu laporan berisi belasan foto.
 */
import { blobToDataUrl, genId } from '@/lib/image'
import type { DailyRecord } from '@/lib/daily'
import { normalizePlan } from '@/lib/plan'
import type { Photos, Plan, Report, ReportSummary, Settings } from '@/lib/sop'
import type { Backend } from './types'

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

const get = <T>(key: string) => run<T | undefined>('readonly', (s) => s.get(key))
const set = (key: string, value: unknown) => run<IDBValidKey>('readwrite', (s) => s.put(value, key))
const del = (key: string) => run<undefined>('readwrite', (s) => s.delete(key))

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

  getSettings: () => get('settings').then((s) => (s as never) ?? null),
  saveSettings: (settings) => set('settings', settings).then(() => {}),
  async saveSettingsTerbatas(data) {
    await set('settings', { ...((await get<Settings>('settings')) ?? {}), ...data })
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
