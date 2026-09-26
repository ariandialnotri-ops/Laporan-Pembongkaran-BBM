/**
 * Indonesian number formatting, written by hand rather than via Intl so every
 * browser renders the same separators. Thousands ".", decimal ",".
 * Ported from Tepat Setoran SPBU.
 */

function groupThousands(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function formatDecimal(value: number, fractionDigits: number) {
  const safe = Number.isFinite(value) ? value : 0
  const negative = safe < 0
  const [whole, fraction] = Math.abs(safe).toFixed(fractionDigits).split('.')
  const body = fraction ? `${groupThousands(whole)},${fraction}` : groupThousands(whole)
  return negative ? `-${body}` : body
}

export function formatNumber(value: number, fractionDigits = 0) {
  return formatDecimal(value, fractionDigits)
}

/** `24500` -> `"24.500 L"`. */
export function formatLiter(value: number, fractionDigits = 0) {
  return `${formatDecimal(value, fractionDigits)} L`
}

/** Signed figure for selisih readouts: `"+12 L"`, `"-0,40%"`. */
export function formatSigned(value: number, fractionDigits = 0, suffix = '') {
  const body = formatDecimal(Math.abs(value), fractionDigits)
  if (Number(body.replace(/\./g, '').replace(',', '.')) === 0) return `${body}${suffix}`
  return `${value > 0 ? '+' : '-'}${body}${suffix}`
}

/**
 * Parses what an operator actually types. Accepts both separator habits —
 * "742,5" and "742.5" — and tolerates thousand dots ("8.000").
 * Returns null when the text is not a usable number.
 */
export function parseAngka(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  const lastComma = trimmed.lastIndexOf(',')
  const lastDot = trimmed.lastIndexOf('.')
  let normalised: string
  if (lastComma > lastDot) {
    normalised = trimmed.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    const decimals = trimmed.length - lastDot - 1
    normalised = lastComma === -1 && decimals === 3 ? trimmed.replace(/\./g, '') : trimmed.replace(/,/g, '')
  } else {
    normalised = trimmed
  }

  if (!/^-?\d*\.?\d*$/.test(normalised)) return null
  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

/** Density 4 desimal: `0.7567` -> `"0,7567"`, null -> `"-"`. */
export function formatDensity(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return formatDecimal(value, 4)
}

/** Selisih density bertanda: `"+0,0006"`. */
export function formatDensitySigned(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return formatSigned(value, 4)
}

/** Angka opsional: null/NaN -> `"-"`. */
export function formatMaybe(value: number | null | undefined, fractionDigits = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'
  return formatDecimal(value, fractionDigits)
}
