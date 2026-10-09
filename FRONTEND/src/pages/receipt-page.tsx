import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, Search } from 'lucide-react'
import { useTransfer } from '@/lib/hooks'
import { formatAccountNumber, formatCurrency, formatDateTime } from '@/lib/format'
import { Button, buttonClasses } from '@/components/ui/button'
import { ErrorState, LoadingState, PageHeader } from '@/components/ui/states'
import { TransferStatusBadge } from '@/components/ui/status-badge'

export function ReceiptPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [lookup, setLookup] = useState(id ?? '')
  const { data: transfer, error, isLoading, mutate } = useTransfer(id)

  function handleLookup(event: FormEvent) {
    event.preventDefault()
    const value = lookup.trim()
    if (value) navigate(`/comprovantes/${value}`)
  }

  return (
    <>
      <PageHeader
        eyebrow="Consulta"
        title="Comprovante"
        description="Consulte o status de uma transferência pelo seu identificador."
      />

      <form onSubmit={handleLookup} className="flex max-w-xl gap-2">
        <label htmlFor="transfer-id" className="sr-only">
          ID da transferência
        </label>
        <input
          id="transfer-id"
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          placeholder="ID da transferência (GUID)"
          className="h-10 flex-1 rounded-md border border-input bg-card px-3 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <Button type="submit" variant="secondary">
          <Search className="size-4" aria-hidden="true" />
          Consultar
        </Button>
      </form>

      {!id ? null : isLoading ? (
        <LoadingState label="Buscando transferência…" />
      ) : error || !transfer ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : (
        <article className="rise mx-auto w-full max-w-md overflow-hidden rounded-lg border bg-card shadow-sm">
          <header className="flex flex-col items-center gap-3 border-b border-dashed px-6 py-8 text-center">
            <TransferStatusBadge status={transfer.status} />
            <p className="tabular font-mono text-4xl font-semibold tracking-tight">{formatCurrency(transfer.amount)}</p>
            <p className="text-sm text-muted-foreground">
              {transfer.status === 'Scheduled'
                ? `Agendada para ${formatDateTime(transfer.scheduledAt)}`
                : `Registrada em ${formatDateTime(transfer.createdAt)}`}
            </p>
          </header>

          <dl className="flex flex-col gap-4 px-6 py-6 text-sm">
            <ReceiptRow label="De" value={transfer.sourceAccountName ?? '—'} detail={`Conta nº ${formatAccountNumber(transfer.sourceAccountId)}`} />
            <ReceiptRow label="Para" value={transfer.destinationAccountName ?? '—'} detail={`Conta nº ${formatAccountNumber(transfer.destinationAccountId)}`} />
            {transfer.processedAt && <ReceiptRow label="Processada em" value={formatDateTime(transfer.processedAt)} />}
            {transfer.cancelledAt && <ReceiptRow label="Cancelada em" value={formatDateTime(transfer.cancelledAt)} />}
            {transfer.failureReason && <ReceiptRow label="Motivo da falha" value={transfer.failureReason} />}
            <ReceiptRow label="Identificador" value={transfer.id} mono />
          </dl>

          <footer className="flex gap-2 border-t bg-muted/40 px-6 py-4">
            <Link to={`/contas/${transfer.sourceAccountId}`} className={buttonClasses('secondary', 'sm')}>
              Ver conta de origem
            </Link>
            <Link to="/transferir" className={buttonClasses('primary', 'sm')}>
              <ArrowLeftRight className="size-4" aria-hidden="true" />
              Nova transferência
            </Link>
          </footer>
        </article>
      )}
    </>
  )
}

function ReceiptRow({ label, value, detail, mono }: { label: string; value: string; detail?: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-col items-end text-right">
        <span className={mono ? 'break-all font-mono text-xs' : 'font-medium'}>{value}</span>
        {detail && <span className="font-mono text-xs text-muted-foreground">{detail}</span>}
      </dd>
    </div>
  )
}
