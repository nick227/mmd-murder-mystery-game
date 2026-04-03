import { createContext, useContext, type PropsWithChildren } from 'react'
import type { ActionItem, RendererHandlers, ScreenData } from '../data/types'

export type RoomContextValue = {
  joined: boolean
  currentCharacterId: string | null
  screenData: ScreenData
  handlers: RendererHandlers
  hostHandlers?: RendererHandlers
  hostError?: string
  hostLobbyActions?: ActionItem[]
}

const RoomContext = createContext<RoomContextValue | null>(null)

export function RoomProvider({ value, children }: PropsWithChildren<{ value: RoomContextValue | null }>) {
  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>
}

export function useRoomContext(): RoomContextValue | null {
  return useContext(RoomContext)
}
