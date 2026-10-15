import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useBlocker, useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { tandaiForm } from '@/components/shell/kembali'
import { lepasKunciGulir } from '@/components/shell/viewport'

/** Menandai bahwa dialog konfirmasi benar-benar tampil di halaman. */
function Terpasang({ tanda, children }: { tanda: RefObject<boolean>; children: ReactNode }) {
  useEffect(() => {
    tanda.current = true
    return () => {
      tanda.current = false
    }
  }, [tanda])
  return children
}

/**
 * Konfirmasi sebelum meninggalkan form (panah kembali, sidebar, bar bawah, atau tautan lain).
 * `bypass()` dipakai untuk perpindahan yang memang disengaja, mis. setelah kirim atau hapus.
 * `izinkan(path)` = tujuan yang tidak perlu konfirmasi (mis. halaman turunan form yang sama).
 */
export function useLeaveGuard({
  active,
  title,
  detail,
  beforeLeave,
  izinkan,
}: {
  active: boolean
  title: string
  detail: ReactNode
  beforeLeave?: () => Promise<unknown> | void
  izinkan?: (pathname: string) => boolean
}) {
  const { pathname } = useLocation()
  useEffect(() => {
    if (active) tandaiForm(pathname)
  }, [active, pathname])
  const lewati = useRef(false)
  // Hanya memblokir bila {guard.dialog} dirender: halaman yang tidak menampilkan dialog (mis. layar
  // "tidak berhak" atau "memuat") tidak boleh membuat tombol kembali macet tanpa konfirmasi.
  const terpasang = useRef(false)
  const [keluar, setKeluar] = useState(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => active && terpasang.current && !lewati.current && currentLocation.pathname !== nextLocation.pathname && !izinkan?.(nextLocation.pathname))
  const open = blocker.state === 'blocked'

  const dialog = (
    <Terpasang tanda={terpasang}>
      <Sheet open={open} onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()} title={title} description={detail}>
        <div className="flex flex-col gap-space-xs">
          <Button
            size="lg"
            variant="danger"
            disabled={keluar}
            onClick={async () => {
              setKeluar(true)
              try {
                await beforeLeave?.()
              } finally {
                setKeluar(false)
                if (blocker.state === 'blocked') blocker.proceed()
                // iOS: pastikan kunci gulir/sentuh dari dialog tidak tertinggal di halaman tujuan.
                lepasKunciGulir()
              }
            }}
          >
            <LogOut aria-hidden="true" />
            Ya, keluar
          </Button>
          <Button size="lg" variant="glass" onClick={() => blocker.state === 'blocked' && blocker.reset()}>
            Tetap di sini
          </Button>
        </div>
      </Sheet>
    </Terpasang>
  )

  return {
    dialog,
    bypass: () => {
      lewati.current = true
    },
  }
}
