/**
 * Mode lokal: data di IndexedDB perangkat ini saja, tanpa login. Dipakai saat
 * Supabase belum dikonfigurasi (mis. `npm run dev` tanpa .env.local).
 * IndexedDB, bukan localStorage, karena satu laporan berisi belasan foto.
 */
import { blobToDataUrl, genId } from '@/lib/image'
import type { DailyRecord } from '@/lib/daily'
import type { OpsRecord } from '@/lib/ops'
import type { AirRecord } from '@/lib/air'
import type { PettyRecord } from '@/lib/petty'
import type { Role } from '@/lib/roles'
import type { Catatan } from '@/lib/catatan'
import { absensiSiap, cekArea, prosesAbsen, type AbsenRecord } from '@/lib/absen'
import type { GtsRecord } from '@/lib/gts'
import type { WbsRecord } from '@/lib/wbs'
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

  listOps: (from, to) => get<OpsRecord[]>('ops').then((d) => (d ?? []).filter((r) => r.tanggal >= from && r.tanggal <= to)),
  async saveOps(rec) {
    await set('ops', upsertById((await get<OpsRecord[]>('ops')) ?? [], rec))
  },
  async deleteOps(id) {
    await set('ops', ((await get<OpsRecord[]>('ops')) ?? []).filter((r) => r.id !== id))
  },
  async kirimWbs(id, data, foto) {
    const rec: WbsRecord = {
      id,
      status: 'baru',
      createdAt: new Date().toISOString(),
      createdBy: null,
      data: { ...data, kontak: data.anonim ? '' : data.kontak, riwayat: [], foto: await Promise.all(foto.map(async (b, i) => ({ id: `${id}-${i + 1}`, name: `bukti-${i + 1}.jpg`, at: new Date().toISOString(), dataUrl: await blobToDataUrl(b) }))) },
    }
    await set('wbs', [rec, ...((await get<WbsRecord[]>('wbs')) ?? [])])
  },
  listWbs: () => get<WbsRecord[]>('wbs').then((d) => d ?? []),
  async updateWbs(id, status, data) {
    await set('wbs', ((await get<WbsRecord[]>('wbs')) ?? []).map((r) => (r.id === id ? { ...r, status, data } : r)))
  },
  listGts: (from, to) => get<GtsRecord[]>('gts').then((d) => (d ?? []).filter((r) => r.tanggal >= from && r.tanggal <= to)),
  async saveGts(rec) {
    await set('gts', [...((await get<GtsRecord[]>('gts')) ?? []), rec])
  },
  async deleteGts(id) {
    await set('gts', ((await get<GtsRecord[]>('gts')) ?? []).filter((r) => r.id !== id))
  },
  listAir: (from, to) => get<AirRecord[]>('air').then((d) => (d ?? []).filter((r) => r.tanggal >= from && r.tanggal <= to)),
  async saveAir(rec) {
    await set('air', upsertById((await get<AirRecord[]>('air')) ?? [], rec))
  },
  async deleteAir(id) {
    await set('air', ((await get<AirRecord[]>('air')) ?? []).filter((r) => r.id !== id))
  },
  listCatatan: <T,>(jenis: string, from: string, to: string) =>
    get<Catatan<T>[]>(`catatan-${jenis}`).then((d) => (d ?? []).filter((r) => r.tanggal >= from && r.tanggal <= to).sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.shift - b.shift)),
  async saveCatatan(jenis, rec) {
    await set(`catatan-${jenis}`, upsertById((await get<Catatan<unknown>[]>(`catatan-${jenis}`)) ?? [], rec))
  },
  async deleteCatatan(jenis, id) {
    await set(`catatan-${jenis}`, ((await get<Catatan<unknown>[]>(`catatan-${jenis}`)) ?? []).filter((r) => r.id !== id))
  },
  // Mode lokal: aturan sama dengan RPC bbm_absen (QR, radius GPS, urutan absen); jam dari perangkat.
  async absen(x) {
    const st = (await get<Settings>('settings')) ?? ({} as Settings)
    const a = st.absensi
    if (!absensiSiap(a)) throw new Error('Titik lokasi & QR absensi SPBU belum diatur. Hubungi pengawas.')
    if (!x.kode.startsWith('FLOQ-ABSEN|') || !x.kode.endsWith(`|${a.token}`)) throw new Error('QR bukan QR absensi SPBU ini atau sudah diganti. Pindai QR absensi yang terpasang di SPBU.')
    const p = (st.personil ?? []).find((z) => z.id === x.personilId && z.aktif)
    if (!p) throw new Error('Personil tidak ditemukan atau tidak aktif')
    const area = cekArea(a, x)
    if (!area.ok) throw new Error(`Di luar area SPBU: ${Math.round(area.jarak)} m dari titik absensi (batas ${a.radius} m)`)
    const recs = (await get<AbsenRecord[]>('catatan-absen')) ?? []
    const titik = { at: new Date().toISOString(), lat: x.lat, lng: x.lng, akurasi: Math.round(x.akurasi), jarak: Math.round(area.jarak), oleh: null, olehNama: localStorage.getItem('floq-peran') || 'abh' }
    await set('catatan-absen', upsertById(recs, prosesAbsen(recs, p, x.jenis, titik, x.tanggal)))
  },
  listPetty: (from, to) => get<PettyRecord[]>('petty').then((d) => (d ?? []).filter((r) => r.tanggal >= from && r.tanggal <= to).sort((a, b) => b.tanggal.localeCompare(a.tanggal))),
  // Mode lokal: status awal mengikuti peran uji (sama dengan trigger database).
  async savePetty(rec, baru) {
    const peran = (localStorage.getItem('floq-peran') || 'abh') as Role
    // Sama dengan trigger database: ABH tidak mengajukan; pengajuan Admin/Cashier langsung ke ABH; peran pengaju dicatat.
    if (baru && peran === 'abh') throw new Error('ABH memberi persetujuan akhir dan tidak dapat mengajukan petty cash.')
    const isi = baru ? { ...rec, status: (peran === 'admin' ? 'Menunggu ABH' : 'Menunggu Admin') as PettyRecord['status'], data: { ...rec.data, peran } } : rec
    await set('petty', upsertById((await get<PettyRecord[]>('petty')) ?? [], isi))
    return isi
  },
  async deletePetty(id) {
    await set('petty', ((await get<PettyRecord[]>('petty')) ?? []).filter((r) => r.id !== id))
  },
  // Mode lokal: foto tersimpan di perangkat, tidak ada cut-off.
  fotoArsip: async () => [],
  unduhFoto: async () => null,

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
