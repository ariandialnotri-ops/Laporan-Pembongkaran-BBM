import { useState } from 'react'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { Link, useSearchParams } from 'react-router-dom'
import { Camera, CircleCheck, Gauge, LoaderCircle, Send, Trash2 } from 'lucide-react'
import { Field } from '@/components/bongkaran/form-bits'
import type { FotoLokal } from '@/components/bongkaran/foto-lokal'
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
import { InfoHalaman } from '@/components/ui/info-pop'
import { useApp } from '@/lib/app-state'
import { idShift } from '@/lib/catatan'
import { addDays, formatTanggalIso, nowHm, todayIso } from '@/lib/date'
import { formatLiter, formatNumber, parseAngka } from '@/lib/format'
import { shiftLabel, type Shift } from '@/lib/shift'
import { statusShift } from '@/lib/status-isi'
import { compressImage, genId } from '@/lib/image'
import type { Photo } from '@/lib/sop'
import { catatanLama, jualNozzle, jualPerProduk, nozzlePerDispenser, nozzleTerkirim, prevShift, totalizerAwalSaja, totalizerLengkap, type LangkahTotalizer, type TotalizerData, type TotalizerNozzle, type TotalizerRecord } from '@/lib/totalizer'
import { usePhotoSrc } from '@/lib/use-photo-src'
import { useCatatan } from '@/lib/use-catatan'
import { useKeTerkirim } from '@/lib/terkirim'
import { usePumpTestShift } from '@/lib/use-pump-test'
import { cn } from '@/lib/utils'

const pesan = (e: unknown) => (e instanceof Error ? e.message : String(e))
const stamp = () => Date.now()
/** "Nozzle 3" tanpa dobel bila nama nozzle sudah diawali kata nozzle. */
const labelNozzle = (nama: string) => (/^nozzle\b/i.test(nama.trim()) ? nama.trim() : `Nozzle ${nama}`)
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
  // Penjualan bersih = selisih totalisator − pump test shift yang sama.
  const pumpTest = usePumpTestShift()
  const hariIni = todayIso()
  const { recs, error } = useCatatan<TotalizerData>('totalizer', todayIso(addDays(new Date(`${hariIni}T00:00:00`), -40)), todayIso(addDays(new Date(`${hariIni}T00:00:00`), 1)))
  if (!app.loaded || !recs) return <Loading />
  const nozzles = app.settings.nozzles ?? []
  if (!nozzles.length) return <NozzleBelumAda />
  const rec = (tanggal: string, shift: Shift) => recs.find((r) => r.id === idShift(tanggal, shift))
  return (
    <div className="flex flex-col gap-space-md">
      <InfoHalaman judul="Totalizer">
        <p>Dua langkah per shift: (1) totalizer awal dan (2) totalizer akhir, setiap nozzle disubmit sendiri dengan foto totalisator manual bila perlu. Awal terisi dari akhir shift sebelumnya; penjualan bersih = (akhir − awal) − pump test shift itu (uji kualitas, Q&Q, uji takaran).</p>
      </InfoHalaman>
      <ErrorBox text={error} />
      <PilihShift
        status={(k) => statusShift(k, totalizerLengkap(rec(k.tanggal, k.shift), nozzles))}
        keHalaman={(k) => `/totalizer/${k.tanggal}/${k.shift}`}
        keterangan={(k) => {
          const r = rec(k.tanggal, k.shift)
          if (!r) return undefined
          if (totalizerAwalSaja(r, nozzles)) return `Awal shift tercatat ${r.data.jamAwal || ''} · akhir shift belum`
          const total = jualPerProduk([r], pumpTest).reduce((n, x) => n + x.liter, 0)
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

/**
 * Form totalizer satu shift dalam 2 langkah: (1) totalizer awal, (2) totalizer akhir. Setiap nozzle
 * disubmit sendiri (angka + foto totalisator manual opsional), dikelompokkan per dispenser / pulau pompa.
 */
export function TotalizerForm() {
  const app = useApp()
  // Penjualan bersih = selisih totalisator − pump test shift yang sama.
  const pumpTest = usePumpTestShift()
  const keTerkirim = useKeTerkirim()
  const konfirmasi = useKonfirmasi()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { tanggal, shift, valid } = useKunciShift()
  const id = idShift(tanggal, shift)
  const sebelum = valid ? prevShift({ tanggal, shift }) : { tanggal, shift }
  const { recs } = useCatatan<TotalizerData>('totalizer', sebelum.tanggal, tanggal)
  const prev = recs?.find((r) => r.id === idShift(sebelum.tanggal, sebelum.shift))
  // Catatan terbaru shift ini (diperbarui setiap submit nozzle).
  const [rec, setRec] = useState<TotalizerRecord | null>(null)
  const [isian, setIsian] = useState<Record<string, string>>({})
  const [foto, setFoto] = useState<Record<string, FotoLokal | undefined>>({})
  const [petugas, setPetugas] = useState<string | null>(null)
  const [catatan, setCatatan] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ nid: string; teks: string } | null>(null)
  const namaShift = shiftLabel(shift).split(' (')[0]
  const lama = rec ?? recs?.find((r) => r.id === id)
  const srcOf = usePhotoSrc(Object.values(lama?.data.nozzle ?? {}).flatMap((n) => [...(n.fotoAwal ?? []), ...(n.fotoAkhir ?? [])]))
  const adaIsian = Object.keys(isian).length > 0 || Object.values(foto).some(Boolean)
  const guard = useLeaveGuard({ active: adaIsian, title: `Keluar dari totalizer ${namaShift}?`, detail: 'Angka nozzle yang belum disubmit akan hilang.' })

  if (!app.loaded || !recs) return <Loading />
  if (!valid) return <GlassCard className="p-space-md">Shift tidak dikenal.</GlassCard>
  const nozzles = app.settings.nozzles ?? []
  if (!nozzles.length) return <NozzleBelumAda />
  const bolehUbah = ['abh', 'pengawas', 'kashift', 'security'].includes(app.role ?? '')
  const lamaFormat = catatanLama(lama)
  const terkirim = (nid: string, l: LangkahTotalizer) => nozzleTerkirim(lama?.data.nozzle[nid], l, lamaFormat)
  const awalSelesai = nozzles.every((n) => terkirim(n.id, 'awal'))
  const akhirSelesai = nozzles.every((n) => terkirim(n.id, 'akhir'))
  const langkah: LangkahTotalizer = params.get('langkah') === 'akhir' || (params.get('langkah') !== 'awal' && awalSelesai) ? 'akhir' : 'awal'
  const pilihLangkah = (l: LangkahTotalizer) => setParams({ langkah: l }, { replace: true })
  const kunci = (nid: string) => `${langkah}:${nid}`
  const tersimpan = (nid: string): TotalizerNozzle => {
    const n = nozzles.find((x) => x.id === nid)!
    return lama?.data.nozzle[nid] ?? { nama: n.nama, produk: n.produk, awal: prev?.data.nozzle[nid]?.akhir ?? '', akhir: '' }
  }
  const nilai = (nid: string) => isian[kunci(nid)] ?? tersimpan(nid)[langkah]
  const namaPetugas = petugas ?? lama?.data.petugas ?? (app.displayName === 'Mode lokal' ? app.settings.namaPetugasDefault : app.displayName)
  const isiCatatan = catatan ?? lama?.data.catatan ?? ''

  const submit = async (nid: string) => {
    const n = nozzles.find((x) => x.id === nid)!
    const sekarang = tersimpan(nid)
    const v = nilai(nid).trim()
    const angkaV = parseAngka(v)
    const salah = (teks: string) => setError({ nid, teks })
    if (angkaV === null) return salah(`Isi totalisator ${langkah} ${labelNozzle(n.nama).toLowerCase()}.`)
    if (langkah === 'akhir') {
      const a = parseAngka(sekarang.awal)
      if (a === null || !terkirim(nid, 'awal')) return salah('Submit totalisator awal nozzle ini terlebih dahulu (langkah 1).')
      if (angkaV < a) return salah('Totalisator akhir lebih kecil dari awal.')
    } else {
      const b = parseAngka(sekarang.akhir)
      if (b !== null && angkaV > b) return salah('Totalisator awal lebih besar dari akhir yang sudah tercatat.')
    }
    if (!namaPetugas.trim()) return salah('Isi nama petugas di atas.')
    if (terkirim(nid, langkah) && v !== sekarang[langkah].trim() && !(await konfirmasi({ jenis: 'ubah', judul: `Ubah totalisator ${langkah} ${labelNozzle(n.nama).toLowerCase()}?`, pesan: <>Angka yang sudah disubmit akan diganti dan memengaruhi penjualan shift ini.</>, ya: 'Ya, ubah' }))) return
    setBusy(nid)
    setError(null)
    try {
      const f = foto[kunci(nid)]
      const fotoBaru: Photo[] = f ? [await app.backend.uploadPhoto(`totalizer-${id}`, f.blob, `totalisator-${langkah}-${n.nama}.jpg`)] : []
      const jam = nowHm()
      const at = new Date().toISOString()
      const isiNozzle: TotalizerNozzle = {
        ...sekarang,
        nama: n.nama,
        produk: n.produk,
        [langkah]: v,
        ...(langkah === 'awal' ? { awalAt: at, ...(fotoBaru.length ? { fotoAwal: fotoBaru } : {}) } : { akhirAt: at, ...(fotoBaru.length ? { fotoAkhir: fotoBaru } : {}) }),
      }
      const semua: TotalizerData['nozzle'] = { ...(lama?.data.nozzle ?? {}), [nid]: isiNozzle }
      const akhirLengkap = nozzles.every((x) => x.id === nid ? langkah === 'akhir' || terkirim(x.id, 'akhir') : nozzleTerkirim(semua[x.id], 'akhir', lamaFormat))
      const baru: TotalizerRecord = {
        id,
        tanggal,
        shift,
        data: { nozzle: semua, petugas: namaPetugas.trim(), jamAwal: lama?.data.jamAwal || jam, jamAkhir: akhirLengkap ? lama?.data.jamAkhir || jam : '', catatan: isiCatatan.trim() },
        createdAt: lama?.createdAt ?? stamp(),
        updatedAt: stamp(),
        createdBy: lama?.createdBy ?? app.session.user?.id ?? null,
      }
      await app.backend.saveCatatan('totalizer', baru)
      if (f) URL.revokeObjectURL(f.url)
      setRec(baru)
      setIsian((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== kunci(nid))))
      setFoto((x) => ({ ...x, [kunci(nid)]: undefined }))
      const selesai = nozzles.every((x) => nozzleTerkirim(baru.data.nozzle[x.id], langkah, false) || (lamaFormat && terkirim(x.id, langkah)))
      if (langkah === 'akhir' && selesai) {
        guard.bypass()
        keTerkirim({
          judul: `Totalizer ${namaShift} lengkap`,
          detail: `${formatTanggalIso(tanggal)}, ${shiftLabel(shift)}`,
          baris: [...jualPerProduk([baru], pumpTest).map((x): [string, string] => [x.produk, formatLiter(x.liter, 2)]), ['Petugas', baru.data.petugas]],
          aksi: [{ to: '/totalizer', label: 'Pilih shift lain' }, ...(app.can('/laporan/totalizer') ? [{ to: '/laporan/totalizer', label: 'Riwayat totalizer' }] : [])],
        })
      } else toast(`${labelNozzle(n.nama)}: totalisator ${langkah} tersimpan${selesai ? ` · semua nozzle ${langkah} lengkap` : ''}`)
    } catch (e) {
      setError({ nid, teks: pesan(e) })
    } finally {
      setBusy(null)
    }
  }

  const jumlah = (l: LangkahTotalizer) => nozzles.filter((n) => terkirim(n.id, l)).length
  const ringkas = lama ? jualPerProduk([lama], pumpTest) : []

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <h2 className="text-headline-md font-bold text-on-surface">{shiftLabel(shift)}</h2>
            <span className="text-body-sm text-on-surface-variant">
              {formatTanggalIso(tanggal)}
              {prev ? ` · awal terisi dari akhir ${shiftLabel(sebelum.shift).split(' (')[0]}` : ''}
            </span>
          </div>
          {akhirSelesai ? <Pill tone="success">Lengkap</Pill> : awalSelesai ? <Pill>Akhir belum</Pill> : <Pill tone="error">Awal belum</Pill>}
        </div>
        <div role="tablist" aria-label="Langkah pengisian" className="inset-field grid grid-cols-2 gap-1 rounded-md p-1">
          {(['awal', 'akhir'] as const).map((l, i) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={langkah === l}
              onClick={() => pilihLangkah(l)}
              className={cn('flex flex-col items-center rounded py-1.5 text-body-sm font-semibold transition-colors', langkah === l ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant')}
            >
              <span>
                {i + 1} · Totalizer {l}
              </span>
              <span className="tabular text-xs font-normal">
                {jumlah(l)}/{nozzles.length} nozzle
              </span>
            </button>
          ))}
        </div>
        <Field label="Petugas" htmlFor="tot-petugas">
          <Input id="tot-petugas" value={namaPetugas} disabled={!bolehUbah} onChange={(e) => setPetugas(e.target.value)} />
        </Field>
        <span className="text-body-sm text-on-surface-variant">
          {langkah === 'awal'
            ? 'Langkah 1 di awal shift: periksa angka totalisator digital tiap nozzle (terisi dari akhir shift sebelumnya), foto totalisator manual bila perlu, lalu Submit per nozzle.'
            : 'Langkah 2 di akhir shift: isi totalisator akhir tiap nozzle, foto totalisator manual bila perlu, lalu Submit per nozzle. Penjualan = akhir − awal.'}
        </span>
      </GlassCard>

      {nozzlePerDispenser(nozzles, app.settings.dispensers ?? []).map((g, gi) => (
        <section key={g.judul} aria-label={g.judul} className={cn('flex flex-col gap-space-xs', gi === 0 ? 'animate-entrance-2' : 'animate-entrance-3')}>
          <SectionHeader id={`tot-${gi}`} title={g.judul} />
          {g.nozzles.map((n) => {
            const t = tersimpan(n.id)
            const sudah = terkirim(n.id, langkah)
            const berubah = isian[kunci(n.id)] !== undefined && isian[kunci(n.id)].trim() !== t[langkah].trim()
            const v = nilai(n.id)
            const j = langkah === 'akhir' ? jualNozzle({ awal: t.awal, akhir: v }) : null
            const fotoTersimpan = (langkah === 'awal' ? t.fotoAwal : t.fotoAkhir) ?? []
            const fl = foto[kunci(n.id)]
            const at = langkah === 'awal' ? t.awalAt : t.akhirAt
            return (
              <GlassCard key={n.id} level={2} className={cn('flex flex-col gap-space-sm p-space-md', sudah && !berubah && 'ring-1 ring-emerald-300')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="text-body-md font-bold text-on-surface">{labelNozzle(n.nama)}</span>
                    <ProdukChip produk={n.produk} />
                  </span>
                  {sudah && !berubah ? (
                    <span className="flex items-center gap-1 text-body-sm font-semibold text-emerald-700">
                      <CircleCheck aria-hidden="true" className="size-4" />
                      {at ? `Terkirim ${new Date(at).toTimeString().slice(0, 5)}` : 'Terkirim'}
                    </span>
                  ) : (
                    <span className="text-body-sm font-semibold text-orange-700">{berubah && sudah ? 'Diubah, belum disubmit' : 'Belum disubmit'}</span>
                  )}
                </div>
                {langkah === 'akhir' && (
                  <span className="tabular text-body-sm text-on-surface-variant">
                    Awal {angka(t.awal)}
                    {terkirim(n.id, 'awal') ? '' : ' · awal belum disubmit'}
                  </span>
                )}
                <div className="flex items-end gap-space-sm">
                  <Field label={`Totalisator ${langkah} (digital)`} htmlFor={`tot-${langkah}-${n.id}`} className="min-w-0 flex-1">
                    <Input
                      id={`tot-${langkah}-${n.id}`}
                      numeric
                      inputMode="decimal"
                      suffix="L"
                      disabled={!bolehUbah || busy === n.id}
                      value={v}
                      onChange={(e) => {
                        setError(null)
                        setIsian((x) => ({ ...x, [kunci(n.id)]: e.target.value }))
                      }}
                    />
                  </Field>
                  <label className={cn(buttonVariants({ variant: 'soft' }), 'h-12 shrink-0 cursor-pointer', (!bolehUbah || busy === n.id) && 'pointer-events-none opacity-50')}>
                    <Camera aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">Foto manual</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      aria-label={`Foto totalisator manual ${labelNozzle(n.nama).toLowerCase()}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (!file) return
                        void compressImage(file).then((blob) => {
                          if (fl) URL.revokeObjectURL(fl.url)
                          setFoto((x) => ({ ...x, [kunci(n.id)]: { id: genId('f'), blob, url: URL.createObjectURL(blob) } }))
                        })
                      }}
                    />
                  </label>
                </div>
                {(fl || fotoTersimpan.length > 0) && (
                  <div className="flex items-center gap-space-xs">
                    {fl ? (
                      <>
                        <img src={fl.url} alt={`Foto totalisator manual ${n.nama} (belum disubmit)`} className="size-16 rounded-md object-cover ring-2 ring-orange-300" />
                        <Button variant="ghost" size="sm" onClick={() => (URL.revokeObjectURL(fl.url), setFoto((x) => ({ ...x, [kunci(n.id)]: undefined })))}>
                          Hapus foto
                        </Button>
                      </>
                    ) : (
                      fotoTersimpan.map((p) =>
                        srcOf(p) ? (
                          <a key={p.id} href={srcOf(p)} target="_blank" rel="noreferrer">
                            <img src={srcOf(p)} alt={`Foto totalisator manual ${n.nama}`} className="size-16 rounded-md object-cover" />
                          </a>
                        ) : (
                          <span key={p.id} className="size-16 animate-pulse rounded-md bg-surface-container" />
                        ),
                      )
                    )}
                    <span className="text-body-sm text-on-surface-variant">Foto totalisator manual</span>
                  </div>
                )}
                {j !== null && (
                  <span className={cn('tabular text-body-sm', j < 0 ? 'font-semibold text-error' : 'text-on-surface-variant')}>Penjualan: {formatLiter(j, 2)}</span>
                )}
                {error?.nid === n.id && <ErrorBox text={error.teks} />}
                {bolehUbah && (
                  <Button variant={sudah && !berubah && !fl ? 'glass' : 'primary'} disabled={busy !== null} onClick={() => void submit(n.id)}>
                    {busy === n.id ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
                    {sudah && !berubah && !fl ? `Submit ulang ${labelNozzle(n.nama).toLowerCase()}` : `Submit ${labelNozzle(n.nama).toLowerCase()}`}
                  </Button>
                )}
              </GlassCard>
            )
          })}
        </section>
      ))}

      <GlassCard level={2} className="flex flex-col gap-space-sm p-space-md">
        {langkah === 'awal' && awalSelesai && !akhirSelesai && (
          <Button onClick={() => pilihLangkah('akhir')}>Lanjut ke langkah 2 · Totalizer akhir</Button>
        )}
        {ringkas.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md bg-surface-container-low p-space-sm">
            <span className="text-tag uppercase text-on-surface-variant">Penjualan tercatat</span>
            {ringkas.map((x) => (
              <span key={x.produk} className="tabular flex justify-between text-body-sm">
                <span className="text-on-surface-variant">{x.produk}</span>
                <b className="text-on-surface">{formatLiter(x.liter, 2)}</b>
              </span>
            ))}
          </div>
        )}
        <Field label="Catatan shift (opsional, ikut tersimpan saat submit nozzle)" htmlFor="tot-catatan">
          <Input id="tot-catatan" autoComplete="off" value={isiCatatan} disabled={!bolehUbah} placeholder="Mis. display nozzle 3 mati" onChange={(e) => setCatatan(e.target.value)} />
        </Field>
        {!bolehUbah && <span className="text-body-sm text-on-surface-variant">Totalizer diisi security, kepala shift, pengawas, atau ABH.</span>}
      </GlassCard>
      {guard.dialog}
    </div>
  )
}

type BarisTot = { r: TotalizerRecord; jual: { produk: string; liter: number }[]; lengkap: boolean }

/** Report > Riwayat Totalizer: per bulan, penjualan per produk per shift dan per nozzle. */
export function RiwayatTotalizer() {
  const app = useApp()
  // Penjualan bersih = selisih totalisator − pump test shift yang sama.
  const pumpTest = usePumpTestShift()
  const konfirmasi = useKonfirmasi()
  const toast = useToast()
  const [bulan, setBulan] = useState(todayIso().slice(0, 7))
  const [buka, setBuka] = useState<string | null>(null)
  const { recs, error, muat } = useCatatan<TotalizerData>('totalizer', `${bulan}-01`, akhirBulan(bulan))
  const fotoBuka = Object.values(recs?.find((r) => r.id === buka)?.data.nozzle ?? {}).flatMap((n) => [
    ...(n.fotoAwal ?? []).map((p) => ({ p, label: `${n.nama} awal` })),
    ...(n.fotoAkhir ?? []).map((p) => ({ p, label: `${n.nama} akhir` })),
  ])
  const srcFoto = usePhotoSrc(fotoBuka.map((x) => x.p))
  if (!app.loaded) return <Loading />
  const nozzles = app.settings.nozzles ?? []
  const rows: BarisTot[] = (recs ?? []).slice().reverse().map((r) => ({ r, jual: jualPerProduk([r], pumpTest), lengkap: totalizerLengkap(r, nozzles) }))
  const totalBulan = jualPerProduk(recs ?? [], pumpTest)
  const perNozzle = new Map<string, { nama: string; produk: string; liter: number }>()
  for (const r of recs ?? []) for (const [nid, x] of Object.entries(r.data.nozzle)) {
    const j = jualNozzle(x)
    if (j === null) continue
    const y = perNozzle.get(nid) ?? { nama: x.nama, produk: x.produk, liter: 0 }
    y.liter += j
    perNozzle.set(nid, y)
  }
  const hapus = async (r: TotalizerRecord) => {
    if (!(await konfirmasi({ judul: 'Hapus totalizer?', pesan: <>Totalizer <b>{formatTanggalIso(r.tanggal)} {shiftLabel(r.shift as Shift)}</b> akan dihapus dari riwayat.</> }))) return
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
              <span className="text-xs uppercase text-on-surface-variant">{x.produk}</span>
              {x.pumpTest > 0 && <span className="tabular block text-xs text-on-surface-variant">bersih · pump test {formatLiter(x.pumpTest, 0)}</span>}
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
          {fotoBuka.length > 0 && (
            <div className="flex flex-col gap-space-xs">
              <span className="text-tag uppercase text-on-surface-variant">Foto totalisator manual</span>
              <div className="flex flex-wrap gap-space-xs">
                {fotoBuka.map(({ p, label }) =>
                  srcFoto(p) ? (
                    <a key={p.id} href={srcFoto(p)} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-0.5 text-xs text-on-surface-variant">
                      <img src={srcFoto(p)} alt={`Totalisator manual nozzle ${label}`} className="size-16 rounded-md object-cover" />
                      {label}
                    </a>
                  ) : (
                    <span key={p.id} className="size-16 animate-pulse rounded-md bg-surface-container" />
                  ),
                )}
              </div>
            </div>
          )}
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
                  {labelNozzle(x.nama)} · {x.produk}
                </span>
                <b>{formatLiter(x.liter, 2)}</b>
              </span>
            ))}
        </GlassCard>
      )}
    </div>
  )
}
