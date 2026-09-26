import { LoaderCircle, RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'

export function Loading({ label = 'Memuat data…' }: { label?: string }) {
  return (
    <GlassCard level={1} role="status" className="flex items-center justify-center gap-space-sm p-space-lg text-body-sm text-on-surface-variant">
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary" />
      {label}
    </GlassCard>
  )
}

export function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <GlassCard level={1} role="alert" className="flex flex-col items-center gap-space-sm bg-error-container/60 p-space-lg text-center">
      <TriangleAlert aria-hidden="true" className="size-6 text-error" />
      <span className="text-body-sm font-semibold text-on-error-container">Gagal memuat data: {error.message}</span>
      <Button variant="glass" size="pill" onClick={onRetry}>
        <RotateCw aria-hidden="true" />
        Coba lagi
      </Button>
    </GlassCard>
  )
}
