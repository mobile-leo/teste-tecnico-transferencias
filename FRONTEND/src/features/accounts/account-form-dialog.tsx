import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { InputField, SelectField } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { api, getErrorMessage } from '@/lib/api'
import { refreshFinancialData, usePersons } from '@/lib/hooks'
import { accountStatusFromName, parseAmount } from '@/lib/format'
import { AccountStatus, type Account } from '@/lib/types'

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account
  defaultPersonId?: number
}

export function AccountFormDialog({ open, onOpenChange, account, defaultPersonId }: AccountFormDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={account ? 'Editar conta' : 'Abrir nova conta'}
      description={account ? 'Altere o titular, o limite ou o status.' : 'Vincule uma conta a uma pessoa cadastrada.'}
    >
      {open && <AccountForm account={account} defaultPersonId={defaultPersonId} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function AccountForm({
  account,
  defaultPersonId,
  onDone,
}: {
  account?: Account
  defaultPersonId?: number
  onDone: () => void
}) {
  const { data: persons } = usePersons()
  const [personId, setPersonId] = useState(
    account ? String(account.personId) : defaultPersonId ? String(defaultPersonId) : '',
  )
  const [balance, setBalance] = useState('0,00')
  const [overdraft, setOverdraft] = useState(account ? account.overdraftLimit.toFixed(2).replace('.', ',') : '0,00')
  const [status, setStatus] = useState<AccountStatus>(
    account ? (accountStatusFromName[account.status ?? ''] ?? AccountStatus.Active) : AccountStatus.Active,
  )
  const [submitting, setSubmitting] = useState(false)

  const available = (persons ?? []).filter((p) => p.accountId === null || p.id === account?.personId)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const overdraftLimit = parseAmount(overdraft)
    const initialBalance = parseAmount(balance)
    if (!personId) return toast.error('Selecione o titular da conta.')
    if (!(overdraftLimit >= 0)) return toast.error('Informe um limite válido.')
    if (!account && !(initialBalance >= 0)) return toast.error('Informe um saldo inicial válido.')

    setSubmitting(true)
    try {
      if (account) {
        await api.updateAccount(account.id, { personId: Number(personId), overdraftLimit, status })
        toast.success('Conta atualizada.')
      } else {
        await api.createAccount({ personId: Number(personId), balance: initialBalance, overdraftLimit, status })
        toast.success('Conta aberta com sucesso.')
      }
      await refreshFinancialData()
      onDone()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <SelectField
        label="Titular"
        value={personId}
        onChange={(e) => setPersonId(e.target.value)}
        required
        hint={available.length === 0 ? 'Todas as pessoas já possuem conta. Cadastre uma nova pessoa.' : undefined}
      >
        <option value="" disabled>
          Selecione uma pessoa
        </option>
        {available.map((person) => (
          <option key={person.id} value={person.id}>
            {person.name}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        {!account && (
          <InputField
            label="Saldo inicial (R$)"
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="tabular font-mono"
          />
        )}
        <InputField
          label="Cheque especial (R$)"
          inputMode="decimal"
          value={overdraft}
          onChange={(e) => setOverdraft(e.target.value)}
          className="tabular font-mono"
        />
        <SelectField
          label="Status"
          value={status}
          onChange={(e) => setStatus(Number(e.target.value) as AccountStatus)}
          wrapperClassName={account ? '' : 'sm:col-span-2'}
        >
          <option value={AccountStatus.Active}>Ativa</option>
          <option value={AccountStatus.Blocked}>Bloqueada</option>
          <option value={AccountStatus.Inactive}>Inativa</option>
        </SelectField>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          {account ? 'Salvar alterações' : 'Abrir conta'}
        </Button>
      </div>
    </form>
  )
}
