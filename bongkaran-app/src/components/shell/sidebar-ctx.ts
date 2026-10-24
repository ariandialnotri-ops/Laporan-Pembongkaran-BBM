import { createContext, useContext } from 'react'

export interface SidebarState {
  /** Laci sidebar HP/tablet terbuka. */
  laci: boolean
  setLaci: (o: boolean) => void
  /** Sidebar tetap (layar lebar) sedang disembunyikan. */
  tertutup: boolean
  /** Tombol menu: layar lebar = sembunyikan/tampilkan sidebar; HP = buka laci. */
  toggle: () => void
}

export const SidebarContext = createContext<SidebarState>({ laci: false, setLaci: () => {}, tertutup: false, toggle: () => {} })
export const useSidebar = () => useContext(SidebarContext)
