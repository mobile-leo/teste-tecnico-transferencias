import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { api, getErrorMessage } from '@/lib/api'
import { refreshFinancialData, usePersons } from '@/lib/hooks'
import type { Person } from '@/lib/types'
import { PersonCard } from '@/features/persons/person-card'
import { AccountFormDialog } from '@/features/accounts/account-form-dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@/components/ui/states'
import { PersonFormDialog } from '@/features/persons/person-form-dialog'

export function PersonsPage() {
  const { data: persons, error, isLoading, mutate } = usePersons()
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Person | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Person | null>(null)
  const [openingAccountFor, setOpeningAccountFor] = useState<Person | null>(null)

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return persons ?? []
    return (persons ?? []).filter((p) =>
      [p.name, p.document, p.email, p.city].some((value) => value?.toLowerCase().includes(term)),
    )
  }, [persons, query])

  return (
    <>
      <PageHeader
        eyebrow="Cadastro"
        title="Pessoas"
        description="Titulares que podem ter uma conta vinculada."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nova pessoa
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="person-search" className="sr-only">
          Buscar pessoas
        </label>
        <input
          id="person-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, documento, e-mail…"
          className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {isLoading ? (
        <LoadingState label="Carregando pessoas…" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? 'Nenhum resultado' : 'Nenhuma pessoa cadastrada'}
          description={query ? 'Tente outro termo de busca.' : 'Cadastre o primeiro titular para abrir uma conta.'}
        />
      ) : (
        <section aria-label="Lista de pessoas" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((person, index) => (
            <PersonCard
              key={person.id}
              person={person}
              index={index}
              onEdit={setEditing}
              onDelete={setDeleting}
              onCreateAccount={setOpeningAccountFor}
            />
          ))}
        </section>
      )}

      <PersonFormDialog open={creating} onOpenChange={setCreating} />
      <AccountFormDialog
        open={openingAccountFor !== null}
        onOpenChange={(open) => !open && setOpeningAccountFor(null)}
        defaultPersonId={openingAccountFor?.id}
      />
      <PersonFormDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} person={editing ?? undefined} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Excluir pessoa?"
        description={`${deleting?.name ?? ''} será removido(a) do cadastro.`}
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.deletePerson(deleting.id)
            toast.success('Pessoa excluída.')
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
