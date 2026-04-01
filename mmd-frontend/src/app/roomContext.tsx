import { createContext, useContext, type PropsWithChildren } from 'react'
import type { ActionItem, RendererHandlers, ScreenData } from '../data/types'
import type { usePinnedIds } from '../hooks/useAppState'

export type RoomContextValue = {
  joined: boolean
  screenData: ScreenData
  handlers: RendererHandlers
  pins: ReturnType<typeof usePinnedIds>
  hostHandlers?: RendererHandlers
  hostError?: string
  hostLobbyActions?: ActionItem[]
  hostGameActions?: ActionItem[]
}

const RoomContext = createContext<RoomContextValue | null>(null)

export function RoomProvider({ value, children }: PropsWithChildren<{ value: RoomContextValue | null }>) {
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

export function useRoomContext(): RoomContextValue | null {
  return useContext(RoomContext)
}
