import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Grafik ringan (SVG, tanpa pustaka) untuk dashboard HP: batang (besaran per waktu/kategori) dan donat
 * (komposisi). Palet & aturan tanda mengikuti skill dataviz: batang ≤ 24 px dengan ujung membulat 4 px dan
 * dasar rata, celah 2 px warna permukaan antar-segmen, grid samar, label teks memakai warna teks (bukan
 * warna seri), ketuk/hover untuk nilai. Palet kategori tervalidasi (CVD & normal-vision lolos).
 */

/** Warna kategori tetap (urutan tidak diputar). */
export const KATEGORI = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
/** Warna produk untuk grafik (identitas tetap per produk, tervalidasi sebagai satu set). */
export const WARNA_PRODUK: Record<string, string> = {
  Pertalite: '#1baf7a',
  Pertamax: '#2a78d6',
  'Pertamax Turbo': '#e34948',
  Biosolar: '#eda100',
  'Pertamina Dex': '#6250d6',
}
export const warnaProduk = (p: string, i: number) => WARNA_PRODUK[p] ?? KATEGORI[i % KATEGORI.length]
/** Warna status (tidak dipakai untuk seri biasa). */
export const STATUS_WARNA = { baik: '#0ca30c', peringatan: '#fab219', serius: '#ec835a', kritis: '#d03b3b' }

const SURFACE = '#ffffff'

/** Skala sumbu "rapi": 0..maks dibulatkan ke 1/2/5 × 10^n, 4 garis. */
function skala(maks: number) {
  if (maks <= 0) return { atas: 4, langkah: 1 }
  const kasar = maks / 4
  const p = 10 ** Math.floor(Math.log10(kasar))
  const n = kasar / p
  const langkah = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
  return { atas: langkah * 4, langkah }
}
const singkat = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb` : v.toLocaleString('id-ID', { maximumFractionDigits: 1 }))

export interface Batang {
  label: string
  /** Label panjang untuk tooltip, mis. "Kamis, 23 Okt". */
  judul?: string
  value: number
}

/** Grafik batang satu seri (judul kartu menamai serinya, jadi tanpa legenda). */
export function BarChart({ data, warna = KATEGORI[0], satuan = '', format = singkat, tinggi = 180, className, label }: { data: Batang[]; warna?: string; satuan?: string; format?: (v: number) => string; tinggi?: number; className?: string; label: string }) {
  const [aktif, setAktif] = useState<number | null>(null)
  const { atas, langkah } = skala(Math.max(0, ...data.map((d) => d.value)))
  const kiri = 40
  const bawah = 22
  const lebar = 320
  const tPlot = tinggi - bawah - 8
  const band = (lebar - kiri) / Math.max(1, data.length)
  const bw = Math.min(24, Math.max(4, band * 0.62))
  const y = (v: number) => 8 + tPlot - (v / atas) * tPlot
  // Label sumbu-x jarang bila batang banyak.
  const tiap = Math.ceil(data.length / 7)
  const pilih = aktif !== null ? data[aktif] : null
  if (!data.some((d) => d.value > 0))
    return (
      <div className={cn('flex h-28 items-center justify-center rounded-md bg-surface-container-low text-body-sm text-on-surface-variant', className)} role="img" aria-label={`${label}: belum ada data`}>
        Belum ada data pada periode ini
      </div>
    )
  return (
    <div className={cn('relative', className)}>
      <svg viewBox={`0 0 ${lebar} ${tinggi}`} className="w-full" role="img" aria-label={`${label}: ${data.map((d) => `${d.judul ?? d.label} ${format(d.value)}${satuan}`).join(', ')}`} onMouseLeave={() => setAktif(null)}>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={kiri} x2={lebar} y1={y(i * langkah)} y2={y(i * langkah)} stroke="#e3e6ec" strokeDasharray={i ? '3 4' : undefined} strokeWidth={1} />
            <text x={kiri - 6} y={y(i * langkah) + 4} textAnchor="end" className="fill-on-surface-variant text-xs">
              {format(i * langkah)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = kiri + band * i + band / 2
          const h = Math.max(0, y(0) - y(d.value))
          const r = Math.min(4, h, bw / 2)
          const x0 = cx - bw / 2
          const yt = y(d.value)
          return (
            <g key={i} onMouseEnter={() => setAktif(i)} onClick={() => setAktif(aktif === i ? null : i)} className="cursor-pointer">
              <rect x={kiri + band * i} y={8} width={band} height={tPlot} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x0},${y(0)} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x0 + bw - r} Q${x0 + bw},${yt} ${x0 + bw},${yt + r} V${y(0)} Z`}
                  fill={warna}
                  opacity={aktif === null || aktif === i ? 1 : 0.45}
                />
              )}
              {i % tiap === 0 && (
                <text x={cx} y={tinggi - 6} textAnchor="middle" className="fill-on-surface-variant text-xs">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {pilih && (
        <div role="status" className="pointer-events-none absolute right-1 top-0 rounded-md bg-on-surface px-2 py-1 text-xs font-semibold text-surface shadow-md">
          {pilih.judul ?? pilih.label}: {format(pilih.value)}
          {satuan}
        </div>
      )}
    </div>
  )
}

export interface Irisan {
  label: string
  value: number
  warna: string
}

/** Donat komposisi + legenda dengan persentase (identitas tidak hanya warna). */
export function DonutChart({ data, tengah, subTengah, label, format = singkat, satuan = '' }: { data: Irisan[]; tengah?: string; subTengah?: string; label: string; format?: (v: number) => string; satuan?: string }) {
  const [aktif, setAktif] = useState<number | null>(null)
  const isi = data.filter((d) => d.value > 0)
  const total = isi.reduce((a, d) => a + d.value, 0)
  const R = 54
  const t = 18
  const C = 2 * Math.PI * R
  let off = 0
  return (
    <div className="flex items-center gap-space-md">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img" aria-label={`${label}: ${isi.map((d) => `${d.label} ${Math.round((d.value / total) * 100)}%`).join(', ')}`}>
          <circle cx={70} cy={70} r={R} fill="none" stroke="#eef0f4" strokeWidth={t} />
          {total > 0 &&
            isi.map((d, i) => {
              const pjg = (d.value / total) * C
              // Celah 2 px warna permukaan antar-irisan (bukan bila hanya satu irisan).
              const gap = isi.length > 1 ? 2 : 0
              const el = (
                <circle
                  key={d.label}
                  cx={70}
                  cy={70}
                  r={R}
                  fill="none"
                  stroke={d.warna}
                  strokeWidth={aktif === i ? t + 4 : t}
                  strokeDasharray={`${Math.max(0, pjg - gap)} ${C - Math.max(0, pjg - gap)}`}
                  strokeDashoffset={-off}
                  className="cursor-pointer transition-[stroke-width] duration-150"
                  onClick={() => setAktif(aktif === i ? null : i)}
                  onMouseEnter={() => setAktif(i)}
                  onMouseLeave={() => setAktif(null)}
                />
              )
              off += pjg
              return el
            })}
          <circle cx={70} cy={70} r={R - t / 2 - 1} fill={SURFACE} />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="tabular text-headline-md font-bold leading-tight text-on-surface">{aktif !== null && isi[aktif] ? `${Math.round((isi[aktif].value / total) * 100)}%` : (tengah ?? (total ? '100%' : '-'))}</span>
          <span className="max-w-20 truncate text-xs text-on-surface-variant">{aktif !== null && isi[aktif] ? isi[aktif].label : subTengah}</span>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-space-xs">
        {isi.map((d, i) => (
          <li key={d.label}>
            <button type="button" onClick={() => setAktif(aktif === i ? null : i)} className={cn('flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-body-sm', aktif === i && 'bg-surface-container-low')}>
              <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ background: d.warna }} />
              <span className="min-w-0 flex-1 leading-snug text-on-surface">{d.label}</span>
              <span className="tabular shrink-0 font-semibold text-on-surface">{Math.round((d.value / total) * 100)}%</span>
            </button>
            {aktif === i && (
              <span className="tabular block pl-6 text-xs text-on-surface-variant">
                {format(d.value)}
                {satuan}
              </span>
            )}
          </li>
        ))}
        {!isi.length && <li className="text-body-sm text-on-surface-variant">Belum ada data pada periode ini.</li>}
      </ul>
    </div>
  )
}
