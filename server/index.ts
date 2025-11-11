import http from 'http'
import { randomUUID } from 'crypto'
import {
  GamePhase,
  GameMessage,
  LobbyState,
  PlayerSummary,
  ServerInboundMessage,
} from '../shared/types.js'
import { GameEngine, PlayerSeed } from '../shared/gameEngine.js'
import { MAX_PLAYERS, MIN_PLAYERS } from '../shared/constants.js'
import { SimpleWebSocket, SimpleWebSocketServer } from './simpleWebSocket.js'

interface PlayerConnection {
  id: string
  name: string
  ws: SimpleWebSocket
  isHost: boolean
}

interface Session {
  code: string
  hostId: string
  players: Map<string, PlayerConnection>
  joinOrder: string[]
  phase: GamePhase
  game: GameEngine | null
}

const sessions = new Map<string, Session>()

const generateCode = (): string => {
  let code = ''
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  if (sessions.has(code)) return generateCode()
  return code
}

const createLobbySummary = (session: Session, playerId: string): LobbyState => {
  const players: PlayerSummary[] = Array.from(session.players.values()).map((player) => ({
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    isEliminated: false,
    trophies: 0,
    bombs: 0,
    isIdentityVisible: false,
  }))

  return {
    session: {
      code: session.code,
      players,
      phase: session.phase,
      hostId: session.hostId,
    },
    you: players.find((player) => player.id === playerId)!,
  }
}

const broadcast = (session: Session, message: GameMessage) => {
  const serialized = JSON.stringify(message)
  session.players.forEach((player) => {
    if (player.ws.readyState === 1) {
      player.ws.send(serialized)
    }
  })
}

const broadcastLobby = (session: Session) => {
  session.players.forEach((player) => {
    if (player.ws.readyState !== 1) return
    const lobby = createLobbySummary(session, player.id)
    const message: GameMessage = { type: 'lobbyState', payload: lobby }
    player.ws.send(JSON.stringify(message))
  })
}

const broadcastGameState = (session: Session) => {
  if (!session.game) return
  const payload = session.game.state
  const message: GameMessage = { type: 'gameState', payload }
  broadcast(session, message)

  // If compaction is in progress, finalize after a short delay
  if (payload.isCompacting && session.game.hasPendingCompaction()) {
    setTimeout(() => {
      if (!session.game) return
      session.game.finalizeCompaction()
      const payload2 = session.game.state
      const message2: GameMessage = { type: 'gameState', payload: payload2 }
      broadcast(session, message2)
    }, 800)
  }
}

const removePlayer = (session: Session, playerId: string, reason: string) => {
  const player = session.players.get(playerId)
  if (!player) return
  session.players.delete(playerId)
  session.joinOrder = session.joinOrder.filter((id) => id !== playerId)

  if (session.game) {
    session.game.dropPlayer(playerId, reason)
    broadcastGameState(session)
  }

  if (!session.players.size) {
    sessions.delete(session.code)
    return
  }

  if (session.hostId === playerId) {
    const nextHost = session.joinOrder[0]
    if (nextHost) {
      session.hostId = nextHost
      const hostConnection = session.players.get(nextHost)
      if (hostConnection) hostConnection.isHost = true
    }
  }

  if (session.phase === GamePhase.Lobby) {
    broadcastLobby(session)
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new SimpleWebSocketServer(server)

wss.on('connection', (ws: SimpleWebSocket) => {
  const playerId = randomUUID()
  let currentSession: Session | null = null
  let connection: PlayerConnection | null = null

  const sendError = (message: string) => {
    if (ws.readyState === 1) {
      const payload: GameMessage = { type: 'error', payload: { message } }
      ws.send(JSON.stringify(payload))
    }
  }

  ws.on('message', (data: string) => {
    let message: ServerInboundMessage
    try {
      message = JSON.parse(data)
    } catch (error) {
      sendError('Не удалось разобрать сообщение от клиента')
      return
    }

    if (message.type === 'createSession') {
      if (currentSession) {
        sendError('Вы уже присоединились к сессии')
        return
      }
      const name = message.payload.name.trim()
      if (!name) {
        sendError('Имя не может быть пустым')
        return
      }
      const code = generateCode()
      const session: Session = {
        code,
        hostId: playerId,
        players: new Map(),
        joinOrder: [playerId],
        phase: GamePhase.Lobby,
        game: null,
      }
      currentSession = session
      connection = { id: playerId, name, ws, isHost: true }
      session.players.set(playerId, connection)
      sessions.set(code, session)
      broadcastLobby(session)
      return
    }

    if (message.type === 'joinSession') {
      if (currentSession) {
        sendError('Вы уже находитесь в сессии')
        return
      }
      const code = message.payload.code.trim().toUpperCase()
      const name = message.payload.name.trim()
      if (!name) {
        sendError('Имя не может быть пустым')
        return
      }
      const session = sessions.get(code)
      if (!session) {
        sendError('Сессия не найдена')
        return
      }
      if (session.players.size >= MAX_PLAYERS) {
        sendError('В сессии достигнуто максимальное количество игроков')
        return
      }
      currentSession = session
      connection = { id: playerId, name, ws, isHost: false }
      session.players.set(playerId, connection)
      session.joinOrder.push(playerId)
      broadcastLobby(session)
      return
    }

    if (!currentSession || !connection) {
      sendError('Сперва создайте или войдите в сессию')
      return
    }

    const session = currentSession
    switch (message.type) {
      case 'startGame': {
        if (session.hostId !== connection.id) {
          sendError('Только создатель игры может начать партию')
          return
        }
        if (session.players.size < MIN_PLAYERS) {
          sendError(`Для начала игры нужно минимум ${MIN_PLAYERS} игрока`)
          return
        }
        const seeds: PlayerSeed[] = session.joinOrder
          .map((id) => {
            const player = session.players.get(id)
            if (!player) return null
            return { id: player.id, name: player.name }
          })
          .filter((value): value is PlayerSeed => Boolean(value))
        session.game = new GameEngine(seeds)
        session.phase = GamePhase.Playing
        broadcastGameState(session)
        return
      }
      case 'selectAction': {
        if (!session.game) {
          sendError('Игра еще не началась')
          return
        }
        try {
          session.game.selectAction(connection.id, message.payload.action)
          broadcastGameState(session)
        } catch (error) {
          sendError((error as Error).message)
        }
        return
      }
      case 'interrogate': {
        if (!session.game) {
          sendError('Игра еще не началась')
          return
        }
        try {
          session.game.interrogate(connection.id, message.payload)
          broadcastGameState(session)
        } catch (error) {
          sendError((error as Error).message)
        }
        return
      }
      case 'kill': {
        if (!session.game) {
          sendError('Игра еще не началась')
          return
        }
        try {
          session.game.kill(connection.id, message.payload)
          broadcastGameState(session)
        } catch (error) {
          sendError((error as Error).message)
        }
        return
      }
      case 'shift': {
        if (!session.game) {
          sendError('Игра еще не началась')
          return
        }
        try {
          session.game.shift(connection.id, message.payload.axis, message.payload.index, message.payload.direction)
          broadcastGameState(session)
        } catch (error) {
          sendError((error as Error).message)
        }
        return
      }
      case 'toggleIdentity': {
        if (!session.game) {
          sendError('Игра еще не началась')
          return
        }
        session.game.toggleIdentity(connection.id, message.payload.playerId)
        broadcastGameState(session)
        return
      }
      case 'closeModal': {
        if (!session.game) return
        session.game.closeModal()
        broadcastGameState(session)
        return
      }
      case 'advanceTurn': {
        if (!session.game) return
        try {
          session.game.advanceTurn(connection.id)
          broadcastGameState(session)
        } catch (error) {
          sendError((error as Error).message)
        }
        return
      }
      default:
        return
    }
  })

  ws.on('close', () => {
    if (currentSession && connection) {
      removePlayer(currentSession, connection.id, 'игрок отключился')
    }
  })
})

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT ?? 3001)
server.listen(port, host, () => {
  console.log(`Game server listening on :${port}`)
})
