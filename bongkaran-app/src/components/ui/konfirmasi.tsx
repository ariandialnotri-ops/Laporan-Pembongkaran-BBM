import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { PencilLine, Send, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** hapus = merah (tidak bisa dibatalkan), ubah = oranye (data riwayat berubah), kirim = biru (data dikunci / dikirim). */
export type JenisKonfirmasi = 'hapus' | 'ubah' | 'kirim'

export interface OpsiKonfirmasi {
  jenis?: JenisKonfirmasi
  judul: string
  /** Kalimat penjelas; nama objek boleh ditebalkan dengan <b>. */
  pesan?: ReactNode
  /** Label tombol aksi, mis. "Ya, hapus". Tulis aksinya, jangan hanya "Ya". */
  ya?: string
  /** Label tombol batal, mis. "Tidak, simpan". */
  tidak?: string
}

const BAWAAN: Record<JenisKonfirmasi, { ya: string; tidak: string; ikon: typeof TriangleAlert; warna: string; tombol: string }> = {
  hapus: { ya: 'Ya, hapus', tidak: 'Tidak, simpan', ikon: TriangleAlert, warna: 'bg-red-50 text-red-600', tombol: 'bg-red-600 text-white shadow-[0_8px_20px_rgba(220,38,38,.35)] hover:bg-red-700' },
  ubah: { ya: 'Ya, ubah', tidak: 'Batal', ikon: PencilLine, warna: 'bg-amber-50 text-amber-600', tombol: 'bg-amber-500 text-white shadow-[0_8px_20px_rgba(245,158,11,.35)] hover:bg-amber-600' },
  kirim: { ya: 'Ya, kirim', tidak: 'Periksa lagi', ikon: Send, warna: 'bg-primary/10 text-primary', tombol: '' },
}

const Ctx = createContext<((o: OpsiKonfirmasi) => Promise<boolean>) | null>(null)

/** `if (!(await konfirmasi({ jenis: 'hapus', judul: 'Hapus totalizer?' }))) return` */
export function useKonfirmasi() {
  const f = useContext(Ctx)
  if (!f) throw new Error('useKonfirmasi harus dipakai di dalam KonfirmasiProvider')
  return f
}

/** Modal konfirmasi di tengah layar, satu untuk seluruh aplikasi (pengganti window.confirm). */
export function KonfirmasiProvider({ children }: { children: ReactNode }) {
  const [opsi, setOpsi] = useState<OpsiKonfirmasi | null>(null)
  const [buka, setBuka] = useState(false)
  const jawab = useRef<((v: boolean) => void) | null>(null)

  const konfirmasi = useCallback((o: OpsiKonfirmasi) => {
    jawab.current?.(false)
    setOpsi(o)
    setBuka(true)
    return new Promise<boolean>((res) => {
      jawab.current = res
    })
  }, [])
  const selesai = (v: boolean) => {
    jawab.current?.(v)
    jawab.current = null
    setBuka(false)
  }

  const jenis = opsi?.jenis ?? 'hapus'
  const gaya = BAWAAN[jenis]
  const Ikon = gaya.ikon
  return (
    <Ctx.Provider value={konfirmasi}>
      {children}
      <Dialog.Root open={buka} onOpenChange={(o) => !o && selesai(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[90] bg-on-surface/40" />
          <Dialog.Content
            role="alertdialog"
            className="modal-konfirmasi fixed left-1/2 top-1/2 z-[91] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-lg text-center shadow-2xl focus:outline-none"
          >
            <span aria-hidden="true" className={cn('flex size-16 items-center justify-center rounded-full', gaya.warna)}>
              <Ikon className="size-8" strokeWidth={2} />
            </span>
            <Dialog.Title className="text-headline-md font-bold text-on-surface">{opsi?.judul}</Dialog.Title>
            {opsi?.pesan ? (
              <Dialog.Description className="text-body-md text-on-surface-variant [&_b]:font-semibold [&_b]:text-on-surface">{opsi.pesan}</Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">{opsi?.judul}</Dialog.Description>
            )}
            {jenis === 'hapus' && <p className="text-body-sm text-red-700">Tindakan ini tidak dapat dibatalkan.</p>}
            <div className="mt-space-xs grid w-full grid-cols-2 gap-space-sm">
              <Button variant="soft" size="lg" className="w-full bg-surface-container-high text-on-surface" onClick={() => selesai(false)} autoFocus>
                {opsi?.tidak ?? gaya.tidak}
              </Button>
              <Button size="lg" className={cn('w-full', gaya.tombol)} onClick={() => selesai(true)}>
                {opsi?.ya ?? gaya.ya}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Ctx.Provider>
  )
}
