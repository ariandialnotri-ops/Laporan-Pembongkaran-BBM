import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleCheck, FireExtinguisher, ScanLine, Search, TriangleAlert } from 'lucide-react'
import { QrScanner } from '@/components/apar/qr'
import { ChipFilter } from '@/components/bongkaran/chip-filter'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { kondisiSemua, tipeLabel, unitDariKode, unitIdDariQr, type KondisiUnit } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { AparRecord } from '@/lib/daily'
import { formatTanggalIso, todayIso } from '@/lib/date'

type Saring = 'belum' | 'sudah' | 'semua'

/**
 * Input > APAR & APAB > Inspeksi: petugas mendatangi unit, memindai label QR
 * (atau mengetik kode bila label rusak), lalu mengirim inspeksi unit itu saja.
 */
export function InspeksiApar() {
  const app = useApp()
  const navigate = useNavigate()
  useSyncOnOpen()
  const [params] = useSearchParams()
  const terkirim = params.get('terkirim')
  const [scan, setScan] = useState(false)
  const [kode, setKode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saring, setSaring] = useState<Saring>('belum')
  const records = useMemo(() => app.daily.filter((d): d is AparRecord => d.kind === 'apar'), [app.daily])
  if (!app.loaded) return <Loading />

  const s = app.settings
  const today = todayIso()
  const kondisi = kondisiSemua(s, records, today)
  const units = kondisi.map((k) => k.unit)
  const sudah = kondisi.filter((k) => k.bulanIni)
  const rows = saring === 'belum' ? kondisi.filter((k) => !k.bulanIni) : saring === 'sudah' ? sudah : kondisi
  const baru = terkirim ? kondisi.find((k) => k.unit.id === terkirim) : null

  const buka = (unitId: string) => navigate(`/apar/inspeksi/${encodeURIComponent(unitId)}`)
  const cariKode = (k: string) => {
    const u = unitDariKode(k, units)
    if (!u) return `Kode "${k.trim()}" tidak ada di data utama. Periksa tulisan kode pada tabung.`
    buka(u.id)
    return null
  }

  return (
    <div className="flex flex-col gap-space-md">
      {baru && (
        <div role="status" className="animate-entrance-1 flex items-start gap-space-sm rounded-lg bg-emerald-50 p-space-sm">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <span className="text-body-sm text-on-surface">
            Inspeksi <b>{baru.unit.kode}</b> terkirim ({baru.status === 'temuan' ? 'ada temuan' : 'baik'}). Lanjutkan ke unit berikutnya: {kondisi.length - sudah.length} unit belum diinspeksi bulan ini.
          </span>
        </div>
      )}

      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-error-container text-error">
            <FireExtinguisher className="size-5" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-body-md font-bold text-on-surface">Inspeksi per unit di lokasi</span>
            <span className="text-body-sm text-on-surface-variant">Datangi unit APAR/APAB, pindai label QR pada tabung, isi checklist & foto, lalu kirim. Ulangi untuk unit berikutnya.</span>
          </div>
        </div>
        <Button size="lg" onClick={() => setScan(true)} disabled={!units.length}>
          <ScanLine aria-hidden="true" />
          Pindai QR unit
        </Button>
        <div className="grid grid-cols-[1fr_auto] items-end gap-space-xs">
          <Field label="Label QR rusak? Ketik kode unit" htmlFor="apar-kode">
            <Input
              id="apar-kode"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="Mis. APAR-01"
              value={kode}
              onChange={(e) => (setError(null), setKode(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setError(cariKode(kode))
                }
              }}
            />
          </Field>
          <Button variant="soft" disabled={!kode.trim()} onClick={() => setError(cariKode(kode))}>
            <Search aria-hidden="true" />
            Buka
          </Button>
        </div>
        {error && (
          <span role="alert" className="flex items-start gap-1.5 text-body-sm font-semibold text-error">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {error}
          </span>
        )}
      </GlassCard>

      {units.length === 0 ? (
        <GlassCard level={1} className="flex flex-col items-center gap-space-sm p-space-md text-center">
          <span className="text-body-sm text-on-surface-variant">Belum ada unit APAR/APAB di data utama. Minta ABH mendaftarkan unit dan mencetak label QR.</span>
          {app.can('/apar/data') && (
            <Link to="/apar/data" className={buttonVariants({ size: 'pill' })}>
              Data utama
            </Link>
          )}
        </GlassCard>
      ) : (
        <section aria-labelledby="apar-progres" className="animate-entrance-2 flex flex-col gap-space-xs">
          <SectionHeader id="apar-progres" title={`Bulan ini: ${sudah.length} dari ${kondisi.length} unit`} />
          <div className="h-2 overflow-hidden rounded-full bg-surface-container">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${kondisi.length ? (sudah.length / kondisi.length) * 100 : 0}%` }} />
          </div>
          <ChipFilter
            label="Saring unit"
            value={saring}
            onChange={setSaring}
            options={[
              { value: 'belum' as const, label: `Belum ${kondisi.length - sudah.length}` },
              { value: 'sudah' as const, label: `Sudah ${sudah.length}` },
              { value: 'semua' as const, label: `Semua ${kondisi.length}` },
            ]}
          />
          <GlassCard level={1} className="flex flex-col divide-y divide-outline-variant/40">
            {rows.length === 0 && <p className="p-space-md text-center text-body-sm text-on-surface-variant">{saring === 'belum' ? 'Semua unit sudah diinspeksi bulan ini.' : 'Belum ada unit diinspeksi bulan ini.'}</p>}
            {rows.map((k) => (
              <UnitBaris key={k.unit.id} k={k} />
            ))}
          </GlassCard>
          <span className="text-center text-body-sm text-on-surface-variant">Inspeksi dibuka dari label QR atau kode unit, agar dilakukan di lokasi unit.</span>
        </section>
      )}

      <QrScanner
        open={scan}
        onClose={() => setScan(false)}
        onKode={cariKode}
        onResult={(text) => {
          const id = unitIdDariQr(text)
          setScan(false)
          if (id && units.some((u) => u.id === id)) buka(id)
          else setError(id ? 'Unit pada label ini sudah tidak terdaftar di data utama.' : 'QR ini bukan label APAR/APAB FLOQ. Ketik kode unit bila label rusak.')
        }}
      />
    </div>
  )
}

function UnitBaris({ k }: { k: KondisiUnit }) {
  const t = k.terakhir
  return (
    <div className="flex min-h-14 items-center gap-space-sm px-space-sm py-space-xs">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-1.5 text-body-sm font-semibold text-on-surface">
          <span className="tabular">{k.unit.kode || '-'}</span>
          <span className="font-normal text-on-surface-variant">{tipeLabel(k.tipe, k.unit.cadangan)}</span>
        </span>
        <span className="truncate text-body-sm text-on-surface-variant">
          {k.unit.lokasi || 'Tanpa lokasi'}
          {t && k.bulanIni ? `, ${formatTanggalIso(t.tanggal)} oleh ${t.petugas || '-'}` : ''}
        </span>
      </span>
      {!k.bulanIni ? (
        <Pill>Belum</Pill>
      ) : (
        <Pill tone={k.status === 'temuan' ? 'error' : 'success'}>
          {k.status === 'temuan' ? 'Temuan' : 'Baik'}
        </Pill>
      )}
    </div>
  )
}
