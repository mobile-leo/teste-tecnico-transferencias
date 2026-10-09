import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, CalendarClock, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { api, getErrorMessage } from '@/lib/api'
import { refreshFinancialData, useAccounts } from '@/lib/hooks'
import { formatAccountNumber, formatCurrency, parseAmount, toLocalDateTimeInput } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { InputField, SelectField } from '@/components/ui/field'
import { ErrorState, LoadingState, PageHeader } from '@/components/ui/states'
import { cn } from '@/lib/cn'

type Mode = 'now' | 'scheduled'

export function TransferPage() {
  const { data: accounts, error, isLoading, mutate } = useAccounts()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('now')
  const [sourceId, setSourceId] = useState(params.get('origem') ?? '')
  const [destinationId, setDestinationId] = useState('')
  const [amount, setAmount] = useState('')
  const [scheduledAt, setScheduledAt] = useState(() => toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)))
  const [submitting, setSubmitting] = useState(false)
  const [keySeed, setKeySeed] = useState(0)

  // Same key while the payload is unchanged, so a resend never duplicates the transfer;
  // a new key after an error lets the user retry instead of replaying the failed one.
  const idempotencyKey = useMemo(
    () => crypto.randomUUID(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, sourceId, destinationId, amount, scheduledAt, keySeed],
  )

  const source = useMemo(() => accounts?.find((a) => String(a.id) === sourceId), [accounts, sourceId])
  const parsedAmount = parseAmount(amount)
  const exceeds = mode === 'now' && source !== undefined && parsedAmount > source.availableBalance

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!sourceId || !destinationId) return toast.error('Selecione as contas de origem e destino.')
    if (sourceId === destinationId) return toast.error('A conta de destino deve ser diferente da origem.')
    if (!(parsedAmount > 0)) return toast.error('Informe um valor maior que zero.')

    const base = { sourceAccountId: Number(sourceId), destinationAccountId: Number(destinationId), amount: parsedAmount }

    if (mode === 'scheduled') {
      const date = new Date(scheduledAt)
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        return toast.error('A data do agendamento deve estar no futuro.')
      }
    }

    setSubmitting(true)
    try {
      const transfer =
        mode === 'now'
          ? await api.transfer(base, idempotencyKey)
          : await api.scheduleTransfer({ ...base, scheduledAt: new Date(scheduledAt).toISOString() }, idempotencyKey)
      toast.success(mode === 'now' ? 'Transferência enviada.' : 'Transferência agendada.')
      await refreshFinancialData()
      navigate(`/comprovantes/${transfer.id}`)
    } catch (err) {
      setKeySeed((seed) => seed + 1)
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Nova transferência"
        description="Envie agora ou agende para uma data futura. Transferências agendadas podem ser canceladas até a execução."
      />

      {isLoading ? (
        <LoadingState label="Carregando contas…" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-5">
          <div className="flex flex-col gap-5 rounded-lg border bg-card p-6 lg:col-span-3">
            <div role="radiogroup" aria-label="Tipo de transferência" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
              {([
                { value: 'now', label: 'Enviar agora', icon: Zap },
                { value: 'scheduled', label: 'Agendar', icon: CalendarClock },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    'flex h-9 items-center justify-center gap-2 rounded-sm text-sm transition-colors',
                    mode === value ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>

            <SelectField label="De" value={sourceId} onChange={(e) => setSourceId(e.target.value)} required>
              <option value="" disabled>
                Conta de origem
              </option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {formatAccountNumber(a.id)} · {a.personName} · {formatCurrency(a.availableBalance)} disponível
                </option>
              ))}
            </SelectField>

            <div className="flex justify-center" aria-hidden="true">
              <span className="flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground">
                <ArrowDown className="size-4" />
              </span>
            </div>

            <SelectField label="Para" value={destinationId} onChange={(e) => setDestinationId(e.target.value)} required>
              <option value="" disabled>
                Conta de destino
              </option>
              {accounts
                ?.filter((a) => String(a.id) !== sourceId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatAccountNumber(a.id)} · {a.personName}
                  </option>
                ))}
            </SelectField>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Valor (R$)"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="tabular font-mono text-base"
                error={exceeds ? 'Valor acima do disponível (saldo + cheque especial).' : undefined}
                wrapperClassName={mode === 'now' ? 'sm:col-span-2' : ''}
              />
              {mode === 'scheduled' && (
                <InputField
                  label="Executar em"
                  type="datetime-local"
                  value={scheduledAt}
                  min={toLocalDateTimeInput(new Date())}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  required
                />
              )}
            </div>
          </div>

          <aside className="flex flex-col gap-5 rounded-lg border border-dashed bg-card p-6 lg:col-span-2">
            <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Resumo</h2>
            <dl className="flex flex-col gap-3 text-sm">
              <SummaryRow label="Origem" value={source?.personName ?? '—'} />
              <SummaryRow label="Destino" value={accounts?.find((a) => String(a.id) === destinationId)?.personName ?? '—'} />
              <SummaryRow label="Execução" value={mode === 'now' ? 'Imediata' : 'Agendada'} />
              {source && (
                <SummaryRow
                  label="Disponível após"
                  value={formatCurrency(source.availableBalance - (parsedAmount > 0 ? parsedAmount : 0))}
                  mono
                />
              )}
            </dl>
            <div className="flex items-baseline justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="tabular font-mono text-2xl font-semibold">{formatCurrency(parsedAmount > 0 ? parsedAmount : 0)}</span>
            </div>
            <Button type="submit" loading={submitting} disabled={exceeds} className="mt-auto">
              {mode === 'now' ? 'Confirmar transferência' : 'Confirmar agendamento'}
            </Button>
          </aside>
        </form>
      )}
    </>
  )
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('truncate text-right font-medium', mono && 'tabular font-mono')}>{value}</dd>
    </div>
  )
}
