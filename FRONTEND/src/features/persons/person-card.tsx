import { IdCard, Mail, MapPin, Pencil, Phone, Trash2, UserPlus, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Person } from '@/lib/types'
import { formatAccountNumber } from '@/lib/format'
import { Button, buttonClasses } from '@/components/ui/button'
import { cn } from '@/lib/cn'

interface PersonCardProps {
  person: Person
  index?: number
  onEdit: (person: Person) => void
  onDelete: (person: Person) => void
  onCreateAccount: (person: Person) => void
}

function initials(name: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function PersonCard({ person, index = 0, onEdit, onDelete, onCreateAccount }: PersonCardProps) {
  const hasAccount = person.accountId !== null
  const location = [person.city, person.state].filter(Boolean).join(' / ')

  const info = [
    { icon: IdCard, value: person.document, fallback: 'Documento não informado', mono: true },
    { icon: Mail, value: person.email, fallback: 'E-mail não informado' },
    { icon: Phone, value: person.phone, fallback: 'Telefone não informado' },
    { icon: MapPin, value: location || null, fallback: 'Endereço não informado' },
  ]

  return (
    <article
      style={{ animationDelay: `${index * 60}ms` }}
      className="rise flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
    >
      <header className="flex items-start justify-between gap-3">
        <div
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground"
        >
          {initials(person.name)}
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
            hasAccount ? 'bg-primary-soft text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
          {hasAccount ? 'Com conta' : 'Sem conta'}
        </span>
      </header>

      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-balance">{person.name ?? 'Sem nome'}</h3>
        {hasAccount && (
          <Link
            to={`/contas/${person.accountId}`}
            className="inline-flex w-fit items-center gap-1.5 font-mono text-xs text-primary hover:underline"
          >
            <Wallet className="size-3.5" aria-hidden="true" />
            Conta #{formatAccountNumber(person.accountId!)}
          </Link>
        )}
      </div>

      <ul className="flex flex-col gap-2.5 text-sm">
        {info.map(({ icon: Icon, value, fallback, mono }) => (
          <li key={fallback} className="flex min-w-0 items-center gap-2.5">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className={cn('truncate', !value && 'text-muted-foreground', mono && value && 'tabular font-mono text-xs')}>
              {value ?? fallback}
            </span>
          </li>
        ))}
      </ul>

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
        {!hasAccount && (
          <Button size="sm" className="flex-1" onClick={() => onCreateAccount(person)}>
            <UserPlus className="size-4" aria-hidden="true" />
            Criar conta
          </Button>
        )}
        {hasAccount && (
          <Link to={`/contas/${person.accountId}`} className={cn(buttonClasses('primary', 'sm'), 'flex-1')}>
            <Wallet className="size-4" aria-hidden="true" />
            Ver conta
          </Link>
        )}
        <Button variant="secondary" size="sm" onClick={() => onEdit(person)}>
          <Pencil className="size-4" aria-hidden="true" />
          Editar
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(person)} aria-label={`Excluir ${person.name ?? 'pessoa'}`}>
          <Trash2 className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Excluir</span>
        </Button>
      </footer>
    </article>
  )
}
