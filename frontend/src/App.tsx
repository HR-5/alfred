import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LandingPage from '@/pages/LandingPage'
import CanvasLayout from '@/components/layout/CanvasLayout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route index element={<LandingPage />} />
          <Route path="app" element={<CanvasLayout />} />
          {/* Redirect old routes */}
          <Route path="chat" element={<Navigate to="/app" replace />} />
          <Route path="tasks" element={<Navigate to="/app" replace />} />
          <Route path="calendar" element={<Navigate to="/app" replace />} />
          <Route path="settings" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
