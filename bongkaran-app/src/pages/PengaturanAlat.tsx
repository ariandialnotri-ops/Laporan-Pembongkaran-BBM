import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox, ProdukSelect } from '@/components/bongkaran/lo-fields'
import { BARIS_ORANYE, ProdukChip, RecordTable, type Col } from '@/components/bongkaran/record-table'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { namaPulau } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import { berlakuSertifikat, MASA_SERTIFIKAT_BULAN, statusSertifikat } from '@/lib/berlaku'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { genId } from '@/lib/image'
import { PRODUK_OPTIONS, type Dispenser, type Nozzle } from '@/lib/sop'
import { cn } from '@/lib/utils'

const TANPA = '__tanpa__'

function TeraPill({ tgl }: { tgl?: string }) {
  const st = statusSertifikat(tgl, todayIso())
  return st === 'lewat' ? <Pill tone="error">Tera lewat</Pill> : st === 'segera' ? <Pill>Tera ≤ 30 hari</Pill> : st === 'belum' ? <Pill>Belum dicatat</Pill> : <Pill tone="success">Berlaku</Pill>
}

/** Pengaturan > Data Dispenser: unit dispenser (nomor/nama, merk, nomor seri, pulau). */
export function DataDispenser() {
  const app = useApp()
  const toast = useToast()
  const [edit, setEdit] = useState<Dispenser | null>(null)
  if (!app.loaded) return <Loading />
  const s = app.settings
  const list = s.dispensers ?? []
  const ubah = app.isAdmin
  const simpanList = (next: Dispenser[], nozzles = s.nozzles) => app.updateSettings({ dispensers: next, jumlahDispenser: next.length, nozzles })
  const baru = (): Dispenser => ({ id: genId('disp'), nama: `Dispenser ${list.length + 1}`, merk: '', noSeri: '', pulau: '' })

  const cols: Col<Dispenser>[] = [
    { header: 'Unit', cell: (x) => <span className="font-semibold">{x.nama || '-'}</span>, mobile: 'title' },
    { header: 'Merk', cell: (x) => x.merk || '-', mobile: 'sub' },
    { header: 'Nomor seri', cell: (x) => <span className="tabular">{x.noSeri || '-'}</span>, mobile: 'sub' },
    { header: 'Pulau', cell: (x) => x.pulau || '-', mobile: 'sub' },
    { header: 'Nozzle', cell: (x) => s.nozzles.filter((n) => n.dispenserId === x.id).map((n) => n.nama).join(', ') || '-', mobile: 'hide' },
  ]

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="tabular text-body-md font-semibold text-on-surface">{list.length} unit dispenser</span>
        <span className="text-body-sm text-on-surface-variant">Nozzle dihubungkan ke unit dispenser di menu Nozzle & Tera Metrologi.</span>
        {ubah ? (
          <Button size="lg" onClick={() => setEdit(baru())}>
            <Plus aria-hidden="true" />
            Tambah dispenser
          </Button>
        ) : (
          <span className="text-body-sm text-on-surface-variant">Data dispenser hanya dapat diubah ABH.</span>
        )}
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable title="Data Dispenser" rows={list} total={list.length} cols={cols} rowKey={(x) => x.id} onRow={ubah ? setEdit : undefined} empty='Belum ada dispenser. Ketuk "Tambah dispenser".' />
      </div>
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit && list.some((x) => x.id === edit.id) ? `Ubah ${edit.nama}` : 'Dispenser baru'}>
        {edit && (
          <FormDispenser
            key={edit.id}
            awal={edit}
            pulau={Array.from({ length: s.jumlahPulau || 0 }, (_, i) => namaPulau(i + 1))}
            ada={list.some((x) => x.id === edit.id)}
            namaLain={list.filter((x) => x.id !== edit.id).map((x) => x.nama.trim().toLowerCase())}
            onSimpan={(d) => {
              simpanList(list.some((x) => x.id === d.id) ? list.map((x) => (x.id === d.id ? d : x)) : [...list, d])
              toast(`${d.nama} tersimpan`)
              setEdit(null)
            }}
            onHapus={() => {
              if (!window.confirm(`Hapus ${edit.nama}? Nozzle di unit ini tidak lagi terhubung ke dispenser.`)) return
              simpanList(
                list.filter((x) => x.id !== edit.id),
                s.nozzles.map((n) => (n.dispenserId === edit.id ? { ...n, dispenserId: undefined } : n)),
              )
              setEdit(null)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

function FormDispenser({ awal, pulau, ada, namaLain, onSimpan, onHapus }: { awal: Dispenser; pulau: string[]; ada: boolean; namaLain: string[]; onSimpan: (d: Dispenser) => void; onHapus: () => void }) {
  const [d, setD] = useState(awal)
  const [error, setError] = useState<string | null>(null)
  const set = (p: Partial<Dispenser>) => (setError(null), setD({ ...d, ...p }))
  const simpan = () => {
    if (!d.nama.trim()) return setError('Isi nomor/nama unit dispenser.')
    if (namaLain.includes(d.nama.trim().toLowerCase())) return setError(`Nama "${d.nama.trim()}" sudah dipakai.`)
    if (!d.merk.trim()) return setError('Isi merk dispenser.')
    if (!d.noSeri.trim()) return setError('Isi nomor seri dispenser.')
    onSimpan({ ...d, nama: d.nama.trim(), merk: d.merk.trim(), noSeri: d.noSeri.trim() })
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-space-sm">
        <Field label="Nomor / nama unit" htmlFor="disp-nama">
          <Input id="disp-nama" autoComplete="off" value={d.nama} onChange={(e) => set({ nama: e.target.value })} />
        </Field>
        <Field label="Pulau pompa" htmlFor="disp-pulau">
          <Select value={d.pulau || TANPA} onValueChange={(v) => set({ pulau: v === TANPA ? '' : v })}>
            <SelectTrigger id="disp-pulau">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TANPA}>Belum diatur</SelectItem>
              {pulau.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Merk" htmlFor="disp-merk">
          <Input id="disp-merk" autoComplete="off" placeholder="Mis. Tatsuno, Gilbarco" value={d.merk} onChange={(e) => set({ merk: e.target.value })} />
        </Field>
        <Field label="Nomor seri" htmlFor="disp-seri">
          <Input id="disp-seri" autoComplete="off" value={d.noSeri} onChange={(e) => set({ noSeri: e.target.value })} />
        </Field>
      </div>
      <ErrorBox text={error} />
      <div className="flex gap-space-xs">
        {ada && (
          <Button variant="ghost" size="icon" aria-label="Hapus dispenser" onClick={onHapus}>
            <Trash2 aria-hidden="true" />
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={simpan}>
          <Save aria-hidden="true" />
          Simpan dispenser
        </Button>
      </div>
    </>
  )
}

/** Pengaturan > Nozzle & Tera Metrologi: nozzle per dispenser dan masa berlaku sertifikat tera (maks. 1 tahun). */
export function NozzleTera() {
  const app = useApp()
  const toast = useToast()
  const [edit, setEdit] = useState<Nozzle | null>(null)
  if (!app.loaded) return <Loading />
  const s = app.settings
  const list = s.nozzles ?? []
  const disp = s.dispensers ?? []
  const ubah = app.isAdmin
  const today = todayIso()
  const st = (n: Nozzle) => statusSertifikat(n.teraTanggal, today)
  const lewat = list.filter((n) => st(n) === 'lewat').length
  const segera = list.filter((n) => st(n) === 'segera').length
  const belum = list.filter((n) => st(n) === 'belum').length

  const cols: Col<Nozzle>[] = [
    { header: 'Nozzle', cell: (x) => <span className="font-semibold">{x.nama}</span>, mobileCell: (x) => `${x.nama} (${x.produk})`, mobile: 'title' },
    { header: 'Produk', cell: (x) => <ProdukChip produk={x.produk} />, mobile: 'hide' },
    { header: 'Dispenser', cell: (x) => disp.find((d) => d.id === x.dispenserId)?.nama ?? '-', mobile: 'sub' },
    { header: 'No. sertifikat tera', cell: (x) => <span className="tabular">{x.teraNoSertifikat || '-'}</span>, mobile: 'hide' },
    { header: 'Tanggal tera', cell: (x) => <span className="tabular whitespace-nowrap">{x.teraTanggal ? formatTanggalIso(x.teraTanggal) : '-'}</span>, mobile: 'hide' },
    {
      header: 'Berlaku s/d',
      cell: (x) =>
        x.teraTanggal ? (
          <span className={cn('tabular whitespace-nowrap', st(x) === 'lewat' ? 'font-semibold text-error' : st(x) === 'segera' ? 'font-semibold text-amber-700' : '')}>
            {formatTanggalIso(berlakuSertifikat(x.teraTanggal))}
          </span>
        ) : (
          <span className="italic text-on-surface-variant">belum dicatat</span>
        ),
      mobile: 'sub',
    },
    { header: 'Status', cell: (x) => <TeraPill tgl={x.teraTanggal} />, mobile: 'badge' },
  ]

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="text-body-sm text-on-surface-variant">
          Sertifikat tera metrologi berlaku maks. {MASA_SERTIFIKAT_BULAN} bulan dari tanggal keluar sertifikat. Nozzle dipakai untuk totalisator bongkar dan uji bejana 20 L di Kualitas Harian.
        </span>
        <div className="flex flex-wrap gap-space-xs">
          <Pill tone={lewat ? 'error' : 'success'}>{lewat} lewat</Pill>
          <Pill>{segera} ≤ 30 hari</Pill>
          <Pill>{belum} belum dicatat</Pill>
        </div>
        {ubah ? (
          <Button size="lg" onClick={() => setEdit({ id: genId('nz'), nama: `Nozzle ${list.length + 1}`, produk: list.at(-1)?.produk ?? PRODUK_OPTIONS[0] })}>
            <Plus aria-hidden="true" />
            Tambah nozzle
          </Button>
        ) : (
          <span className="text-body-sm text-on-surface-variant">Data nozzle hanya dapat diubah ABH.</span>
        )}
      </GlassCard>
      <div className="animate-entrance-2">
        <RecordTable
          title="Nozzle & Tera Metrologi"
          rows={list}
          total={list.length}
          cols={cols}
          rowKey={(x) => x.id}
          onRow={ubah ? setEdit : undefined}
          rowClass={(x) => (st(x) === 'lewat' || st(x) === 'segera' ? BARIS_ORANYE : undefined)}
          empty='Belum ada nozzle. Ketuk "Tambah nozzle".'
        />
      </div>
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit && list.some((x) => x.id === edit.id) ? `Ubah ${edit.nama}` : 'Nozzle baru'}>
        {edit && (
          <FormNozzle
            key={edit.id}
            awal={edit}
            dispensers={disp}
            ada={list.some((x) => x.id === edit.id)}
            namaLain={list.filter((x) => x.id !== edit.id).map((x) => x.nama.trim().toLowerCase())}
            onSimpan={(n) => {
              app.updateSettings({ nozzles: list.some((x) => x.id === n.id) ? list.map((x) => (x.id === n.id ? n : x)) : [...list, n] })
              toast(`${n.nama} tersimpan`)
              setEdit(null)
            }}
            onHapus={() => {
              if (!window.confirm(`Hapus ${edit.nama}?`)) return
              app.updateSettings({ nozzles: list.filter((x) => x.id !== edit.id) })
              setEdit(null)
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

function FormNozzle({ awal, dispensers, ada, namaLain, onSimpan, onHapus }: { awal: Nozzle; dispensers: Dispenser[]; ada: boolean; namaLain: string[]; onSimpan: (n: Nozzle) => void; onHapus: () => void }) {
  const [n, setN] = useState(awal)
  const [error, setError] = useState<string | null>(null)
  const set = (p: Partial<Nozzle>) => (setError(null), setN({ ...n, ...p }))
  const simpan = () => {
    if (!n.nama.trim()) return setError('Isi nama nozzle.')
    if (namaLain.includes(n.nama.trim().toLowerCase())) return setError(`Nama "${n.nama.trim()}" sudah dipakai.`)
    if (n.teraTanggal && n.teraTanggal > todayIso()) return setError('Tanggal sertifikat tera tidak boleh di masa depan.')
    onSimpan({ ...n, nama: n.nama.trim(), teraNoSertifikat: n.teraNoSertifikat?.trim() })
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-space-sm">
        <Field label="Nama nozzle" htmlFor="nz-nama">
          <Input id="nz-nama" autoComplete="off" value={n.nama} onChange={(e) => set({ nama: e.target.value })} />
        </Field>
        <Field label="Produk" htmlFor="nz-produk">
          <ProdukSelect id="nz-produk" value={n.produk} onChange={(v) => set({ produk: v })} />
        </Field>
        <Field label="Unit dispenser" htmlFor="nz-disp" className="col-span-2">
          <Select value={n.dispenserId || TANPA} onValueChange={(v) => set({ dispenserId: v === TANPA ? undefined : v })}>
            <SelectTrigger id="nz-disp">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TANPA}>Belum dihubungkan</SelectItem>
              {dispensers.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nama}
                  {d.merk ? `, ${d.merk}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="No. sertifikat tera" htmlFor="nz-sertifikat">
          <Input id="nz-sertifikat" autoComplete="off" value={n.teraNoSertifikat ?? ''} onChange={(e) => set({ teraNoSertifikat: e.target.value })} />
        </Field>
        <Field
          label="Tanggal keluar sertifikat"
          htmlFor="nz-tera"
          hint={n.teraTanggal ? `Berlaku sampai ${formatTanggalIso(berlakuSertifikat(n.teraTanggal))}.` : `Tera metrologi berlaku maks. ${MASA_SERTIFIKAT_BULAN} bulan.`}
        >
          <Input id="nz-tera" type="date" max={todayIso()} value={n.teraTanggal ?? ''} onChange={(e) => set({ teraTanggal: e.target.value })} />
        </Field>
      </div>
      <ErrorBox text={error} />
      <div className="flex gap-space-xs">
        {ada && (
          <Button variant="ghost" size="icon" aria-label="Hapus nozzle" onClick={onHapus}>
            <Trash2 aria-hidden="true" />
          </Button>
        )}
        <Button size="lg" className="flex-1" onClick={simpan}>
          <Save aria-hidden="true" />
          Simpan nozzle
        </Button>
      </div>
    </>
  )
}

/** Profil > Sold To & Ship To (ABH & pengawas): mengisi otomatis form bongkaran dan permintaan MS2. */
export function SoldShipTo() {
  const app = useApp()
  // Isian awal diambil setelah pengaturan dimuat.
  return app.loaded ? <SoldShipToForm /> : <Loading />
}

function SoldShipToForm() {
  const app = useApp()
  const toast = useToast()
  const s = app.settings
  const [soldTo, setSoldTo] = useState(() => s.soldTo ?? '')
  const [shipTo, setShipTo] = useState<Record<string, string>>(() => ({ ...(s.shipTo ?? {}) }))
  const ubah = app.isAdmin || app.role === 'pengawas'
  const simpan = () => {
    app.updateSettings({ soldTo: soldTo.trim(), shipTo: Object.fromEntries(Object.entries(shipTo).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)) })
    toast('Sold To & Ship To tersimpan')
  }
  return (
    <div className="flex flex-col gap-space-md">
      <fieldset disabled={!ubah} className="flex min-w-0 flex-col gap-space-md">
        <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
          <Field label="No. Sold To (satu untuk SPBU)" htmlFor="set-soldto">
            <Input id="set-soldto" autoComplete="off" inputMode="numeric" value={soldTo} onChange={(e) => setSoldTo(e.target.value)} />
          </Field>
        </GlassCard>
        <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
          <span className="text-tag uppercase text-primary">No. Ship To per produk</span>
          <span className="text-body-sm text-on-surface-variant">Terisi otomatis di form bongkaran setelah LO dipilih, dan di permintaan MS2.</span>
          {PRODUK_OPTIONS.map((p) => (
            <div key={p} className="grid grid-cols-[8.5rem_1fr] items-center gap-space-sm">
              <ProdukChip produk={p} />
              <Input id={`set-shipto-${p.toLowerCase().replace(/\s+/g, '-')}`} aria-label={`Ship To ${p}`} autoComplete="off" inputMode="numeric" value={shipTo[p] ?? ''} onChange={(e) => setShipTo({ ...shipTo, [p]: e.target.value })} />
            </div>
          ))}
        </GlassCard>
        {ubah && (
          <Button size="lg" className="animate-entrance-3" onClick={simpan}>
            <Save aria-hidden="true" />
            Simpan Sold To & Ship To
          </Button>
        )}
      </fieldset>
    </div>
  )
}
