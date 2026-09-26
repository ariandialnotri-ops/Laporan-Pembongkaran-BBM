const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const
const HARI_SINGKAT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'] as const

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Monday 00:00 local of the week containing `d`. */
export function startOfWeek(d: Date) {
  const day = startOfDay(d)
  const offset = (day.getDay() + 6) % 7
  day.setDate(day.getDate() - offset)
  return day
}

export function addDays(d: Date, n: number) {
  const next = new Date(d)
  next.setDate(d.getDate() + n)
  return next
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatTanggalPanjang(d: Date) {
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

export function formatBulanTahun(d: Date) {
  return `${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

export function formatTanggalSingkat(d: Date) {
  return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

export function hariSingkat(d: Date) {
  return HARI_SINGKAT[d.getDay()]
}

function jam(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

/** "Hari ini, 07.40" / "Kemarin, 16.20" / "24 Sep 2026, 09.10". */
export function formatWaktuRelatif(iso: string, now = new Date()) {
  const d = new Date(iso)
  const kemarin = new Date(now)
  kemarin.setDate(now.getDate() - 1)
  if (sameDay(d, now)) return `Hari ini, ${jam(d)}`
  if (sameDay(d, kemarin)) return `Kemarin, ${jam(d)}`
  return `${formatTanggalSingkat(d)}, ${jam(d)}`
}

/** Value for <input type="datetime-local"> in local time. */
export function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function greeting(d: Date) {
  const h = d.getHours()
  if (h < 11) return 'Selamat Pagi'
  if (h < 15) return 'Selamat Siang'
  if (h < 19) return 'Selamat Sore'
  return 'Selamat Malam'
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "2026-09-26" (tanggal lokal). */
export function todayIso(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** "14:05" (jam lokal). */
export function nowHm(d = new Date()) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** "2026-09-26" -> "26 Sep 2026"; kosong -> "-". */
export function formatTanggalIso(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : formatTanggalSingkat(d)
}

/** Selisih menit dari jam "HH:MM" a ke b; melewati tengah malam dianggap hari berikutnya. */
export function minutesBetween(a: string, b: string) {
  if (!a || !b) return null
  const [ah, am] = a.split(':').map(Number)
  const [bh, bm] = b.split(':').map(Number)
  if ([ah, am, bh, bm].some((x) => !Number.isFinite(x))) return null
  let diff = bh * 60 + bm - (ah * 60 + am)
  if (diff < 0) diff += 24 * 60
  return diff
}
