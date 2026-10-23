import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AMBANG } from './use-pull-segarkan'

/** Indikator bulat di bawah header; berputar mengikuti tarikan, lalu berputar terus saat menyegarkan. */
export function IndikatorSegarkan({ tarik, sibuk }: { tarik: number; sibuk: boolean }) {
  const siap = tarik >= AMBANG
  const tampil = tarik > 0 || sibuk
  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none fixed left-1/2 top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 flex size-10 -translate-x-1/2 items-center justify-center rounded-full bg-surface shadow-lg ring-1 ring-outline-variant print:hidden',
          !tampil && 'opacity-0',
          tarik === 0 && 'transition-[transform,opacity] duration-200 motion-reduce:transition-none',
        )}
        style={{ transform: `translate(-50%, ${tampil ? Math.max(tarik, sibuk ? AMBANG : 0) - 24 : -24}px)`, opacity: tampil ? Math.min(1, tarik / AMBANG + (sibuk ? 1 : 0)) : 0 }}
      >
        <RefreshCw
          className={cn('size-5', siap || sibuk ? 'text-primary' : 'text-on-surface-variant', sibuk && 'animate-spin motion-reduce:animate-none')}
          style={sibuk ? undefined : { transform: `rotate(${(tarik / AMBANG) * 270}deg)` }}
        />
      </div>
      <span role="status" className="sr-only">
        {sibuk ? 'Menyegarkan data…' : ''}
      </span>
    </>
  )
}
