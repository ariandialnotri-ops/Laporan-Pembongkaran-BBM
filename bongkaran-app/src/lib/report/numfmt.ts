/**
 * Format angka Excel yang dipakai template laporan, ditampilkan dengan
 * pemisah Indonesia (ribuan ".", desimal ",") seperti Excel berbahasa
 * Indonesia. Hanya pola yang ada di template yang didukung.
 */
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export type CellValue = string | number | Date | null

function splitSections(fmt: string) {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < fmt.length; i++) {
    const ch = fmt[i]
    if (ch === '"') q = !q
    if (ch === '\\' && i + 1 < fmt.length) {
      cur += ch + fmt[++i]
      continue
    }
    if (ch === ';' && !q) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

function group(intPart: string) {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Isi literal sebuah bagian format: teks dalam kutip dan karakter ber-backslash. */
function literals(sec: string) {
  let pre = ''
  let post = ''
  let seenDigit = false
  for (let i = 0; i < sec.length; i++) {
    const ch = sec[i]
    if (ch === '"') {
      const end = sec.indexOf('"', i + 1)
      const lit = sec.slice(i + 1, end)
      if (seenDigit) post += lit
      else pre += lit
      i = end
    } else if (ch === '\\') {
      const lit = sec[++i]
      if (seenDigit) post += lit
      else pre += lit
    } else if (ch === '_' || ch === '*') {
      i++ // spasi selebar karakter berikutnya / isi: diabaikan
    } else if ('0#?,.'.includes(ch)) {
      seenDigit = true
    } else if (ch === '(' || ch === ')' || ch === '-') {
      if (seenDigit) post += ch
      else pre += ch
    }
  }
  return { pre, post }
}

function formatNumberSection(value: number, sec: string) {
  const digitsPart = sec.match(/[#0?][#0?,.]*/)?.[0] ?? '0'
  const dot = digitsPart.indexOf('.')
  const decimals = dot >= 0 ? (digitsPart.slice(dot + 1).match(/[0?#]/g) ?? []).length : 0
  const thousands = digitsPart.includes(',')
  const fixed = Math.abs(value).toFixed(decimals)
  const [i, f] = fixed.split('.')
  const body = (thousands ? group(i) : i) + (f ? `,${f}` : '')
  const { pre, post } = literals(sec)
  return `${pre}${body}${post}`
}

function formatDate(d: Date, fmt: string) {
  const pad = (n: number) => String(n).padStart(2, '0')
  const f = fmt.replace(/\\/g, '')
  if (/h+:mm/.test(f)) return `${d.getHours()}:${pad(d.getMinutes())}`
  if (f.includes('mmmm')) return f.replace('mmmm', BULAN[d.getMonth()]).replace('yyyy', String(d.getFullYear())).replace(/\bd\b/, String(d.getDate()))
  return f
    .replace('yyyy', String(d.getFullYear()))
    .replace('yy', String(d.getFullYear()).slice(2))
    .replace('mm', pad(d.getMonth() + 1))
    .replace('dd', pad(d.getDate()))
}

/** Teks tampilan sel; `align` = perataan bawaan Excel untuk perataan "general". */
export function formatCell(value: CellValue, fmt: string): { text: string; align: 'left' | 'right' } {
  if (value === null || value === undefined || value === '') return { text: '', align: 'left' }
  if (value instanceof Date) return { text: formatDate(value, fmt), align: 'right' }
  if (typeof value === 'string') return { text: value, align: 'left' }
  if (!Number.isFinite(value)) return { text: '#NUM!', align: 'right' }
  if (!fmt || fmt === 'General') {
    const r = Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(10)))
    return { text: r.replace('.', ','), align: 'right' }
  }
  if (/[dmyh]/.test(fmt.replace(/"[^"]*"/g, '').replace(/\\./g, '')) && !/[0#]/.test(fmt)) {
    return { text: formatDate(serialToDate(value), fmt), align: 'right' }
  }
  const secs = splitSections(fmt)
  const rounded = Number(value.toFixed(10))
  let sec = secs[0]
  if (rounded < 0 && secs[1] !== undefined) sec = secs[1]
  else if (rounded === 0 && secs[2] !== undefined) sec = secs[2]
  if (rounded === 0 && secs[2] !== undefined && !/[0#]/.test(sec)) {
    const { pre } = literals(sec)
    return { text: pre.trim() || '-', align: 'right' }
  }
  const text = formatNumberSection(value, sec)
  // Bagian negatif tanpa tanda kurung/minus eksplisit: Excel menambahkan "-".
  const neg = rounded < 0 && (secs[1] === undefined || !/[(-]/.test(literals(secs[1]).pre))
  return { text: neg ? `-${text}` : text, align: 'right' }
}

/** Nomor seri tanggal Excel (sistem 1900). */
export function dateToSerial(d: Date) {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return utc / 86400000 + 25569
}

export function serialToDate(n: number) {
  const ms = Math.round((n - 25569) * 86400000)
  const u = new Date(ms)
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate())
}
