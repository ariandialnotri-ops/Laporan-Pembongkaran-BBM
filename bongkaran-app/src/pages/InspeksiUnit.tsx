import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LoaderCircle, Pencil, Send } from 'lucide-react'
import { UnitCard } from '@/components/apar/unit-cek'
import { Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useToast } from '@/components/ui/toast'
import { aparUnitRecordId, cekDari, hasilCek, type AparCek, type AparTipe, type AparUnit } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import type { AparRecord } from '@/lib/daily'
import { formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { compressImage } from '@/lib/image'
import { currentShift } from '@/lib/shift'
import type { Photo } from '@/lib/sop'
import { usePhotoSrc } from '@/lib/use-photo-src'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const stamp = () => Date.now()

/** Inspeksi satu unit APAR/APAB (dibuka dari label QR atau kode unit), dikirim per unit. */
export function InspeksiUnit() {
  const app = useApp()
  useSyncOnOpen()
  const { id = '' } = useParams()
  if (!app.loaded) return <Loading />
  const s = app.settings
  const ada = [...(s.apar ?? []).map((u) => ({ u, tipe: 'apar' as const })), ...(s.apab ?? []).map((u) => ({ u, tipe: 'apab' as const }))].find((x) => x.u.id === id)
  if (!ada)
    return (
      <GlassCard level={1} className="flex flex-col items-center gap-space-sm p-space-md text-center">
        <span className="text-body-md font-semibold text-on-surface">Unit tidak ditemukan</span>
        <span className="text-body-sm text-on-surface-variant">Label atau kode ini tidak terdaftar di data utama (mungkin unitnya sudah dihapus).</span>
        <Link to="/apar/inspeksi" className={buttonVariants({ size: 'pill' })}>
          Pindai unit lain
        </Link>
      </GlassCard>
    )
  return <Form key={id} unit={ada.u} tipe={ada.tipe} />
}

function Form({ unit, tipe }: { unit: AparUnit; tipe: AparTipe }) {
  const app = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const tanggal = todayIso()
  const rid = aparUnitRecordId(tanggal, unit.id)
  const ex = app.daily.find((d): d is AparRecord => d.kind === 'apar' && d.id === rid) ?? null
  const terkirim = ex?.data.units[0] ?? null
  const [ubah, setUbah] = useState(!terkirim)
  // Data unit diambil dari data utama terbaru; isian lama dipakai saat mengoreksi kiriman hari ini.
  const [cek, setCek] = useState<AparCek>(() => (terkirim ? { ...cekDari(unit, tipe), cek: terkirim.cek, catatan: terkirim.catatan, foto: terkirim.foto } : cekDari(unit, tipe)))
  const [petugas, setPetugas] = useState(() => ex?.data.petugas || (app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'foto' | 'kirim' | null>(null)
  const [dirty, setDirty] = useState(false)
  const srcOf = usePhotoSrc(cek.foto)
  const guard = useLeaveGuard({ active: ubah && dirty, title: 'Keluar tanpa mengirim?', detail: `Inspeksi ${unit.kode} belum dikirim. Foto yang sudah diambil akan dibuang.` })

  const set = (p: Partial<AparCek>) => {
    setError(null)
    setDirty(true)
    setCek((c) => ({ ...c, ...p }))
  }

  const tambahFoto = async (files: File[]) => {
    setBusy('foto')
    try {
      const baru: Photo[] = []
      for (const f of files) baru.push(await app.backend.uploadPhoto(`daily-${rid}`, await compressImage(f), `${unit.kode || 'apar'}.jpg`))
      setDirty(true)
      setError(null)
      setCek((c) => ({ ...c, foto: [...c.foto, ...baru] }))
    } catch (e) {
      setError(`Gagal menyimpan foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }
  const hapusFoto = (i: number) => {
    const target = cek.foto[i]
    set({ foto: cek.foto.filter((_, j) => j !== i) })
    // Foto yang sudah terkirim tetap disimpan sampai koreksi dikirim.
    if (target && !terkirim?.foto.some((p) => p.id === target.id)) void app.backend.deletePhoto(target).catch(() => {})
  }

  const kirim = async () => {
    const h = hasilCek(cek)
    if (h.kosong.length) return setError(`${h.kosong.length} butir belum diperiksa.`)
    if (h.temuan.length && !cek.catatan.trim()) return setError('Tulis catatan tindak lanjut temuan.')
    if (!cek.foto.length) return setError('Foto kondisi unit wajib diunggah.')
    if (!petugas.trim()) return setError('Isi nama petugas.')
    setBusy('kirim')
    try {
      const rec: AparRecord = {
        id: rid,
        kind: 'apar',
        tanggal,
        shift: currentShift().shift,
        data: { petugas: petugas.trim(), jam: nowHm(), units: [cek], catatan: '', selesaiAt: new Date().toISOString() },
        createdAt: ex?.createdAt ?? stamp(),
        updatedAt: stamp(),
        createdBy: ex?.createdBy ?? app.session.user?.id ?? null,
      }
      await app.saveDaily(rec)
      guard.bypass()
      toast(`Inspeksi ${unit.kode} terkirim`)
      navigate(`/apar/inspeksi?terkirim=${encodeURIComponent(unit.id)}`)
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  const h = hasilCek(cek)
  return (
    <div className="flex flex-col gap-space-md">
      {terkirim && !ubah && (
        <GlassCard level={1} className="animate-entrance-1 flex flex-col gap-space-xs p-space-sm">
          <span className="flex items-center gap-space-xs text-body-sm text-on-surface">
            <Pill tone={hasilCek(terkirim).temuan.length ? 'error' : 'success'}>{hasilCek(terkirim).temuan.length ? 'Ada temuan' : 'Baik'}</Pill>
            Sudah dikirim hari ini ({formatTanggalIso(tanggal)} {ex?.data.jam}) oleh {ex?.data.petugas || '-'}.
          </span>
          <Button variant="glass" size="sm" className="self-start" onClick={() => setUbah(true)}>
            <Pencil aria-hidden="true" />
            Koreksi inspeksi hari ini
          </Button>
        </GlassCard>
      )}

      <div className="animate-entrance-1">
        <UnitCard
          u={cek}
          hariIni={tanggal}
          readOnly={!ubah}
          busy={busy === 'foto'}
          srcOf={srcOf}
          onCek={(k, v) => set({ cek: { ...cek.cek, [k]: v } })}
          onSemuaBaik={() => set({ cek: Object.fromEntries(h.items.map((i) => [i.key, 'ok'])) })}
          onCatatan={(v) => set({ catatan: v })}
          onFoto={(f) => void tambahFoto(f)}
          onHapusFoto={hapusFoto}
        />
      </div>

      {ubah && (
        <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Petugas" htmlFor="apar-petugas">
              <Input id="apar-petugas" value={petugas} onChange={(e) => (setDirty(true), setPetugas(e.target.value))} />
            </Field>
            <Field label="Tanggal">
              <span className="tabular flex h-12 items-center text-body-md font-semibold text-on-surface">{formatTanggalIso(tanggal)}</span>
            </Field>
          </div>
          <ErrorBox text={error} />
          <Button size="lg" disabled={busy !== null} onClick={kirim}>
            {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
            Kirim inspeksi {unit.kode}
          </Button>
        </GlassCard>
      )}

      <Link to={`/apar/unit/${encodeURIComponent(unit.id)}`} className="text-center text-body-sm font-semibold text-primary">
        Lihat data & riwayat unit
      </Link>
      {guard.dialog}
    </div>
  )
}
