import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'

export type Col<T> = {
  header: string
  cell: (row: T) => ReactNode
  /** Isi pengganti di kartu HP (mis. teks polos untuk judul). */
  mobileCell?: (row: T) => ReactNode
  align?: 'right'
  /** Peran di kartu HP: judul, baris keterangan, lencana kanan, atau disembunyikan. */
  mobile?: 'title' | 'sub' | 'badge' | 'hide'
  /** false: hanya untuk kartu HP (mis. gabungan beberapa kolom). */
  desktop?: boolean
  className?: string
}

/**
 * Riwayat dalam bentuk tabel rekap (layar lebar) atau kartu (HP), dari definisi kolom yang sama.
 * Judul dan jumlah baris tampil di atas, seperti lembar rekap transaksi.
 */
export function RecordTable<T>({
  title,
  rows,
  total,
  cols,
  rowKey,
  to,
  empty,
}: {
  title: string
  rows: T[]
  /** Jumlah sebelum disaring, untuk "n dari total". */
  total: number
  cols: Col<T>[]
  rowKey: (row: T) => string
  to?: (row: T) => string
  empty: string
}) {
  const navigate = useNavigate()
  const titleCols = cols.filter((c) => c.mobile === 'title')
  const subCols = cols.filter((c) => c.mobile === 'sub')
  const badgeCol = cols.find((c) => c.mobile === 'badge')
  const tableCols = cols.filter((c) => c.desktop !== false)

  return (
    <GlassCard level={1} className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-space-sm border-b border-outline-variant/50 px-space-md py-space-sm">
        <h2 className="text-body-md font-bold uppercase tracking-wide text-on-surface">{title}</h2>
        <span className="tabular rounded-full border border-primary/30 bg-primary-fixed/60 px-3 py-0.5 text-body-sm font-semibold text-primary">
          {rows.length} dari {total}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="p-space-md text-center text-body-sm text-on-surface-variant">{empty}</p>
      ) : (
        <>
          {/* HP */}
          <ul className="divide-y divide-outline-variant/40 md:hidden">
            {rows.map((row) => {
              const body = (
                <div className="flex items-center gap-space-sm px-space-sm py-space-sm">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body-md font-semibold text-on-surface">
                      {titleCols.map((c, i) => (
                        <span key={c.header}>
                          {i > 0 && ', '}
                          {(c.mobileCell ?? c.cell)(row)}
                        </span>
                      ))}
                    </span>
                    {subCols.map((c) => (
                      <span key={c.header} className="tabular truncate text-body-sm text-on-surface-variant">
                        <span className="sr-only">{c.header}: </span>
                        {c.cell(row)}
                      </span>
                    ))}
                  </div>
                  {badgeCol && <span className="shrink-0">{badgeCol.cell(row)}</span>}
                  {to && <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />}
                </div>
              )
              return <li key={rowKey(row)}>{to ? <Link to={to(row)}>{body}</Link> : body}</li>
            })}
          </ul>

          {/* Layar lebar */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-body-sm">
              <thead className="bg-surface-container-low/70">
                <tr className="text-tag uppercase text-on-surface-variant">
                  {tableCols.map((c) => (
                    <th key={c.header} scope="col" className={cn('whitespace-nowrap px-space-sm py-space-sm font-semibold first:pl-space-md', c.align === 'right' && 'text-right')}>
                      {c.header}
                    </th>
                  ))}
                  {to && (
                    <th scope="col" className="px-space-md py-space-sm text-right font-semibold">
                      Aksi
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/40">
                {rows.map((row) => (
                  <tr key={rowKey(row)} onClick={to ? () => navigate(to(row)) : undefined} className={cn(to && 'cursor-pointer transition-colors hover:bg-primary-fixed/30')}>
                    {tableCols.map((c) => (
                      <td key={c.header} className={cn('px-space-sm py-space-sm text-on-surface first:pl-space-md', c.align === 'right' && 'tabular text-right', c.className)}>
                        {c.cell(row)}
                      </td>
                    ))}
                    {to && (
                      <td className="px-space-md py-space-sm text-right">
                        <Link
                          to={to(row)}
                          aria-label="Buka"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex size-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-lowest hover:text-primary"
                        >
                          <ChevronRight aria-hidden="true" className="size-5" />
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </GlassCard>
  )
}

/** Chip produk seperti kolom BBM pada lembar rekap. */
export function ProdukChip({ produk }: { produk: string }) {
  return <span className="whitespace-nowrap rounded-sm bg-surface-container-lowest px-2 py-1 text-body-sm font-semibold text-on-surface shadow-sm">{produk || '-'}</span>
}
