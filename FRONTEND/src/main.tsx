import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Link, RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { SWRConfig } from 'swr'
import './index.css'
import { AppShell } from '@/components/layout/app-shell'
import { EmptyState } from '@/components/ui/states'
import { AccountsPage } from '@/pages/accounts-page'
import { AccountDetailPage } from '@/pages/account-detail-page'
import { PersonsPage } from '@/pages/persons-page'
import { TransferPage } from '@/pages/transfer-page'
import { ReceiptPage } from '@/pages/receipt-page'

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <AccountsPage /> },
      { path: 'contas/:id', element: <AccountDetailPage /> },
      { path: 'pessoas', element: <PersonsPage /> },
      { path: 'transferir', element: <TransferPage /> },
      { path: 'comprovantes', element: <ReceiptPage /> },
      { path: 'comprovantes/:id', element: <ReceiptPage /> },
      {
        path: '*',
        element: (
          <EmptyState
            title="Página não encontrada"
            action={
              <Link to="/" className="text-sm text-primary hover:underline">
                Voltar para contas
              </Link>
            }
          />
        ),
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SWRConfig value={{ revalidateOnFocus: false, shouldRetryOnError: false }}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton />
    </SWRConfig>
  </StrictMode>,
)
