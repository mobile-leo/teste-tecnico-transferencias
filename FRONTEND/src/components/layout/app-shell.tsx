import { ArrowUpRight } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { IS_MOCK } from '@/lib/api'

const navigation = [
  { to: '/', label: 'Contas', end: true },
  { to: '/pessoas', label: 'Pessoas', end: false },
  { to: '/comprovantes', label: 'Comprovantes', end: false },
]

export function AppShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 md:px-8">
          <div className="flex items-center gap-10">
            <Link to="/" className="flex items-center gap-2.5 py-4" aria-label="Razão, página inicial">
              <span className="flex size-8 items-center justify-center rounded-md bg-ink font-mono text-xs font-semibold text-ink-foreground">
                R$
              </span>
              <span className="text-lg font-semibold tracking-tight">Razão</span>
            </Link>

            <nav aria-label="Navegação principal" className="hidden md:block">
              <NavItems />
            </nav>
          </div>

          <Link
            to="/transferir"
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Nova transferência
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <nav aria-label="Navegação principal" className="overflow-x-auto px-4 md:hidden">
          <NavItems />
        </nav>
      </header>

      <main className="flex-1 px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 font-mono text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-8">
          <span>Razão · Transferências entre contas</span>
          <span className="flex items-center gap-2">
            <span
              className={cn('size-1.5 rounded-full', IS_MOCK ? 'bg-accent' : 'bg-primary')}
              aria-hidden="true"
            />
            {IS_MOCK ? 'Modo demonstração' : 'API conectada em /api'}
          </span>
        </div>
      </footer>
    </div>
  )
}

function NavItems() {
  return (
    <ul className="flex gap-6">
      {navigation.map(({ to, label, end }) => (
        <li key={to}>
          <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative block whitespace-nowrap py-4 text-sm transition-colors',
                'after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors',
                isActive
                  ? 'font-medium text-foreground after:bg-primary'
                  : 'text-muted-foreground after:bg-transparent hover:text-foreground',
              )
            }
          >
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
