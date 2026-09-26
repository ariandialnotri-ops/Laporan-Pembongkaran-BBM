import { CircleCheck, CircleDashed, TriangleAlert } from 'lucide-react'
import { Pill } from '@/components/ui/pill'
import type { QQStatus } from '@/data/mock'

const TONE = { sesuai: 'success', perhatian: 'error', belum: 'neutral' } as const
const ICON = { sesuai: CircleCheck, perhatian: TriangleAlert, belum: CircleDashed }

/** Status reads through an icon and a word as well as colour. */
export function QQPill({ status, label }: { status: QQStatus; label: string }) {
  const Icon = ICON[status]
  return (
    <Pill tone={TONE[status]} className={status === 'perhatian' ? 'variance-pulse' : undefined}>
      <Icon aria-hidden="true" />
      {label}
    </Pill>
  )
}
