import type { Report, StepId } from '@/lib/sop'

/**
 * Cadangan draft di perangkat untuk mode Supabase. Ditulis seketika pada
 * setiap perubahan dan dihapus setelah server mengonfirmasi simpan, sehingga
 * isian tidak hilang bila Safari memuat ulang halaman (mis. saat kamera
 * dibuka) sebelum data sempat terkirim.
 */
const draftKey = (id: string) => `pantas:draft:${id}`
const stepKey = (id: string) => `pantas:step:${id}`

export function writeBackup(report: Report) {
  try {
    localStorage.setItem(draftKey(report.id), JSON.stringify(report))
  } catch {
    // Penyimpanan penuh atau diblokir: tetap lanjut, server tetap menerima data.
  }
}

export function readBackup(id: string): Report | null {
  try {
    const raw = localStorage.getItem(draftKey(id))
    return raw ? (JSON.parse(raw) as Report) : null
  } catch {
    return null
  }
}

/** Hapus cadangan bila isinya sudah sama dengan yang baru tersimpan di server. */
export function clearBackup(id: string, savedUpdatedAt?: number) {
  try {
    if (savedUpdatedAt !== undefined && readBackup(id)?.updatedAt !== savedUpdatedAt) return
    localStorage.removeItem(draftKey(id))
  } catch {
    // abaikan
  }
}

export function readStep(id: string): StepId | 'finish' | null {
  try {
    return sessionStorage.getItem(stepKey(id)) as StepId | 'finish' | null
  } catch {
    return null
  }
}

export function writeStep(id: string, step: StepId | 'finish') {
  try {
    sessionStorage.setItem(stepKey(id), step)
  } catch {
    // abaikan
  }
}
