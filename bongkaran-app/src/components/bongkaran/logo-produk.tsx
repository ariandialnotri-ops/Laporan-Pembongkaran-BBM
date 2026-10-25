import biosolar from '@/assets/produk/biosolar.svg'
import pertalite from '@/assets/produk/pertalite.svg'
import pertamaxTurbo from '@/assets/produk/pertamax-turbo.svg'
import pertamax from '@/assets/produk/pertamax.svg'
import pertaminaDex from '@/assets/produk/pertamina-dex.svg'
import { produkMeta } from '@/lib/produk'
import { cn } from '@/lib/utils'

/** Logo produk BBM (SVG dari pengguna, sudah dipangkas & dikecilkan). */
const LOGO: Record<string, string> = {
  Pertalite: pertalite,
  Pertamax: pertamax,
  'Pertamax Turbo': pertamaxTurbo,
  Biosolar: biosolar,
  'Pertamina Dex': pertaminaDex,
}

/**
 * Kotak logo produk berlatar putih (seperti aplikasi MyPertamina): logo dimuat utuh sesuai rasio.
 * Sudut 8 px: sejajar (konsentris) dengan sudut kartu 16 px dikurangi padding 8 px.
 * Produk tanpa logo memakai kode produk berwarna (PLT, PMX, …).
 */
export function LogoProduk({ produk, className }: { produk: string; className?: string }) {
  const src = LOGO[produk]
  const meta = produkMeta(produk)
  return (
    <span className={cn('logo-produk flex shrink-0 items-center justify-center overflow-hidden rounded-[0.5rem] bg-white p-2 shadow-sm ring-1 ring-outline-variant/50', className)}>
      {src ? (
        <img src={src} alt={produk} decoding="async" draggable={false} className="max-h-full max-w-full object-contain" />
      ) : (
        <span className={cn('tabular rounded-md px-2 py-1 text-body-sm font-extrabold', meta.tile)}>{produk ? meta.kode : 'BBM'}</span>
      )}
    </span>
  )
}
