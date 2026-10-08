/**
 * Identitas produk untuk kartu kaleng sample: kode label kaleng, spesifikasi,
 * dan warna produk Pertamina (hanya untuk ikon, chip, dan isi kaleng).
 */
export type ProdukMeta = { kode: string; spek: string; tile: string; chip: string; isi: string; garis: string; dot: string; teks: string }

const META: Record<string, ProdukMeta> = {
  Pertalite: { kode: 'PLT', spek: 'RON 90', tile: 'bg-emerald-100 text-emerald-700', chip: 'border-emerald-300 bg-emerald-50 text-emerald-800', isi: 'bg-emerald-300/70', garis: 'border-emerald-500', dot: 'bg-emerald-500', teks: 'text-emerald-700' },
  Pertamax: { kode: 'PMX', spek: 'RON 92', tile: 'bg-sky-100 text-sky-700', chip: 'border-sky-300 bg-sky-50 text-sky-800', isi: 'bg-sky-300/70', garis: 'border-sky-500', dot: 'bg-sky-500', teks: 'text-sky-700' },
  'Pertamax Turbo': { kode: 'PMT', spek: 'RON 98', tile: 'bg-red-100 text-red-700', chip: 'border-red-300 bg-red-50 text-red-800', isi: 'bg-red-300/60', garis: 'border-red-500', dot: 'bg-red-500', teks: 'text-red-700' },
  Biosolar: { kode: 'SOL', spek: 'CN 48', tile: 'bg-amber-100 text-amber-700', chip: 'border-amber-300 bg-amber-50 text-amber-800', isi: 'bg-amber-300/70', garis: 'border-amber-500', dot: 'bg-amber-500', teks: 'text-amber-700' },
  'Pertamina Dex': { kode: 'DEX', spek: 'CN 53', tile: 'bg-teal-100 text-teal-700', chip: 'border-teal-300 bg-teal-50 text-teal-800', isi: 'bg-teal-300/70', garis: 'border-teal-500', dot: 'bg-teal-500', teks: 'text-teal-700' },
}

const FALLBACK: ProdukMeta = { kode: 'BBM', spek: '', tile: 'bg-primary-fixed text-primary', chip: 'border-outline-variant bg-surface-container-low text-on-surface', isi: 'bg-primary-fixed', garis: 'border-primary', dot: 'bg-primary', teks: 'text-primary' }

export const produkMeta = (produk: string) => META[produk] ?? FALLBACK
