import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowLeftRight, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, getErrorMessage } from '@/lib/api'
import { refreshFinancialData, useAccount, useTransferHistory } from '@/lib/hooks'
import { formatAccountNumber, formatCurrency } from '@/lib/format'
import { Button, buttonClasses } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState, LoadingState, PageHeader } from '@/components/ui/states'
import { AccountStatusBadge } from '@/components/ui/status-badge'
import { OverdraftMeter } from '@/features/accounts/overdraft-meter'
import { AccountFormDialog } from '@/features/accounts/account-form-dialog'
import { TransferHistory } from '@/features/transfers/transfer-history'
import { cn } from '@/lib/cn'

export function AccountDetailPage() {
  const accountId = Number(useParams().id)
  const navigate = useNavigate()
  const account = useAccount(accountId)
  const history = useTransferHistory(accountId)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (account.isLoading) return <LoadingState label="Carregando conta…" />
  if (account.error || !account.data) return <ErrorState error={account.error} onRetry={() => account.mutate()} />

  const data = account.data

  return (
    <>
      <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Todas as contas
      </Link>

      <PageHeader
        eyebrow={`Conta nº ${formatAccountNumber(data.id)}`}
        title={data.personName ?? 'Sem titular'}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDeleting(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
              Excluir
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden="true" />
              Editar
            </Button>
            <Link to={`/transferir?origem=${data.id}`} className={buttonClasses('primary')}>
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Transferir
            </Link>
          </>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col justify-between gap-6 rounded-lg bg-ink p-6 text-ink-muted lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">Saldo atual</span>
            <AccountStatusBadge status={data.status} />
          </div>
          <p className={cn('tabular font-mono text-4xl font-semibold tracking-tight md:text-5xl', data.balance < 0 ? 'text-destructive-soft' : 'text-ink-foreground')}>
            {formatCurrency(data.balance)}
          </p>
          <p className="text-sm">
            Disponível para transferências:{' '}
            <span className="tabular font-mono font-medium text-ink-foreground">{formatCurrency(data.availableBalance)}</span>
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <OverdraftMeter account={data} />
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="history-title">
        <h2 id="history-title" className="text-lg font-semibold">
          Movimentações
        </h2>
        {history.isLoading ? (
          <LoadingState label="Carregando movimentações…" />
        ) : history.error ? (
          <ErrorState error={history.error} onRetry={() => history.mutate()} />
        ) : (
          <TransferHistory accountId={data.id} transfers={history.data ?? []} />
        )}
      </section>

      <AccountFormDialog open={editing} onOpenChange={setEditing} account={data} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir conta?"
        description="Essa ação não pode ser desfeita. Contas com movimentações podem não ser excluídas pelo backend."
        confirmLabel="Excluir conta"
        onConfirm={async () => {
          try {
            await api.deleteAccount(data.id)
            toast.success('Conta excluída.')
            await refreshFinancialData()
            navigate('/')
          } catch (error) {
            toast.error(getErrorMessage(error))
            throw error
          }
        }}
      />
    </>
  )
}
