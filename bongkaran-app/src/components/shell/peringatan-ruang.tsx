import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { HardDrive, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Sisa ruang (MB) di bawah batas ini: peringatan oranye; di bawah KRITIS: merah. */
const BATAS_MB = 300
const KRITIS_MB = 100
const KUNCI_TUTUP = 'floq:ruang-ditutup'

type Tingkat = 'cukup' | 'menipis' | 'kritis'

/**
 * Perkiraan sisa ruang penyimpanan HP untuk aplikasi ini (navigator.storage.estimate).
 * Browser membatasi kuota situs sesuai ruang kosong HP, jadi kuota yang hampir habis berarti
 * HP hampir penuh. null = browser tidak mendukung.
 */
async function sisaRuangMb(): Promise<number | null> {
  try {
    const est = await navigator.storage?.estimate?.()
    if (!est?.quota) return null
    return Math.max(0, (est.quota - (est.usage ?? 0)) / 1024 / 1024)
  } catch {
    return null
  }
}

const tingkatDari = (mb: number | null): Tingkat => (mb === null || mb >= BATAS_MB ? 'cukup' : mb < KRITIS_MB ? 'kritis' : 'menipis')

function bacaTutup(): Tingkat | null {
  try {
    return sessionStorage.getItem(KUNCI_TUTUP) as Tingkat | null
  } catch {
    return null
  }
}

/**
 * Peringatan memori HP hampir penuh, dicek setiap pindah halaman (mis. saat membuka form).
 * Ditutup berlaku sampai aplikasi dibuka ulang, kecuali keadaan memburuk menjadi kritis.
 */
export function PeringatanRuang() {
  const { pathname } = useLocation()
  const [mb, setMb] = useState<number | null>(null)
  const [tutup, setTutup] = useState<Tingkat | null>(bacaTutup)

  useEffect(() => {
    let batal = false
    void sisaRuangMb().then((v) => !batal && setMb(v))
    return () => {
      batal = true
    }
  }, [pathname])

  const tingkat = tingkatDari(mb)
  if (tingkat === 'cukup' || tutup === tingkat || tutup === 'kritis') return null
  const kritis = tingkat === 'kritis'
  const tutupSekarang = () => {
    setTutup(tingkat)
    try {
      sessionStorage.setItem(KUNCI_TUTUP, tingkat)
    } catch {
      // abaikan
    }
  }

  return (
    <div
      role="alert"
      className={cn(
        'animate-entrance-1 mb-space-md flex items-start gap-space-sm rounded-lg p-space-md shadow-sm ring-1',
        kritis ? 'bg-error-container/80 text-on-error-container ring-error/40' : 'bg-amber-50 text-amber-900 ring-amber-300',
      )}
    >
      <HardDrive aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', kritis ? 'text-error' : 'text-amber-600')} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body-md font-bold">{kritis ? 'Memori HP hampir habis' : 'Memori HP menipis'}</span>
        <span className="text-body-sm">
          Sisa ruang untuk aplikasi sekitar {Math.round(mb ?? 0)} MB. {kritis ? 'Foto bukti bisa gagal diambil atau disimpan.' : 'Foto bukti bisa gagal bila memori habis.'} Hapus foto, video, atau file WhatsApp lama di HP sebelum mengisi form. Jangan hapus data situs FLOQ selama masih ada form yang belum selesai.
        </span>
      </span>
      <button type="button" aria-label="Tutup peringatan memori" onClick={tutupSekarang} className="touch-44 -m-1 flex size-8 shrink-0 items-center justify-center rounded-full">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
