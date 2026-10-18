import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Plus, Send, Trash2, Zap } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import { FotoWajib, type FotoLokal } from '@/components/bongkaran/foto-lokal'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { Pill } from '@/components/ui/pill'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useApp } from '@/lib/app-state'
import type { Catatan } from '@/lib/catatan'
import { formatTanggalIso, todayIso } from '@/lib/date'
import { BATAS_OHM, nilaiOhm, ringkasGrounding, SELANG_BULAN, statusTitik, titikGrounding, type GroundingData, type NilaiTitik } from '@/lib/grounding'
import { compressImage, genId } from '@/lib/image'
import { tangkiOps } from '@/lib/ops'
import type { Photo } from '@/lib/sop'
import { useKeTerkirim } from '@/lib/terkirim'
import { useCatatan } from '@/lib/use-catatan'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

type GroundingRecord = Catatan<GroundingData>
const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
/** Pengisi: ABH, pengawas, kepala shift (sama dengan RLS bbm_grounding). */
const bolehIsi = (role: string) => ['abh', 'pengawas', 'kashift'].includes(role)
const tambahBulan = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setMonth(d.getMonth() + n)
  return todayIso(d)
}

/** HSSE > Pengukuran Grounding: pengukuran terakhir, jadwal ulang, dan riwayat. */
export function GroundingMenu() {
  const app = useApp()
  const { recs, error } = useCatatan<GroundingData>('grounding', '2000-01-01', '2999-12-31')
  if (!app.loaded) return <Loading />
  const urut = [...(recs ?? [])].sort((a, b) => b.tanggal.localeCompare(a.tanggal))
  const terakhir = urut[0]
  const berikut = terakhir ? tambahBulan(terakhir.tanggal, SELANG_BULAN) : null
  const lewat = !!berikut && berikut <= todayIso()
  const titik = titikGrounding(app.settings, tangkiOps())
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white shadow-sm">
            <Zap className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-primary">HSSE · Proteksi listrik statis & petir</span>
            <span className="text-headline-md font-bold text-on-surface">Pengukuran Grounding SPBU</span>
            <span className="text-body-sm text-on-surface-variant">
              {titik.length} titik ukur dari data SPBU (tangki pendam, dispenser, panel, penangkal petir, fasilitas, area). Batas tahanan ≤ {BATAS_OHM} Ω, ukur ulang tiap {SELANG_BULAN} bulan.
            </span>
          </div>
        </div>
        {recs !== null && (
          <div className={cn('rounded-md p-space-sm text-body-sm', !terakhir || lewat ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900')}>
            {!terakhir ? 'Belum ada pengukuran tercatat.' : `Terakhir ${formatTanggalIso(terakhir.tanggal)} · ukur ulang ${lewat ? 'sudah jatuh tempo' : `paling lambat ${formatTanggalIso(berikut!)}`}.`}
          </div>
        )}
        {bolehIsi(app.role) && (
          <Link to={`/grounding/${todayIso()}`} className={buttonVariants({ size: 'lg' })}>
            <Plus aria-hidden="true" />
            Ukur grounding
          </Link>
        )}
        <ErrorBox text={error} />
      </GlassCard>

      <section aria-labelledby="gr-riwayat" className="flex flex-col gap-space-sm">
        <SectionHeader id="gr-riwayat" title={`Riwayat pengukuran (${urut.length})`} />
        {recs === null ? (
          <Loading />
        ) : !urut.length ? (
          <GlassCard level={1} className="p-space-md text-center text-body-sm text-on-surface-variant">
            Belum ada pengukuran.
          </GlassCard>
        ) : (
          <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 overflow-hidden">
            {urut.map((r) => {
              const x = ringkasGrounding(r.data)
              return (
                <Link key={r.id} to={`/grounding/${r.tanggal}`} className="flex items-center gap-space-sm px-space-md py-space-sm active:bg-surface-container-low">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body-md font-semibold text-on-surface">{formatTanggalIso(r.tanggal)}</span>
                    <span className="truncate text-body-sm text-on-surface-variant">
                      {x.diukur} titik diukur · alat {r.data.alat || '-'} · {r.data.petugas}
                    </span>
                  </span>
                  {x.buruk ? <Pill tone="error">{x.buruk} di atas {r.data.batasOhm} Ω</Pill> : <Pill tone="success">Semua baik</Pill>}
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
                </Link>
              )
            })}
          </GlassCard>
        )}
      </section>
    </div>
  )
}

/** Form pengukuran grounding satu tanggal: titik ukur otomatis dari data SPBU. */
export function GroundingForm() {
  const app = useApp()
  const konfirmasi = useKonfirmasi()
  const toast = useToast()
  const navigate = useNavigate()
  const keTerkirim = useKeTerkirim()
  const { tanggal = todayIso() } = useParams()
  const { recs } = useCatatan<GroundingData>('grounding', tanggal, tanggal)
  const lama: GroundingRecord | undefined = recs?.find((r) => r.id === tanggal)
  const titik = useMemo(() => titikGrounding(app.settings, tangkiOps()), [app.settings])
  const [edit, setEdit] = useState<GroundingData | null>(null)
  const [foto, setFoto] = useState<FotoLokal[]>([])
  const [busy, setBusy] = useState<'foto' | 'kirim' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const boleh = bolehIsi(app.role)
  const guard = useLeaveGuard({ active: boleh && !!edit, title: 'Keluar dari pengukuran?', detail: 'Hasil ukur yang belum disimpan akan hilang.' })
  const srcOf = usePhotoSrc(lama?.data.foto ?? [])
  if (!app.loaded || recs === null) return <Loading />

  const awal: GroundingData = lama?.data ?? {
    titik: {},
    batasOhm: BATAS_OHM,
    alat: '',
    petugas: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault || '' : app.displayName,
    pelaksana: '',
    catatan: '',
    foto: [],
  }
  const d = edit ?? awal
  const ubah = (patch: Partial<GroundingData>) => {
    setError(null)
    setEdit({ ...d, ...patch })
  }
  const ubahTitik = (id: string, area: string, kelompok: string, patch: Partial<NilaiTitik>) =>
    ubah({ titik: { ...d.titik, [id]: { ...{ area, kelompok, ohm: '', ket: '' }, ...d.titik[id], ...patch } } })
  // Titik dari data SPBU saat ini + titik lama yang sudah tidak ada di data SPBU (tetap ditampilkan).
  const semua = [...titik, ...Object.entries(d.titik).filter(([id]) => !titik.some((t) => t.id === id)).map(([id, v]) => ({ id, area: v.area, kelompok: v.kelompok }))]
  const kelompok = [...new Set(semua.map((t) => t.kelompok))]
  const ringkas = ringkasGrounding(d)

  const simpan = async () => {
    if (!ringkas.diukur) return setError('Isi hasil ukur minimal satu titik.')
    if (!d.petugas.trim()) return setError('Isi nama petugas.')
    const buruk = Object.entries(d.titik).filter(([, v]) => statusTitik(v, d.batasOhm) === 'buruk' && !v.ket.trim())
    if (buruk.length) return setError(`Titik di atas ${d.batasOhm} Ω wajib diberi keterangan tindak lanjut: ${buruk.map(([, v]) => v.area).join(', ')}.`)
    if (lama && !(await konfirmasi({ jenis: 'ubah', judul: 'Ubah pengukuran tersimpan?', pesan: <>Pengukuran <b>{formatTanggalIso(tanggal)}</b> akan diganti dengan isian baru.</>, ya: 'Ya, ubah data' }))) return
    setBusy('kirim')
    try {
      const baru: Photo[] = []
      for (const [i, f] of foto.entries()) baru.push(await app.backend.uploadPhoto(`grounding-${tanggal}`, f.blob, `grounding-${i + 1}.jpg`))
      const data: GroundingData = { ...d, petugas: d.petugas.trim(), foto: [...d.foto, ...baru] }
      await app.backend.saveCatatan<GroundingData>('grounding', { id: tanggal, tanggal, shift: 0, data, createdAt: lama?.createdAt ?? Date.now(), updatedAt: Date.now(), createdBy: lama?.createdBy ?? app.session.user?.id ?? null })
      guard.bypass()
      foto.forEach((f) => URL.revokeObjectURL(f.url))
      const r = ringkasGrounding(data)
      keTerkirim({
        judul: 'Pengukuran grounding tersimpan',
        detail: formatTanggalIso(tanggal),
        peringatan: r.buruk ? `${r.buruk} titik di atas ${data.batasOhm} Ω: perlu perbaikan pentanahan (laporkan sebagai kerusakan).` : undefined,
        baris: [
          ['Titik diukur', `${r.diukur} dari ${semua.length}`],
          ['Memenuhi (≤ ' + data.batasOhm + ' Ω)', String(r.baik)],
          ['Di atas batas', String(r.buruk)],
          ['Ukur ulang', formatTanggalIso(tambahBulan(tanggal, SELANG_BULAN))],
        ],
        aksi: [
          ...(r.buruk ? [{ to: '/insiden/baru/kerusakan', label: 'Laporkan kerusakan grounding' }] : []),
          { to: '/grounding', label: 'Riwayat pengukuran' },
        ],
      })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }
  const hapus = async () => {
    if (!lama || !(await konfirmasi({ judul: 'Hapus pengukuran?', pesan: <>Pengukuran grounding <b>{formatTanggalIso(tanggal)}</b> beserta fotonya akan dihapus.</> }))) return
    try {
      await app.backend.deleteCatatan('grounding', lama.id)
      for (const p of lama.data.foto) void app.backend.deletePhoto(p).catch(() => {})
      guard.bypass()
      toast('Pengukuran dihapus')
      navigate('/grounding', { replace: true })
    } catch (e) {
      setError(pesan(e))
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="text-tag uppercase text-primary">Pengukuran grounding · {formatTanggalIso(tanggal)}</span>
        <div className="grid grid-cols-3 gap-space-xs text-center">
          {[
            ['Diukur', `${ringkas.diukur}/${semua.length}`, false],
            [`≤ ${d.batasOhm} Ω`, String(ringkas.baik), false],
            ['Di atas batas', String(ringkas.buruk), ringkas.buruk > 0],
          ].map(([k, v, buruk]) => (
            <div key={String(k)} className={cn('rounded-md p-space-xs', buruk ? 'bg-error-container text-on-error-container' : 'bg-surface-container-low')}>
              <span className="tabular block text-headline-md font-bold">{v}</span>
              <span className="text-[11px] uppercase">{k}</span>
            </div>
          ))}
        </div>
        {!boleh && <span className="text-body-sm text-on-surface-variant">Diisi pengawas, kepala shift, atau ABH. Anda hanya dapat melihat.</span>}
      </GlassCard>

      <fieldset disabled={!boleh || busy !== null} className="flex min-w-0 flex-col gap-space-md">
        <GlassCard level={2} className="grid grid-cols-2 gap-space-sm p-space-md">
          <Field label="Alat ukur (earth tester)" htmlFor="gr-alat">
            <Input id="gr-alat" autoComplete="off" placeholder="Mis. Kyoritsu 4105A" value={d.alat} onChange={(e) => ubah({ alat: e.target.value })} />
          </Field>
          <Field label="Batas maksimum (Ω)" htmlFor="gr-batas">
            <Input id="gr-batas" numeric inputMode="decimal" value={String(d.batasOhm)} onChange={(e) => ubah({ batasOhm: nilaiOhm(e.target.value) ?? BATAS_OHM })} />
          </Field>
          <Field label="Petugas" htmlFor="gr-petugas">
            <Input id="gr-petugas" value={d.petugas} onChange={(e) => ubah({ petugas: e.target.value })} />
          </Field>
          <Field label="Pelaksana / vendor (opsional)" htmlFor="gr-pelaksana">
            <Input id="gr-pelaksana" value={d.pelaksana} onChange={(e) => ubah({ pelaksana: e.target.value })} />
          </Field>
        </GlassCard>

        {kelompok.map((k) => (
          <section key={k} aria-label={k} className="flex flex-col gap-space-xs">
            <SectionHeader id={`gr-${k}`} title={k} />
            <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 px-space-md">
              {semua
                .filter((t) => t.kelompok === k)
                .map((t) => {
                  const v = d.titik[t.id]
                  const st = statusTitik(v, d.batasOhm)
                  return (
                    <div key={t.id} className={cn('flex flex-col gap-space-xs py-space-sm', st === 'buruk' && '-mx-space-md bg-error-container/40 px-space-md')}>
                      <div className="flex items-center gap-space-sm">
                        <span className="min-w-0 flex-1 text-body-md text-on-surface">{t.area}</span>
                        <Input
                          aria-label={`Tahanan ${t.area} (Ω)`}
                          numeric
                          inputMode="decimal"
                          suffix="Ω"
                          className="w-28"
                          value={v?.ohm ?? ''}
                          onChange={(e) => ubahTitik(t.id, t.area, t.kelompok, { ohm: e.target.value })}
                        />
                        <span className="w-20 shrink-0 text-right">
                          {st === 'baik' ? <Pill tone="success">Baik</Pill> : st === 'buruk' ? <Pill tone="error">Perbaiki</Pill> : <Pill tone="neutral">-</Pill>}
                        </span>
                      </div>
                      {(st === 'buruk' || v?.ket) && (
                        <Input
                          aria-label={`Keterangan ${t.area}`}
                          placeholder={st === 'buruk' ? 'Tindak lanjut (wajib), mis. tambah elektroda, cek sambungan' : 'Keterangan'}
                          value={v?.ket ?? ''}
                          onChange={(e) => ubahTitik(t.id, t.area, t.kelompok, { ket: e.target.value })}
                        />
                      )}
                    </div>
                  )
                })}
            </GlassCard>
          </section>
        ))}

        <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
          {d.foto.length > 0 && (
            <div className="flex flex-wrap gap-space-xs">
              {d.foto.map((p) => (srcOf(p) ? <img key={p.id} src={srcOf(p)} alt="Foto pengukuran" className="size-24 rounded-md object-cover" /> : null))}
            </div>
          )}
          {boleh && (
            <FotoWajib
              label="Foto pengukuran"
              hint="Foto layar alat ukur di titik yang diukur (opsional, maks. 6)."
              wajib={false}
              kamera={false}
              fotos={foto}
              busy={busy === 'foto'}
              disabled={busy === 'kirim'}
              onAdd={(files) => {
                setBusy('foto')
                void (async () => {
                  try {
                    const baru: FotoLokal[] = []
                    for (const f of files.slice(0, 6 - foto.length)) {
                      const blob = await compressImage(f)
                      baru.push({ id: genId('f'), blob, url: URL.createObjectURL(blob) })
                    }
                    setFoto((x) => [...x, ...baru].slice(0, 6))
                    setEdit((x) => x ?? d)
                  } catch (e) {
                    setError(`Gagal memproses foto: ${pesan(e)}`)
                  } finally {
                    setBusy(null)
                  }
                })()
              }}
              onRemove={(fid) => setFoto((x) => x.filter((f) => f.id !== fid))}
            />
          )}
          <Field label="Catatan (opsional)" htmlFor="gr-catatan">
            <Textarea id="gr-catatan" className="min-h-[64px]" value={d.catatan} onChange={(e) => ubah({ catatan: e.target.value })} />
          </Field>
          <ErrorBox text={error} />
          {boleh && (
            <Button size="lg" onClick={() => void simpan()}>
              <Send aria-hidden="true" />
              Simpan pengukuran
            </Button>
          )}
        </GlassCard>
      </fieldset>
      {lama && (app.role === 'abh' || app.role === 'pengawas') && (
        <Button variant="ghost" className="self-center text-error" onClick={() => void hapus()}>
          <Trash2 aria-hidden="true" />
          Hapus pengukuran
        </Button>
      )}
      {guard.dialog}
    </div>
  )
}
