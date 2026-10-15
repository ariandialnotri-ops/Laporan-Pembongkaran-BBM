import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Droplet, LoaderCircle, PenLine, Send, Trash2, X } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { PilihShift, useKunciShift } from '@/components/bongkaran/pilih-shift'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { TangkiBelumAda } from '@/components/bongkaran/stok-gate'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { airId, airLengkap, literAir, statusAir, tangkiBerair, type AirData, type AirRecord, type AirTangki } from '@/lib/air'
import { useApp } from '@/lib/app-state'
import { addDays, formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { formatLiter } from '@/lib/format'
import { capWaktu, compressImage, genId } from '@/lib/image'
import { currentShift, shiftLabel } from '@/lib/shift'
import type { Photo } from '@/lib/sop'
import { statusShift } from '@/lib/status-isi'
import { TANKS, tankName, type Tank } from '@/lib/tank'
import { useKeTerkirim } from '@/lib/terkirim'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const namaTangki = (t: Tank) => `${tankName(t.tankNo)} · ${t.produk}`
const keteranganMm = (t: AirTangki | undefined, tank: Tank | undefined) => {
  const st = statusAir(t)
  if (st === 'kosong' || !t) return '-'
  if (st === 'nihil') return 'Nihil'
  const l = t.liter ?? literAir(tank, t.airMm)
  return `${t.airMm} mm${l ? ` ≈ ${formatLiter(l)}` : ''}`
}

/** Catatan water content pada rentang tanggal; dimuat ulang saat SPBU/rentang berubah. */
function useAir(from: string, to: string) {
  const app = useApp()
  const kunci = `${app.spbuId}|${from}|${to}`
  const [hasil, setHasil] = useState<{ kunci: string; recs: AirRecord[]; error: string | null } | null>(null)
  const muat = useCallback(
    () =>
      app.backend.listAir(from, to).then(
        (recs) => setHasil({ kunci, recs, error: null }),
        (e) => setHasil({ kunci, recs: [], error: pesan(e) }),
      ),
    [app.backend, from, to, kunci],
  )
  useEffect(() => {
    void muat()
  }, [muat])
  const kini = hasil?.kunci === kunci ? hasil : null
  return { recs: kini?.recs ?? null, error: kini?.error ?? null, muat }
}

/** Operation > Water Content Tangki: pilih shift (hijau sudah, oranye belum, merah terlewat). */
export function AirMenu() {
  const app = useApp()
  const hariIni = currentShift().tanggal
  const { recs, error } = useAir(todayIso(addDays(new Date(`${hariIni}T00:00:00`), -60)), hariIni)
  if (!app.loaded || !recs) return <Loading />
  if (!TANKS.length) return <TangkiBelumAda className="animate-entrance-1" detail="Water content diperiksa per tangki pendam, jadi menunggu database tangki SPBU ini." />
  const rec = (tanggal: string, shift: AirRecord['shift']) => recs.find((r) => r.id === airId(tanggal, shift))
  return (
    <div className="flex flex-col gap-space-md">
      <p className="animate-entrance-1 px-space-xs text-body-sm text-on-surface-variant">
        Periksa air di dasar setiap tangki pendam dengan pasta air pada stik ukur, setiap shift. Air wajib nihil; bila ada air, catat tindakannya (penyedotan/pengurasan) dan lapor pengawas.
      </p>
      <ErrorBox text={error} />
      <PilihShift
        status={(k) => statusShift(k, airLengkap(rec(k.tanggal, k.shift), TANKS))}
        keHalaman={(k) => `/air/${k.tanggal}/${k.shift}`}
        keterangan={(k, st) => {
          const r = rec(k.tanggal, k.shift)
          if (!r) return undefined
          const berair = tangkiBerair(r, TANKS)
          const isi = berair.length ? `Ada air: ${berair.map((t) => tankName(t.tankNo)).join(', ')}` : st === 'sudah' ? 'Semua tangki nihil' : 'Sebagian tangki tersimpan'
          return `${isi} · ${r.data.petugas || '-'}`
        }}
      />
      {app.can('/laporan/air') && (
        <Link to="/laporan/air" className={buttonVariants({ variant: 'glass' })}>
          Riwayat water content
        </Link>
      )}
    </div>
  )
}

type IsianTangki = { airMm: string; tindakan: string; fotoLama: Photo[]; fotoBaru: FotoLokal[] }

/** Halaman form water content satu shift: semua tangki pendam. */
export function AirForm() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const { tanggal, shift, valid } = useKunciShift()
  const id = valid ? airId(tanggal, shift) : ''
  const { recs } = useAir(tanggal || todayIso(), tanggal || todayIso())
  const lama = recs?.find((r) => r.id === id)
  const [isian, setIsian] = useState<Record<string, IsianTangki> | null>(null)
  const [petugas, setPetugas] = useState<string | null>(null)
  const [catatan, setCatatan] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const namaShift = shiftLabel(shift).split(' (')[0]
  const guard = useLeaveGuard({ active: true, title: `Keluar dari water content ${namaShift}?`, detail: 'Isian dan foto yang belum dikirim akan hilang.' })
  const fotoLamaSemua = useMemo(() => Object.values(lama?.data.tangki ?? {}).flatMap((t) => t.foto), [lama])
  const srcOf = usePhotoSrc(fotoLamaSemua)

  if (!app.loaded || (valid && !recs)) return <Loading />
  if (!TANKS.length) return <TangkiBelumAda className="animate-entrance-1" />
  if (!valid) return <GlassCard className="p-space-md">Shift tidak dikenal.</GlassCard>

  const awal = (t: Tank): IsianTangki => {
    const x = lama?.data.tangki[t.id]
    return { airMm: x?.airMm ?? '', tindakan: x?.tindakan ?? '', fotoLama: x?.foto ?? [], fotoBaru: [] }
  }
  const nilai = (t: Tank) => isian?.[t.id] ?? awal(t)
  const ubah = (t: Tank, patch: Partial<IsianTangki>) => {
    setError(null)
    setIsian((x) => ({ ...(x ?? Object.fromEntries(TANKS.map((k) => [k.id, awal(k)]))), [t.id]: { ...nilai(t), ...patch } }))
  }
  const namaPetugas = petugas ?? lama?.data.petugas ?? (app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName)
  const isiCatatan = catatan ?? lama?.data.catatan ?? ''

  const ambil = async (t: Tank, files: File[]) => {
    setBusy(t.id)
    try {
      const baru: FotoLokal[] = []
      for (const f of files) {
        const blob = await compressImage(f, { cap: [capWaktu(), `${app.settings.namaSpbu || 'SPBU'} · ${namaTangki(t)}`, `Water content · ${formatTanggalIso(tanggal)} ${namaShift}`] })
        baru.push({ id: genId('f'), blob, url: URL.createObjectURL(blob) })
      }
      ubah(t, { fotoBaru: [...nilai(t).fotoBaru, ...baru] })
    } catch (e) {
      setError(`Gagal memproses foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const kirim = async () => {
    for (const t of TANKS) {
      const v = nilai(t)
      const st = statusAir({ airMm: v.airMm, liter: null, foto: [], tindakan: '' })
      if (st === 'kosong') return setError(`${namaTangki(t)}: isi tinggi air (0 bila nihil).`)
      if (!v.fotoLama.length && !v.fotoBaru.length) return setError(`${namaTangki(t)}: foto stik pasta air wajib.`)
      if (st === 'ada' && !v.tindakan.trim()) return setError(`${namaTangki(t)}: ada air, isi tindakan yang dilakukan.`)
    }
    if (!namaPetugas.trim()) return setError('Isi nama petugas.')
    setBusy('kirim')
    try {
      const tangki: AirData['tangki'] = {}
      const dibuang: Photo[] = []
      for (const t of TANKS) {
        const v = nilai(t)
        const foto = [...v.fotoLama]
        for (const [i, f] of v.fotoBaru.entries()) foto.push(await app.backend.uploadPhoto(`air-${id}`, f.blob, `air-${t.tankNo}-${Date.now()}-${i + 1}.jpg`))
        dibuang.push(...(lama?.data.tangki[t.id]?.foto ?? []).filter((p) => !v.fotoLama.some((x) => x.id === p.id)))
        const nihil = statusAir({ airMm: v.airMm, liter: null, foto: [], tindakan: '' }) === 'nihil'
        tangki[t.id] = { airMm: v.airMm.trim(), liter: literAir(t, v.airMm), foto, tindakan: nihil ? '' : v.tindakan.trim() }
      }
      const rec: AirRecord = {
        id,
        tanggal,
        shift,
        data: { tangki, petugas: namaPetugas.trim(), jam: nowHm(), catatan: isiCatatan.trim() },
        createdAt: lama?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        createdBy: lama?.createdBy ?? app.session.user?.id ?? null,
      }
      await app.backend.saveAir(rec)
      for (const p of dibuang) void app.backend.deletePhoto(p).catch(() => {})
      for (const t of TANKS) for (const f of nilai(t).fotoBaru) URL.revokeObjectURL(f.url)
      guard.bypass()
      const berair = tangkiBerair(rec, TANKS)
      keTerkirim({
        judul: `Water content ${namaShift} terkirim`,
        detail: `${formatTanggalIso(tanggal)}, ${shiftLabel(shift)}`,
        peringatan: berair.length ? `Ada air di ${berair.map((t) => tankName(t.tankNo)).join(', ')}: lakukan penyedotan/pengurasan dan laporkan ke pengawas.` : undefined,
        baris: [...TANKS.map((t): [string, string] => [namaTangki(t), keteranganMm(rec.data.tangki[t.id], t)]), ['Petugas', rec.data.petugas]],
        aksi: [{ to: '/air', label: 'Pilih shift lain' }, ...(app.can('/laporan/air') ? [{ to: '/laporan/air', label: 'Riwayat water content' }] : [])],
      })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col p-space-md">
        <span className="text-tag uppercase text-primary">
          Water content tangki pendam · {formatTanggalIso(tanggal)}
        </span>
        <span className="text-headline-md font-bold text-on-surface">{shiftLabel(shift)}</span>
        <span className="text-body-sm text-on-surface-variant">Oleskan pasta air di ujung stik ukur, celupkan sampai dasar tangki, tunggu perubahan warna, lalu baca tinggi air. Tidak berubah warna = nihil (0 mm).</span>
      </GlassCard>

      {TANKS.map((t, ti) => {
        const v = nilai(t)
        const st = statusAir({ airMm: v.airMm, liter: null, foto: [], tindakan: '' })
        const liter = literAir(t, v.airMm)
        return (
          <GlassCard key={t.id} level={2} className={cn('flex flex-col gap-space-sm p-space-md', ti < 3 && ['animate-entrance-2', 'animate-entrance-3', 'animate-entrance-4'][ti], st === 'ada' && 'border border-error/40')}>
            <div className="flex items-center justify-between gap-space-sm">
              <span className="flex min-w-0 items-center gap-space-xs">
                <span aria-hidden="true" className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', st === 'ada' ? 'bg-error text-on-error' : st === 'nihil' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant')}>
                  <Droplet className="size-5" />
                </span>
                <span className="text-body-md font-bold text-on-surface">{namaTangki(t)}</span>
              </span>
              {st !== 'kosong' && <Pill tone={st === 'ada' ? 'error' : 'success'}>{st === 'ada' ? `Ada air${liter ? ` ≈ ${formatLiter(liter)}` : ''}` : 'Nihil'}</Pill>}
            </div>
            <div className="flex items-end gap-space-xs">
              <Field label="Tinggi air" htmlFor={`air-${t.id}`} className="flex-1">
                <Input id={`air-${t.id}`} numeric inputMode="decimal" suffix="mm" placeholder="0" value={v.airMm} onChange={(e) => ubah(t, { airMm: e.target.value })} />
              </Field>
              <Button variant={st === 'nihil' ? 'primary' : 'glass'} className="h-12" onClick={() => ubah(t, { airMm: '0' })}>
                Nihil
              </Button>
            </div>
            {v.fotoLama.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-tag uppercase text-on-surface-variant">Foto tersimpan</span>
                <div className="flex flex-wrap gap-space-xs">
                  {v.fotoLama.map((p) => (
                    <span key={p.id} className="relative">
                      {srcOf(p) ? <img src={srcOf(p)} alt={`Foto ${namaTangki(t)}`} className="size-20 rounded-md object-cover" /> : <span className="block size-20 rounded-md bg-surface-container" />}
                      <button type="button" aria-label="Hapus foto tersimpan" onClick={() => ubah(t, { fotoLama: v.fotoLama.filter((x) => x.id !== p.id) })} className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-on-surface text-surface">
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <FotoWajib
              label="Foto stik pasta air"
              hint="Ujung stik dengan pasta air setelah dicelupkan, angka tinggi air terbaca."
              fotos={v.fotoBaru}
              busy={busy === t.id}
              disabled={busy === 'kirim'}
              wajib={!v.fotoLama.length}
              onAdd={(files) => void ambil(t, files)}
              onRemove={(fid) => {
                const f = v.fotoBaru.find((x) => x.id === fid)
                if (f) URL.revokeObjectURL(f.url)
                ubah(t, { fotoBaru: v.fotoBaru.filter((x) => x.id !== fid) })
              }}
            />
            {st === 'ada' && (
              <Field label="Tindakan (wajib)" htmlFor={`air-tl-${t.id}`}>
                <Input id={`air-tl-${t.id}`} autoComplete="off" placeholder="Mis. penyedotan air, lapor pengawas, cek ulang setelah 1 jam" value={v.tindakan} onChange={(e) => ubah(t, { tindakan: e.target.value })} />
              </Field>
            )}
          </GlassCard>
        )
      })}

      <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Petugas" htmlFor="air-petugas">
            <Input id="air-petugas" value={namaPetugas} onChange={(e) => setPetugas(e.target.value)} />
          </Field>
          <Field label="Catatan (opsional)" htmlFor="air-catatan">
            <Input id="air-catatan" autoComplete="off" value={isiCatatan} onChange={(e) => setCatatan(e.target.value)} />
          </Field>
        </div>
        <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <Camera aria-hidden="true" className="size-4 shrink-0" />
          Tanggal, jam, SPBU, dan tangki tercetak otomatis pada foto.
        </span>
        <ErrorBox text={error} />
        <Button size="lg" disabled={busy !== null} onClick={() => void kirim()}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {busy === 'kirim' ? 'Mengirim…' : lama ? 'Simpan perubahan' : `Kirim water content ${namaShift}`}
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

/** Report > Riwayat Water Content: per bulan, temuan air disorot, foto stik pasta air. */
export function LaporanAir() {
  const app = useApp()
  const toast = useToast()
  const now = currentShift()
  const [bulan, setBulan] = useState(now.tanggal.slice(0, 7))
  const akhir = todayIso(new Date(Number(bulan.slice(0, 4)), Number(bulan.slice(5, 7)), 0))
  const { recs, error, muat } = useAir(`${bulan}-01`, akhir)
  const fotos = useMemo(() => (recs ?? []).flatMap((r) => Object.values(r.data.tangki).flatMap((t) => t.foto.slice(0, 1))), [recs])
  const srcOf = usePhotoSrc(fotos)
  if (!app.loaded) return <Loading />
  if (!TANKS.length) return <TangkiBelumAda className="animate-entrance-1" />
  const data = [...(recs ?? [])].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.shift - a.shift)
  const temuan = data.filter((r) => tangkiBerair(r, TANKS).length).length
  // Shift yang sudah lewat/berjalan pada bulan ini tanpa catatan lengkap.
  const nHari = Number(akhir.slice(8))
  let wajib = 0
  let terlewat = 0
  for (let d = 1; d <= nHari; d++) {
    const t = `${bulan}-${String(d).padStart(2, '0')}`
    for (const s of [1, 2, 3] as const) {
      const st = statusShift({ tanggal: t, shift: s }, airLengkap(data.find((r) => r.id === airId(t, s)), TANKS), now)
      if (st !== 'nanti') wajib++
      if (st === 'terlewat') terlewat++
    }
  }
  const bolehHapus = app.role === 'abh' || app.role === 'pengawas'
  const hapus = async (r: AirRecord) => {
    if (!window.confirm(`Hapus water content ${formatTanggalIso(r.tanggal)} ${shiftLabel(r.shift)}?`)) return
    try {
      await app.backend.deleteAir(r.id)
      for (const t of Object.values(r.data.tangki)) for (const p of t.foto) void app.backend.deletePhoto(p).catch(() => {})
      toast('Catatan dihapus')
      void muat()
    } catch (e) {
      toast(pesan(e))
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <Field label="Bulan" htmlFor="lair-bulan">
          <Input id="lair-bulan" type="month" max={now.tanggal.slice(0, 7)} value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-space-xs text-center">
          <div className="rounded-md bg-surface-container-low p-space-xs">
            <span className="tabular block text-numeric-md font-bold text-on-surface">{data.length}</span>
            <span className="text-[11px] uppercase text-on-surface-variant">Pengecekan</span>
          </div>
          <div className={cn('rounded-md p-space-xs', temuan ? 'bg-error-container' : 'bg-surface-container-low')}>
            <span className={cn('tabular block text-numeric-md font-bold', temuan ? 'text-on-error-container' : 'text-on-surface')}>{temuan}</span>
            <span className="text-[11px] uppercase text-on-surface-variant">Ada air</span>
          </div>
          <div className="rounded-md bg-surface-container-low p-space-xs">
            <span className="tabular block text-numeric-md font-bold text-on-surface">
              {terlewat}/{wajib}
            </span>
            <span className="text-[11px] uppercase text-on-surface-variant">Shift terlewat</span>
          </div>
        </div>
        <ErrorBox text={error} />
      </GlassCard>

      <section aria-labelledby="lair-daftar" className="flex flex-col gap-space-sm">
        <SectionHeader id="lair-daftar" title={`Pengecekan (${data.length})`} />
        {recs === null ? (
          <Loading />
        ) : !data.length ? (
          <GlassCard level={1} className="p-space-md text-center text-body-md text-on-surface-variant">
            Belum ada pengecekan water content pada bulan ini.
          </GlassCard>
        ) : (
          data.map((r) => {
            const berair = tangkiBerair(r, TANKS).length > 0
            return (
              <GlassCard key={r.id} level={2} className={cn('flex flex-col gap-space-sm p-space-md', berair && 'border border-error/40')}>
                <div className="flex items-start justify-between gap-space-sm">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-md font-bold text-on-surface">
                      {formatTanggalIso(r.tanggal)} · {shiftLabel(r.shift).split(' (')[0]}
                    </span>
                    <span className="text-body-sm text-on-surface-variant">
                      {r.data.petugas || '-'} · {r.data.jam}
                      {r.data.catatan ? ` · ${r.data.catatan}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Pill tone={berair ? 'error' : 'success'}>{berair ? 'Ada air' : 'Nihil'}</Pill>
                    {app.can('/air/') && (
                      <Link to={`/air/${r.tanggal}/${r.shift}`} aria-label="Ubah" className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                        <PenLine aria-hidden="true" />
                      </Link>
                    )}
                    {bolehHapus && (
                      <Button variant="ghost" size="icon" aria-label="Hapus" onClick={() => void hapus(r)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    )}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-outline-variant/40 rounded-md bg-surface-container-low/60">
                  {TANKS.map((t) => {
                    const x = r.data.tangki[t.id]
                    const st = statusAir(x)
                    const foto = x?.foto[0]
                    const src = foto ? srcOf(foto) : undefined
                    return (
                      <div key={t.id} className="flex items-center gap-space-sm px-space-sm py-space-xs">
                        {src ? (
                          <a href={src} target="_blank" rel="noreferrer" className="shrink-0">
                            <img src={src} alt={`Pasta air ${namaTangki(t)}`} className="size-12 rounded-md object-cover" />
                          </a>
                        ) : (
                          <span className="size-12 shrink-0 rounded-md bg-surface-container" />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-body-sm font-semibold text-on-surface">{namaTangki(t)}</span>
                          {x?.tindakan && <span className="text-body-sm text-on-surface-variant">Tindakan: {x.tindakan}</span>}
                        </span>
                        <span className={cn('tabular shrink-0 text-body-sm font-bold', st === 'ada' ? 'text-error' : st === 'nihil' ? 'text-on-tertiary-fixed-variant' : 'text-on-surface-variant')}>{keteranganMm(x, t)}</span>
                      </div>
                    )
                  })}
                </div>
              </GlassCard>
            )
          })
        )}
      </section>
    </div>
  )
}
