import { Eye, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Account } from '@/lib/types'
import { formatAccountNumber, formatCurrency } from '@/lib/format'
import { AccountStatusBadge } from '@/components/ui/status-badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface AccountCardProps {
  account: Account
  index?: number
  onEdit: (account: Account) => void
  onDelete: (account: Account) => void
}

function initials(name: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function AccountCard({ account, index = 0, onEdit, onDelete }: AccountCardProps) {
  const negative = account.balance < 0
  const used = Math.max(0, -account.balance)
  const ratio = account.overdraftLimit > 0 ? Math.min(1, used / account.overdraftLimit) : 0

  return (
    <article
      style={{ animationDelay: `${index * 60}ms` }}
      className="rise flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft font-semibold text-primary"
          >
            {initials(account.personName)}
          </div>
          <div className="flex min-w-0 flex-col">
            <h3 className="truncate text-base font-semibold">{account.personName ?? 'Sem titular'}</h3>
            <span className="font-mono text-xs text-muted-foreground">Conta #{formatAccountNumber(account.id)}</span>
          </div>
        </div>
        <AccountStatusBadge status={account.status} />
      </header>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saldo disponível</span>
        <strong className="tabular font-mono text-3xl font-semibold tracking-tight text-foreground">
          {formatCurrency(account.availableBalance)}
        </strong>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-xl bg-muted/60 px-4 py-3">
          <dt className="text-xs text-muted-foreground">Saldo</dt>
          <dd className={cn('tabular font-mono text-sm font-semibold', negative && 'text-destructive')}>
            {formatCurrency(account.balance)}
          </dd>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-muted/60 px-4 py-3">
          <dt className="text-xs text-muted-foreground">Cheque especial</dt>
          <dd className="tabular font-mono text-sm font-semibold">{formatCurrency(account.overdraftLimit)}</dd>
          {ratio > 0 && (
            <div
              role="meter"
              aria-label="Uso do cheque especial"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(ratio * 100)}
              className="mt-1 h-1 overflow-hidden rounded-full bg-border"
            >
              <div
                className={cn('h-full rounded-full', ratio > 0.75 ? 'bg-destructive' : 'bg-accent')}
                style={{ width: `${Math.max(6, ratio * 100)}%` }}
              />
            </div>
          )}
        </div>
      </dl>

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
        <Link to={`/contas/${account.id}`} className={cn(buttonClasses('primary', 'sm'), 'flex-1')}>
          <Eye className="size-4" aria-hidden="true" />
          Visualizar
        </Link>
        <Button variant="secondary" size="sm" onClick={() => onEdit(account)}>
          <Pencil className="size-4" aria-hidden="true" />
          Editar
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(account)} aria-label={`Excluir conta de ${account.personName ?? 'sem titular'}`}>
          <Trash2 className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Excluir</span>
        </Button>
      </footer>
    </article>
  )
}
