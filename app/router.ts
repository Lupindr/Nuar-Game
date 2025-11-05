import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export const createAppRouter = () =>
  createRouter({
    routeTree,
    context: {},
  })

export type AppRouter = ReturnType<typeof createAppRouter>
