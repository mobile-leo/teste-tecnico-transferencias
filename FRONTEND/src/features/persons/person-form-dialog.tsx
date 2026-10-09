import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { InputField } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { api, getErrorMessage } from '@/lib/api'
import { refreshFinancialData } from '@/lib/hooks'
import type { Person, PersonPayload } from '@/lib/types'

const emptyPayload: PersonPayload = {
  name: '',
  document: '',
  birthDate: '',
  email: '',
  phone: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
}

interface PersonFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  person?: Person
}

export function PersonFormDialog({ open, onOpenChange, person }: PersonFormDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={person ? 'Editar pessoa' : 'Cadastrar pessoa'}
      description="Apenas o nome é obrigatório. Os demais dados ajudam na identificação."
    >
      {open && <PersonForm person={person} onDone={() => onOpenChange(false)} />}
    </Modal>
  )
}

function toFormValues(person?: Person): PersonPayload {
  if (!person) return emptyPayload
  const { id: _id, accountId: _accountId, ...rest } = person
  return Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, value ?? ''])) as PersonPayload
}

function toPayload(values: PersonPayload): PersonPayload {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      const trimmed = typeof value === 'string' ? value.trim() : value
      return [key, trimmed === '' ? null : trimmed]
    }),
  ) as PersonPayload
}

function PersonForm({ person, onDone }: { person?: Person; onDone: () => void }) {
  const [values, setValues] = useState<PersonPayload>(() => toFormValues(person))
  const [submitting, setSubmitting] = useState(false)

  const bind = (field: keyof PersonPayload) => ({
    value: values[field] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((prev) => ({ ...prev, [field]: e.target.value })),
  })

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!values.name?.trim()) return toast.error('Informe o nome.')

    setSubmitting(true)
    try {
      const payload = toPayload({ ...values, state: values.state?.toUpperCase() ?? null })
      if (person) {
        await api.updatePerson(person.id, payload)
        toast.success('Cadastro atualizado.')
      } else {
        await api.createPerson(payload)
        toast.success('Pessoa cadastrada.')
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Identificação</legend>
        <InputField label="Nome" required maxLength={150} wrapperClassName="sm:col-span-2" {...bind('name')} />
        <InputField label="CPF / CNPJ" maxLength={20} {...bind('document')} />
        <InputField label="Nascimento" type="date" {...bind('birthDate')} />
        <InputField label="E-mail" type="email" maxLength={150} {...bind('email')} />
        <InputField label="Telefone" type="tel" maxLength={20} {...bind('phone')} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-6">
        <legend className="mb-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">Endereço</legend>
        <InputField label="CEP" maxLength={10} wrapperClassName="sm:col-span-2" {...bind('zipCode')} />
        <InputField label="Rua" maxLength={150} wrapperClassName="sm:col-span-4" {...bind('street')} />
        <InputField label="Número" maxLength={20} wrapperClassName="sm:col-span-2" {...bind('number')} />
        <InputField label="Complemento" maxLength={100} wrapperClassName="sm:col-span-4" {...bind('complement')} />
        <InputField label="Bairro" maxLength={100} wrapperClassName="sm:col-span-3" {...bind('neighborhood')} />
        <InputField label="Cidade" maxLength={100} wrapperClassName="sm:col-span-2" {...bind('city')} />
        <InputField label="UF" maxLength={2} className="uppercase" {...bind('state')} />
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          {person ? 'Salvar alterações' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  )
}
