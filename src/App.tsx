import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/lib/auth'
import { GoldRateProvider } from '@/hooks/useGoldRate'
import { Toaster } from 'sonner'
import AppRouter from '@/router/AppRouter'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GoldRateProvider>
          <AppRouter />
        </GoldRateProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#141414',
              border: '1px solid rgba(212,175,55,0.15)',
              color: '#fff',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  )
}
