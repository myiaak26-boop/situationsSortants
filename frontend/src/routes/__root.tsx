import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { LoginPage } from '@/components/auth/login-page'
import { setUnauthorizedHandler } from '@/lib/api'
import { fetchSession, logout, type Session } from '@/lib/session'
import { SessionProvider } from '@/lib/session-context'

type AuthState =
  | { status: 'loading' }
  | { status: 'ready'; session: Session }
  | { status: 'error'; message: string }

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' })

  const checkAuth = () => {
    setAuth({ status: 'loading' })
    fetchSession().then((session) => {
      if (session) return setAuth({ status: 'ready', session })
      setAuth({ status: 'error', message: 'Session expirée. Veuillez vous reconnecter.' })
    })
  }

  useEffect(() => {
    checkAuth()
    setUnauthorizedHandler(checkAuth)
    return () => setUnauthorizedHandler(null)
  }, [])

  const handleLoginSuccess = () => {
    checkAuth()
  }

  const handleLogout = async () => {
    await logout()
    checkAuth()
  }

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (auth.status !== 'ready') {
    return <LoginPage onSuccess={handleLoginSuccess} />
  }

  return (
    <SessionProvider session={auth.session}>
      <div className="flex min-h-screen">
        <div className="print:hidden">
          <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} session={auth.session} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col pl-0 transition-all duration-300 lg:pl-sidebar print:pl-0">
          <div className="print:hidden">
            <Topbar session={auth.session} onLogout={handleLogout} onMenuClick={() => setMobileMenuOpen(true)} />
          </div>
          <main className="flex-1 p-5 pt-[calc(var(--topbar-height)+1.25rem)] lg:p-6 lg:pt-[calc(var(--topbar-height)+1.5rem)] print:p-0 print:pt-0">
            <Outlet />
          </main>
        </div>
        <div className="print:hidden">
          <TanStackRouterDevtools />
        </div>
      </div>
    </SessionProvider>
  )
}