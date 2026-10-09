import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import type { Transfer } from '@/lib/types'
import { api, getErrorMessage } from '@/lib/api'
import { refreshFinancialData } from '@/lib/hooks'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { TransferStatusBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/states'
import { cn } from '@/lib/cn'

export function TransferHistory({ accountId, transfers }: { accountId: number; transfers: Transfer[] }) {
  const [cancelling, setCancelling] = useState<Transfer | null>(null)

  if (transfers.length === 0) {
    return <EmptyState title="Nenhuma movimentação" description="As transferências enviadas e recebidas por esta conta aparecerão aqui." />
  }

  const sorted = [...transfers].sort(
    (a, b) => new Date(b.scheduledAt ?? b.createdAt).getTime() - new Date(a.scheduledAt ?? a.createdAt).getTime(),
  )

  return (
    <>
      <ol className="flex flex-col divide-y rounded-lg border bg-card">
        {sorted.map((transfer) => {
          const outgoing = transfer.sourceAccountId === accountId
          const counterpart = outgoing ? transfer.destinationAccountName : transfer.sourceAccountName
          const Icon = transfer.status === 'Scheduled' ? CalendarClock : outgoing ? ArrowUpRight : ArrowDownLeft
          const muted = transfer.status === 'Cancelled' || transfer.status === 'Failed'

          return (
            <li key={transfer.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md',
                    outgoing ? 'bg-muted text-foreground' : 'bg-primary-soft text-primary',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link to={`/comprovantes/${transfer.id}`} className="truncate text-sm font-medium hover:underline">
                    {outgoing ? 'Para ' : 'De '}
                    {counterpart ?? 'Conta desconhecida'}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {transfer.status === 'Scheduled'
                      ? `Agendada para ${formatDateTime(transfer.scheduledAt)}`
                      : formatDateTime(transfer.processedAt ?? transfer.createdAt)}
                    {transfer.failureReason ? ` · ${transfer.failureReason}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <TransferStatusBadge status={transfer.status} />
                <span
                  className={cn(
                    'tabular w-32 text-right font-mono text-sm font-medium',
                    muted ? 'text-muted-foreground line-through' : outgoing ? 'text-foreground' : 'text-primary',
                  )}
                >
                  {outgoing ? '− ' : '+ '}
                  {formatCurrency(transfer.amount)}
                </span>
                {transfer.status === 'Scheduled' && outgoing && (
                  <Button variant="ghost" size="sm" onClick={() => setCancelling(transfer)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancelar agendamento?"
        description={
          cancelling
            ? `A transferência de ${formatCurrency(cancelling.amount)} para ${cancelling.destinationAccountName ?? 'o destino'} não será executada.`
            : ''
        }
        confirmLabel="Cancelar agendamento"
        onConfirm={async () => {
          if (!cancelling) return
          try {
            await api.cancelTransfer(cancelling.id)
            toast.success('Agendamento cancelado.')
            await refreshFinancialData()
          } catch (error) {
            toast.error(getErrorMessage(error))
            throw error
          }
        }}
      />
    </>
  )
}
