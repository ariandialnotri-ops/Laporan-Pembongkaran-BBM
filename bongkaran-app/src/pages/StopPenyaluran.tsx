import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, History, LoaderCircle, Plus, Send } from 'lucide-react'
import { Choice, Field } from '@/components/bongkaran/form-bits'
import { useLeaveGuard } from '@/components/bongkaran/leave-guard'
import { Loading } from '@/components/bongkaran/load-state'
import { ErrorBox } from '@/components/bongkaran/lo-fields'
import { PhotoSlot } from '@/components/bongkaran/photo-slot'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { HentiInfo, PilihProduk } from '@/components/insiden/henti'
import { Button, buttonVariants } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DEFAULT_AREAS, lokasiOptions } from '@/lib/apar'
import { useApp, useSyncOnOpen } from '@/lib/app-state'
import { formatBulanTahun, formatTanggalIso, todayIso } from '@/lib/date'
import { compressImage, genId } from '@/lib/image'
import { hentiDari, JENIS_HENTI, KATEGORI_INSIDEN, labelMenit, labelWaktu, produkSpbu, ringkasHenti, TINGKAT_INSIDEN, waktuLokal, type InsidenData } from '@/lib/insiden'
import { ambilMedia } from '@/lib/lapor-media'
import { shiftKey } from '@/lib/shift'
import type { Photo } from '@/lib/sop'
import { useKeTerkirim } from '@/lib/terkirim'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * Operation > Stop Penyaluran: dashboard pemberhentian penyaluran (yang masih berjalan, ringkasan bulan,
 * lama berhenti per produk & alasan) dan tombol laporan baru. Terpisah dari laporan kerusakan.
 */
export function StopPenyaluranMenu() {
  const app = useApp()
  useSyncOnOpen()
  const [bulan, setBulan] = useState(todayIso().slice(0, 7))
  if (!app.loaded) return <Loading />
  const r = ringkasHenti(hentiDari(app.daily), bulan)
  const maks = Math.max(1, ...r.produk.map((p) => p.menit))

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className={cn('animate-entrance-1 flex flex-col gap-space-sm p-space-md', r.aktif.length > 0 && 'ring-1 ring-error/40')}>
        <span className="text-tag uppercase text-primary">Status penyaluran sekarang</span>
        {r.aktif.length ? (
          r.aktif.map((x) => (
            <Link key={x.id} to={`/laporan/insiden/${encodeURIComponent(x.id)}`}>
              <HentiInfo h={x.h} />
            </Link>
          ))
        ) : (
          <span className="text-headline-md font-bold text-emerald-700">Semua produk tersalurkan normal</span>
        )}
        <span className="text-body-sm text-on-surface-variant">Ketuk stop penyaluran yang masih berjalan untuk mengisi tindak lanjut dan jam penyaluran kembali.</span>
        <div className="grid grid-cols-2 gap-space-sm">
          <Link to="/stop-penyaluran/baru" className={buttonVariants({ size: 'lg' })}>
            <Plus aria-hidden="true" />
            Laporkan stop
          </Link>
          <Link to="/laporan/henti" className={buttonVariants({ size: 'lg', variant: 'glass' })}>
            <History aria-hidden="true" />
            Riwayat
          </Link>
        </div>
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
        <Field label="Bulan" htmlFor="sp-bulan">
          <Input id="sp-bulan" type="month" max={todayIso().slice(0, 7)} value={bulan} onChange={(e) => e.target.value && setBulan(e.target.value)} />
        </Field>
        <section aria-label={`Ringkasan ${formatBulanTahun(new Date(`${bulan}-01T00:00:00`))}`} className="grid grid-cols-2 gap-space-sm lg:grid-cols-4">
          {[
            ['Kejadian', String(r.kejadian), 'stop penyaluran', r.kejadian > 0],
            ['Masih berhenti', String(r.aktif.length), 'belum dibuka kembali', r.aktif.length > 0],
            ['Total berhenti', r.totalMenit ? labelMenit(r.totalMenit) : '-', 'semua produk', false],
            ['Rata-rata', r.rataMenit ? labelMenit(r.rataMenit) : '-', 'per kejadian selesai', false],
          ].map(([l, v, sub, buruk]) => (
            <div key={String(l)} className="flex flex-col rounded-md bg-surface-container-low p-space-sm">
              <span className="text-tag uppercase text-on-surface-variant">{l}</span>
              <span className={cn('tabular text-body-lg font-bold', buruk ? 'text-error' : 'text-on-surface')}>{v}</span>
              <span className="text-body-sm text-on-surface-variant">{sub}</span>
            </div>
          ))}
        </section>
      </GlassCard>

      <section aria-labelledby="sp-produk" className="animate-entrance-3 flex flex-col gap-space-sm">
        <SectionHeader id="sp-produk" title="Lama berhenti per produk" />
        <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
          {!r.produk.length ? (
            <span className="text-center text-body-sm text-on-surface-variant">Tidak ada stop penyaluran pada bulan ini.</span>
          ) : (
            r.produk.map((p) => (
              <div key={p.produk} className="flex flex-col gap-1">
                <span className="flex items-center justify-between gap-space-sm text-body-sm">
                  <b className={cn('text-on-surface', p.berhenti && 'text-error')}>
                    {p.produk}
                    {p.berhenti ? ' · masih berhenti' : ''}
                  </b>
                  <span className="tabular text-on-surface-variant">
                    {p.kejadian}× · {labelMenit(p.menit)}
                  </span>
                </span>
                <div className="h-2 overflow-hidden rounded-full bg-surface-container-high" aria-hidden="true">
                  <div className={cn('h-full rounded-full', p.berhenti ? 'bg-error' : 'bg-primary')} style={{ width: `${Math.max(4, (p.menit / maks) * 100)}%` }} />
                </div>
              </div>
            ))
          )}
        </GlassCard>
      </section>

      {r.alasan.length > 0 && (
        <section aria-labelledby="sp-alasan" className="flex flex-col gap-space-sm">
          <SectionHeader id="sp-alasan" title="Alasan stop penyaluran" />
          <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 px-space-md">
            {r.alasan.map((a) => (
              <span key={a.alasan} className="flex items-center justify-between gap-space-sm py-space-xs text-body-sm">
                <span className="text-on-surface">{a.alasan}</span>
                <b className="tabular text-on-surface">{a.kejadian}×</b>
              </span>
            ))}
          </GlassCard>
        </section>
      )}
    </div>
  )
}

/** Form laporan stop penyaluran (terpisah dari laporan kerusakan). */
export function StopPenyaluranBaru() {
  const app = useApp()
  const keTerkirim = useKeTerkirim()
  const [id] = useState(() => genId('insiden'))
  const [produk, setProduk] = useState<string[]>([])
  const [mulai, setMulai] = useState(() => waktuLokal())
  const [d, setD] = useState<InsidenData>(() => ({
    jenis: 'henti',
    kategori: KATEGORI_INSIDEN.henti[0],
    jam: '',
    lokasi: '',
    aset: '',
    uraian: '',
    penyebab: '',
    tindakanSegera: '',
    dampak: '',
    tingkat: 'sedang',
    pelapor: app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName,
    foto: [],
    status: 'terbuka',
    pic: '',
    targetSelesai: '',
    riwayat: [],
  }))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'foto' | 'kirim' | null>(null)
  const srcOf = usePhotoSrc(d.foto)
  // Foto dari kamera Lapor (tombol tengah bar bawah) ikut dilampirkan.
  const titipan = useRef(false)
  useEffect(() => {
    if (titipan.current) return
    titipan.current = true
    const media = ambilMedia().filter((m) => m.jenis === 'foto')
    if (!media.length) return
    setBusy('foto')
    void (async () => {
      try {
        for (const m of media) {
          const p = await app.backend.uploadPhoto(`daily-${id}`, m.blob, 'stop-penyaluran.jpg')
          setD((x) => ({ ...x, foto: [...x.foto, p] }))
          URL.revokeObjectURL(m.url)
        }
      } catch (e) {
        setError(`Gagal menyimpan foto: ${pesan(e)}`)
      } finally {
        setBusy(null)
      }
    })()
  }, [app.backend, id])
  const guard = useLeaveGuard({ active: true, title: 'Keluar tanpa mengirim laporan?', detail: 'Laporan stop penyaluran ini belum dikirim.' })
  if (!app.loaded) return <Loading />

  const s = app.settings
  const lokasi = [...lokasiOptions(s.jumlahPulau ?? 0, s.aparArea ?? DEFAULT_AREAS), 'Semua pulau pompa']
  const aset = [...(s.dispensers ?? []).map((x) => x.nama), ...(s.nozzles ?? []).map((x) => x.nama), 'Tangki pendam', 'ATG']
  const set = (p: Partial<InsidenData>) => {
    setError(null)
    setD((x) => ({ ...x, ...p }))
  }

  const tambahFoto = async (files: File[]) => {
    setBusy('foto')
    try {
      const baru: Photo[] = []
      for (const f of files) baru.push(await app.backend.uploadPhoto(`daily-${id}`, await compressImage(f), 'stop-penyaluran.jpg'))
      setD((x) => ({ ...x, foto: [...x.foto, ...baru] }))
    } catch (e) {
      setError(`Gagal menyimpan foto: ${pesan(e)}`)
    } finally {
      setBusy(null)
    }
  }

  const kirim = async () => {
    if (!produk.length) return setError('Pilih produk yang penyalurannya dihentikan.')
    if (!mulai) return setError('Isi waktu mulai berhenti.')
    if (mulai > waktuLokal()) return setError('Waktu mulai berhenti tidak boleh di masa depan.')
    if (!d.lokasi) return setError('Pilih lokasi.')
    if (d.uraian.trim().length < 10) return setError('Tulis uraian / penyebab stop penyaluran (minimal 10 karakter).')
    if (!d.tindakanSegera.trim()) return setError('Isi tindakan yang sudah dilakukan.')
    if (!d.pelapor.trim()) return setError('Isi nama pelapor.')
    setBusy('kirim')
    try {
      const tanggal = mulai.slice(0, 10)
      const jam = mulai.slice(11, 16)
      const data: InsidenData = {
        ...d,
        jam,
        pelapor: d.pelapor.trim(),
        henti: { produk, mulai },
        riwayat: [{ at: new Date().toISOString(), oleh: d.pelapor.trim(), status: 'terbuka', catatan: `Penyaluran ${produk.join(', ')} dihentikan sejak ${labelWaktu(mulai, formatTanggalIso)}` }],
      }
      await app.saveDaily({ id, kind: 'insiden', tanggal, shift: shiftKey(tanggal, jam)?.shift ?? 1, data, createdAt: Date.now(), updatedAt: Date.now(), createdBy: app.session.user?.id ?? null })
      guard.bypass()
      keTerkirim({
        judul: 'Stop penyaluran dilaporkan',
        detail: `${produk.join(', ')} berhenti sejak ${labelWaktu(mulai, formatTanggalIso)}`,
        baris: [
          ['Alasan', d.kategori],
          ['Lokasi', `${d.lokasi}${d.aset.trim() ? `, ${d.aset.trim()}` : ''}`],
          ['Foto', `${d.foto.length} foto`],
          ['Pelapor', d.pelapor.trim()],
        ],
        aksi: [
          { to: `/laporan/insiden/${encodeURIComponent(id)}`, label: 'Lihat laporan & tindak lanjut' },
          { to: '/stop-penyaluran', label: 'Ke dashboard stop penyaluran' },
        ],
      })
    } catch (e) {
      setError(pesan(e))
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <span className="flex items-center gap-space-xs text-tag uppercase text-error">
          <Ban aria-hidden="true" className="size-4" />
          {JENIS_HENTI.label}
        </span>
        <span className="text-body-sm text-on-surface-variant">{JENIS_HENTI.desc}. Penyaluran dibuka kembali lewat tindak lanjut (isi jam penyaluran kembali).</span>
        <Field label="Produk yang dihentikan">
          <PilihProduk value={produk} onChange={(v) => (setError(null), setProduk(v))} options={produkSpbu(s)} />
        </Field>
        <div className="grid grid-cols-2 gap-space-sm">
          <Field label="Mulai berhenti" htmlFor="sp-mulai" className="col-span-2">
            <Input id="sp-mulai" type="datetime-local" max={waktuLokal()} value={mulai} onChange={(e) => (setError(null), setMulai(e.target.value))} />
          </Field>
          <Field label="Alasan" htmlFor="sp-alasan-pilih" className="col-span-2">
            <Select value={d.kategori} onValueChange={(v) => set({ kategori: v })}>
              <SelectTrigger id="sp-alasan-pilih">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KATEGORI_INSIDEN.henti.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Lokasi" htmlFor="sp-lokasi">
            <Select value={d.lokasi || undefined} onValueChange={(v) => set({ lokasi: v })}>
              <SelectTrigger id="sp-lokasi">
                <SelectValue placeholder="Pilih lokasi" />
              </SelectTrigger>
              <SelectContent>
                {lokasi.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Dispenser / nozzle (opsional)" htmlFor="sp-aset">
            <Input id="sp-aset" list="sp-aset-list" autoComplete="off" placeholder="Mis. Nozzle 2" value={d.aset} onChange={(e) => set({ aset: e.target.value })} />
            <datalist id="sp-aset-list">
              {aset.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
        </div>
      </GlassCard>

      <GlassCard level={2} className="animate-entrance-2 flex flex-col gap-space-sm p-space-md">
        <Field label="Uraian / penyebab" htmlFor="sp-uraian">
          <Textarea id="sp-uraian" placeholder="Mis. nozzle 2 Pertalite bocor di selang, penyaluran Pertalite di pulau 1 dihentikan" value={d.uraian} onChange={(e) => set({ uraian: e.target.value })} />
        </Field>
        <Field label="Tindakan yang sudah dilakukan" htmlFor="sp-tindakan">
          <Textarea id="sp-tindakan" className="min-h-[64px]" placeholder="Mis. nozzle diberi tanda, pelanggan diarahkan ke pulau 2, teknisi dihubungi" value={d.tindakanSegera} onChange={(e) => set({ tindakanSegera: e.target.value })} />
        </Field>
        <Field label="Dampak ke pelayanan (opsional)" htmlFor="sp-dampak">
          <Input id="sp-dampak" autoComplete="off" placeholder="Mis. antrean, pelanggan dialihkan" value={d.dampak} onChange={(e) => set({ dampak: e.target.value })} />
        </Field>
        <Field label="Tingkat risiko">
          <Choice label="Tingkat risiko" value={d.tingkat} onChange={(v) => set({ tingkat: v })} options={TINGKAT_INSIDEN} />
        </Field>
        <PhotoSlot
          label="Foto (opsional)"
          photos={d.foto}
          required={false}
          busy={busy === 'foto'}
          srcOf={srcOf}
          onAdd={(f) => void tambahFoto(f)}
          onRemove={(i) => {
            const t = d.foto[i]
            set({ foto: d.foto.filter((_, j) => j !== i) })
            if (t) void app.backend.deletePhoto(t).catch(() => {})
          }}
        />
        <Field label="Pelapor" htmlFor="sp-pelapor">
          <Input id="sp-pelapor" value={d.pelapor} onChange={(e) => set({ pelapor: e.target.value })} />
        </Field>
        <ErrorBox text={error} />
        <Button size="lg" variant="danger" disabled={busy !== null} onClick={() => void kirim()}>
          {busy === 'kirim' ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          Kirim laporan stop penyaluran
        </Button>
      </GlassCard>
      {guard.dialog}
    </div>
  )
}
