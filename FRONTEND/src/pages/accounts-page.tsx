import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { api, getErrorMessage } from '@/lib/api'
import { refreshFinancialData, useAccounts } from '@/lib/hooks'
import { formatCurrency } from '@/lib/format'
import type { Account } from '@/lib/types'
import { Button, buttonClasses } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui/states'
import { AccountCard } from '@/features/accounts/account-card'
import { AccountFormDialog } from '@/features/accounts/account-form-dialog'

export function AccountsPage() {
  const { data: accounts, error, isLoading, mutate } = useAccounts()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)

  const total = (accounts ?? []).reduce((sum, account) => sum + account.balance, 0)
  const available = (accounts ?? []).reduce((sum, account) => sum + account.availableBalance, 0)

  return (
    <>
      <PageHeader
        eyebrow="Visão geral"
        title="Contas"
        description="Saldos, limites de cheque especial e situação de cada conta cadastrada."
        actions={
          <>
            <Link to="/transferir" className={buttonClasses('secondary')}>
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Transferir
            </Link>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Nova conta
            </Button>
          </>
        }
      />

      {isLoading ? (
        <LoadingState label="Carregando contas…" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : !accounts || accounts.length === 0 ? (
        <EmptyState
          title="Nenhuma conta aberta"
          description="Cadastre uma pessoa e abra a primeira conta para começar a transferir."
          action={<Button onClick={() => setCreating(true)}>Abrir conta</Button>}
        />
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3">
            {[
              { label: 'Contas', value: String(accounts.length) },
              { label: 'Saldo consolidado', value: formatCurrency(total) },
              { label: 'Disponível com limite', value: formatCurrency(available) },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-1 bg-card px-5 py-4">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="tabular font-mono text-lg font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>

          <section aria-label="Lista de contas" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account, index) => (
              <AccountCard
                key={account.id}
                account={account}
                index={index}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </section>
        </>
      )}

      <AccountFormDialog open={creating} onOpenChange={setCreating} />
      <AccountFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        account={editing ?? undefined}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir conta?"
        description={`A conta de ${deleting?.personName ?? 'sem titular'} será removida.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.deleteAccount(deleting.id)
            toast.success('Conta excluída.')
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
