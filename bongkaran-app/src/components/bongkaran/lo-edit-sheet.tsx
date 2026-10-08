import { useState } from 'react'
import { Lock, Repeat, Trash2, TriangleAlert } from 'lucide-react'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { formatNumber, parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
import { LO_MANUAL_STATUS, loStatus, loStatusMeta, planSupply, SHIFT_PERMINTAAN } from '@/lib/plan'
import { PRODUK_OPTIONS, SUPPLY_POINTS, type LoStatus, type Plan, type PlanLo } from '@/lib/sop'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

export function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <div role="alert" className="flex items-start gap-space-sm rounded-md bg-error-container/70 p-space-sm">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
      <span className="text-body-sm font-semibold text-on-error-container">{text}</span>
    </div>
  )
}

export function ProdukSelect({ id, value, onChange, label = 'Produk' }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRODUK_OPTIONS.map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SupplySelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Pilih supply point" />
      </SelectTrigger>
      <SelectContent>
        {SUPPLY_POINTS.map((p) => (
          <SelectItem key={p} value={p}>
            {p}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type LoForm = { noSO: string; noLO: string; produk: string; volume: string; shift: '' | '1' | '2'; status: LoStatus; alihLO: string; alihSP: string; /** Nomor LO produk lain dalam permintaan yang sama. */ lainLO: Record<string, string> }

export type LoTarget = { plan: Plan; lo: PlanLo | null }

const formOf = ({ plan, lo }: LoTarget): LoForm =>
  lo
    ? { noSO: plan.noSO, noLO: lo.noLO, produk: lo.produk, volume: String(lo.volume), shift: lo.shift ?? plan.ms2Shift ?? '', status: lo.status, alihLO: '', alihSP: planSupply(plan, lo), lainLO: lainOf(plan, lo.id) }
    : { noSO: plan.noSO, noLO: '', produk: PRODUK_OPTIONS[0], volume: '8000', shift: plan.ms2Shift ?? '', status: 'os', alihLO: '', alihSP: plan.supplyPoint, lainLO: lainOf(plan, '') }

const lainOf = (plan: Plan, kecuali: string) => Object.fromEntries(plan.los.filter((x) => x.id !== kecuali).map((x) => [x.id, x.noLO]))

/**
 * Pop up ubah LO: nomor SO (milik permintaan), nomor LO tiap produk dalam permintaan,
 * lalu produk, volume, shift, status, dan alih supply untuk LO yang diketuk.
 * LO Closed (sudah dibongkar) hanya bisa dilihat.
 */
export function LoEditSheet({ target, onClose }: { target: LoTarget | null; onClose: () => void }) {
  return (
    <Sheet
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      title={target?.lo ? (target.lo.noLO ? `LO ${target.lo.noLO}` : `${target.lo.produk}, LO belum terbit`) : 'Tambah LO'}
      description={target ? `${target.plan.noSO ? `SO ${target.plan.noSO}` : 'SO belum terbit'}, ${planSupply(target.plan, target.lo ?? undefined) || '-'}, kirim ${formatTanggalIso(target.plan.tanggal)}` : undefined}
    >
      {/* key: form diisi ulang tiap LO berbeda dibuka. */}
      {target && <Isi key={target.lo?.id ?? `baru-${target.plan.id}`} target={target} onClose={onClose} />}
    </Sheet>
  )
}

function Isi({ target, onClose }: { target: LoTarget; onClose: () => void }) {
  const app = useApp()
  const toast = useToast()
  const { plan, lo } = target
  const [f, setF] = useState<LoForm>(() => formOf(target))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (p: Partial<LoForm>) => {
    setError(null)
    setF({ ...f, ...p })
  }
  const usedBy = lo ? app.usedLoIds.get(lo.id) : undefined
  const status = lo ? loStatus(lo, app.usedLoIds) : 'os'
  const terkunci = status === 'closed'
  const startAlih = f.status === 'alih' && !!lo && lo.status !== 'alih'

  // LO lain di permintaan ini yang nomornya masih boleh diubah (belum dipakai bongkaran, tidak dihapus).
  const bisaUbah = (x: PlanLo) => !app.usedLoIds.has(x.id) && x.status !== 'deleted'
  const lain = plan.los.filter((x) => x.id !== lo?.id)
  // Nomor LO di permintaan lain (permintaan ini dicek terpisah karena nomornya bisa ditukar).
  const taken = () =>
    new Set(
      app.plans
        .filter((p) => p.id !== plan.id)
        .flatMap((p) => p.los.flatMap((x) => [x.noLO, x.noLOLama ?? '']))
        .map((n) => n.trim().toUpperCase())
        .filter(Boolean),
    )

  const simpan = async () => {
    const lainBaru = lain.map((x) => ({ x, no: bisaUbah(x) ? (f.lainLO[x.id] ?? '').trim() : x.noLO }))
    if ((f.noLO.trim() || startAlih || lainBaru.some((l) => l.no && bisaUbah(l.x))) && !f.noSO.trim()) return setError('Isi nomor SO terlebih dahulu, baru nomor LO.')
    // Nomor LO dalam permintaan ini tidak boleh kembar.
    const semua = [startAlih ? f.alihLO.trim() : f.noLO.trim(), ...lainBaru.map((l) => l.no), ...plan.los.map((x) => x.noLOLama ?? '')].map((n) => n.toUpperCase()).filter(Boolean)
    const kembar = semua.find((n, i) => semua.indexOf(n) !== i)
    if (kembar) return setError(`Nomor LO ${kembar} dipakai lebih dari sekali.`)
    const volume = parseAngka(f.volume)
    if (!(volume && volume > 0)) return setError('Volume harus lebih dari 0 liter.')
    const sudah = taken()
    if (startAlih) {
      if (!lo.noLO.trim()) return setError('LO belum punya nomor, tidak bisa dialih supply.')
      const baru = f.alihLO.trim().toUpperCase()
      if (!baru) return setError('Isi nomor LO baru dari terminal tujuan.')
      if (sudah.has(baru) || baru === lo.noLO.trim().toUpperCase()) return setError(`Nomor LO ${f.alihLO} sudah terdaftar.`)
      if (!f.alihSP || f.alihSP === planSupply(plan, lo)) return setError('Pilih supply point baru yang berbeda.')
    } else if (f.noLO.trim() && sudah.has(f.noLO.trim().toUpperCase())) {
      return setError(`Nomor LO ${f.noLO} sudah terdaftar.`)
    }
    const lainDipakai = lainBaru.find((l) => bisaUbah(l.x) && l.no && sudah.has(l.no.toUpperCase()))
    if (lainDipakai) return setError(`Nomor LO ${lainDipakai.no} (${lainDipakai.x.produk}) sudah terdaftar.`)
    const next: PlanLo =
      startAlih && lo
        ? { ...lo, produk: f.produk, volume, shift: f.shift, status: 'alih', noLOLama: lo.noLO, supplyPointLama: planSupply(plan, lo), noLO: f.alihLO.trim(), supplyPoint: f.alihSP }
        : { segel: [], ...(lo ?? { id: genId('lo') }), noLO: f.noLO.trim(), produk: f.produk, volume, shift: f.shift, status: f.status }
    const lainLos = plan.los.map((x) => {
      const baru = lainBaru.find((l) => l.x.id === x.id)
      return baru && bisaUbah(x) ? { ...x, noLO: baru.no } : x
    })
    const los = lo ? lainLos.map((x) => (x.id === lo.id ? next : x)) : [...lainLos, next]
    setSaving(true)
    try {
      await app.savePlan({ ...plan, noSO: f.noSO.trim(), los })
      onClose()
      toast(startAlih ? `Alih supply: LO ${next.noLOLama} menjadi ${next.noLO}` : 'LO tersimpan')
    } catch (e) {
      setError(pesan(e))
    } finally {
      setSaving(false)
    }
  }

  const hapus = async () => {
    if (!lo) return
    if (!window.confirm(`Hapus baris ${lo.noLO ? `LO ${lo.noLO}` : lo.produk} dari plan ini? Untuk LO yang dibatalkan depot, pakai status Deleted.`)) return
    try {
      const sisa = plan.los.filter((x) => x.id !== lo.id)
      if (sisa.length) await app.savePlan({ ...plan, los: sisa })
      else await app.deletePlan(plan)
      onClose()
    } catch (e) {
      setError(pesan(e))
    }
  }

  if (terkunci && lo)
    return (
      <>
        <div className="flex items-start gap-space-sm rounded-md bg-surface-container-low p-space-sm">
          <Lock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-on-surface-variant" />
          <span className="text-body-sm text-on-surface">
            LO ini sudah <b>Closed</b> (dibongkar MT {usedBy?.nopol || '-'}), sehingga tidak dapat diubah lagi.
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-x-space-sm gap-y-space-xs rounded-md bg-surface-container-low/60 p-space-sm text-body-sm">
          <Info label="Produk" value={lo.produk} />
          <Info label="Volume" value={`${formatNumber(lo.volume)} L`} />
          <Info label="Nomor SO" value={plan.noSO || '-'} />
          <Info label="Nomor LO" value={lo.noLO || '-'} />
          <Info label="Shift permintaan" value={lo.shift ? `Shift ${lo.shift}` : '-'} />
          <Info label="Supply point" value={planSupply(plan, lo) || '-'} />
          {lo.noLOLama && <Info label="Pindah station dari" value={`LO ${lo.noLOLama}${lo.supplyPointLama ? `, ${lo.supplyPointLama}` : ''}`} />}
        </dl>
        <Button size="lg" variant="glass" className="w-full" onClick={onClose}>
          Tutup
        </Button>
      </>
    )

  return (
    <>
      <div className="grid grid-cols-2 gap-space-sm">
        <Field
          label="Nomor SO"
          htmlFor="lo-so-edit"
          className="col-span-2"
          hint={plan.los.length > 1 ? `Satu SO untuk ${plan.los.length} LO dalam permintaan ini; ubah di sini berlaku untuk semuanya.` : 'Isi setelah SO terbit dari depot.'}
        >
          <Input id="lo-so-edit" autoComplete="off" inputMode="numeric" value={f.noSO} onChange={(e) => set({ noSO: e.target.value })} />
        </Field>
        <div className="col-span-2 flex flex-col gap-space-xs">
          <span className="text-tag uppercase text-on-surface-variant">{plan.los.length > 1 ? 'Nomor LO per produk' : 'Nomor LO'}</span>
          {plan.los.map((x) => {
            const ini = x.id === lo?.id
            const label = `${x.produk}, ${formatNumber(x.volume)} L${x.shift ? `, shift ${x.shift}` : ''}`
            if (ini)
              return (
                <Field key={x.id} label={plan.los.length > 1 ? `${label} (LO ini)` : label} htmlFor="lo-no-edit">
                  <Input id="lo-no-edit" autoComplete="off" inputMode="numeric" disabled={startAlih} value={f.noLO} onChange={(e) => set({ noLO: e.target.value })} />
                </Field>
              )
            return bisaUbah(x) ? (
              <Field key={x.id} label={label} htmlFor={`lo-no-${x.id}`}>
                <Input id={`lo-no-${x.id}`} autoComplete="off" inputMode="numeric" value={f.lainLO[x.id] ?? ''} onChange={(e) => set({ lainLO: { ...f.lainLO, [x.id]: e.target.value } })} />
              </Field>
            ) : (
              <div key={x.id} className="flex min-h-11 items-center gap-space-sm rounded-md bg-surface-container-low px-space-sm text-body-sm">
                <Lock aria-hidden="true" className="size-4 shrink-0 text-on-surface-variant" />
                <span className="flex-1 text-on-surface">{label}</span>
                <span className="tabular font-semibold text-on-surface">{x.noLO || '-'}</span>
                <span className="text-on-surface-variant">{loStatusMeta(loStatus(x, app.usedLoIds)).label}</span>
              </div>
            )
          })}
          {!lo && (
            <Field label="LO baru" htmlFor="lo-no-edit">
              <Input id="lo-no-edit" autoComplete="off" inputMode="numeric" value={f.noLO} onChange={(e) => set({ noLO: e.target.value })} />
            </Field>
          )}
        </div>
        <Field label="Produk" htmlFor="lo-produk-edit">
          <ProdukSelect id="lo-produk-edit" value={f.produk} onChange={(v) => set({ produk: v })} />
        </Field>
        <Field label="Volume" htmlFor="lo-vol-edit">
          <Input id="lo-vol-edit" numeric inputMode="numeric" suffix="L" value={f.volume} onChange={(e) => set({ volume: e.target.value })} />
        </Field>
        <Field label="Shift permintaan" className="col-span-2">
          <Choice label="Shift permintaan LO" value={f.shift} onChange={(v) => set({ shift: v })} options={SHIFT_PERMINTAAN} />
        </Field>
      </div>

      {usedBy ? (
        <div className="inset-field rounded-md p-space-sm text-body-sm text-on-surface">
          Status <b>{loStatusMeta(status).label}</b> otomatis dari data bongkaran MT {usedBy.nopol || '-'}.
        </div>
      ) : (
        <Field label="Status LO">
          <div role="radiogroup" aria-label="Status LO" className="grid grid-cols-2 gap-space-xs">
            {LO_MANUAL_STATUS.map((k) => {
              const m = loStatusMeta(k)
              const on = f.status === k
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ status: k })}
                  className={cn('flex min-h-14 flex-col items-start justify-center rounded-md px-space-sm py-space-xs text-left', on ? 'bg-primary text-on-primary' : 'inset-field text-on-surface')}
                >
                  <span className="text-body-sm font-semibold">{m.label}</span>
                  <span className={cn('text-tag normal-case tracking-normal', on ? 'text-on-primary' : 'text-on-surface-variant')}>{m.desc}</span>
                </button>
              )
            })}
          </div>
          <span className="text-body-sm text-on-surface-variant">Proses tampil selama nomor LO belum diisi. Delivered dan Closed terisi otomatis saat LO dipakai bongkaran.</span>
        </Field>
      )}

      {startAlih && (
        <div className="flex flex-col gap-space-sm rounded-md bg-secondary-fixed/40 p-space-sm">
          <span className="flex items-center gap-space-xs text-body-sm font-semibold text-on-surface">
            <Repeat aria-hidden="true" className="size-4" />
            Adjustment alih supply dari {planSupply(plan, lo)}
          </span>
          <span className="text-body-sm text-on-surface-variant">LO {lo?.noLO} tetap tercatat sebagai LO lama.</span>
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Nomor LO baru" htmlFor="lo-alih-no">
              <Input id="lo-alih-no" autoComplete="off" inputMode="numeric" value={f.alihLO} onChange={(e) => set({ alihLO: e.target.value })} />
            </Field>
            <Field label="Supply point baru" htmlFor="lo-alih-sp">
              <SupplySelect id="lo-alih-sp" value={f.alihSP} onChange={(v) => set({ alihSP: v })} />
            </Field>
          </div>
        </div>
      )}

      <ErrorBox text={error} />
      <div className="flex gap-space-xs">
        {lo && app.canManage && !usedBy && (
          <Button variant="ghost" size="icon" aria-label="Hapus baris LO" onClick={hapus}>
            <Trash2 aria-hidden="true" />
          </Button>
        )}
        <Button size="lg" className="flex-1" disabled={saving} onClick={simpan}>
          Simpan LO
        </Button>
      </div>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="tabular break-words font-semibold text-on-surface">{value}</dd>
    </div>
  )
}
