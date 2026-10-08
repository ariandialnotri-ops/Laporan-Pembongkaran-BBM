import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Lock, Repeat, Save, Scissors, Trash2 } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox, ProdukSelect, SupplySelect } from '@/components/bongkaran/lo-fields'
import { ProdukChip } from '@/components/bongkaran/record-table'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { formatTanggalIso } from '@/lib/date'
import { formatNumber, parseAngka } from '@/lib/format'
import { genId } from '@/lib/image'
import { LO_MANUAL_STATUS, LO_MAX_LITER, loStatus, loStatusMeta, pecahVolume, planSupply, SHIFT_PERMINTAAN } from '@/lib/plan'
import type { LoStatus, Plan, PlanLo } from '@/lib/sop'
import { cn } from '@/lib/utils'

/** Satu baris tabel edit. `asal` = LO tersimpan (kosong untuk hasil pecah LO lama di atas 8.000 L). */
type Baris = {
  id: string
  asal: PlanLo | null
  noLO: string
  produk: string
  volume: string
  shift: '' | '1' | '2'
  status: LoStatus
  /** Alih supply / pindah station: nomor LO baru dan supply point baru. */
  alihLO: string
  alihSP: string
  hapus: boolean
}

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * LO lama di atas 8.000 L (sebelum aturan 1 LO = 8.000 L) dipecah otomatis menjadi beberapa baris.
 * Baris pertama mempertahankan id & nomor LO lama; sisanya baris baru tanpa nomor.
 */
function barisDari(plan: Plan, bisaUbah: (lo: PlanLo) => boolean): Baris[] {
  return plan.los.flatMap((lo) => {
    const dasar: Baris = { id: lo.id, asal: lo, noLO: lo.noLO, produk: lo.produk, volume: String(lo.volume), shift: lo.shift ?? plan.ms2Shift ?? '', status: lo.status, alihLO: '', alihSP: planSupply(plan, lo), hapus: false }
    if (!bisaUbah(lo) || lo.volume <= LO_MAX_LITER) return [dasar]
    return pecahVolume(lo.volume).map((v, i) => (i === 0 ? { ...dasar, volume: String(v) } : { ...dasar, id: genId('lo'), asal: null, noLO: '', volume: String(v), status: 'os' as const }))
  })
}

/**
 * Edit SO & LO satu permintaan dalam bentuk tabel: nomor SO di atas, lalu satu baris per LO
 * (produk, volume maks. 8.000 L, shift, nomor LO, status). Simpan lalu kembali ke Tracking LO.
 */
export function EditLo() {
  const app = useApp()
  useSyncOnOpen()
  const { id = '' } = useParams()
  const plan = app.plans.find((p) => p.id === id)
  if (!app.loaded) return <Loading />
  if (!plan)
    return (
      <GlassCard level={1} className="flex flex-col items-center gap-space-sm p-space-md text-center">
        <span className="text-body-md font-semibold text-on-surface">Permintaan tidak ditemukan</span>
        <span className="text-body-sm text-on-surface-variant">Plan ini mungkin sudah dihapus dari perangkat lain.</span>
        <Link to="/plan" className={buttonVariants({ size: 'pill' })}>
          Ke Tracking LO
        </Link>
      </GlassCard>
    )
  // key: form diisi ulang bila plan lain dibuka.
  return <Form key={plan.id} plan={plan} />
}

function Form({ plan }: { plan: Plan }) {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const fokus = params.get('lo')
  const dari = params.get('dari')
  const kembaliKe = dari?.startsWith('/') && !dari.startsWith('//') ? dari : '/plan'

  const terpakai = (lo: PlanLo) => app.usedLoIds.has(lo.id)
  const bisaUbah = (lo: PlanLo) => !terpakai(lo)
  const [noSO, setNoSO] = useState(plan.noSO)
  const [rows, setRows] = useState<Baris[]>(() => barisDari(plan, bisaUbah))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const awal = useMemo(() => JSON.stringify({ noSO: plan.noSO, rows: barisDari(plan, bisaUbah) }), [plan]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify({ noSO, rows }) !== awal
  const dipecah = rows.filter((r) => !r.asal).length
  const guard = useLeaveGuard({ active: dirty, title: 'Keluar tanpa menyimpan?', detail: 'Perubahan nomor SO dan LO pada halaman ini belum disimpan.' })

  useEffect(() => {
    // Baris LO yang diketuk di Tracking LO ditandai dan digulir ke tengah layar.
    if (fokus) document.getElementById(`baris-${fokus}`)?.scrollIntoView({ block: 'center' })
  }, [fokus])

  const setRow = (rid: string, p: Partial<Baris>) => {
    setError(null)
    setRows((rs) => rs.map((r) => (r.id === rid ? { ...r, ...p } : r)))
  }
  const semuaTerkunci = plan.los.every(terpakai)

  const simpan = async () => {
    const aktif = rows.filter((r) => !r.hapus)
    const editable = aktif.filter((r) => !r.asal || bisaUbah(r.asal))
    const alihBaru = (r: Baris) => r.status === 'alih' && r.asal?.status !== 'alih'
    for (const r of editable) {
      const v = parseAngka(r.volume)
      const nama = `Baris ${rows.indexOf(r) + 1} (${r.produk})`
      if (!(v && v > 0)) return setError(`${nama}: volume harus lebih dari 0 liter.`)
      if (v > LO_MAX_LITER) return setError(`${nama}: volume maksimal ${formatNumber(LO_MAX_LITER)} L per LO. Tiap ${formatNumber(LO_MAX_LITER)} L = 1 LO.`)
      if (!r.shift) return setError(`${nama}: pilih shift permintaan.`)
      if (alihBaru(r)) {
        if (!r.noLO.trim()) return setError(`${nama}: LO belum punya nomor, tidak bisa dialih supply.`)
        if (!r.alihLO.trim()) return setError(`${nama}: isi nomor LO baru dari station tujuan.`)
        if (!r.alihSP || r.alihSP === (r.asal ? planSupply(plan, r.asal) : plan.supplyPoint)) return setError(`${nama}: pilih supply point baru yang berbeda.`)
      }
    }
    const nomorAkhir = (r: Baris) => (alihBaru(r) ? r.alihLO.trim() : r.noLO.trim())
    if (aktif.some((r) => nomorAkhir(r)) && !noSO.trim()) return setError('Isi nomor SO terlebih dahulu, baru nomor LO.')
    // Nomor LO tidak boleh kembar, baik di permintaan ini maupun permintaan lain.
    const lain = new Set(
      app.plans
        .filter((p) => p.id !== plan.id)
        .flatMap((p) => p.los.flatMap((x) => [x.noLO, x.noLOLama ?? '']))
        .map((n) => n.trim().toUpperCase())
        .filter(Boolean),
    )
    const sini = aktif.flatMap((r) => [nomorAkhir(r), alihBaru(r) ? r.noLO : (r.asal?.noLOLama ?? '')]).map((n) => n.trim().toUpperCase()).filter(Boolean)
    const kembar = sini.find((n, i) => sini.indexOf(n) !== i)
    if (kembar) return setError(`Nomor LO ${kembar} dipakai lebih dari sekali.`)
    const dipakai = sini.find((n) => lain.has(n))
    if (dipakai) return setError(`Nomor LO ${dipakai} sudah terdaftar di permintaan lain.`)

    const los: PlanLo[] = aktif.map((r) => {
      if (r.asal && !bisaUbah(r.asal)) return r.asal
      const volume = parseAngka(r.volume) ?? 0
      const base: PlanLo = { segel: [], noLO: '', status: 'os', ...(r.asal ?? { id: r.id }), produk: r.produk, volume, shift: r.shift }
      if (alihBaru(r) && r.asal) return { ...base, status: 'alih', noLOLama: r.noLO.trim(), supplyPointLama: planSupply(plan, r.asal), noLO: r.alihLO.trim(), supplyPoint: r.alihSP }
      return { ...base, noLO: r.noLO.trim(), status: r.status }
    })
    setSaving(true)
    try {
      if (los.length) await app.savePlan({ ...plan, noSO: noSO.trim(), los })
      else await app.deletePlan(plan)
      guard.bypass()
      toast(los.length ? 'SO & LO tersimpan' : 'Permintaan dihapus')
      navigate(kembaliKe)
    } catch (e) {
      setError(pesan(e))
    } finally {
      setSaving(false)
    }
  }

  const keluar = () => navigate(kembaliKe)

  return (
    <div className="flex flex-col gap-space-md">
      {/* Data permintaan MS2 (hanya dibaca) + nomor SO */}
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex flex-col">
          <span className="text-tag uppercase text-primary">Permintaan MS2</span>
          <h2 className="tabular text-headline-md font-bold text-on-surface">Kirim {formatTanggalIso(plan.tanggal)}</h2>
        </div>
        <dl className="grid grid-cols-2 gap-x-space-sm gap-y-space-xs text-body-sm sm:grid-cols-4">
          <Info label="Supply point" value={plan.supplyPoint || '-'} />
          <Info label="Ship To" value={plan.shipTo || '-'} />
          <Info label="Permintaan MS2" value={`${formatTanggalIso(plan.ms2Tanggal)} ${plan.ms2Jam}`} />
          <Info label="Total" value={`${plan.los.length} LO, ${formatNumber(plan.los.reduce((n, l) => n + l.volume, 0))} L`} />
        </dl>
        <Field label="Nomor SO" htmlFor="lo-so-edit" hint={`Satu SO untuk semua LO di permintaan ini. 1 LO maksimal ${formatNumber(LO_MAX_LITER)} L.`}>
          <Input id="lo-so-edit" autoComplete="off" inputMode="numeric" disabled={semuaTerkunci} value={noSO} onChange={(e) => (setError(null), setNoSO(e.target.value))} />
        </Field>
      </GlassCard>

      {dipecah > 0 && (
        <div role="note" className="animate-entrance-2 flex items-start gap-space-sm rounded-md border border-amber-300 bg-amber-50 p-space-sm text-body-sm text-on-surface">
          <Scissors aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700" />
          <span>
            LO di atas {formatNumber(LO_MAX_LITER)} L dipecah otomatis menjadi {dipecah} LO tambahan (tiap {formatNumber(LO_MAX_LITER)} L = 1 LO). Isi nomor LO masing-masing lalu simpan.
          </span>
        </div>
      )}

      {/* Tabel LO */}
      <GlassCard level={1} className="animate-entrance-2 overflow-hidden">
        <div className="flex flex-wrap items-center gap-space-sm border-b border-outline-variant/50 px-space-md py-space-sm">
          <h2 className="text-body-md font-bold uppercase tracking-wide text-on-surface">Daftar LO</h2>
          <span className="tabular rounded-full border border-primary/30 bg-primary-fixed/60 px-3 py-0.5 text-body-sm font-semibold text-primary">{rows.filter((r) => !r.hapus).length} LO</span>
        </div>
        <table className="w-full table-fixed border-collapse text-body-sm">
          <colgroup>
            <col className="w-11" />
            <col className="w-[46%] sm:w-[52%]" />
            <col />
          </colgroup>
          <thead className="bg-surface-container-low/80 text-left text-tag uppercase text-on-surface-variant">
            <tr>
              <th scope="col" className="px-space-xs py-space-xs text-center">
                No
              </th>
              {/* Di layar lebar judul kolom mengikuti grid isian tiap sel. */}
              <th scope="col" className="px-space-xs py-space-xs">
                <span className="sm:hidden">Produk, volume & shift</span>
                <span className="hidden gap-1 sm:grid sm:grid-cols-[1fr_8.5rem_7.5rem]">
                  <span>Produk</span>
                  <span>Volume (maks. {formatNumber(LO_MAX_LITER)} L)</span>
                  <span>Shift</span>
                </span>
              </th>
              <th scope="col" className="px-space-xs py-space-xs">
                <span className="sm:hidden">Nomor LO & status</span>
                <span className="hidden gap-1 sm:grid sm:grid-cols-2">
                  <span>Nomor LO</span>
                  <span>Status</span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {rows.map((r, i) => (
              <Fragment key={r.id}>{barisLo(i + 1, r)}</Fragment>
            ))}
          </tbody>
        </table>
      </GlassCard>

      <ErrorBox text={error} />
      <div className="flex gap-space-xs">
        <Button size="lg" variant="glass" onClick={keluar}>
          Batal
        </Button>
        {!semuaTerkunci && (
          <Button size="lg" className="flex-1" disabled={saving} onClick={simpan}>
            <Save aria-hidden="true" />
            {saving ? 'Menyimpan…' : 'Simpan & kembali'}
          </Button>
        )}
      </div>
      {guard.dialog}
    </div>
  )

  // Fungsi render biasa (bukan komponen) agar input tidak kehilangan fokus saat mengetik.
  function barisLo(no: number, r: Baris) {
    const set = (p: Partial<Baris>) => setRow(r.id, p)
    const fokusIni = fokus === r.id
    const used = r.asal ? app.usedLoIds.get(r.asal.id) : undefined
    const st = r.asal ? loStatus(r.asal, app.usedLoIds) : 'proses'
    const alih = r.status === 'alih' && r.asal?.status !== 'alih'
    const sel = (extra?: string) => cn('align-top px-space-xs py-space-sm', extra)

    if (used && r.asal) {
      const m = loStatusMeta(st)
      return (
        <tr id={`baris-${r.id}`} className={cn('bg-surface-container-low/50', fokusIni && 'outline outline-2 -outline-offset-2 outline-primary/50')}>
          <td className={sel('tabular text-center font-semibold text-on-surface-variant')}>{no}</td>
          <td className={sel()}>
            <ProdukLine produk={r.asal.produk} volume={r.asal.volume} shift={r.asal.shift} />
          </td>
          <td className={sel()}>
            <span className="tabular flex items-center gap-1.5 font-semibold text-on-surface">
              <Lock aria-hidden="true" className="size-3.5 shrink-0 text-on-surface-variant" />
              {r.asal.noLO || '-'}
            </span>
            {r.asal.noLOLama && <span className="tabular block text-on-surface-variant">dari LO {r.asal.noLOLama}</span>}
            <span className="block text-on-surface-variant">MT {used.nopol || '-'}</span>
            <span className="mt-1 inline-block">
              <Pill tone={m.tone}>{m.label}</Pill>
            </span>
          </td>
        </tr>
      )
    }

    const status = (
      <Select value={r.status} onValueChange={(v) => set({ status: v as LoStatus })}>
        <SelectTrigger id={`lo-st-${r.id}`} aria-label={`Status LO baris ${no}`} className="h-10">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LO_MANUAL_STATUS.map((k) => (
            <SelectItem key={k} value={k}>
              {loStatusMeta(k).label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
    const hapus = app.canManage && r.asal && (
      <Button variant="ghost" size="icon" aria-label={`${r.hapus ? 'Batal hapus' : 'Hapus'} baris ${no}`} aria-pressed={r.hapus} onClick={() => set({ hapus: !r.hapus })} className={r.hapus ? 'text-error' : undefined}>
        <Trash2 aria-hidden="true" />
      </Button>
    )

    return (
      <>
        <tr id={`baris-${r.id}`} className={cn(r.hapus && 'opacity-50', !r.asal && 'bg-amber-50/60', fokusIni && 'outline outline-2 -outline-offset-2 outline-primary/50')}>
          <td className={sel('tabular text-center font-semibold text-on-surface-variant')}>
            {no}
            <span className="mt-1 block">{hapus}</span>
          </td>
          <td className={sel()}>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_8.5rem_7.5rem]">
              <ProdukSelect id={`lo-produk-${r.id}`} label={`Produk baris ${no}`} value={r.produk} onChange={(v) => set({ produk: v })} />
              <Input aria-label={`Volume baris ${no}`} numeric inputMode="numeric" suffix="L" className="h-10" value={r.volume} onChange={(e) => set({ volume: e.target.value })} />
              <Select value={r.shift} onValueChange={(v) => set({ shift: v as Baris['shift'] })}>
                <SelectTrigger aria-label={`Shift permintaan baris ${no}`} className="h-10">
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_PERMINTAAN.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </td>
          <td className={sel()}>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <Input id={`lo-no-${r.id}`} aria-label={`Nomor LO baris ${no}`} autoComplete="off" inputMode="numeric" className="h-10" placeholder="belum terbit" disabled={alih || r.hapus} value={r.noLO} onChange={(e) => set({ noLO: e.target.value })} />
              {status}
              {r.asal?.noLOLama && <span className="tabular text-on-surface-variant sm:col-span-2">dari LO {r.asal.noLOLama}</span>}
              {r.hapus && <span className="font-semibold text-error sm:col-span-2">Dihapus saat disimpan</span>}
            </div>
          </td>
        </tr>
        {alih && (
          <tr className="bg-secondary-fixed/30">
            <td />
            <td colSpan={2} className="px-space-xs py-space-sm">
              <div className="flex flex-col gap-space-xs">
                <span className="flex items-center gap-space-xs font-semibold text-on-surface">
                  <Repeat aria-hidden="true" className="size-4" />
                  Alih supply dari {r.asal ? planSupply(plan, r.asal) : plan.supplyPoint}; LO {r.noLO || '-'} tetap tercatat
                </span>
                <div className="grid grid-cols-1 gap-space-xs sm:grid-cols-2">
                  <Input id={`lo-alih-${r.id}`} aria-label={`Nomor LO baru baris ${no}`} autoComplete="off" inputMode="numeric" className="h-10" placeholder="Nomor LO baru" value={r.alihLO} onChange={(e) => set({ alihLO: e.target.value })} />
                  <SupplySelect id={`lo-alih-sp-${r.id}`} label={`Supply point baru baris ${no}`} value={r.alihSP} onChange={(v) => set({ alihSP: v })} />
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    )
  }
}

function ProdukLine({ produk, volume, shift }: { produk: string; volume: number; shift?: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <ProdukChip produk={produk} />
      <span className="tabular text-on-surface">
        {formatNumber(volume)} L{shift ? `, shift ${shift}` : ''}
      </span>
    </div>
  )
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="tabular break-words font-semibold text-on-surface">{value}</dd>
    </div>
  )
}
