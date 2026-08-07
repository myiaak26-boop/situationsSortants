import { createContext, useContext, type ReactNode } from 'react'
import { can, type Session } from './session'

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ session, children }: { session: Session | null; children: ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSession(): Session | null {
  return useContext(SessionContext)
}

export function useCan(permission: string): boolean {
  const session = useContext(SessionContext)
  return can(session, permission)
}