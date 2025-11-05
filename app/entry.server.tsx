import { StartServer } from '@tanstack/start/server'
import { createAppRouter } from './router'

export default StartServer({
  router: createAppRouter,
})
