import { cn } from '@/lib/cn'
import { accountStatusLabel, transferStatusLabel } from '@/lib/format'

const transferTones: Record<string, string> = {
  Completed: 'bg-primary-soft text-primary',
  Scheduled: 'bg-accent-soft text-accent',
  Processing: 'bg-muted text-foreground',
  Failed: 'bg-destructive-soft text-destructive',
  Cancelled: 'bg-muted text-muted-foreground line-through decoration-1',
}

const accountTones: Record<string, string> = {
  Active: 'bg-primary-soft text-primary',
  Blocked: 'bg-destructive-soft text-destructive',
  Inactive: 'bg-muted text-muted-foreground',
}

const base = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold'

export function TransferStatusBadge({ status }: { status: string | null }) {
  const key = status ?? ''
  return (
    <span className={cn(base, transferTones[key] ?? 'bg-muted text-muted-foreground')}>
      {transferStatusLabel[key] ?? key ?? '—'}
    </span>
  )
}

export function AccountStatusBadge({ status }: { status: string | null }) {
  const key = status ?? ''
  return (
    <span className={cn(base, accountTones[key] ?? 'bg-muted text-muted-foreground')}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {accountStatusLabel[key] ?? key ?? '—'}
    </span>
  )
}
