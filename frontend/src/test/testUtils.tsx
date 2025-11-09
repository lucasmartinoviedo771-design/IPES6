import { ReactElement, PropsWithChildren } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SnackbarProvider } from 'notistack'
import { ThemeProvider, createTheme } from '@mui/material/styles'

type ProviderOptions = {
  router?: MemoryRouterProps
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & ProviderOptions,
) {
  const { router, ...renderOptions } = options ?? {}
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  const Wrapper = ({ children }: PropsWithChildren<object>) => (
    <MemoryRouter {...router}>
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider maxSnack={1}>
          <ThemeProvider theme={createTheme()}>
            {children}
          </ThemeProvider>
        </SnackbarProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )

  return render(ui, { wrapper: Wrapper, ...renderOptions })
}
