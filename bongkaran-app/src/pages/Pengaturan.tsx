import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { BookOpen, Building2, ChevronRight, Cylinder, FireExtinguisher, Fuel, Gauge, ImagePlus, Receipt, SlidersHorizontal, X } from 'lucide-react'
import { Field, JumlahField } from '@/components/bongkaran/form-bits'
import { Loading } from '@/components/bongkaran/load-state'
import { SectionHeader } from '@/components/bongkaran/section-header'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Pill } from '@/components/ui/pill'
import { useApp } from '@/lib/app-state'
import { statusSertifikat } from '@/lib/berlaku'
import { todayIso } from '@/lib/date'
import { TABLE53_CORRECTIONS, TABLE53_COVERAGE } from '@/lib/density'
import { formatNumber, parseAngka } from '@/lib/format'
import { blobToDataUrl, compressImage } from '@/lib/image'
import type { Rules } from '@/lib/sop'
import { TANKS } from '@/lib/tank'

/** Profil > Pengaturan SPBU: menu ke tiap bagian data SPBU (halaman terpisah). */
export function Pengaturan() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  const s = app.settings
  const nz = s.nozzles ?? []
  const teraBermasalah = nz.filter((n) => statusSertifikat(n.teraTanggal, todayIso()) !== 'ok').length
  const items: { to: string; icon: LucideIcon; title: string; desc: string; badge?: ReactNode }[] = [
    { to: '/pengaturan/identitas', icon: Building2, title: 'Identitas SPBU', desc: `${s.namaSpbu || '-'}, ${s.jumlahPulau || 0} pulau pompa, logo & nama default` },
    { to: '/pengaturan/tangki', icon: Cylinder, title: 'Database Tangki', desc: `${app.tanks.length} tangki pendam & tabel kalibrasi` },
    { to: '/pengaturan/dispenser', icon: Fuel, title: 'Data Dispenser', desc: `${(s.dispensers ?? []).length} unit: merk & nomor seri` },
    {
      to: '/pengaturan/nozzle',
      icon: Gauge,
      title: 'Nozzle & Tera Metrologi',
      desc: `${nz.length} nozzle, sertifikat tera berlaku maks. 1 tahun`,
      badge: teraBermasalah ? <Pill tone="error">{teraBermasalah} perlu tera</Pill> : nz.length ? <Pill tone="success">Berlaku</Pill> : undefined,
    },
    { to: '/pengaturan/sold-ship-to', icon: Receipt, title: 'Sold To & Ship To', desc: s.soldTo ? `Sold To ${s.soldTo}, Ship To per produk` : 'Belum diisi; dipakai otomatis di form bongkaran' },
    { to: '/apar/data', icon: FireExtinguisher, title: 'Data utama APAR & APAB', desc: `${(s.apar ?? []).length + (s.apab ?? []).length} unit, ${(s.aparArea ?? []).length} area` },
    { to: '/pengaturan/aturan', icon: SlidersHorizontal, title: 'Aturan Pemeriksaan', desc: 'Toleransi density, batas tera, tunggu ATG, PIN' },
    { to: '/pengaturan/acuan', icon: BookOpen, title: 'Data Acuan', desc: 'Tabel ASTM 53 dan ringkasan kalibrasi tangki' },
  ]
  return (
    <nav aria-label="Menu pengaturan" className="animate-entrance-1">
      <GlassCard level={2} className="flex flex-col divide-y divide-outline-variant/40 p-space-2xs">
        {items.map((m) => (
          <Link key={m.to} to={m.to} className="flex min-h-16 items-center gap-space-sm rounded-md px-space-sm py-space-xs transition-colors hover:bg-white/50">
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <m.icon className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-md font-semibold text-on-surface">{m.title}</span>
              <span className="truncate text-body-sm text-on-surface-variant">{m.desc}</span>
            </span>
            {m.badge}
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
          </Link>
        ))}
      </GlassCard>
    </nav>
  )
}

function HanyaAbh() {
  return (
    <GlassCard level={1} className="animate-entrance-1 p-space-md text-center text-body-sm text-on-surface-variant">
      Bagian ini hanya dapat diubah oleh ABH.
    </GlassCard>
  )
}

/** Pengaturan > Identitas SPBU. */
export function IdentitasSpbu() {
  const app = useApp()
  const logoRef = useRef<HTMLInputElement>(null)
  if (!app.loaded) return <Loading />
  const s = app.settings
  const readOnly = !app.isAdmin
  // Pengawas melengkapi identitas dasar SPBU-nya; logo & nama default tetap ABH.
  const dasarReadOnly = !app.isAdmin && app.role !== 'pengawas'
  const onLogo = async (file?: File) => {
    if (file) app.updateSettings({ logoDataUrl: await blobToDataUrl(await compressImage(file, { maxSize: 400, quality: 0.9 })) })
  }
  return (
    <div className="flex flex-col gap-space-md">
      {dasarReadOnly && <HanyaAbh />}
      <fieldset disabled={dasarReadOnly} className="flex min-w-0 flex-col gap-space-md">
        <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
          <Field label="Nama SPBU" htmlFor="set-nama">
            <Input id="set-nama" value={s.namaSpbu} onChange={(e) => app.updateSettings({ namaSpbu: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Kode / nomor SPBU" htmlFor="set-kode">
              <Input id="set-kode" value={s.kodeSpbu} onChange={(e) => app.updateSettings({ kodeSpbu: e.target.value })} />
            </Field>
            <Field label="Alamat" htmlFor="set-alamat">
              <Input id="set-alamat" value={s.alamatSpbu} onChange={(e) => app.updateSettings({ alamatSpbu: e.target.value })} />
            </Field>
            <JumlahField id="set-pulau" label="Jumlah pulau pompa" value={s.jumlahPulau ?? 0} max={30} onChange={(n) => app.updateSettings({ jumlahPulau: n })} />
            <JumlahField id="set-jml-dispenser" label="Jumlah dispenser" value={s.jumlahDispenser ?? 0} max={60} onChange={(n) => app.updateSettings({ jumlahDispenser: n })} />
            <div className="col-span-2 flex flex-col justify-end">
              <Link to="/pengaturan/dispenser" className="flex min-h-12 flex-col justify-center rounded-md bg-surface-container-low px-space-sm text-body-sm">
                <span className="tabular font-semibold text-on-surface">{(s.dispensers ?? []).length} dispenser</span>
                <span className="text-primary">Atur di Data Dispenser</span>
              </Link>
            </div>
          </div>
          <span className="text-body-sm text-on-surface-variant">Pulau pompa otomatis menjadi lokasi APAR di data utama APAR & APAB.</span>
          <fieldset disabled={readOnly} className="flex min-w-0 items-center gap-space-sm">
            {s.logoDataUrl ? (
              <span className="glass-1 flex h-12 items-center rounded-md px-space-sm">
                <img src={s.logoDataUrl} alt="Logo Berita Acara" className="h-8" />
              </span>
            ) : null}
            <Button variant="glass" size="pill" onClick={() => logoRef.current?.click()}>
              <ImagePlus aria-hidden="true" />
              Logo Berita Acara
            </Button>
            {s.logoDataUrl && (
              <Button variant="ghost" size="icon" aria-label="Hapus logo" onClick={() => app.updateSettings({ logoDataUrl: '' })}>
                <X aria-hidden="true" />
              </Button>
            )}
            <input ref={logoRef} type="file" accept="image/*" className="sr-only" onChange={(e) => void onLogo(e.target.files?.[0])} />
          </fieldset>
        </GlassCard>
      </fieldset>
      <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-space-md">
        <section aria-labelledby="nama-default" className="animate-entrance-2 flex flex-col gap-space-sm">
          <SectionHeader id="nama-default" title="Nama default di Berita Acara" />
          <GlassCard level={2} className="grid grid-cols-2 gap-space-sm p-space-md">
            <Field label="Petugas penerima" htmlFor="set-petugas">
              <Input id="set-petugas" value={s.namaPetugasDefault} onChange={(e) => app.updateSettings({ namaPetugasDefault: e.target.value })} />
            </Field>
            <Field label="Pengawas" htmlFor="set-pengawas">
              <Input id="set-pengawas" value={s.namaPengawasDefault} onChange={(e) => app.updateSettings({ namaPengawasDefault: e.target.value })} />
            </Field>
            <Field label="Security" htmlFor="set-security">
              <Input id="set-security" value={s.namaSecurityDefault} onChange={(e) => app.updateSettings({ namaSecurityDefault: e.target.value })} />
            </Field>
            <Field label="Area Business Head" htmlFor="set-abh">
              <Input id="set-abh" value={s.namaAbhDefault} onChange={(e) => app.updateSettings({ namaAbhDefault: e.target.value })} />
            </Field>
            <Field label="Perusahaan pengangkut" htmlFor="set-pengangkut" className="col-span-2">
              <Input id="set-pengangkut" value={s.perusahaanPengangkut} onChange={(e) => app.updateSettings({ perusahaanPengangkut: e.target.value })} />
            </Field>
          </GlassCard>
        </section>
      </fieldset>
    </div>
  )
}

/** Pengaturan > Aturan Pemeriksaan. */
export function AturanPemeriksaan() {
  const app = useApp()
  if (!app.loaded) return <Loading />
  const s = app.settings
  const readOnly = !app.isAdmin
  const setRule = (key: keyof Rules, n: number) => app.updateSettings({ rules: { ...s.rules, [key]: n } })
  return (
    <div className="flex flex-col gap-space-md">
      {readOnly && <HanyaAbh />}
      <fieldset disabled={readOnly} className="min-w-0">
        <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-md p-space-md">
          <div className="grid grid-cols-2 gap-space-sm">
            <Field label="Toleransi density 15°C" htmlFor="set-dens" hint="Di atasnya bongkar dihentikan">
              <RuleInput id="set-dens" value={s.rules.densityTolerance} onChange={(n) => setRule('densityTolerance', n)} />
            </Field>
            <Field label="Batas kurang vs tera" htmlFor="set-tera" hint="Di atasnya butuh izin">
              <RuleInput id="set-tera" suffix="mm" value={s.rules.teraToleranceMm} onChange={(n) => setRule('teraToleranceMm', n)} />
            </Field>
            <Field label="Tunggu sebelum baca ATG" htmlFor="set-atg">
              <RuleInput id="set-atg" suffix="menit" value={s.rules.atgSettleMinutes} onChange={(n) => setRule('atgSettleMinutes', n)} />
            </Field>
            <Field label="Liter per 1 DO" htmlFor="set-do">
              <RuleInput id="set-do" suffix="L" value={s.rules.literPerDO} onChange={(n) => setRule('literPerDO', n)} />
            </Field>
          </div>
          <Field label="PIN penanggung jawab (opsional)" htmlFor="set-pin" hint="Bila diisi, izin lanjut saat selisih tera di luar batas wajib memasukkan PIN ini.">
            <Input id="set-pin" type="password" inputMode="numeric" value={s.pinPenanggungJawab} onChange={(e) => app.updateSettings({ pinPenanggungJawab: e.target.value })} />
          </Field>
        </GlassCard>
      </fieldset>
    </div>
  )
}

/** Pengaturan > Data Acuan: tabel bawaan aplikasi (hanya dibaca). */
export function DataAcuan() {
  return (
    <div className="flex flex-col gap-space-md">
      <GlassCard level={2} className="animate-entrance-1 flex flex-col gap-space-xs p-space-md">
        <span className="text-tag uppercase text-primary">Tabel ASTM 53, density reduction to 15°C</span>
        <span className="text-body-sm text-on-surface">Cakupan densitas observasi {TABLE53_COVERAGE}. Di luar cakupan dipakai rumus ASTM D1250 Tabel 53B.</span>
        {TABLE53_CORRECTIONS.length > 0 && (
          <span className="text-body-sm text-on-surface-variant">
            {TABLE53_CORRECTIONS.length} sel salah ketik pada file acuan telah dikoreksi ({[...new Set(TABLE53_CORRECTIONS.map((c) => c.sheet))].join(', ')}).
          </span>
        )}
      </GlassCard>
      <section aria-labelledby="kalibrasi" className="animate-entrance-2 flex flex-col gap-space-sm">
        <SectionHeader id="kalibrasi" title="Kalibrasi tangki pendam" />
        <GlassCard level={2} className="flex flex-col p-space-2xs">
          {TANKS.map((t) => (
            <div key={t.id} className="flex min-h-14 items-center gap-space-sm rounded-md px-space-sm py-space-xs">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-body-md font-semibold text-on-surface">{t.label}</span>
                <span className="tabular text-numeric-sm text-on-surface-variant">
                  {formatNumber(t.startMm)}-{formatNumber(t.maxMm)} mm, {formatNumber(t.capacity)} L, kalibrasi {t.tanggalKalibrasi || '-'}
                </span>
              </div>
              {t.anomalyLevels.length > 0 ? <Pill tone="error">{t.anomalyLevels.length} titik janggal</Pill> : <Pill tone="primary">OK</Pill>}
            </div>
          ))}
        </GlassCard>
      </section>
    </div>
  )
}

/** Angka aturan: teks disimpan lokal agar ketikan setengah jadi ("0,00") tidak terpotong. */
function RuleInput({ id, value, suffix, onChange }: { id: string; value: number; suffix?: string; onChange: (n: number) => void }) {
  const [text, setText] = useState(() => String(value).replace('.', ','))
  return (
    <Input
      id={id}
      numeric
      inputMode="decimal"
      suffix={suffix}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = parseAngka(e.target.value)
        if (n !== null && n > 0) onChange(n)
      }}
    />
  )
}

/** Angka bulat 0..max; teks disimpan sendiri agar kolom boleh kosong saat diketik. */
