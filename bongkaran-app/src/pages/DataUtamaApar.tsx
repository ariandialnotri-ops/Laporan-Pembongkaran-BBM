import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapPin, Plus, QrCode, Settings2, Trash2, Wand2 } from 'lucide-react'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { RecordTable, type Col } from '@/components/bongkaran/record-table'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { DEFAULT_AREAS, kodeBerikut, lokasiOptions, namaPulau, statusKedaluwarsa, tipeLabel, unitBaru, type AparTipe, type AparUnit } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { cn } from '@/lib/utils'

type Row = { u: AparUnit; tipe: AparTipe }
type Saring = 'semua' | 'apar' | 'cadangan' | 'apab'

const COLS: Col<Row>[] = [
  { header: 'Kode', cell: (x) => <span className="tabular font-semibold">{x.u.kode || '-'}</span>, mobileCell: (x) => `${x.u.kode || '-'} (${tipeLabel(x.tipe, x.u.cadangan)})`, mobile: 'title' },
  { header: 'Tipe', cell: (x) => tipeLabel(x.tipe, x.u.cadangan), mobile: 'hide' },
  { header: 'Jenis & kapasitas', cell: (x) => <span className="whitespace-nowrap">{`${x.u.jenis}, ${x.u.kapasitasKg || '-'} kg`}</span>, mobile: 'sub' },
  { header: 'Lokasi', cell: (x) => x.u.lokasi || <span className="italic text-on-surface-variant">belum diatur</span>, mobile: 'sub' },
  {
    header: 'Isi ulang',
    cell: (x) => {
      const st = statusKedaluwarsa(x.u.kedaluwarsa, todayIso())
      if (!st) return <span className="text-on-surface-variant">belum diatur</span>
      return <span className={cn('tabular whitespace-nowrap', st === 'lewat' ? 'font-semibold text-error' : st === 'segera' ? 'font-semibold text-amber-700' : '')}>{formatTanggalIso(x.u.kedaluwarsa)}</span>
    },
    mobile: 'sub',
  },
  {
    header: 'Status',
    cell: (x) => {
      const st = statusKedaluwarsa(x.u.kedaluwarsa, todayIso())
      return st === 'lewat' ? <Pill tone="error">Isi ulang lewat</Pill> : st === 'segera' ? <Pill>Isi ulang ≤ 30 hari</Pill> : null
    },
    mobile: 'badge',
  },
]

/**
 * APAR & APAB > Data utama: daftar unit dan area yang sudah tersimpan.
 * Tambah/ubah unit lewat halaman form terpisah; area lewat bottom sheet.
 */
export function DataUtamaApar() {
  const app = useApp()
  const navigate = useNavigate()
  const toast = useToast()
  const [saring, setSaring] = useState<Saring>('semua')
  const [areaOpen, setAreaOpen] = useState(false)
  if (!app.loaded) return <Loading />

  const s = app.settings
  const ubah = app.isAdmin
  const pulau = s.jumlahPulau ?? 0
  const areas = s.aparArea ?? DEFAULT_AREAS
  const apar = s.apar ?? []
  const apab = s.apab ?? []
  const semua: Row[] = [...apar.map((u) => ({ u, tipe: 'apar' as const })), ...apab.map((u) => ({ u, tipe: 'apab' as const }))]
  const rows = semua.filter((x) => (saring === 'apar' ? x.tipe === 'apar' && !x.u.cadangan : saring === 'cadangan' ? x.u.cadangan : saring === 'apab' ? x.tipe === 'apab' : true))
  const dipakai = (l: string) => semua.filter((x) => x.u.lokasi === l).length
  const pulauTanpaApar = Array.from({ length: pulau }, (_, i) => namaPulau(i + 1)).filter((l) => !apar.some((u) => u.lokasi === l))

  // Isi cepat: satu APAR di tiap pulau pompa yang belum punya APAR.
  const isiPerPulau = () => {
    const baru: AparUnit[] = []
    for (const l of pulauTanpaApar) baru.push(unitBaru('apar', kodeBerikut('apar', [...apar, ...baru]), l))
    app.updateSettings({ apar: [...apar, ...baru] })
    toast(`${baru.length} APAR ditambahkan, satu per pulau pompa`)
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="grid grid-cols-2 gap-space-xs sm:grid-cols-4">
          <Ringkas label="Pulau pompa" value={pulau} />
          <Ringkas label="APAR terpasang" value={apar.filter((u) => !u.cadangan).length} />
          <Ringkas label="APAR cadangan" value={apar.filter((u) => u.cadangan).length} />
          <Ringkas label="APAB" value={apab.length} />
        </div>
        {!ubah && <span className="text-body-sm text-on-surface-variant">Data utama hanya dapat diubah ABH.</span>}
        {ubah && (
          <div className="grid grid-cols-2 gap-space-xs">
            <Link to="/apar/data/unit/baru" className={cn(buttonVariants({ size: 'lg' }), 'col-span-2')}>
              <Plus aria-hidden="true" />
              Tambah APAR / APAB
            </Link>
            <Link to="/apar/label" className={buttonVariants({ variant: 'glass' })}>
              <QrCode aria-hidden="true" />
              Label QR
            </Link>
            <Link to="/pengaturan" className={buttonVariants({ variant: 'glass' })}>
              <Settings2 aria-hidden="true" />
              Jumlah pulau
            </Link>
            {pulauTanpaApar.length > 0 && (
              <Button variant="soft" size="sm" className="col-span-2" onClick={isiPerPulau}>
                <Wand2 aria-hidden="true" />
                Tambah 1 APAR di {pulauTanpaApar.length} pulau yang belum punya
              </Button>
            )}
          </div>
        )}
      </GlassCard>

      <section aria-labelledby="apar-unit" className="animate-entrance-2 flex flex-col gap-space-xs">
        <SectionHeader id="apar-unit" title="Unit tersimpan" />
        <ChipFilter
          label="Saring unit"
          value={saring}
          onChange={setSaring}
          options={[
            { value: 'semua' as const, label: `Semua ${semua.length}` },
            { value: 'apar' as const, label: `APAR ${apar.filter((u) => !u.cadangan).length}` },
            { value: 'cadangan' as const, label: `Cadangan ${apar.filter((u) => u.cadangan).length}` },
            { value: 'apab' as const, label: `APAB ${apab.length}` },
          ]}
        />
        <RecordTable
          title="Data APAR & APAB"
          rows={rows}
          total={semua.length}
          cols={COLS}
          rowKey={(x) => x.u.id}
          onRow={(x) => navigate(ubah ? `/apar/data/unit/${encodeURIComponent(x.u.id)}` : `/apar/unit/${encodeURIComponent(x.u.id)}`)}
          empty={semua.length ? 'Tidak ada unit pada saringan ini.' : 'Belum ada unit. Ketuk "Tambah APAR / APAB".'}
        />
      </section>

      <section aria-labelledby="apar-area" className="animate-entrance-3 flex flex-col gap-space-xs">
        <SectionHeader
          id="apar-area"
          title="Area / lokasi"
          action={
            ubah ? (
              <button type="button" onClick={() => setAreaOpen(true)} className="touch-44 text-body-sm font-semibold text-primary">
                Tambah area
              </button>
            ) : undefined
          }
        />
        <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
          {lokasiOptions(pulau, areas).map((l) => {
            const otomatis = l.startsWith('Pulau pompa ')
            const n = dipakai(l)
            return (
              <div key={l} className="flex min-h-12 items-center gap-space-sm pl-space-sm pr-space-2xs">
                <MapPin aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
                <span className="flex-1 text-body-sm text-on-surface">{l}</span>
                <span className="tabular text-body-sm text-on-surface-variant">
                  {n} unit{otomatis ? ', dari jumlah pulau' : ''}
                </span>
                {ubah && !otomatis ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Hapus area ${l}`}
                    title={n ? 'Pindahkan dulu unit di area ini' : undefined}
                    disabled={n > 0}
                    onClick={() => window.confirm(`Hapus area "${l}"?`) && app.updateSettings({ aparArea: areas.filter((x) => x !== l) })}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                ) : (
                  <span className="w-2" />
                )}
              </div>
            )
          })}
        </GlassCard>
      </section>

      <Sheet open={areaOpen} onOpenChange={setAreaOpen} title="Tambah area" description="Area baru muncul di pilihan lokasi APAR/APAB.">
        {areaOpen && <AreaBaru opsi={lokasiOptions(pulau, areas)} onSimpan={(nama) => (app.updateSettings({ aparArea: [...areas, nama] }), setAreaOpen(false), toast(`Area "${nama}" ditambahkan`))} />}
      </Sheet>
    </div>
  )
}

function AreaBaru({ opsi, onSimpan }: { opsi: string[]; onSimpan: (nama: string) => void }) {
  const [nama, setNama] = useState('')
  const [error, setError] = useState<string | null>(null)
  const simpan = () => {
    const n = nama.trim().replace(/\s+/g, ' ')
    if (!n) return setError('Tulis nama area, mis. "Area cuci mobil".')
    if (opsi.some((l) => l.toLowerCase() === n.toLowerCase())) return setError(`Area "${n}" sudah ada.`)
    onSimpan(n)
  }
  return (
    <>
      <Field label="Nama area" htmlFor="set-area-baru">
        <Input
          id="set-area-baru"
          autoComplete="off"
          placeholder="Mis. Area cuci mobil"
          value={nama}
          onChange={(e) => (setError(null), setNama(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              simpan()
            }
          }}
        />
      </Field>
      <ErrorBox text={error} />
      <Button size="lg" onClick={simpan}>
        <Plus aria-hidden="true" />
        Simpan area
      </Button>
    </>
  )
}

function Ringkas({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col rounded-md bg-surface-container-lowest/80 p-space-sm">
      <span className="text-tag uppercase text-on-surface-variant">{label}</span>
      <span className="tabular text-numeric-lg font-bold text-on-surface">{value}</span>
    </div>
  )
}
