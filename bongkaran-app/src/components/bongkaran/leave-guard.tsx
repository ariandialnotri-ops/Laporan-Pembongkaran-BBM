import { useRef, useState, type ReactNode } from 'react'
import { useBlocker } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'

/**
 * Konfirmasi sebelum meninggalkan form (tombol kembali, menu dock, atau tautan lain).
 * `bypass()` dipakai untuk perpindahan yang memang disengaja, mis. setelah hapus.
 */
export function useLeaveGuard({ active, title, detail, beforeLeave }: { active: boolean; title: string; detail: ReactNode; beforeLeave?: () => Promise<unknown> | void }) {
  const lewati = useRef(false)
  const [keluar, setKeluar] = useState(false)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => active && !lewati.current && currentLocation.pathname !== nextLocation.pathname)
  const open = blocker.state === 'blocked'

  const dialog = (
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
  )

  return {
    dialog,
    bypass: () => {
      lewati.current = true
    },
  }
}
