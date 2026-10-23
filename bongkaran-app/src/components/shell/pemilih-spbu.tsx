import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, ChevronDown, LayoutGrid, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Sheet } from '@/components/ui/sheet'
import { useApp } from '@/lib/app-state'
import { cn } from '@/lib/utils'

/**
 * Nama SPBU aktif di header. Untuk ABH dengan beberapa unit bisnis, ketuk untuk berpindah SPBU
 * (seperti pemilih SPBU di aplikasi Monitoring JBT).
 */
export function PemilihSpbu() {
  const app = useApp()
  const [buka, setBuka] = useState(false)
  const [cari, setCari] = useState('')
  const nama = app.settings.namaSpbu || app.spbu?.nama || 'SPBU'
  if (!app.isAdmin) return <span className="truncate text-tag uppercase text-primary">{nama}</span>

  const q = cari.trim().toLowerCase()
  const daftar = app.spbuList.filter((s) => !q || s.nama.toLowerCase().includes(q) || (s.kode ?? '').toLowerCase().includes(q))
  return (
    <>
      <button
        type="button"
        onClick={() => (setCari(''), setBuka(true))}
        aria-label={`SPBU aktif: ${nama}. Ganti SPBU`}
        className="flex min-w-0 items-center gap-0.5 text-left text-tag uppercase text-primary"
      >
        <span className="truncate">{nama}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
      <Sheet open={buka} onOpenChange={setBuka} title="Pilih SPBU" description={`${app.spbuList.length} unit bisnis yang Anda kendalikan`}>
        {app.spbuList.length > 6 && (
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
            <Input aria-label="Cari SPBU" placeholder="Cari nama atau kode SPBU" className="pl-9" value={cari} onChange={(e) => setCari(e.target.value)} />
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {daftar.map((s) => {
            const aktif = s.id === app.spbuId
            return (
              <li key={s.id}>
                <button
                  type="button"
                  aria-current={aktif ? 'true' : undefined}
                  onClick={() => (app.pilihSpbu(s.id), setBuka(false))}
                  className={cn('flex min-h-14 w-full items-center gap-space-sm rounded-md px-space-sm py-space-xs text-left transition-colors', aktif ? 'bg-primary/10' : 'hover:bg-surface-container-low')}
                >
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                    <Building2 className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-md font-semibold text-on-surface">{s.nama || 'SPBU tanpa nama'}</span>
                    <span className="tabular text-body-sm text-on-surface-variant">{s.kode || 'Kode belum diisi'}</span>
                  </span>
                  {aktif && <Check aria-hidden="true" className="size-5 shrink-0 text-primary" />}
                </button>
              </li>
            )
          })}
          {daftar.length === 0 && <li className="p-space-sm text-center text-body-sm text-on-surface-variant">Tidak ada SPBU yang cocok.</li>}
        </ul>
        <Link to="/unit" onClick={() => setBuka(false)} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-surface-container-low text-body-md font-semibold text-primary">
          <LayoutGrid aria-hidden="true" className="size-4" />
          Dashboard unit bisnis & tambah SPBU
        </Link>
      </Sheet>
    </>
  )
}
