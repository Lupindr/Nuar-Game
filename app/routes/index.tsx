import { createFileRoute } from '@tanstack/react-router'
import GameApp from '../GameApp'

export const Route = createFileRoute('/')({
  component: GameRoute,
})

function GameRoute() {
  return <GameApp />
}
