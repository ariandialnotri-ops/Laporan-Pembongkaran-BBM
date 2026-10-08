import { Link } from 'react-router-dom'
import { ChevronRight, CircleCheck, ClipboardList, FireExtinguisher, FlaskConical, Fuel, TestTube, Truck } from 'lucide-react'
import { MenuCard, type MenuItem } from '@/components/bongkaran/menu-card'
import { Loading } from '@/components/bongkaran/load-state'
import { useStokShift } from '@/components/bongkaran/stok-gate'
import { kondisiSemua } from '@/lib/apar'
import { useApp } from '@/lib/app-state'
import { qqRecordId, type AparRecord } from '@/lib/daily'
import { loStatus, planBesokKurang } from '@/lib/plan'
import { sampleMenunggu } from '@/lib/sample'
import { shiftLabel } from '@/lib/shift'
import { cn } from '@/lib/utils'

/** Menu Input: semua pengisian data ada di sini, satu kartu per pekerjaan. */
export function InputMenu() {
  const app = useApp()
  const stok = useStokShift()
  if (!app.loaded) return <Loading />

  const shiftNama = shiftLabel(stok.key.shift).split(' (')[0]
  const drafts = app.reports.filter((r) => r.status === 'draft').length
  const los = app.plans.flatMap((p) => p.los.map((lo) => loStatus(lo, app.usedLoIds)))
  const proses = los.filter((s) => s === 'proses').length
  const kirim = los.filter((s) => s === 'delivery').length
  const diuji = app.daily.some((d) => d.kind === 'qq' && d.id === qqRecordId(stok.key.tanggal, stok.key.shift))
  const sample = sampleMenunggu(app.reports)
  const besok = planBesokKurang(app.plans)
  const unitApar = (app.settings.apar?.length ?? 0) + (app.settings.apab?.length ?? 0)
  // Inspeksi APAR per unit: berapa unit yang belum diinspeksi bulan ini.
  const aparBelum = kondisiSemua(
    app.settings,
    app.daily.filter((d): d is AparRecord => d.kind === 'apar'),
    stok.key.tanggal,
  ).filter((k) => !k.bulanIni).length

  const menus: MenuItem[] = [
    {
      to: '/input/bongkar',
      icon: Truck,
      title: 'Input Bongkaran',
      desc: '14 tahap SOP saat mobil tangki tiba',
      status: drafts ? `${drafts} bongkaran belum selesai` : 'Tidak ada yang berjalan',
      badge: drafts,
    },
    {
      to: '/plan',
      icon: ClipboardList,
      title: 'Plan Pengiriman',
      desc: 'Permintaan MS2, nomor SO, dan LO per produk',
      status: besok ? 'Plan besok belum dibuat' : proses ? `${proses} LO belum terbit` : kirim ? `${kirim} LO sedang dikirim` : 'Semua LO terisi',
      badge: (besok ? 1 : 0) + proses,
    },
    {
      to: '/kualitas',
      icon: FlaskConical,
      title: 'Kualitas Harian',
      desc: 'Density, suhu, dan tera bejana 20 L',
      status: diuji ? `${shiftNama} sudah diuji` : `${shiftNama} belum diuji`,
      badge: diuji ? 0 : 1,
    },
    {
      to: '/sample',
      icon: TestTube,
      title: 'Uji Kualitas Pasca Penerimaan',
      desc: 'Wajib setelah setiap penerimaan BBM, jam uji diatur petugas',
      status: sample.length ? `${sample.length} penerimaan belum diuji` : 'Semua penerimaan sudah diuji',
      badge: sample.length,
    },
    {
      to: '/apar',
      icon: FireExtinguisher,
      title: 'APAR & APAB',
      desc: 'Pindai QR di unit, checklist & foto, kirim per unit',
      status: !unitApar ? 'Data utama unit belum diisi' : aparBelum ? `${aparBelum} dari ${unitApar} unit belum bulan ini` : 'Semua unit sudah bulan ini',
      badge: aparBelum,
    },
  ]

  return (
    <div className="flex flex-col gap-space-md">
      {/* Kewajiban awal shift: bukan menu, tapi syarat sebelum input lain. */}
      {app.can('/stok') && (
        <Link
          to="/stok"
          className={cn(
            'animate-entrance-1 flex min-h-16 items-center gap-space-sm rounded-lg p-space-sm transition-transform active:scale-[0.99]',
            stok.missing ? 'border border-error/40 bg-error-container/70' : 'glass-1',
          )}
        >
          <span aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-full', stok.missing ? 'bg-error text-on-error' : 'bg-primary-fixed text-primary')}>
            {stok.missing ? <Fuel className="size-5" /> : <CircleCheck className="size-5" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className={cn('text-body-md font-bold', stok.missing ? 'text-on-error-container' : 'text-on-surface')}>
              {stok.missing ? `Isi stok awal ${shiftNama}` : `Stok awal ${shiftNama} terisi`}
            </span>
            <span className={cn('text-body-sm', stok.missing ? 'text-on-error-container' : 'text-on-surface-variant')}>
              {stok.missing ? 'Wajib sebelum input bongkaran dan kualitas harian.' : 'Pengeluaran dispenser diisi di akhir shift.'}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-on-surface-variant" />
        </Link>
      )}

      <nav aria-label="Menu input" className="grid grid-cols-2 gap-space-sm">
        {menus
          .filter((m) => app.can(m.to))
          .map((m, i) => (
            <MenuCard key={m.to} m={m} index={i} />
          ))}
      </nav>
    </div>
  )
}
