import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ActionType,
  GameMessage,
  GamePhase,
  GameState,
  LobbyState,
  Position,
  ServerInboundMessage,
} from '../types.js'

interface ConnectionState {
  status: 'idle' | 'connecting' | 'connected' | 'disconnected'
  lobby?: LobbyState
  game?: GameState
  error?: string
}

const resolveWsUrl = (): string => {
  if (typeof window === 'undefined') {
    return ''
  }
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const port = import.meta.env.VITE_GAME_SERVER_PORT ?? '3001'
  const host = window.location.hostname
  return `${protocol}://${host}:${port}`
}

export const useGameSession = () => {
  const [connection, setConnection] = useState<ConnectionState>({ status: 'idle' })
  const wsRef = useRef<WebSocket | null>(null)
  const playerIdRef = useRef<string>('')
  const sessionCodeRef = useRef<string>('')
  const defaultUrl = useMemo(() => resolveWsUrl(), [])

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => closeSocket, [closeSocket])

  useEffect(() => {
    if (!connection.error) return
    const timer = setTimeout(() => {
      setConnection((prev) => ({ ...prev, error: undefined }))
    }, 4000)
    return () => clearTimeout(timer)
  }, [connection.error])

  const send = useCallback((payload: ServerInboundMessage) => {
    const socket = wsRef.current
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload))
    }
  }, [])

  const handleMessage = useCallback((event: MessageEvent) => {
    let message: GameMessage
    try {
      message = JSON.parse(event.data)
    } catch (error) {
      console.error('Не удалось обработать сообщение сервера', error)
      return
    }

    switch (message.type) {
      case 'lobbyState': {
        playerIdRef.current = message.payload.you.id
        sessionCodeRef.current = message.payload.session.code
        setConnection({ status: 'connected', lobby: message.payload })
        break
      }
      case 'gameState': {
        setConnection((prev) => ({
          status: 'connected',
          lobby: prev.lobby,
          game: message.payload,
        }))
        break
      }
      case 'error': {
        setConnection((prev) => ({ ...prev, error: message.payload.message }))
        break
      }
      case 'sessionClosed': {
        closeSocket()
        setConnection({ status: 'disconnected' })
        break
      }
      default:
        break
    }
  }, [closeSocket])

  const connect = useCallback(
    (payload: ServerInboundMessage) => {
      closeSocket()
      const socket = new WebSocket(defaultUrl)
      wsRef.current = socket
      setConnection({ status: 'connecting' })

      socket.onopen = () => {
        socket.send(JSON.stringify(payload))
      }
      socket.onmessage = handleMessage
      socket.onerror = () => {
        setConnection({ status: 'disconnected', error: 'Ошибка соединения с сервером' })
      }
      socket.onclose = () => {
        setConnection((prev) => ({ status: 'disconnected', lobby: prev.lobby, game: prev.game }))
      }
    },
    [closeSocket, defaultUrl, handleMessage],
  )

  const createSession = useCallback(
    (name: string) => {
      connect({ type: 'createSession', payload: { name } })
    },
    [connect],
  )

  const joinSession = useCallback(
    (name: string, code: string) => {
      connect({ type: 'joinSession', payload: { name, code } })
    },
    [connect],
  )

  const startGame = useCallback(() => {
    send({ type: 'startGame' })
  }, [send])

  const selectAction = useCallback(
    (action: ActionType) => {
      send({ type: 'selectAction', payload: { action } })
    },
    [send],
  )

  const interrogate = useCallback(
    (position: Position) => {
      send({ type: 'interrogate', payload: position })
    },
    [send],
  )

  const kill = useCallback(
    (position: Position) => {
      send({ type: 'kill', payload: position })
    },
    [send],
  )

  const shift = useCallback(
    (axis: 'row' | 'col', index: number, direction: 1 | -1) => {
      send({ type: 'shift', payload: { axis, index, direction } })
    },
    [send],
  )

  const toggleIdentity = useCallback(
    (playerId: string) => {
      send({ type: 'toggleIdentity', payload: { playerId } })
    },
    [send],
  )

  const closeModal = useCallback(() => {
    send({ type: 'closeModal' })
  }, [send])

  const advanceTurn = useCallback(() => {
    send({ type: 'advanceTurn' })
  }, [send])

  return {
    connection,
    createSession,
    joinSession,
    startGame,
    selectAction,
    interrogate,
    kill,
    shift,
    toggleIdentity,
    closeModal,
    advanceTurn,
    playerId: playerIdRef.current,
    sessionCode: sessionCodeRef.current,
  }
}
