import type { Account } from '@/lib/types'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'

export function OverdraftMeter({ account }: { account: Account }) {
  const used = Math.max(0, -account.balance)
  const ratio = account.overdraftLimit > 0 ? Math.min(1, used / account.overdraftLimit) : 0
  const percent = Math.round(ratio * 100)

  return (
    <div className="flex flex-col gap-2 border-t border-dashed pt-4">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Cheque especial</span>
        <span className="tabular font-mono">
          {formatCurrency(used)} <span className="text-muted-foreground">/ {formatCurrency(account.overdraftLimit)}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label="Uso do cheque especial"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-all', ratio > 0.75 ? 'bg-destructive' : ratio > 0 ? 'bg-accent' : 'bg-primary')}
          style={{ width: `${ratio === 0 ? 0 : Math.max(4, percent)}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Disponível para transferir</span>
        <span className="tabular font-mono font-medium text-primary">{formatCurrency(account.availableBalance)}</span>
      </div>
    </div>
  )
}
