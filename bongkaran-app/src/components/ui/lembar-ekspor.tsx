import { useEffect, useState, useSyncExternalStore } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BadgeCheck, FileDown, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { eksporStore } from '@/lib/ekspor'
import { cn } from '@/lib/utils'

const R = 52
const KELILING = 2 * Math.PI * R

/**
 * Lembar bawah global saat membuat / mengunduh file: cincin persentase, bilah progres, tahap yang sedang
 * dikerjakan, dan lama berjalan. Persentase tampil merambat pelan di antara laporan tahap nyata (tidak
 * pernah mundur, berhenti sebelum 100% sampai file benar-benar jadi).
 */
export function LembarEkspor() {
  const k = useSyncExternalStore(eksporStore.subscribe, eksporStore.get)
  const [tampil, setTampil] = useState(0)
  const [detik, setDetik] = useState(0)

  useEffect(() => {
    if (k.fase === 'diam') {
      setTampil(0)
      return
    }
    setTampil((d) => Math.max(d, k.persen))
    if (k.fase !== 'proses') {
      if (k.fase === 'sukses') setTampil(100)
      return
    }
    const t = setInterval(() => {
      setTampil((d) => {
        // Laporan nyata langsung dipakai (transisi CSS menghaluskan); sesudahnya merambat menuju batas di bawah tahap berikutnya.
        if (d < k.persen) return k.persen
        const batas = Math.min(97, k.persen + (100 - k.persen) * 0.4)
        return d < batas ? d + Math.max(0.04, (batas - d) * 0.015) : d
      })
      setDetik(Math.floor((Date.now() - k.mulai) / 1000))
    }, 80)
    return () => clearInterval(t)
  }, [k.fase, k.persen, k.mulai])

  const buka = k.fase !== 'diam'
  const persen = Math.floor(tampil)
  const warna = k.fase === 'gagal' ? 'text-error' : k.fase === 'sukses' ? 'text-emerald-500' : 'text-primary'

  return (
    <Dialog.Root open={buka} onOpenChange={(o) => !o && k.fase !== 'proses' && eksporStore.tutup()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[87] bg-on-surface/35" />
        <Dialog.Content
          onEscapeKeyDown={(e) => k.fase === 'proses' && e.preventDefault()}
          onPointerDownOutside={(e) => k.fase === 'proses' && e.preventDefault()}
          className="sheet-content fixed inset-x-0 bottom-0 z-[88] mx-auto flex w-full max-w-xl flex-col items-center rounded-t-3xl px-space-lg pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-2 text-center focus:outline-none"
        >
          <div aria-hidden="true" className="mb-space-md h-1.5 w-10 rounded-full bg-outline-variant" />
          <div className={cn('relative mb-space-sm flex size-32 items-center justify-center', warna)}>
            <svg aria-hidden="true" viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-90">
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="9" className="stroke-surface-container-high" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                strokeWidth="9"
                strokeLinecap="round"
                stroke="currentColor"
                strokeDasharray={KELILING}
                strokeDashoffset={KELILING * (1 - (k.fase === 'gagal' ? Math.max(tampil, 4) : tampil) / 100)}
                className="transition-[stroke-dashoffset] duration-150 ease-out"
              />
            </svg>
            {k.fase === 'sukses' ? (
              <BadgeCheck aria-hidden="true" className="ikon-sukses size-14" strokeWidth={1.5} fill="currentColor" stroke="white" />
            ) : k.fase === 'gagal' ? (
              <TriangleAlert aria-hidden="true" className="size-12" strokeWidth={1.8} />
            ) : (
              <span className="flex flex-col items-center">
                <FileDown aria-hidden="true" className="ekspor-ikon size-6 opacity-80" />
                <span className="tabular text-[1.75rem] font-extrabold leading-none text-on-surface">
                  {persen}
                  <span className="text-body-md font-bold text-on-surface-variant">%</span>
                </span>
              </span>
            )}
          </div>
          <Dialog.Title className="text-headline-md font-bold text-on-surface">
            {k.fase === 'sukses' ? `${k.judul.replace(/^Membuat /, '')} berhasil dibuat` : k.fase === 'gagal' ? 'Gagal membuat file' : k.judul}
          </Dialog.Title>
          <Dialog.Description className="mt-1 min-h-5 text-body-md text-on-surface-variant" aria-live="polite">
            {k.fase === 'gagal' ? k.pesan || 'Terjadi kesalahan. Coba ulangi.' : k.tahap}
          </Dialog.Description>
          <div
            role="progressbar"
            aria-label={k.judul}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={persen}
            className="relative mt-space-md h-2.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-container-high"
          >
            <div
              className={cn('h-full rounded-full transition-[width] duration-150 ease-out', k.fase === 'gagal' ? 'bg-error' : k.fase === 'sukses' ? 'bg-emerald-500' : 'bg-gradient-to-r from-sky-500 to-primary')}
              style={{ width: `${k.fase === 'gagal' ? Math.max(tampil, 4) : tampil}%` }}
            />
            {k.fase === 'proses' && <div aria-hidden="true" className="ekspor-kilau absolute inset-y-0 w-16" />}
          </div>
          {k.fase === 'proses' ? (
            <span className="tabular mt-space-xs text-xs text-on-surface-variant">
              {persen}% · berjalan {detik} dtk · jangan tutup aplikasi
            </span>
          ) : (
            <Button className="mt-space-md min-w-36 rounded-full bg-on-surface text-surface hover:bg-on-surface/90" onClick={eksporStore.tutup} autoFocus>
              {k.fase === 'gagal' ? 'Tutup' : 'Oke'}
            </Button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
