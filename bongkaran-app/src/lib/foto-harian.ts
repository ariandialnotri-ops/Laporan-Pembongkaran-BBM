/**
 * Foto pemeriksaan harian (density & water content) disimpan sementara di perangkat (IndexedDB)
 * setelah laporannya dikirim, supaya menu "Kirim ke grup WA" di Kualitas Harian dapat menggabungkan
 * foto & hasil keduanya menjadi satu kolase. Foto tidak diunggah ke server dan dibuang setelah 3 hari.
 * Foto hanya ada di HP yang mengisi form.
 */
export type JenisFotoHarian = 'density' | 'air'
export interface FotoHarian {
  blob: Blob
  /** Baris cap kolase (jam, SPBU, keterangan). */
  cap: string[]
}
interface Entri {
  tanggal: string
  disimpan: number
  foto: FotoHarian[]
}

const DB = 'floq-foto-harian'
const STORE = 'foto'
const SIMPAN_HARI = 3

function buka() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function jalankan<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  const db = await buka()
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => {
      db.close()
      resolve(req ? (req.result as T) : undefined)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
  })
}

const kunci = (spbuId: string | null, tanggal: string, jenis: JenisFotoHarian) => `${spbuId ?? 'lokal'}|${tanggal}|${jenis}`

/** Simpan foto satu pemeriksaan (menggantikan foto sebelumnya pada tanggal & jenis yang sama). */
export async function simpanFotoHarian(spbuId: string | null, tanggal: string, jenis: JenisFotoHarian, foto: FotoHarian[]) {
  try {
    const batas = Date.now() - SIMPAN_HARI * 86400_000
    await jalankan('readwrite', (s) => {
      s.put({ tanggal, disimpan: Date.now(), foto } satisfies Entri, kunci(spbuId, tanggal, jenis))
      // Buang foto lama.
      const c = s.openCursor()
      c.onsuccess = () => {
        const cur = c.result
        if (!cur) return
        if ((cur.value as Entri).disimpan < batas) cur.delete()
        cur.continue()
      }
    })
  } catch {
    // Penyimpanan diblokir/penuh: laporan tetap terkirim, hanya kolase gabungan tanpa foto ini.
  }
}

export async function bacaFotoHarian(spbuId: string | null, tanggal: string, jenis: JenisFotoHarian): Promise<FotoHarian[]> {
  try {
    const e = await jalankan<Entri | undefined>('readonly', (s) => s.get(kunci(spbuId, tanggal, jenis)))
    return e?.foto ?? []
  } catch {
    return []
  }
}
