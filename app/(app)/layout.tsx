import { Sidebar } from '@/components/layout/Sidebar'
import { ProtectedLayout } from '@/components/layout/ProtectedLayout'
import { SidebarProvider } from '@/contexts/SidebarContext'
import { BranchProvider } from '@/contexts/BranchContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <SidebarProvider>
        <BranchProvider>
          <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-auto">
              {children}
            </main>
          </div>
        </BranchProvider>
      </SidebarProvider>
    </ProtectedLayout>
  )
}
