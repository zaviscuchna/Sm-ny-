import { Sidebar } from '@/components/layout/Sidebar'
import { ProtectedLayout } from '@/components/layout/ProtectedLayout'
import { SidebarProvider } from '@/contexts/SidebarContext'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedLayout>
      <SidebarProvider>
        <div className="flex min-h-screen bg-slate-50">
          <Sidebar />
          <main className="flex-1 min-w-0 overflow-auto">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </ProtectedLayout>
  )
}
