import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCheck, ClipboardCheck, FileDown, FileSpreadsheet, LoaderCircle, PenLine, Save, Trash2 } from 'lucide-react'
import { ArsipFotoBanner } from '@/components/bongkaran/arsip-foto'
import { CheckRow, Choice, Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { PhotoSlot } from '@/components/bongkaran/photo-slot'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { KartuPilih, LegendaStatus } from '@/components/bongkaran/pilih-status'
import type { StatusIsi } from '@/lib/status-isi'
import { useKeTerkirim } from '@/lib/terkirim'
import { useApp } from '@/lib/app-state'
import type { InsidenRecord } from '@/lib/daily'
import { formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { compressImage } from '@/lib/image'
import {
  aktivitasRapi,
  aktivitasWajib,
  bolehIsi,
  bolehParaf,
  cekOps,
  dataKosong,
  FORM_OIL,
  FORM_SUMUR,
  formById,
  formTampil,
  fotoOps,
  jadwal,
  judulForm,
  OIL_OPSI,
  opsId,
  statusOps,
  STATUS_LABEL,
  SUMUR_OPSI,
  tanggalSimpan,
  type OpsChecklist,
  type OpsData,
  type OpsRecord,
  type OpsStatus,
  type Tanda,
} from '@/lib/ops'
import type { Photo } from '@/lib/sop'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const akhirBulan = (ym: string) => `${ym}-${String(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()).padStart(2, '0')}`

const TONE: Record<OpsStatus, 'neutral' | 'primary' | 'success' | 'error' | 'info'> = {
  kosong: 'neutral',
  sebagian: 'info',
  lengkap: 'primary',
  temuan: 'error',
  paraf: 'success',
}
const WARNA: Record<OpsStatus, string> = {
  kosong: 'bg-surface-container-high',
  sebagian: 'bg-primary/35',
  lengkap: 'bg-primary',
  temuan: 'bg-error',
  paraf: 'bg-tertiary',
}

/** Catatan bbm_ops pada rentang tanggal; dimuat ulang saat SPBU/rentang berubah. */
function useOps(from: string, to: string) {
  const app = useApp()
  const kunci = `${app.spbuId}|${from}|${to}`
  const [hasil, setHasil] = useState<{ kunci: string; recs: OpsRecord[]; error: string | null } | null>(null)
  const muat = useCallback(
    () =>
      app.backend.listOps(from, to).then(
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

const namaSaya = (app: ReturnType<typeof useApp>) => (app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault || '' : app.displayName)

/**
 * Input > Operasional SPBU: daftar kartu perawatan, checklist housekeeping, sumur pantau,
 * dan oil catcher untuk satu tanggal. Hanya form yang boleh diisi peran ini dan sesuai fasilitas SPBU.
 */
export function OpsMenu() {
  const app = useApp()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tanggal = params.get('tanggal') || todayIso()
  const awalBulan = `${tanggal.slice(0, 8)}01`
  const { recs, error, muat } = useOps(awalBulan, tanggal)
  const [busy, setBusy] = useState(false)
  if (!app.loaded) return <Loading />

  // ?grup=operasional (Operation: perawatan & housekeeping) atau ?grup=lingkungan (HSSE).
  const filter = params.get('grup')
  const grup = formTampil(app.role, app.settings).filter((g) => (filter === 'lingkungan' ? g.judul === 'Pantauan lingkungan' : filter === 'operasional' ? g.judul !== 'Pantauan lingkungan' : true))
  const recOf = (id: string) => {
    const f = formById(id)
    return recs?.find((r) => r.id === opsId(id, f ? tanggalSimpan(f, tanggal) : tanggal))
  }
  const semua = grup.flatMap((g) => g.forms)
  const status = semua.map((id) => statusOps(id, recOf(id)))
  const terisi = status.filter((s) => s !== 'kosong').length
  // Paraf massal: catatan hari ini yang sudah lengkap (atau ada temuan) dan belum diparaf.
  const bisaParaf = bolehParaf(app.role) ? semua.map(recOf).filter((r): r is OpsRecord => !!r && !r.data.paraf && ['lengkap', 'temuan'].includes(statusOps(r.form, r))) : []

  const parafSemua = async () => {
    const nama = namaSaya(app).trim() || app.settings.namaPengawasDefault || 'Pengawas'
    setBusy(true)
    try {
      for (const r of bisaParaf) await app.backend.saveOps({ ...r, data: { ...r.data, paraf: { nama, at: new Date().toISOString() } } })
      toast(`${bisaParaf.length} form diparaf`)
      await muat()
    } catch (e) {
      toast(`Gagal memaraf: ${pesan(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <ArsipFotoBanner className="animate-entrance-1" />
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <div className="flex items-start gap-space-sm">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-on-primary shadow-sm">
            <ClipboardCheck className="size-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-tag uppercase text-primary">Format laporan operasional SPBU</span>
            <span className="text-headline-md font-bold text-on-surface">Operasional SPBU</span>
            <span className="text-body-sm text-on-surface-variant">Tandai tiap aktivitas. X (ada kerusakan) wajib catatan dan foto; foto hanya saat ada temuan.</span>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-space-sm">
          <Field label="Tanggal" htmlFor="ops-tgl" className="min-w-40 flex-1">
            <Input id="ops-tgl" type="date" max={todayIso()} value={tanggal} onChange={(e) => e.target.value && setParams({ ...(filter ? { grup: filter } : {}), tanggal: e.target.value }, { replace: true })} />
          </Field>
          <span className="tabular pb-3 text-body-sm text-on-surface-variant">
            {recs ? `${terisi}/${semua.length} form terisi` : 'Memuat…'}
          </span>
        </div>
        {bisaParaf.length > 0 && (
          <Button variant="soft" size="pill" className="self-start" disabled={busy} onClick={() => void parafSemua()}>
            {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <PenLine aria-hidden="true" />}
            Paraf {bisaParaf.length} form yang sudah diisi
          </Button>
        )}
        <ErrorBox text={error} />
      </GlassCard>

      {!grup.length && (
        <GlassCard level={1} className="p-space-md text-body-md text-on-surface-variant">
          Tidak ada form operasional untuk peran Anda di SPBU ini.
        </GlassCard>
      )}

      {grup.map((g, gi) => (
        <section key={g.judul} aria-labelledby={`ops-g${gi}`} className="flex flex-col gap-space-sm">
          <SectionHeader id={`ops-g${gi}`} title={g.judul} />
          <div className="flex flex-col gap-space-xs">
            {g.forms.map((id) => {
              const f = formById(id)
              const rec = recOf(id)
              const st = recs ? statusOps(id, rec) : null
              const n = f && rec?.data.jenis === 'checklist' ? Object.keys(rec.data.hasil).length : 0
              // Hijau = sudah diisi lengkap; oranye = belum/sebagian; merah = periodenya lewat tanpa diisi lengkap.
              const lewat = f?.periode === 'bulanan' ? tanggal.slice(0, 7) < todayIso().slice(0, 7) : tanggal < todayIso()
              const warna: StatusIsi = !st || st === 'kosong' || st === 'sebagian' ? (lewat ? 'terlewat' : 'belum') : 'sudah'
              const periode = f ? `${f.periode === 'bulanan' ? `Bulanan · ${BULAN[Number(tanggal.slice(5, 7)) - 1]}` : 'Harian'} · ${n}/${f.aktivitas.length} aktivitas` : 'Pantauan harian'
              return (
                <KartuPilih
                  key={id}
                  to={`/ops/${id}?${filter ? `grup=${filter}&` : ''}tanggal=${tanggal}`}
                  status={warna}
                  judul={judulForm(id)}
                  sub={periode}
                  keterangan={!st ? 'Memuat…' : warna === 'terlewat' ? (st === 'sebagian' ? 'Terlewat · baru sebagian' : 'Terlewat') : STATUS_LABEL[st]}
                />
              )
            })}
          </div>
        </section>
      ))}
      {grup.length > 0 && <LegendaStatus />}
    </div>
  )
}

/** Pilihan tanda satu aktivitas: baik / X / tidak dikerjakan. */
function TandaPilih({ value, onChange, tandaOk, label, disabled }: { value?: Tanda; onChange: (v: Tanda | undefined) => void; tandaOk: string; label: string; disabled?: boolean }) {
  const opsi: { v: Tanda; teks: string; aria: string; aktif: string }[] = [
    { v: 'OK', teks: tandaOk, aria: 'Baik', aktif: 'bg-primary text-on-primary' },
    { v: 'X', teks: 'X', aria: 'Ada kerusakan', aktif: 'bg-error text-on-error' },
    { v: '-', teks: '–', aria: 'Tidak dikerjakan', aktif: 'bg-on-surface-variant text-surface' },
  ]
  return (
    <div role="radiogroup" aria-label={label} className="inset-field grid shrink-0 grid-cols-3 gap-1 rounded-md p-1">
      {opsi.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          aria-label={o.aria}
          disabled={disabled}
          onClick={() => onChange(value === o.v ? undefined : o.v)}
          className={cn('tabular h-10 min-w-11 rounded text-body-md font-bold transition-colors', value === o.v ? o.aktif : 'text-on-surface-variant')}
        >
          {o.teks}
        </button>
      ))}
    </div>
  )
}

/** Input > Operasional SPBU > satu form pada satu tanggal. */
export function OpsIsi() {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const keTerkirim = useKeTerkirim()
  const { form = '' } = useParams()
  const [params] = useSearchParams()
  const tanggalPilih = params.get('tanggal') || todayIso()
  const f = formById(form)
  const valid = !!f || form === FORM_SUMUR || form === FORM_OIL
  const tanggal = f ? tanggalSimpan(f, tanggalPilih) : tanggalPilih
  const id = opsId(form, tanggal)
  const { recs, error: errMuat } = useOps(tanggal, tanggal)
  const lama = recs?.find((r) => r.id === id)
  const [edit, setD] = useState<OpsData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const guard = useLeaveGuard({ active: true, title: 'Keluar dari form?', detail: dirty ? 'Isian form ini belum dikirim dan akan hilang.' : 'Form ini belum dikirim.' })

  // Isian awal: catatan tersimpan atau form kosong; salinan baru dibuat saat pertama diubah.
  const [jamBuka] = useState(nowHm)
  const awal = useMemo(() => (recs ? (lama?.data ?? dataKosong(form, namaSaya(app), jamBuka)) : null), [recs, lama, form, app, jamBuka])
  const d = edit ?? awal
  const fotoSemua = useMemo(() => (d ? fotoOps(d) : []), [d])
  const srcOf = usePhotoSrc(fotoSemua)

  if (!app.loaded) return <Loading />
  if (!valid)
    return (
      <GlassCard level={2} className="flex flex-col items-start gap-space-sm p-space-md">
        <span className="text-body-md font-semibold text-on-surface">Form tidak ditemukan</span>
        <Link to="/ops" className="text-primary">
          Kembali ke Operasional SPBU
        </Link>
      </GlassCard>
    )
  if (!d) return <Loading />

  const bolehUbah = bolehIsi(app.role, form)
  const paraf = bolehParaf(app.role)
  const ubah = (fn: (x: OpsData) => OpsData) => {
    setError(null)
    setDirty(true)
    setD((x) => {
      const dasar = x ?? (awal ? structuredClone(awal) : null)
      return dasar ? fn(dasar) : dasar
    })
  }

  const unggah = async (key: string, files: File[], tambah: (p: Photo[]) => void) => {
    setBusy(`foto-${key}`)
    try {
      const baru: Photo[] = []
      for (const file of files) baru.push(await app.backend.uploadPhoto(`ops-${id}`, await compressImage(file), `${form}-${key}.jpg`))
      tambah(baru)
      setDirty(true)
    } catch (e) {
      setError(`Gagal menyimpan foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }
  const hapusFoto = (p: Photo | undefined) => p && void app.backend.deletePhoto(p).catch(() => {})

  const simpan = async () => {
    const galat = cekOps(form, d)
    if (galat) return setError(galat)
    setBusy('simpan')
    try {
      await app.backend.saveOps({ id, form, tanggal, data: { ...d, petugas: d.petugas.trim() }, updatedAt: Date.now(), updatedBy: app.session.user?.id ?? null })
      guard.bypass()
      const kembali = `/ops?${params.get('grup') ? `grup=${params.get('grup')}&` : ''}tanggal=${tanggalPilih}`
      const x = Object.values(d.jenis === 'checklist' ? d.hasil : {}).filter((v) => v === 'X').length
      keTerkirim({
        judul: `${judulForm(form)} terkirim`,
        detail: f?.periode === 'bulanan' ? `Bulan ${BULAN[Number(tanggal.slice(5, 7)) - 1]} ${tanggal.slice(0, 4)}` : formatTanggalIso(tanggal),
        peringatan: x ? `${x} temuan (X) dengan catatan & foto.` : d.jenis === 'sumur' && d.sumur.some((v) => v !== 'Nihil') ? 'Ada temuan di sumur pantau.' : undefined,
        baris: [
          ...(d.jenis === 'checklist'
            ? ([['Aktivitas ditandai', `${Object.keys(d.hasil).length}${f ? ` dari ${f.aktivitas.length}` : ''}`]] as [string, string][])
            : ([['Hasil pantauan', d.hasil]] as [string, string][])),
          ['Petugas', d.petugas.trim()],
          ['Paraf pengawas', d.paraf ? d.paraf.nama : 'belum'],
        ],
        aksi: [{ to: kembali, label: 'Form operasional lain' }],
      })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }
  const hapus = async () => {
    if (!lama || !window.confirm(`Hapus catatan ${judulForm(form)} tanggal ${formatTanggalIso(tanggal)}?`)) return
    setBusy('hapus')
    try {
      await app.backend.deleteOps(id)
      for (const p of fotoOps(lama.data)) hapusFoto(p)
      guard.bypass()
      toast('Catatan dihapus')
      navigate(`/ops?${params.get('grup') ? `grup=${params.get('grup')}&` : ''}tanggal=${tanggalPilih}`, { replace: true })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  const periode = f?.periode === 'bulanan' ? `Bulan ${BULAN[Number(tanggal.slice(5, 7)) - 1]} ${tanggal.slice(0, 4)}` : formatTanggalIso(tanggal)

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <span className="text-tag uppercase text-primary">
          {f ? (f.kategori === 'hk' ? 'Checklist housekeeping' : 'Kartu perawatan') : 'Pantauan lingkungan'} · {periode}
        </span>
        <span className="text-headline-md font-bold text-on-surface">{judulForm(form)}</span>
        {!bolehUbah && <span className="text-body-sm text-on-surface-variant">Hanya dapat dilihat: form ini diisi oleh peran lain.</span>}
        <ErrorBox text={errMuat} />
      </GlassCard>

      <fieldset disabled={!bolehUbah || !!busy} className="flex min-w-0 flex-col gap-space-md">
        {d.jenis === 'checklist' && f && <Checklist f={f} d={d} ubah={ubah} srcOf={srcOf} busy={busy} unggah={unggah} hapusFoto={hapusFoto} />}

        {d.jenis === 'sumur' && (
          <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
            {['I', 'II', 'III', 'IV'].map((n, i) => (
              <Field key={n} label={`Sumur ${n}`}>
                <Choice
                  label={`Sumur ${n}`}
                  value={d.sumur[i]}
                  options={SUMUR_OPSI.map((o) => ({ value: o, label: o }))}
                  onChange={(v) => ubah((x) => (x.jenis === 'sumur' ? { ...x, sumur: x.sumur.map((s, j) => (j === i ? v : s)), hasil: x.hasil === 'Tidak ada BBM' && v !== 'Nihil' ? '' : x.hasil } : x))}
                />
              </Field>
            ))}
            <Field label="Hasil pantauan" htmlFor="ops-hasil">
              <Input id="ops-hasil" value={d.hasil} onChange={(e) => ubah((x) => (x.jenis === 'checklist' ? x : { ...x, hasil: e.target.value }))} />
            </Field>
            <Field label="Keterangan (opsional)" htmlFor="ops-ket">
              <Input id="ops-ket" value={d.keterangan} onChange={(e) => ubah((x) => (x.jenis === 'checklist' ? x : { ...x, keterangan: e.target.value }))} />
            </Field>
            {(d.sumur.some((s) => s !== 'Nihil') || d.foto.length > 0) && (
              <PhotoSlot
                label="Foto temuan sumur pantau"
                photos={d.foto}
                busy={busy === 'foto-sumur'}
                srcOf={srcOf}
                onAdd={(files) => void unggah('sumur', files, (p) => ubah((x) => (x.jenis === 'sumur' ? { ...x, foto: [...x.foto, ...p] } : x)))}
                onRemove={(i) => {
                  hapusFoto(d.foto[i])
                  ubah((x) => (x.jenis === 'sumur' ? { ...x, foto: x.foto.filter((_, j) => j !== i) } : x))
                }}
              />
            )}
          </GlassCard>
        )}

        {d.jenis === 'oil' && (
          <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
            <Field label="Kondisi oil catcher">
              <Choice label="Kondisi oil catcher" value={d.kondisi} options={OIL_OPSI.map((o) => ({ value: o, label: o }))} onChange={(v) => ubah((x) => (x.jenis === 'oil' ? { ...x, kondisi: v, hasil: v === 'Bersih' ? 'Normal' : x.hasil === 'Normal' ? '' : x.hasil } : x))} />
            </Field>
            <Field label="Hasil pantauan / tindakan" htmlFor="ops-hasil" hint="Mis. Normal, Dikuras, Lapisan minyak diangkat">
              <Input id="ops-hasil" value={d.hasil} onChange={(e) => ubah((x) => (x.jenis === 'checklist' ? x : { ...x, hasil: e.target.value }))} />
            </Field>
            <Field label="Keterangan (opsional)" htmlFor="ops-ket">
              <Input id="ops-ket" value={d.keterangan} onChange={(e) => ubah((x) => (x.jenis === 'checklist' ? x : { ...x, keterangan: e.target.value }))} />
            </Field>
            {(d.kondisi !== 'Bersih' || d.foto.length > 0) && (
              <PhotoSlot
                label="Foto kondisi oil catcher"
                photos={d.foto}
                busy={busy === 'foto-oil'}
                srcOf={srcOf}
                onAdd={(files) => void unggah('oil', files, (p) => ubah((x) => (x.jenis === 'oil' ? { ...x, foto: [...x.foto, ...p] } : x)))}
                onRemove={(i) => {
                  hapusFoto(d.foto[i])
                  ubah((x) => (x.jenis === 'oil' ? { ...x, foto: x.foto.filter((_, j) => j !== i) } : x))
                }}
              />
            )}
          </GlassCard>
        )}

        <GlassCard level={2} className="flex flex-col gap-space-md p-space-md">
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Petugas" htmlFor="ops-petugas">
              <Input id="ops-petugas" value={d.petugas} onChange={(e) => ubah((x) => ({ ...x, petugas: e.target.value }))} />
            </Field>
            <Field label="Jam" htmlFor="ops-jam">
              <Input id="ops-jam" type="time" value={d.jam} onChange={(e) => ubah((x) => ({ ...x, jam: e.target.value }))} />
            </Field>
          </div>
          <CheckRow
            checked={!!d.paraf}
            disabled={!paraf}
            onChange={(v) => ubah((x) => ({ ...x, paraf: v ? { nama: namaSaya(app).trim() || app.settings.namaPengawasDefault || 'Pengawas', at: new Date().toISOString() } : undefined }))}
          >
            Mengetahui pengawas (paraf){d.paraf ? ` · ${d.paraf.nama}` : ''}
            {!paraf && <span className="block text-body-sm text-on-surface-variant">Diparaf oleh pengawas atau ABH.</span>}
          </CheckRow>
          <ErrorBox text={error} />
          <Button size="lg" onClick={() => void simpan()}>
            {busy === 'simpan' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            Simpan
          </Button>
        </GlassCard>
      </fieldset>
      {lama && paraf && (
        <Button variant="ghost" className="self-center" disabled={!!busy} onClick={() => void hapus()}>
          <Trash2 aria-hidden="true" />
          Hapus catatan ini
        </Button>
      )}
    </div>
  )
}

function Checklist({
  f,
  d,
  ubah,
  srcOf,
  busy,
  unggah,
  hapusFoto,
}: {
  f: NonNullable<ReturnType<typeof formById>>
  d: OpsChecklist
  ubah: (fn: (x: OpsData) => OpsData) => void
  srcOf: (p: Photo) => string | undefined
  busy: string | null
  unggah: (key: string, files: File[], tambah: (p: Photo[]) => void) => Promise<void>
  hapusFoto: (p: Photo | undefined) => void
}) {
  const wajib = aktivitasWajib(f)
  const set = (fn: (x: OpsChecklist) => OpsChecklist) => ubah((x) => (x.jenis === 'checklist' ? fn(x) : x))
  const semuaBaik = () => set((x) => ({ ...x, hasil: { ...Object.fromEntries(wajib.map((i) => [i, 'OK' as Tanda])), ...x.hasil } }))
  const bagianList = f.aktivitas.map((a) => aktivitasRapi(a).bagian)
  return (
    <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <span className="text-body-sm text-on-surface-variant">
          {f.tanda} = baik · X = ada kerusakan · – = tidak dikerjakan {f.periode === 'harian' ? 'hari ini' : 'bulan ini'}
        </span>
        <Button variant="soft" size="sm" onClick={semuaBaik}>
          <CheckCheck aria-hidden="true" />
          Tandai {f.periode === 'harian' ? 'aktivitas harian' : 'semua'} baik
        </Button>
      </div>
      <ol className="flex flex-col divide-y divide-outline-variant/40">
        {f.aktivitas.map((a, i) => {
          const { bagian, item } = aktivitasRapi(a)
          const j = jadwal(a)
          const v = d.hasil[i]
          const t = d.temuan[i]
          const judulBagian = bagian && bagian !== bagianList[i - 1] ? bagian : ''
          return (
            <li key={i} className="flex flex-col gap-space-xs py-space-sm">
              {judulBagian && <span className="text-tag uppercase text-primary">{judulBagian}</span>}
              <div className="flex items-center gap-space-sm">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-md text-on-surface">{item}</span>
                  {f.periode === 'harian' && j !== 'harian' && <span className="text-body-sm text-on-surface-variant">{j}</span>}
                </span>
                <TandaPilih
                  label={item}
                  tandaOk={f.tanda}
                  value={v}
                  onChange={(nv) =>
                    set((x) => {
                      const hasil = { ...x.hasil }
                      if (nv) hasil[i] = nv
                      else delete hasil[i]
                      return { ...x, hasil }
                    })
                  }
                />
              </div>
              {v === 'X' && (
                <div className="flex flex-col gap-space-xs rounded-md border border-error/30 bg-error-container/40 p-space-sm">
                  <Textarea
                    aria-label={`Catatan temuan ${item}`}
                    className="min-h-[56px]"
                    placeholder="Catatan kerusakan / temuan (wajib)"
                    value={t?.catatan ?? ''}
                    onChange={(e) => set((x) => ({ ...x, temuan: { ...x.temuan, [i]: { foto: x.temuan[i]?.foto ?? [], catatan: e.target.value } } }))}
                  />
                  <PhotoSlot
                    label="Foto temuan"
                    photos={t?.foto ?? []}
                    busy={busy === `foto-${i}`}
                    srcOf={srcOf}
                    onAdd={(files) =>
                      void unggah(String(i), files, (p) => set((x) => ({ ...x, temuan: { ...x.temuan, [i]: { catatan: x.temuan[i]?.catatan ?? '', foto: [...(x.temuan[i]?.foto ?? []), ...p] } } })))
                    }
                    onRemove={(k) => {
                      hapusFoto(t?.foto[k])
                      set((x) => ({ ...x, temuan: { ...x.temuan, [i]: { catatan: x.temuan[i]?.catatan ?? '', foto: (x.temuan[i]?.foto ?? []).filter((_, m) => m !== k) } } }))
                    }}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </GlassCard>
  )
}

/**
 * Laporan > Operasional SPBU: rekap bulanan per form (status tiap tanggal), daftar temuan,
 * dan unduhan Excel format asli.
 */
export function LaporanOps() {
  const app = useApp()
  const toast = useToast()
  const [bulan, setBulan] = useState(() => todayIso().slice(0, 7))
  const tahun = bulan.slice(0, 4)
  const akhir = akhirBulan(bulan)
  // Dimuat sejak 1 Januari: kartu bulanan (rutin pompa & tangki, outlet ritel) memakai kolom per bulan.
  const { recs, error } = useOps(`${tahun}-01-01`, akhir)
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)
  const temuanFoto = useMemo(
    () => (recs ?? []).filter((r) => r.tanggal >= `${bulan}-01`).flatMap((r) => fotoOps(r.data)),
    [recs, bulan],
  )
  const srcOf = usePhotoSrc(temuanFoto)
  if (!app.loaded) return <Loading />

  const nHari = Number(akhir.slice(8))
  const hariIni = todayIso()
  const grup = formTampil('abh', app.settings)
  const bulanIni = (recs ?? []).filter((r) => r.tanggal >= `${bulan}-01`)
  const byId = new Map((recs ?? []).map((r) => [r.id, r]))
  const temuan = bulanIni.flatMap((r) => {
    const d = r.data
    if (d.jenis === 'checklist') {
      const f = formById(r.form)
      return Object.entries(d.hasil)
        .filter(([, v]) => v === 'X')
        .map(([i]) => ({ r, judul: aktivitasRapi(f?.aktivitas[Number(i)] ?? '').item, catatan: d.temuan[i]?.catatan ?? '', foto: d.temuan[i]?.foto ?? [] }))
    }
    if (statusOps(r.form, r) === 'temuan') return [{ r, judul: d.jenis === 'sumur' ? d.sumur.map((s, i) => `${['I', 'II', 'III', 'IV'][i]}: ${s}`).join(', ') : d.kondisi, catatan: [d.hasil, d.keterangan].filter(Boolean).join(' · '), foto: d.foto }]
    return []
  })
  const kerusakan = app.daily.filter((x): x is InsidenRecord => x.kind === 'insiden' && x.data.jenis === 'kerusakan' && x.tanggal.startsWith(bulan))

  const unduh = async () => {
    if (!recs) return
    setBusy('xlsx')
    try {
      const { exportOpsXlsx } = await import('@/lib/report/ops')
      const kode = (app.settings.kodeSpbu || 'SPBU').replace(/[^0-9A-Za-z]/g, '')
      await exportOpsXlsx({ tahun: Number(tahun), bulan: Number(bulan.slice(5)), recs, kerusakan, settings: app.settings, filename: `Laporan_Operasional_SPBU_${kode}_${bulan}.xlsx` })
    } catch (e) {
      toast(`Gagal membuat Excel: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const unduhPdf = async () => {
    if (!recs) return
    setBusy('pdf')
    try {
      const [{ exportOpsPdf }, fotoData] = await Promise.all([
        import('@/lib/report/ops-pdf'),
        // Foto temuan disisipkan di PDF; foto yang sudah dipangkas cut-off dilewati.
        Promise.all(temuanFoto.map(async (p) => [p.id, await app.backend.photoDataUrl(p).catch(() => '')] as const)).then((x) => Object.fromEntries(x)),
      ])
      const kode = (app.settings.kodeSpbu || 'SPBU').replace(/[^0-9A-Za-z]/g, '')
      exportOpsPdf({ tahun: Number(tahun), bulan: Number(bulan.slice(5)), recs, kerusakan, settings: app.settings, grup, fotoData, hariIni }, `Laporan_Operasional_SPBU_${kode}_${bulan}.pdf`)
    } catch (e) {
      toast(`Gagal membuat PDF: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <ArsipFotoBanner className="animate-entrance-1" />
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
        <div className="flex flex-wrap items-end gap-space-sm">
          <Field label="Bulan" htmlFor="ops-bulan" className="min-w-40 flex-1">
            <Input id="ops-bulan" type="month" max={hariIni.slice(0, 7)} value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-space-xs">
            <Button size="pill" disabled={!recs || !!busy} onClick={() => void unduh()}>
              {busy === 'xlsx' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileSpreadsheet aria-hidden="true" />}
              Unduh Excel (format asli)
            </Button>
            <Button size="pill" variant="glass" disabled={!recs || !!busy} onClick={() => void unduhPdf()}>
              {busy === 'pdf' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileDown aria-hidden="true" />}
              Unduh PDF
            </Button>
          </div>
        </div>
        <span className="text-body-sm text-on-surface-variant">
          Berisi kartu perawatan, checklist housekeeping, sumur pantau, oil catcher, dan breakdown ({kerusakan.length} laporan kerusakan). Cek tera, kualitas harian, dan persediaan BBM diunduh dari laporannya masing-masing.
        </span>
        <div className="flex flex-wrap gap-x-space-sm gap-y-1 text-body-sm text-on-surface-variant">
          {(['lengkap', 'paraf', 'temuan', 'sebagian', 'kosong'] as OpsStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('size-3 rounded-sm', WARNA[s])} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
        <ErrorBox text={error} />
      </GlassCard>

      {!recs ? (
        <Loading />
      ) : (
        grup.map((g, gi) => (
          <section key={g.judul} aria-labelledby={`lo-g${gi}`} className="flex flex-col gap-space-sm">
            <SectionHeader id={`lo-g${gi}`} title={g.judul} />
            <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40">
              {g.forms.map((id) => {
                const f = formById(id)
                if (f?.periode === 'bulanan') {
                  const st = statusOps(id, byId.get(opsId(id, `${bulan}-01`)))
                  return (
                    <div key={id} className="flex items-center justify-between gap-space-sm px-space-md py-space-sm">
                      <span className="text-body-md text-on-surface">{judulForm(id)} (bulanan)</span>
                      <Pill tone={TONE[st]}>{STATUS_LABEL[st]}</Pill>
                    </div>
                  )
                }
                const hari = Array.from({ length: nHari }, (_, i) => {
                  const t = `${bulan}-${String(i + 1).padStart(2, '0')}`
                  return { t, st: t > hariIni ? null : statusOps(id, byId.get(opsId(id, t))) }
                })
                const isi = hari.filter((h) => h.st && h.st !== 'kosong').length
                const lewat = hari.filter((h) => h.st).length
                return (
                  <div key={id} className="flex flex-col gap-space-xs px-space-md py-space-sm">
                    <div className="flex items-center justify-between gap-space-sm">
                      <span className="text-body-md text-on-surface">{judulForm(id)}</span>
                      <span className="tabular text-body-sm text-on-surface-variant">
                        {isi}/{lewat} hari
                      </span>
                    </div>
                    <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-[3px]" role="img" aria-label={`${judulForm(id)}: ${isi} dari ${lewat} hari terisi`}>
                      {hari.map((h, i) => (
                        <span key={h.t} title={`${i + 1}: ${h.st ? STATUS_LABEL[h.st] : '-'}`} className={cn('aspect-square rounded-[3px]', h.st ? WARNA[h.st] : 'bg-surface-container-low')} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </GlassCard>
          </section>
        ))
      )}

      {recs && (
        <section aria-labelledby="lo-temuan" className="flex flex-col gap-space-sm">
          <SectionHeader id="lo-temuan" title={`Temuan bulan ini (${temuan.length})`} />
          {!temuan.length ? (
            <GlassCard level={1} className="p-space-md text-body-md text-on-surface-variant">
              Tidak ada temuan.
            </GlassCard>
          ) : (
            <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40">
              {temuan.map((x, i) => (
                <Link key={i} to={`/ops/${x.r.form}?tanggal=${x.r.tanggal}`} className="flex gap-space-sm px-space-md py-space-sm">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-tag uppercase text-error">
                      {formatTanggalIso(x.r.tanggal)} · {judulForm(x.r.form)}
                    </span>
                    <span className="text-body-md font-semibold text-on-surface">{x.judul}</span>
                    {x.catatan && <span className="text-body-sm text-on-surface-variant">{x.catatan}</span>}
                  </span>
                  {x.foto[0] && srcOf(x.foto[0]) && <img src={srcOf(x.foto[0])} alt="" className="size-16 shrink-0 rounded-md object-cover" />}
                </Link>
              ))}
            </GlassCard>
          )}
        </section>
      )}
    </div>
  )
}
