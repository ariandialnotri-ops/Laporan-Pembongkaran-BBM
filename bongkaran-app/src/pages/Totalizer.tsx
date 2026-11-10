import { useState } from 'react'
import { TandaRevisi } from '@/components/ui/tanda-revisi'
import { useKonfirmasi } from '@/components/ui/konfirmasi'
import { Link, useSearchParams } from 'react-router-dom'
import { Camera, CircleCheck, Gauge, LoaderCircle, Lock, Send, Trash2 } from 'lucide-react'
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
import { capWaktu, compressImage, genId } from '@/lib/image'
import type { Photo } from '@/lib/sop'
import { catatanLama, jualManual, jualNozzle, jualPerProduk, manualTerkirim, nextShift, nozzlePerDispenser, nozzleTerkirim, prevShift, totalizerLengkap, type LangkahForm, type TotalizerData, type TotalizerNozzle, type TotalizerRecord } from '@/lib/totalizer'
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
        <p>
          Dua langkah per shift, disubmit per nozzle: (1) <b>totalisator manual</b> oleh security, dengan foto wajib yang tercap tanggal & jam; (2) <b>totalisator digital akhir shift</b> oleh kepala shift. Awal digital otomatis dari akhir shift sebelumnya, dan akhir shift ini menjadi awal shift berikutnya. Penjualan bersih = (akhir − awal) − pump test shift itu. Penjualan digital dibandingkan dengan penjualan manual tiap nozzle.
        </p>
      </InfoHalaman>
      <ErrorBox text={error} />
      <PilihShift
        status={(k) => statusShift(k, totalizerLengkap(rec(k.tanggal, k.shift), nozzles))}
        keHalaman={(k) => `/totalizer/${k.tanggal}/${k.shift}`}
        keterangan={(k) => {
          const r = rec(k.tanggal, k.shift)
          if (!r) return undefined
          const manual = nozzles.filter((n) => manualTerkirim(r.data.nozzle[n.id])).length
          if (!totalizerLengkap(r, nozzles)) {
            const digital = nozzles.filter((n) => nozzleTerkirim(r.data.nozzle[n.id], 'akhir', catatanLama(r))).length
            return `Manual ${manual}/${nozzles.length} · digital akhir ${digital}/${nozzles.length}`
          }
          const total = jualPerProduk([r], pumpTest).reduce((n, x) => n + x.liter, 0)
          return `Lengkap · ${formatLiter(total)} · ${r.data.petugas || '-'}${manual < nozzles.length ? ` · manual ${manual}/${nozzles.length}` : ''}`
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

/** Peran yang mengisi tiap langkah (pengawas & ABH dapat mengisi keduanya bila petugas berhalangan). */
const PERAN_LANGKAH: Record<LangkahForm, string[]> = {
  manual: ['security', 'pengawas', 'abh'],
  digital: ['kashift', 'pengawas', 'abh'],
}
const JUDUL_LANGKAH: Record<LangkahForm, { judul: string; oleh: string }> = {
  manual: { judul: 'Totalisator manual', oleh: 'Security' },
  digital: { judul: 'Digital akhir shift', oleh: 'Kepala shift' },
}

/**
 * Form totalizer satu shift dalam 2 langkah per nozzle:
 * (1) totalisator manual/mekanik oleh security: angka + foto wajib yang dicap tanggal-jam, waktu submit tercatat;
 * (2) totalisator digital akhir shift oleh kepala shift: awal otomatis dari akhir shift sebelumnya.
 * Penjualan digital dibandingkan dengan penjualan manual (selisih manual antarshift) per nozzle.
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
  const sesudah = valid ? nextShift({ tanggal, shift }) : { tanggal, shift }
  const { recs } = useCatatan<TotalizerData>('totalizer', sebelum.tanggal, sesudah.tanggal)
  const prev = recs?.find((r) => r.id === idShift(sebelum.tanggal, sebelum.shift))
  // Catatan terbaru shift ini dan shift berikutnya (diperbarui setiap submit nozzle).
  const [rec, setRec] = useState<TotalizerRecord | null>(null)
  const [recNext, setRecNext] = useState<TotalizerRecord | null>(null)
  const [isian, setIsian] = useState<Record<string, string>>({})
  const [foto, setFoto] = useState<Record<string, FotoLokal | undefined>>({})
  const [petugas, setPetugas] = useState<Record<LangkahForm, string | null>>({ manual: null, digital: null })
  const [catatan, setCatatan] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<{ nid: string; teks: string } | null>(null)
  const namaShift = shiftLabel(shift).split(' (')[0]
  const lama = rec ?? recs?.find((r) => r.id === id)
  const lanjut = recNext ?? recs?.find((r) => r.id === idShift(sesudah.tanggal, sesudah.shift))
  const srcOf = usePhotoSrc(Object.values(lama?.data.nozzle ?? {}).flatMap((n) => [...(n.fotoManual ?? []), ...(n.fotoAwal ?? []), ...(n.fotoAkhir ?? [])]))
  const adaIsian = Object.keys(isian).length > 0 || Object.values(foto).some(Boolean)
  const guard = useLeaveGuard({ active: adaIsian, title: `Keluar dari totalizer ${namaShift}?`, detail: 'Angka nozzle yang belum disubmit akan hilang.' })

  if (!app.loaded || !recs) return <Loading />
  if (!valid) return <GlassCard className="p-space-md">Shift tidak dikenal.</GlassCard>
  const nozzles = app.settings.nozzles ?? []
  if (!nozzles.length) return <NozzleBelumAda />
  const peran = app.role ?? ''
  const boleh = (l: LangkahForm) => PERAN_LANGKAH[l].includes(peran)
  const lamaFormat = catatanLama(lama)
  const digitalSudah = (nid: string) => nozzleTerkirim(lama?.data.nozzle[nid], 'akhir', lamaFormat)
  const manualSudah = (nid: string) => manualTerkirim(lama?.data.nozzle[nid])
  const sudahPada = (nid: string, l: LangkahForm) => (l === 'manual' ? manualSudah(nid) : digitalSudah(nid))
  const manualSelesai = nozzles.every((n) => manualSudah(n.id))
  const digitalSelesai = nozzles.every((n) => digitalSudah(n.id))
  // Langkah awal: dari tautan, atau sesuai peran (security → manual, kepala shift → digital).
  const minta = params.get('langkah')
  const langkah: LangkahForm =
    minta === 'manual' || minta === 'digital' ? minta : peran === 'kashift' ? 'digital' : peran === 'security' ? 'manual' : manualSelesai ? 'digital' : 'manual'
  const bolehUbah = boleh(langkah)
  const pilihLangkah = (l: LangkahForm) => setParams({ langkah: l }, { replace: true })
  const kunci = (nid: string, k: string = langkah) => `${k}:${nid}`
  const prevAkhir = (nid: string) => {
    const v = prev?.data.nozzle[nid]?.akhir ?? ''
    return parseAngka(v) !== null ? v : ''
  }
  const tersimpan = (nid: string): TotalizerNozzle => {
    const n = nozzles.find((x) => x.id === nid)!
    return lama?.data.nozzle[nid] ?? { nama: n.nama, produk: n.produk, awal: prevAkhir(nid), akhir: '' }
  }
  // Awal digital: akhir shift sebelumnya (dikunci); diisi sendiri hanya bila shift sebelumnya kosong.
  const awalDariPrev = (nid: string) => prevAkhir(nid) !== ''
  const nilaiAwal = (nid: string) => (awalDariPrev(nid) ? prevAkhir(nid) : (isian[kunci(nid, 'awal')] ?? tersimpan(nid).awal))
  const nilai = (nid: string) => isian[kunci(nid)] ?? (langkah === 'manual' ? (tersimpan(nid).manual ?? '') : tersimpan(nid).akhir)
  const namaDefault = app.displayName === 'Mode lokal' ? '' : app.displayName
  const namaPetugas = (l: LangkahForm) =>
    petugas[l] ?? (l === 'manual' ? lama?.data.petugasManual : lama?.data.petugas) ?? (boleh(l) ? namaDefault || (l === 'digital' ? app.settings.namaPetugasDefault : '') : '')
  const isiCatatan = catatan ?? lama?.data.catatan ?? ''
  const batas = app.rules.batasTotalisatorL

  /** Selisih penjualan digital − manual satu nozzle (null bila salah satu belum lengkap). */
  const banding = (nid: string, akhirDigital = tersimpan(nid).akhir, manualIni = tersimpan(nid).manual) => {
    const d = jualNozzle({ awal: nilaiAwal(nid), akhir: akhirDigital })
    const m = jualManual(prev?.data.nozzle[nid], { ...tersimpan(nid), manual: manualIni })
    return d === null || m === null ? null : { digital: d, manual: m, selisih: d - m }
  }

  const simpan = async (nid: string, patch: Partial<TotalizerNozzle>, l: LangkahForm) => {
    const n = nozzles.find((x) => x.id === nid)!
    const jam = nowHm()
    const isiNozzle: TotalizerNozzle = { ...tersimpan(nid), nama: n.nama, produk: n.produk, ...patch }
    const semua: TotalizerData['nozzle'] = { ...(lama?.data.nozzle ?? {}), [nid]: isiNozzle }
    const akhirLengkap = nozzles.every((x) => nozzleTerkirim(semua[x.id], 'akhir', lamaFormat))
    const baru: TotalizerRecord = {
      id,
      tanggal,
      shift,
      data: {
        nozzle: semua,
        petugas: (l === 'digital' ? namaPetugas('digital') : lama?.data.petugas ?? '').trim(),
        petugasManual: (l === 'manual' ? namaPetugas('manual') : lama?.data.petugasManual ?? '').trim(),
        jamAwal: lama?.data.jamAwal || jam,
        jamAkhir: akhirLengkap ? lama?.data.jamAkhir || jam : '',
        catatan: isiCatatan.trim(),
      },
      createdAt: lama?.createdAt ?? stamp(),
      updatedAt: stamp(),
      createdBy: lama?.createdBy ?? app.session.user?.id ?? null,
    }
    await app.backend.saveCatatan('totalizer', baru)
    setRec(baru)
    // Akhir shift ini menjadi awal shift berikutnya: bila catatan shift berikutnya sudah ada, awalnya ikut diperbarui.
    if (l === 'digital' && lanjut?.data.nozzle[nid] && lanjut.data.nozzle[nid].awal !== isiNozzle.akhir) {
      const nx: TotalizerRecord = { ...lanjut, data: { ...lanjut.data, nozzle: { ...lanjut.data.nozzle, [nid]: { ...lanjut.data.nozzle[nid], awal: isiNozzle.akhir } } }, updatedAt: stamp() }
      await app.backend.saveCatatan('totalizer', nx)
      setRecNext(nx)
    }
    return baru
  }

  const bersihkan = (nid: string) => {
    const f = foto[kunci(nid)]
    if (f) URL.revokeObjectURL(f.url)
    setIsian((x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== kunci(nid) && k !== kunci(nid, 'awal'))))
    setFoto((x) => ({ ...x, [kunci(nid)]: undefined }))
  }

  const submitManual = async (nid: string) => {
    const n = nozzles.find((x) => x.id === nid)!
    const t = tersimpan(nid)
    const v = nilai(nid).trim()
    const salah = (teks: string) => setError({ nid, teks })
    const angkaV = parseAngka(v)
    if (angkaV === null) return salah(`Isi angka totalisator manual ${labelNozzle(n.nama).toLowerCase()}.`)
    const pm = parseAngka(prev?.data.nozzle[nid]?.manual ?? '')
    if (pm !== null && angkaV < pm) return salah(`Totalisator manual lebih kecil dari ${shiftLabel(sebelum.shift).split(' (')[0]} (${angka(prev!.data.nozzle[nid].manual!)}).`)
    const f = foto[kunci(nid)]
    if (!f && !(t.fotoManual ?? []).length) return salah('Foto totalisator manual wajib dilampirkan.')
    if (!namaPetugas('manual').trim()) return salah('Isi nama security di atas.')
    if (manualSudah(nid) && v !== (t.manual ?? '').trim() && !(await konfirmasi({ jenis: 'ubah', judul: `Ubah totalisator manual ${labelNozzle(n.nama).toLowerCase()}?`, pesan: <>Angka manual yang sudah disubmit akan diganti.</>, ya: 'Ya, ubah' }))) return
    setBusy(nid)
    setError(null)
    try {
      const fotoBaru: Photo[] = f ? [await app.backend.uploadPhoto(`totalizer-${id}`, f.blob, `totalisator-manual-${n.nama}.jpg`)] : (t.fotoManual ?? [])
      const baru = await simpan(nid, { manual: v, manualAt: new Date().toISOString(), manualOleh: namaPetugas('manual').trim(), fotoManual: fotoBaru }, 'manual')
      bersihkan(nid)
      const selesai = nozzles.every((x) => manualTerkirim(baru.data.nozzle[x.id]))
      toast(`${labelNozzle(n.nama)}: totalisator manual tersimpan${selesai ? ' · semua nozzle manual lengkap' : ''}`)
    } catch (e) {
      setError({ nid, teks: pesan(e) })
    } finally {
      setBusy(null)
    }
  }

  const submitDigital = async (nid: string) => {
    const n = nozzles.find((x) => x.id === nid)!
    const t = tersimpan(nid)
    const v = nilai(nid).trim()
    const awal = nilaiAwal(nid).trim()
    const salah = (teks: string) => setError({ nid, teks })
    const a = parseAngka(awal)
    const b = parseAngka(v)
    if (a === null) return salah(`Isi totalisator awal ${labelNozzle(n.nama).toLowerCase()} (shift sebelumnya belum tercatat).`)
    if (b === null) return salah(`Isi totalisator digital akhir ${labelNozzle(n.nama).toLowerCase()}.`)
    if (b < a) return salah('Totalisator akhir lebih kecil dari awal.')
    if (!namaPetugas('digital').trim()) return salah('Isi nama kepala shift di atas.')
    if (digitalSudah(nid) && (v !== t.akhir.trim() || awal !== t.awal.trim()) && !(await konfirmasi({ jenis: 'ubah', judul: `Ubah totalisator digital ${labelNozzle(n.nama).toLowerCase()}?`, pesan: <>Angka yang sudah disubmit akan diganti dan memengaruhi penjualan shift ini{lanjut ? ' serta awal shift berikutnya' : ''}.</>, ya: 'Ya, ubah' }))) return
    setBusy(nid)
    setError(null)
    try {
      const at = new Date().toISOString()
      const baru = await simpan(nid, { awal, akhir: v, awalAt: t.awalAt ?? at, akhirAt: at, akhirOleh: namaPetugas('digital').trim() }, 'digital')
      bersihkan(nid)
      const selesai = nozzles.every((x) => nozzleTerkirim(baru.data.nozzle[x.id], 'akhir', false) || (lamaFormat && digitalSudah(x.id)))
      if (selesai) {
        guard.bypass()
        keTerkirim({
          judul: `Totalizer ${namaShift} lengkap`,
          detail: `${formatTanggalIso(tanggal)}, ${shiftLabel(shift)} · akhir shift ini menjadi awal ${shiftLabel(sesudah.shift).split(' (')[0]}`,
          baris: [...jualPerProduk([baru], pumpTest).map((x): [string, string] => [x.produk, formatLiter(x.liter, 2)]), ['Kepala shift', baru.data.petugas], ['Security (manual)', baru.data.petugasManual || '-']],
          aksi: [{ to: '/totalizer', label: 'Pilih shift lain' }, ...(app.can('/laporan/totalizer') ? [{ to: '/laporan/totalizer', label: 'Riwayat totalizer' }] : [])],
        })
      } else toast(`${labelNozzle(n.nama)}: totalisator digital akhir tersimpan`)
    } catch (e) {
      setError({ nid, teks: pesan(e) })
    } finally {
      setBusy(null)
    }
  }

  const jumlah = (l: LangkahForm) => nozzles.filter((n) => sudahPada(n.id, l)).length
  const ringkas = lama ? jualPerProduk([lama], pumpTest) : []
  const namaSpbu = app.settings.namaSpbu || app.spbu?.nama || 'SPBU'

  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-sm p-space-md">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <h2 className="text-headline-md font-bold text-on-surface">{shiftLabel(shift)}</h2>
            <span className="text-body-sm text-on-surface-variant">{formatTanggalIso(tanggal)}</span>
          </div>
          {digitalSelesai ? <Pill tone="success">Lengkap</Pill> : manualSelesai ? <Pill>Digital belum</Pill> : <Pill tone="error">Manual belum</Pill>}
        </div>
        <TandaRevisi dari={lama} />
        <div role="tablist" aria-label="Langkah pengisian" className="inset-field grid grid-cols-2 gap-1 rounded-md p-1">
          {(['manual', 'digital'] as const).map((l, i) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={langkah === l}
              onClick={() => pilihLangkah(l)}
              className={cn('flex flex-col items-center rounded py-1.5 text-body-sm font-semibold transition-colors', langkah === l ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant')}
            >
              <span>
                {i + 1} · {JUDUL_LANGKAH[l].judul}
              </span>
              <span className="tabular text-xs font-normal">
                {JUDUL_LANGKAH[l].oleh} · {jumlah(l)}/{nozzles.length} nozzle
              </span>
            </button>
          ))}
        </div>
        <Field label={langkah === 'manual' ? 'Nama security' : 'Nama kepala shift'} htmlFor="tot-petugas">
          <Input id="tot-petugas" value={namaPetugas(langkah)} disabled={!bolehUbah} onChange={(e) => setPetugas((x) => ({ ...x, [langkah]: e.target.value }))} />
        </Field>
        <span className="text-body-sm text-on-surface-variant">
          {langkah === 'manual'
            ? 'Security: baca totalisator manual (mekanik) tiap nozzle saat pergantian shift, foto angkanya (tanggal & jam otomatis tercetak di foto), lalu Submit per nozzle.'
            : `Kepala shift: cukup isi totalisator digital akhir shift tiap nozzle. Awal otomatis dari akhir ${shiftLabel(sebelum.shift).split(' (')[0]}, dan akhir shift ini otomatis menjadi awal ${shiftLabel(sesudah.shift).split(' (')[0]}.`}
        </span>
        {!bolehUbah && (
          <span className="rounded-md bg-amber-50 px-space-sm py-space-xs text-body-sm text-amber-900">
            Langkah ini diisi oleh {JUDUL_LANGKAH[langkah].oleh.toLowerCase()} (atau pengawas/ABH). Anda dapat melihat datanya.
          </span>
        )}
      </GlassCard>

      {nozzlePerDispenser(nozzles, app.settings.dispensers ?? []).map((g, gi) => (
        <section key={g.judul} aria-label={g.judul} className={cn('flex flex-col gap-space-xs', gi === 0 ? 'animate-entrance-2' : 'animate-entrance-3')}>
          <SectionHeader id={`tot-${gi}`} title={g.judul} />
          {g.nozzles.map((n) => {
            const t = tersimpan(n.id)
            const sudah = sudahPada(n.id, langkah)
            const asli = langkah === 'manual' ? (t.manual ?? '') : t.akhir
            const berubah = (isian[kunci(n.id)] !== undefined && isian[kunci(n.id)].trim() !== asli.trim()) || (isian[kunci(n.id, 'awal')] !== undefined && isian[kunci(n.id, 'awal')].trim() !== t.awal.trim())
            const v = nilai(n.id)
            const fl = foto[kunci(n.id)]
            const at = langkah === 'manual' ? t.manualAt : t.akhirAt
            const oleh = langkah === 'manual' ? t.manualOleh : t.akhirOleh
            const cek = langkah === 'digital' ? banding(n.id, v) : banding(n.id, undefined, v)
            const lebih = cek !== null && Math.abs(cek.selisih) > batas
            const jm = langkah === 'manual' ? jualManual(prev?.data.nozzle[n.id], { ...t, manual: v }) : null
            const jd = langkah === 'digital' ? jualNozzle({ awal: nilaiAwal(n.id), akhir: v }) : null
            const fotoTersimpan = langkah === 'manual' ? (t.fotoManual ?? []) : [...(t.fotoAwal ?? []), ...(t.fotoAkhir ?? [])]
            return (
              <GlassCard key={n.id} level={2} className={cn('flex flex-col gap-space-sm p-space-md', sudah && !berubah && !fl && 'ring-1 ring-emerald-300', lebih && 'ring-2 ring-error')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="text-body-md font-bold text-on-surface">{labelNozzle(n.nama)}</span>
                    <ProdukChip produk={n.produk} />
                  </span>
                  {sudah && !berubah && !fl ? (
                    <span className="flex items-center gap-1 text-right text-body-sm font-semibold text-emerald-700">
                      <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
                      {at ? `${new Date(at).toTimeString().slice(0, 5)}${oleh ? ` · ${oleh}` : ''}` : 'Terkirim'}
                    </span>
                  ) : (
                    <span className="text-body-sm font-semibold text-orange-700">{berubah && sudah ? 'Diubah, belum disubmit' : 'Belum disubmit'}</span>
                  )}
                </div>

                {langkah === 'digital' &&
                  (awalDariPrev(n.id) ? (
                    <span className="tabular flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                      <Lock aria-hidden="true" className="size-3.5" />
                      Awal {angka(nilaiAwal(n.id))} · akhir {shiftLabel(sebelum.shift).split(' (')[0]}
                    </span>
                  ) : (
                    <Field label="Totalisator awal (shift sebelumnya belum tercatat)" htmlFor={`tot-awal-${n.id}`}>
                      <Input
                        id={`tot-awal-${n.id}`}
                        numeric
                        inputMode="decimal"
                        suffix="L"
                        disabled={!bolehUbah || busy === n.id}
                        value={nilaiAwal(n.id)}
                        onChange={(e) => {
                          setError(null)
                          setIsian((x) => ({ ...x, [kunci(n.id, 'awal')]: e.target.value }))
                        }}
                      />
                    </Field>
                  ))}

                <div className="flex items-end gap-space-sm">
                  <Field label={langkah === 'manual' ? 'Totalisator manual (mekanik)' : 'Totalisator digital akhir'} htmlFor={`tot-${langkah}-${n.id}`} className="min-w-0 flex-1">
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
                  {langkah === 'manual' && (
                    <label className={cn(buttonVariants({ variant: fl || fotoTersimpan.length ? 'soft' : 'primary' }), 'h-12 shrink-0 cursor-pointer', (!bolehUbah || busy === n.id) && 'pointer-events-none opacity-50')}>
                      <Camera aria-hidden="true" />
                      <span>{fl || fotoTersimpan.length ? 'Ganti foto' : 'Foto'}</span>
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
                          // Tanggal & jam dicap ke foto sebagai bukti waktu pembacaan.
                          void compressImage(file, { cap: [capWaktu(), namaSpbu, `${labelNozzle(n.nama)} · ${n.produk} · totalisator manual`] }).then((blob) => {
                            if (fl) URL.revokeObjectURL(fl.url)
                            setFoto((x) => ({ ...x, [kunci(n.id)]: { id: genId('f'), blob, url: URL.createObjectURL(blob) } }))
                          })
                        }}
                      />
                    </label>
                  )}
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
                    <span className="text-body-sm text-on-surface-variant">{fl ? 'Foto bercap waktu, belum disubmit' : 'Foto totalisator manual'}</span>
                  </div>
                )}

                {jm !== null && <span className={cn('tabular text-body-sm', jm < 0 ? 'font-semibold text-error' : 'text-on-surface-variant')}>Penjualan menurut manual: {formatLiter(jm, 0)}</span>}
                {jd !== null && <span className={cn('tabular text-body-sm', jd < 0 ? 'font-semibold text-error' : 'text-on-surface-variant')}>Penjualan digital: {formatLiter(jd, 2)}</span>}
                {cek !== null && (
                  <span className={cn('tabular rounded-md px-space-sm py-1.5 text-body-sm', lebih ? 'bg-error-container/50 font-semibold text-on-error-container' : 'bg-emerald-50 text-emerald-800')}>
                    {lebih ? 'Selisih digital vs manual ' : 'Digital vs manual sesuai · selisih '}
                    {formatNumber(cek.selisih, 1)} L{lebih ? ` (batas ±${formatNumber(batas)} L). Periksa ulang angka & foto.` : ''}
                  </span>
                )}
                {error?.nid === n.id && <ErrorBox text={error.teks} />}
                {bolehUbah && (
                  <Button variant={sudah && !berubah && !fl ? 'glass' : 'primary'} disabled={busy !== null} onClick={() => void (langkah === 'manual' ? submitManual(n.id) : submitDigital(n.id))}>
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
        {langkah === 'manual' && manualSelesai && !digitalSelesai && boleh('digital') && <Button onClick={() => pilihLangkah('digital')}>Lanjut ke langkah 2 · Digital akhir shift</Button>}
        {ringkas.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md bg-surface-container-low p-space-sm">
            <span className="text-tag uppercase text-on-surface-variant">Penjualan tercatat (digital)</span>
            {ringkas.map((x) => (
              <span key={x.produk} className="tabular flex justify-between text-body-sm">
                <span className="text-on-surface-variant">{x.produk}</span>
                <b className="text-on-surface">{formatLiter(x.liter, 2)}</b>
              </span>
            ))}
          </div>
        )}
        <Field label="Catatan shift (opsional, ikut tersimpan saat submit nozzle)" htmlFor="tot-catatan">
          <Input id="tot-catatan" autoComplete="off" value={isiCatatan} disabled={!boleh('manual') && !boleh('digital')} placeholder="Mis. display nozzle 3 mati" onChange={(e) => setCatatan(e.target.value)} />
        </Field>
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
    ...(n.fotoManual ?? []).map((p) => ({ p, label: `${n.nama}${n.manualAt ? ` ${new Date(n.manualAt).toTimeString().slice(0, 5)}` : ''}` })),
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
          <TandaRevisi dari={terbuka.r} />
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm">
              <thead>
                <tr className="text-left text-on-surface-variant">
                  <th className="py-1 pr-2">Nozzle</th>
                  <th className="py-1 pr-2">Produk</th>
                  <th className="py-1 pr-2 text-right">Awal</th>
                  <th className="py-1 pr-2 text-right">Akhir</th>
                  <th className="py-1 pr-2 text-right">Penjualan</th>
                  <th className="py-1 pr-2 text-right">Manual</th>
                  <th className="py-1 text-right">Selisih vs manual</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(terbuka.r.data.nozzle).map(([nid, x]) => {
                  const j = jualNozzle(x)
                  const sb = prevShift({ tanggal: terbuka.r.tanggal, shift: terbuka.r.shift as Shift })
                  const jm = jualManual(recs?.find((r) => r.id === idShift(sb.tanggal, sb.shift))?.data.nozzle[nid], x)
                  const sel = j !== null && jm !== null ? j - jm : null
                  return (
                    <tr key={x.nama} className="border-t border-outline-variant/40">
                      <td className="py-1 pr-2 font-semibold">{x.nama}</td>
                      <td className="py-1 pr-2">{x.produk}</td>
                      <td className="tabular py-1 pr-2 text-right">{angka(x.awal)}</td>
                      <td className="tabular py-1 pr-2 text-right">{angka(x.akhir)}</td>
                      <td className="tabular py-1 pr-2 text-right font-semibold">{j === null ? '-' : formatNumber(j, 2)}</td>
                      <td className="tabular py-1 pr-2 text-right">{x.manual ? angka(x.manual) : '-'}</td>
                      <td className={cn('tabular py-1 text-right', sel !== null && Math.abs(sel) > app.rules.batasTotalisatorL && 'font-bold text-error')}>{sel === null ? '-' : formatNumber(sel, 1)}</td>
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
            Awal {terbuka.r.data.jamAwal || '-'} · akhir {terbuka.r.data.jamAkhir || '-'} · kepala shift {terbuka.r.data.petugas || '-'}
            {terbuka.r.data.petugasManual ? ` · security ${terbuka.r.data.petugasManual}` : ''}
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
