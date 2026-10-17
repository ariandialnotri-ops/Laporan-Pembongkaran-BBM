import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Gauge, Send, Trash2 } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { PilihShift, useKunciShift } from '@/components/bongkaran/pilih-shift'
import { ProdukChip, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { idShift } from '@/lib/catatan'
import { addDays, formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { formatLiter, formatNumber, parseAngka } from '@/lib/format'
import { shiftLabel, type Shift } from '@/lib/shift'
import { statusShift } from '@/lib/status-isi'
import { jualNozzle, jualPerProduk, nozzlePerDispenser, prevShift, totalizerAwalSaja, totalizerLengkap, type TotalizerData, type TotalizerNozzle, type TotalizerRecord } from '@/lib/totalizer'
import { useCatatan } from '@/lib/use-catatan'
import { useKeTerkirim } from '@/lib/terkirim'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const akhirBulan = (bulan: string) => todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0))
/** Angka totalisator ditampilkan 2 desimal (digital). */
const angka = (s: string) => {
  const v = parseAngka(s)
  return v === null ? '-' : formatNumber(v, 2)
}

function NozzleBelumAda() {
  return (
    <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
      <span className="text-body-md font-semibold text-on-surface">Database nozzle belum diisi</span>
      <span className="text-body-sm text-on-surface-variant">Totalizer diisi per nozzle. ABH atau pengawas mengisi nozzle (terhubung ke dispenser & pulau pompa) di Pengaturan.</span>
      <Link to="/pengaturan/nozzle" className={buttonVariants({ variant: 'glass' })}>
        Nozzle & Tera Metrologi
      </Link>
    </GlassCard>
  )
}

/** Operation > Totalizer: pilih shift (hijau lengkap, oranye belum/akhir shift belum, merah terlewat). */
export function TotalizerMenu() {
  const app = useApp()
  const hariIni = todayIso()
  const { recs, error } = useCatatan<TotalizerData>('totalizer', todayIso(addDays(new Date(`${hariIni}T00:00:00`), -40)), todayIso(addDays(new Date(`${hariIni}T00:00:00`), 1)))
  if (!app.loaded || !recs) return <Loading />
  const nozzles = app.settings.nozzles ?? []
  if (!nozzles.length) return <NozzleBelumAda />
  const rec = (tanggal: string, shift: Shift) => recs.find((r) => r.id === idShift(tanggal, shift))
  return (
    <div className="flex flex-col gap-space-md">
      <p className="animate-entrance-1 px-space-xs text-body-sm text-on-surface-variant">
        Catat totalisator digital setiap nozzle di awal dan akhir shift. Awal shift terisi otomatis dari akhir shift sebelumnya; penjualan nozzle = akhir − awal.
      </p>
      <ErrorBox text={error} />
      <PilihShift
        status={(k) => statusShift(k, totalizerLengkap(rec(k.tanggal, k.shift), nozzles))}
        keHalaman={(k) => `/totalizer/${k.tanggal}/${k.shift}`}
        keterangan={(k) => {
          const r = rec(k.tanggal, k.shift)
          if (!r) return undefined
          if (totalizerAwalSaja(r, nozzles)) return `Awal shift tercatat ${r.data.jamAwal || ''} · akhir shift belum`
          const total = jualPerProduk([r]).reduce((n, x) => n + x.liter, 0)
          return `Lengkap · ${formatLiter(total)} · ${r.data.petugas || '-'}`
        }}
      />
      {app.can('/laporan/totalizer') && (
        <Link to="/laporan/totalizer" className={buttonVariants({ variant: 'glass' })}>
          Riwayat totalizer
        </Link>
      )}
    </div>
  )
}

/** Form totalizer satu shift: awal & akhir per nozzle, dikelompokkan per dispenser / pulau pompa. */
export function TotalizerForm() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const { tanggal, shift, valid } = useKunciShift()
  const id = idShift(tanggal, shift)
  const sebelum = valid ? prevShift({ tanggal, shift }) : { tanggal, shift }
  const { recs } = useCatatan<TotalizerData>('totalizer', sebelum.tanggal, tanggal)
  const lama = recs?.find((r) => r.id === id)
  const prev = recs?.find((r) => r.id === idShift(sebelum.tanggal, sebelum.shift))
  const [isian, setIsian] = useState<Record<string, TotalizerNozzle> | null>(null)
  const [petugas, setPetugas] = useState<string | null>(null)
  const [catatan, setCatatan] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const namaShift = shiftLabel(shift).split(' (')[0]
  const guard = useLeaveGuard({ active: true, title: `Keluar dari totalizer ${namaShift}?`, detail: 'Isian yang belum dikirim akan hilang.' })

  if (!app.loaded || !recs) return <Loading />
  if (!valid) return <GlassCard className="p-space-md">Shift tidak dikenal.</GlassCard>
  const nozzles = app.settings.nozzles ?? []
  if (!nozzles.length) return <NozzleBelumAda />
  const bolehUbah = ['abh', 'pengawas', 'kashift', 'security'].includes(app.role ?? '')

  const awalDari = (nid: string, produk: string, nama: string): TotalizerNozzle =>
    lama?.data.nozzle[nid] ?? { nama, produk, awal: prev?.data.nozzle[nid]?.akhir ?? '', akhir: '' }
  const nilai = (nid: string) => {
    const n = nozzles.find((x) => x.id === nid)!
    return isian?.[nid] ?? awalDari(nid, n.produk, n.nama)
  }
  const ubah = (nid: string, patch: Partial<TotalizerNozzle>) => {
    setError(null)
    setIsian((x) => ({ ...(x ?? Object.fromEntries(nozzles.map((n) => [n.id, awalDari(n.id, n.produk, n.nama)]))), [nid]: { ...nilai(nid), ...patch } }))
  }
  const namaPetugas = petugas ?? lama?.data.petugas ?? (app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName)
  const isiCatatan = catatan ?? lama?.data.catatan ?? ''

  const kirim = async () => {
    for (const n of nozzles) {
      const v = nilai(n.id)
      const a = parseAngka(v.awal)
      const b = parseAngka(v.akhir)
      if (a === null) return setError(`Nozzle ${n.nama}: isi totalisator awal shift.`)
      if (b !== null && b < a) return setError(`Nozzle ${n.nama}: totalisator akhir lebih kecil dari awal.`)
    }
    if (!namaPetugas.trim()) return setError('Isi nama petugas.')
    setBusy(true)
    try {
      const jam = nowHm()
      const isi: TotalizerData['nozzle'] = {}
      for (const n of nozzles) {
        const v = nilai(n.id)
        isi[n.id] = { nama: n.nama, produk: n.produk, awal: v.awal.trim(), akhir: v.akhir.trim() }
      }
      const lengkap = nozzles.every((n) => jualNozzle(isi[n.id]) !== null)
      const rec: TotalizerRecord = {
        id,
        tanggal,
        shift,
        data: { nozzle: isi, petugas: namaPetugas.trim(), jamAwal: lama?.data.jamAwal || jam, jamAkhir: lengkap ? lama?.data.jamAkhir || jam : '', catatan: isiCatatan.trim() },
        createdAt: lama?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        createdBy: lama?.createdBy ?? app.session.user?.id ?? null,
      }
      await app.backend.saveCatatan('totalizer', rec)
      guard.bypass()
      keTerkirim({
        judul: `Totalizer ${namaShift} ${lengkap ? 'terkirim' : 'awal shift tersimpan'}`,
        detail: `${formatTanggalIso(tanggal)}, ${shiftLabel(shift)}${lengkap ? '' : '. Lengkapi totalisator akhir di akhir shift.'}`,
        baris: lengkap ? [...jualPerProduk([rec]).map((x): [string, string] => [x.produk, formatLiter(x.liter, 2)]), ['Petugas', rec.data.petugas]] : [['Nozzle', `${nozzles.length} nozzle`], ['Petugas', rec.data.petugas]],
        aksi: [
          { to: '/totalizer', label: 'Pilih shift lain' },
          ...(app.can('/laporan/totalizer') ? [{ to: '/laporan/totalizer', label: 'Riwayat totalizer' }] : []),
        ],
      })
    } catch (e) {
      setError(pesan(e))
      setBusy(false)
    }
  }

  const ringkas = jualPerProduk([{ id, tanggal, shift, data: { nozzle: Object.fromEntries(nozzles.map((n) => [n.id, nilai(n.id)])), petugas: '', jamAwal: '', jamAkhir: '', catatan: '' }, createdAt: 0, updatedAt: 0, createdBy: null }])

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex items-start justify-between gap-2 p-space-md">
        <div className="flex flex-col">
          <h2 className="text-headline-md font-bold text-on-surface">{shiftLabel(shift)}</h2>
          <span className="text-body-sm text-on-surface-variant">
            {formatTanggalIso(tanggal)}
            {prev ? ` · awal dari akhir ${shiftLabel(sebelum.shift).split(' (')[0]}` : ''}
          </span>
        </div>
        {totalizerLengkap(lama, nozzles) ? <Pill tone="success">Lengkap</Pill> : lama ? <Pill>Akhir belum</Pill> : <Pill tone="error">Belum diisi</Pill>}
      </GlassCard>

      {nozzlePerDispenser(nozzles, app.settings.dispensers ?? []).map((g, gi) => (
        <section key={g.judul} aria-label={g.judul} className={cn('flex flex-col gap-space-xs', gi === 0 ? 'animate-entrance-2' : 'animate-entrance-3')}>
          <SectionHeader id={`tot-${gi}`} title={g.judul} />
          {g.nozzles.map((n) => {
            const v = nilai(n.id)
            const j = jualNozzle(v)
            return (
              <GlassCard key={n.id} level={2} className="flex flex-col gap-space-sm p-space-md">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-body-md font-bold text-on-surface">Nozzle {n.nama}</span>
                  <ProdukChip produk={n.produk} />
                </div>
                <div className="grid grid-cols-2 gap-space-sm">
                  <Field label="Awal shift" htmlFor={`tot-a-${n.id}`}>
                    <Input id={`tot-a-${n.id}`} numeric inputMode="decimal" suffix="L" disabled={!bolehUbah} value={v.awal} onChange={(e) => ubah(n.id, { awal: e.target.value })} />
                  </Field>
                  <Field label="Akhir shift" htmlFor={`tot-b-${n.id}`}>
                    <Input id={`tot-b-${n.id}`} numeric inputMode="decimal" suffix="L" disabled={!bolehUbah} value={v.akhir} onChange={(e) => ubah(n.id, { akhir: e.target.value })} />
                  </Field>
                </div>
                <span className={cn('tabular text-body-sm', j !== null && j < 0 ? 'font-semibold text-error' : 'text-on-surface-variant')}>
                  Penjualan: {j === null ? '-' : formatLiter(j, 2)}
                </span>
              </GlassCard>
            )
          })}
        </section>
      ))}

      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        {ringkas.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md bg-surface-container-low p-space-sm">
            {ringkas.map((x) => (
              <span key={x.produk} className="tabular flex justify-between text-body-sm">
                <span className="text-on-surface-variant">{x.produk}</span>
                <b className="text-on-surface">{formatLiter(x.liter, 2)}</b>
              </span>
            ))}
          </div>
        )}
        <Field label="Petugas" htmlFor="tot-petugas">
          <Input id="tot-petugas" value={namaPetugas} disabled={!bolehUbah} onChange={(e) => setPetugas(e.target.value)} />
        </Field>
        <Field label="Catatan (opsional)" htmlFor="tot-catatan">
          <Input id="tot-catatan" autoComplete="off" value={isiCatatan} disabled={!bolehUbah} placeholder="Mis. display nozzle 3 mati" onChange={(e) => setCatatan(e.target.value)} />
        </Field>
        <ErrorBox text={error} />
        {bolehUbah ? (
          <Button size="lg" className="w-full" disabled={busy} onClick={() => void kirim()}>
            <Send aria-hidden="true" />
            Kirim totalizer {namaShift}
          </Button>
        ) : (
          <span className="text-body-sm text-on-surface-variant">Totalizer diisi security, kepala shift, pengawas, atau ABH.</span>
        )}
        <span className="text-body-sm text-on-surface-variant">Boleh dikirim di awal shift (akhir dikosongkan), lalu dilengkapi di akhir shift.</span>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

type BarisTot = { r: TotalizerRecord; jual: { produk: string; liter: number }[]; lengkap: boolean }

/** Report > Riwayat Totalizer: per bulan, penjualan per produk per shift dan per nozzle. */
export function RiwayatTotalizer() {
  const app = useApp()
  const toast = useToast()
  const [bulan, setBulan] = useState(todayIso().slice(0, 7))
  const [buka, setBuka] = useState<string | null>(null)
  const { recs, error, muat } = useCatatan<TotalizerData>('totalizer', `${bulan}-01`, akhirBulan(bulan))
  if (!app.loaded) return <Loading />
  const nozzles = app.settings.nozzles ?? []
  const rows: BarisTot[] = (recs ?? []).slice().reverse().map((r) => ({ r, jual: jualPerProduk([r]), lengkap: totalizerLengkap(r, nozzles) }))
  const totalBulan = jualPerProduk(recs ?? [])
  const perNozzle = new Map<string, { nama: string; produk: string; liter: number }>()
  for (const r of recs ?? []) for (const [nid, x] of Object.entries(r.data.nozzle)) {
    const j = jualNozzle(x)
    if (j === null) continue
    const y = perNozzle.get(nid) ?? { nama: x.nama, produk: x.produk, liter: 0 }
    y.liter += j
    perNozzle.set(nid, y)
  }
  const hapus = async (r: TotalizerRecord) => {
    if (!window.confirm(`Hapus totalizer ${formatTanggalIso(r.tanggal)} ${shiftLabel(r.shift as Shift)}?`)) return
    try {
      await app.backend.deleteCatatan('totalizer', r.id)
      toast('Catatan totalizer dihapus')
      void muat()
    } catch (e) {
      toast(pesan(e))
    }
  }
  const cols: Col<BarisTot>[] = [
    { header: 'Tanggal', cell: (x) => <span className="tabular whitespace-nowrap">{formatTanggalIso(x.r.tanggal)}</span>, mobileCell: (x) => `${formatTanggalIso(x.r.tanggal)} · Shift ${x.r.shift}`, mobile: 'title' },
    { header: 'Shift', cell: (x) => x.r.shift, mobile: 'hide' },
    { header: 'Penjualan', cell: (x) => (x.jual.length ? x.jual.map((j) => `${j.produk} ${formatLiter(j.liter, 2)}`).join(' · ') : '-'), mobile: 'sub' },
    { header: 'Petugas', cell: (x) => x.r.data.petugas || '-', mobile: 'sub' },
    { header: 'Status', cell: (x) => (x.lengkap ? <Pill tone="success">Lengkap</Pill> : <Pill>Akhir belum</Pill>), mobile: 'badge' },
  ]
  const terbuka = rows.find((x) => x.r.id === buka)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <Field label="Bulan" htmlFor="tot-bulan">
          <Input id="tot-bulan" type="month" value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-space-xs">
          {totalBulan.map((x) => (
            <div key={x.produk} className="rounded-md bg-surface-container-low p-space-xs">
              <span className="tabular block text-body-md font-bold text-on-surface">{formatLiter(x.liter, 2)}</span>
              <span className="text-[11px] uppercase text-on-surface-variant">{x.produk}</span>
            </div>
          ))}
          {!totalBulan.length && <span className="col-span-2 text-body-sm text-on-surface-variant">Belum ada penjualan tercatat bulan ini.</span>}
        </div>
        <ErrorBox text={error} />
      </GlassCard>
      {recs === null ? (
        <Loading />
      ) : (
        <div className="animate-entrance-2">
          <RecordTable title="Totalizer per shift" rows={rows} total={rows.length} cols={cols} rowKey={(x) => x.r.id} onRow={(x) => setBuka(buka === x.r.id ? null : x.r.id)} empty="Belum ada catatan totalizer bulan ini." />
        </div>
      )}
      {terbuka && (
        <GlassCard level={2} className="flex flex-col gap-space-xs p-space-md">
          <SectionHeader id="tot-detail" title={`${formatTanggalIso(terbuka.r.tanggal)} · ${shiftLabel(terbuka.r.shift as Shift)}`} />
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-on-surface-variant">
                  <th className="py-1 pr-2">Nozzle</th>
                  <th className="py-1 pr-2">Produk</th>
                  <th className="py-1 pr-2 text-right">Awal</th>
                  <th className="py-1 pr-2 text-right">Akhir</th>
                  <th className="py-1 text-right">Penjualan</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(terbuka.r.data.nozzle).map((x) => {
                  const j = jualNozzle(x)
                  return (
                    <tr key={x.nama} className="border-t border-outline-variant/40">
                      <td className="py-1 pr-2 font-semibold">{x.nama}</td>
                      <td className="py-1 pr-2">{x.produk}</td>
                      <td className="tabular py-1 pr-2 text-right">{angka(x.awal)}</td>
                      <td className="tabular py-1 pr-2 text-right">{angka(x.akhir)}</td>
                      <td className="tabular py-1 text-right font-semibold">{j === null ? '-' : formatNumber(j, 2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <span className="text-body-sm text-on-surface-variant">
            Awal {terbuka.r.data.jamAwal || '-'} · akhir {terbuka.r.data.jamAkhir || '-'} · {terbuka.r.data.petugas || '-'}
            {terbuka.r.data.catatan ? ` · ${terbuka.r.data.catatan}` : ''}
          </span>
          {app.canManage && (
            <Button variant="danger" onClick={() => void hapus(terbuka.r)}>
              <Trash2 aria-hidden="true" />
              Hapus catatan
            </Button>
          )}
        </GlassCard>
      )}
      {perNozzle.size > 0 && (
        <GlassCard level={2} className="flex flex-col gap-space-xs p-space-md">
          <SectionHeader id="tot-nozzle" title="Penjualan per nozzle (bulan ini)" />
          {[...perNozzle.values()]
            .sort((a, b) => a.nama.localeCompare(b.nama, 'id', { numeric: true }))
            .map((x) => (
              <span key={x.nama} className="tabular flex items-center justify-between gap-2 text-body-sm">
                <span className="flex items-center gap-2">
                  <Gauge aria-hidden="true" className="size-4 text-on-surface-variant" />
                  Nozzle {x.nama} · {x.produk}
                </span>
                <b>{formatLiter(x.liter, 2)}</b>
              </span>
            ))}
        </GlassCard>
      )}
    </div>
  )
}
