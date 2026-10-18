import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarRange, ChevronRight, Copy, Pencil, Plus, Save, UserRound, Users } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet } from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import { formatBulanTahun, todayIso } from '@/lib/date'
import { bertugas, JABATAN, KODE_JADWAL, kodeInfo, personilAktif, personilId, shiftSekarang, type JadwalData, type KodeJadwal } from '@/lib/personil'
import { SHIFTS, type Shift } from '@/lib/shift'
import type { Personil } from '@/lib/sop'
import { useJadwal } from '@/lib/use-jadwal'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
/** Daftar personil & jadwal diatur ABH / pengawas (sama dengan RLS bbm_jadwal). */
const bolehAtur = (role: string) => role === 'abh' || role === 'pengawas'
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const URUTAN: (KodeJadwal | '')[] = ['', '1', '2', '3', 'L', 'C', 'I']

/** Kartu personil yang sedang bertugas pada shift berjalan (dashboard & menu personil). */
export function KartuBertugas({ className }: { className?: string }) {
  const app = useApp()
  const k = shiftSekarang()
  const { jadwal } = useJadwal(k.bulan)
  const orang = bertugas(app.settings, jadwal?.data, k.tanggal, k.shift)
  const s = SHIFTS.find((x) => x.no === k.shift)!
  return (
    <GlassCard level={2} className={cn('flex flex-col gap-space-sm p-space-md', className)}>
      <div className="flex items-center justify-between gap-space-sm">
        <span className="flex items-center gap-space-xs">
          <span aria-hidden="true" className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-body-md font-bold text-on-surface">
            Sedang bertugas · {s.label} ({s.jam})
          </span>
        </span>
        <Link to="/personil" className="text-body-sm font-semibold text-primary">
          Jadwal
        </Link>
      </div>
      {jadwal === undefined ? (
        <span className="text-body-sm text-on-surface-variant">Memuat jadwal…</span>
      ) : !orang.length ? (
        <span className="text-body-sm text-on-surface-variant">{jadwal ? 'Tidak ada personil terjadwal pada shift ini.' : 'Jadwal shift bulan ini belum dibuat.'}</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {orang.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-body-sm text-emerald-900">
              <UserRound aria-hidden="true" className="size-3.5" />
              <b>{p.nama}</b>
              <span className="text-emerald-700">· {p.jabatan}</span>
            </span>
          ))}
        </div>
      )}
    </GlassCard>
  )
}

/** Operation > Personil & Jadwal Shift: siapa bertugas hari ini per shift, daftar personil. */
export function PersonilMenu() {
  const app = useApp()
  const toast = useToast()
  const hariIni = shiftSekarang()
  const { jadwal } = useJadwal(hariIni.bulan)
  const [ubah, setUbah] = useState<Personil | null>(null)
  if (!app.loaded) return <Loading />
  const semua = app.settings.personil ?? []
  const atur = bolehAtur(app.role)

  const simpan = (p: Personil) => {
    if (!p.nama.trim()) return toast('Isi nama personil.')
    const ada = semua.some((x) => x.id === p.id)
    app.updateSettings({ personil: ada ? semua.map((x) => (x.id === p.id ? { ...p, nama: p.nama.trim() } : x)) : [...semua, { ...p, nama: p.nama.trim() }] })
    setUbah(null)
  }

  return (
    <div className="flex flex-col gap-space-md">
      <KartuBertugas className="animate-entrance-1" />

      <section aria-labelledby="ps-hari" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="ps-hari" title="Jadwal hari ini" />
        <div className="grid gap-space-sm md:grid-cols-3">
          {SHIFTS.map((s) => {
            const orang = bertugas(app.settings, jadwal?.data, hariIni.tanggal, s.no)
            const kini = s.no === hariIni.shift
            return (
              <GlassCard key={s.no} level={2} className={cn('flex flex-col gap-space-xs p-space-md', kini && 'ring-2 ring-emerald-500')}>
                <div className="flex items-center justify-between">
                  <span className="text-body-md font-bold text-on-surface">{s.label}</span>
                  {kini ? <Pill tone="success">Sedang bertugas</Pill> : <span className="tabular text-body-sm text-on-surface-variant">{s.jam}</span>}
                </div>
                {orang.length ? (
                  orang.map((p) => (
                    <span key={p.id} className="text-body-sm text-on-surface">
                      {p.nama} <span className="text-on-surface-variant">· {p.jabatan}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-body-sm text-on-surface-variant">Belum dijadwalkan</span>
                )}
              </GlassCard>
            )
          })}
        </div>
      </section>

      <Link to="/personil/jadwal" className={cn(buttonVariants({ variant: 'glass', size: 'lg' }), 'justify-between')}>
        <span className="flex items-center gap-space-xs">
          <CalendarRange aria-hidden="true" />
          Jadwal shift bulanan
        </span>
        <ChevronRight aria-hidden="true" />
      </Link>

      <section aria-labelledby="ps-daftar" className="flex flex-col gap-space-sm">
        <SectionHeader id="ps-daftar" title={`Daftar personil (${personilAktif(app.settings).length} aktif)`} />
        {atur && (
          <Button variant="soft" className="self-start" onClick={() => setUbah({ id: personilId(), nama: '', jabatan: 'Operator', hp: '', aktif: true })}>
            <Plus aria-hidden="true" />
            Tambah personil
          </Button>
        )}
        {!semua.length ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Belum ada personil. {atur ? 'Tambahkan operator, kasir, kepala shift, security, dan cleaning service SPBU.' : 'Diisi oleh pengawas / ABH.'}
          </GlassCard>
        ) : (
          <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
            {[...semua]
              .sort((a, b) => Number(b.aktif) - Number(a.aktif) || JABATAN.indexOf(a.jabatan) - JABATAN.indexOf(b.jabatan) || a.nama.localeCompare(b.nama))
              .map((p) => (
                <div key={p.id} className={cn('flex items-center gap-space-sm px-space-md py-space-sm', !p.aktif && 'opacity-60')}>
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Users className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body-md font-semibold text-on-surface">{p.nama}</span>
                    <span className="truncate text-body-sm text-on-surface-variant">
                      {p.jabatan}
                      {p.hp ? ` · ${p.hp}` : ''}
                      {!p.aktif ? ' · tidak aktif' : ''}
                    </span>
                  </span>
                  {atur && (
                    <Button variant="ghost" size="icon" aria-label={`Ubah ${p.nama}`} onClick={() => setUbah(p)}>
                      <Pencil aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ))}
          </GlassCard>
        )}
      </section>

      <Sheet open={!!ubah} onOpenChange={(o) => !o && setUbah(null)} title={ubah && semua.some((x) => x.id === ubah.id) ? 'Ubah personil' : 'Tambah personil'}>
        {ubah && (
          <div className="flex flex-col gap-space-md">
            <Field label="Nama" htmlFor="ps-nama">
              <Input id="ps-nama" autoComplete="off" value={ubah.nama} onChange={(e) => setUbah({ ...ubah, nama: e.target.value })} />
            </Field>
            <Field label="Jabatan" htmlFor="ps-jabatan">
              <Select value={ubah.jabatan} onValueChange={(v) => setUbah({ ...ubah, jabatan: v })}>
                <SelectTrigger id="ps-jabatan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JABATAN.map((j) => (
                    <SelectItem key={j} value={j}>
                      {j}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="No. HP (opsional)" htmlFor="ps-hp">
              <Input id="ps-hp" inputMode="tel" autoComplete="off" value={ubah.hp} onChange={(e) => setUbah({ ...ubah, hp: e.target.value })} />
            </Field>
            <label className="flex items-center gap-space-sm text-body-md text-on-surface">
              <input type="checkbox" className="size-5 accent-primary" checked={ubah.aktif} onChange={(e) => setUbah({ ...ubah, aktif: e.target.checked })} />
              Masih bertugas di SPBU ini
            </label>
            <Button size="lg" onClick={() => simpan(ubah)}>
              <Save aria-hidden="true" />
              Simpan personil
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}

/** Personil > Jadwal shift bulanan: grid personil × tanggal (ketuk sel untuk mengganti shift/libur/cuti). */
export function JadwalShift() {
  const app = useApp()
  const toast = useToast()
  const [bulan, setBulan] = useState(todayIso().slice(0, 7))
  const { jadwal, error, muat } = useJadwal(bulan)
  const [edit, setEdit] = useState<{ bulan: string; roster: JadwalData['roster'] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const nHari = new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0).getDate()
  const hari = useMemo(() => Array.from({ length: nHari }, (_, i) => i + 1), [nHari])
  if (!app.loaded || jadwal === undefined) return <Loading />
  const atur = bolehAtur(app.role)
  const roster = edit?.bulan === bulan ? edit.roster : (jadwal?.data.roster ?? {})
  const orang = (app.settings.personil ?? []).filter((p) => p.aktif || Object.keys(roster[p.id] ?? {}).length)
  const hariIni = todayIso()
  const setSel = (pid: string, d: number) => {
    if (!atur) return
    const kini = roster[pid]?.[d] ?? ''
    const next = URUTAN[(URUTAN.indexOf(kini) + 1) % URUTAN.length]
    const baris = { ...(roster[pid] ?? {}) }
    if (next) baris[d] = next
    else delete baris[d]
    setEdit({ bulan, roster: { ...roster, [pid]: baris } })
  }
  // Salin pola 7 hari pertama ke seluruh bulan (rotasi mingguan).
  const ulangPola = () => {
    const r: JadwalData['roster'] = {}
    for (const p of orang) {
      const pola = roster[p.id] ?? {}
      r[p.id] = {}
      for (const d of hari) {
        const k = pola[((d - 1) % 7) + 1]
        if (k) r[p.id][d] = k
      }
    }
    setEdit({ bulan, roster: r })
  }
  const simpan = async () => {
    setBusy(true)
    setErr(null)
    try {
      await app.backend.saveCatatan<JadwalData>('jadwal', {
        id: bulan,
        tanggal: `${bulan}-01`,
        shift: 0,
        data: { roster },
        createdAt: jadwal?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        createdBy: jadwal?.createdBy ?? app.session.user?.id ?? null,
      })
      setEdit(null)
      await muat()
      toast('Jadwal shift tersimpan')
    } catch (e) {
      setErr(pesan(e))
    } finally {
      setBusy(false)
    }
  }
  const jumlah = (d: number, s: Shift) => orang.filter((p) => roster[p.id]?.[d] === String(s)).length

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <Field label="Bulan" htmlFor="js-bulan">
          <Input id="js-bulan" type="month" value={bulan} onChange={(e) => e.target.value && (setBulan(e.target.value), setEdit(null))} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {KODE_JADWAL.map((k) => (
            <span key={k.kode} className={cn('rounded-full px-2.5 py-1 text-[12px] font-semibold', k.kelas)}>
              {k.kode} = {k.label}
            </span>
          ))}
        </div>
        <span className="text-body-sm text-on-surface-variant">
          {atur ? 'Ketuk sel untuk berganti: kosong → Shift 1 → 2 → 3 → Libur → Cuti → Izin. Simpan setelah selesai.' : 'Jadwal diatur pengawas / ABH.'} {formatBulanTahun(new Date(`${bulan}-01T00:00:00`))}.
        </span>
        <ErrorBox text={error ?? err} />
      </GlassCard>

      {!orang.length ? (
        <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
          Belum ada personil aktif. Tambahkan di <Link to="/personil" className="font-semibold text-primary">Daftar personil</Link>.
        </GlassCard>
      ) : (
        <GlassCard level={2} className="overflow-x-auto p-0">
          <table className="border-separate border-spacing-0 text-body-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-36 bg-surface-container-lowest px-space-sm py-space-xs text-left text-tag uppercase text-on-surface-variant">Personil</th>
                {hari.map((d) => {
                  const iso = `${bulan}-${String(d).padStart(2, '0')}`
                  const w = new Date(`${iso}T00:00:00`).getDay()
                  return (
                    <th key={d} className={cn('min-w-9 px-0.5 py-space-xs text-center font-semibold', w === 0 ? 'text-error' : 'text-on-surface-variant', iso === hariIni && 'bg-primary/10')}>
                      <span className="block text-[10px] font-normal">{HARI[w]}</span>
                      {d}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {orang.map((p) => (
                <tr key={p.id}>
                  <td className="sticky left-0 z-10 border-t border-outline-variant/40 bg-surface-container-lowest px-space-sm py-1">
                    <span className="block max-w-40 truncate font-semibold text-on-surface">{p.nama}</span>
                    <span className="block text-[11px] text-on-surface-variant">{p.jabatan}</span>
                  </td>
                  {hari.map((d) => {
                    const k = roster[p.id]?.[d]
                    const info = kodeInfo(k)
                    return (
                      <td key={d} className="border-t border-outline-variant/40 p-0.5 text-center">
                        <button
                          type="button"
                          disabled={!atur}
                          aria-label={`${p.nama} tanggal ${d}: ${info?.label ?? 'kosong'}`}
                          onClick={() => setSel(p.id, d)}
                          className={cn('tabular h-8 w-8 rounded text-[12px] font-bold', info?.kelas ?? 'bg-surface-container-low text-on-surface-variant/40')}
                        >
                          {k ?? '·'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {SHIFTS.map((s) => (
                <tr key={s.no}>
                  <td className="sticky left-0 z-10 border-t border-outline-variant/40 bg-surface-container-lowest px-space-sm py-1 text-[11px] font-semibold uppercase text-on-surface-variant">Jumlah {s.label}</td>
                  {hari.map((d) => (
                    <td key={d} className={cn('tabular border-t border-outline-variant/40 text-center text-[12px]', jumlah(d, s.no) ? 'text-on-surface' : 'text-error')}>
                      {jumlah(d, s.no)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}

      {atur && orang.length > 0 && (
        <div className="flex flex-wrap gap-space-sm">
          <Button variant="glass" onClick={ulangPola}>
            <Copy aria-hidden="true" />
            Ulangi pola 7 hari pertama
          </Button>
          <Button disabled={busy || !edit} onClick={() => void simpan()}>
            <Save aria-hidden="true" />
            Simpan jadwal
          </Button>
        </div>
      )}
    </div>
  )
}
