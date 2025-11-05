import { StartClient } from '@tanstack/start/client'
import { hydrateRoot } from 'react-dom/client'
import { createAppRouter } from './router'

const router = createAppRouter()

StartClient({
  router,
  hydrate: (element) => {
    const rootElement = document.getElementById('app')

    if (!rootElement) {
      throw new Error('Не найден контейнер #app для гидрации приложения TanStack Start')
    }

    hydrateRoot(rootElement, element)
  },
})
