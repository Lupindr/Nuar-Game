'use client'

import React, { useMemo, useState } from 'react'
import GameBoard from './components/GameBoard'
import PlayerDashboard from './components/PlayerDashboard'
import ActionHistory from './components/ActionHistory'
import Modal from './components/Modal'
import { useGameSession } from './hooks/useGameSession'
import { ActionType } from './types.js'
import { MAX_PLAYERS, MIN_PLAYERS } from './constants'

const ActionButton: React.FC<{
  label: string
  action: ActionType
  active: boolean
  disabled: boolean
  onClick: (action: ActionType) => void
}> = ({ label, action, active, disabled, onClick }) => (
  <button
    onClick={() => onClick(action)}
    disabled={disabled}
    className={`px-6 py-3 rounded font-title text-lg transition-colors ${
      active
        ? 'bg-yellow-500 text-black'
        : disabled
          ? 'bg-zinc-700/50 text-zinc-400 cursor-not-allowed'
          : 'bg-zinc-700 hover:bg-zinc-600'
    }`}
  >
    {label}
  </button>
)

const GameApp: React.FC = () => {
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const {
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
    playerId,
    sessionCode,
  } = useGameSession()

  const { status, lobby, game, error } = connection
  const isConnecting = status === 'connecting'

  const isHost = lobby?.you.isHost ?? false
  const currentPlayer = game ? game.players[game.currentPlayerIndex] ?? null : null
  const isCurrentPlayer = currentPlayer?.id === playerId

  const canStartGame = useMemo(() => {
    if (!lobby || !isHost) return false
    const playerCount = lobby.session.players.length
    return playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS
  }, [isHost, lobby])

  const handleCreateGame = () => {
    if (!name.trim()) return
    createSession(name.trim())
  }

  const handleJoinGame = () => {
    if (!name.trim() || !joinCode.trim()) return
    joinSession(name.trim(), joinCode.trim())
  }

  const handleActionClick = (action: ActionType) => {
    if (!game || !isCurrentPlayer) return
    const nextAction = game.activeAction === action ? null : action
    selectAction(nextAction)
  }

  const handleCardClick = (row: number, col: number) => {
    if (!game || !isCurrentPlayer || !game.activeAction) return
    const position = { row, col }
    if (game.activeAction === 'kill') {
      kill(position)
    } else if (game.activeAction === 'interrogate') {
      interrogate(position)
    }
  }

  const handleShift = (axis: 'row' | 'col', index: number, direction: 1 | -1) => {
    if (!game || !isCurrentPlayer) return
    shift(axis, index, direction)
  }

  const handleToggleIdentity = (targetId: string) => {
    if (!game) return
    if (targetId !== playerId) return
    toggleIdentity(targetId)
  }

  const renderLanding = () => (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-800 p-8 rounded-lg shadow-2xl border border-zinc-700 space-y-4">
        <h1 className="text-5xl font-title text-center text-red-500">НУАР</h1>
        <p className="text-center text-zinc-300">Создайте новую игру или войдите по коду</p>
        <div className="space-y-3">
          <label className="block text-sm text-zinc-300">
            Ваше имя
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Введите имя"
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Код сессии
            <input
              type="text"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              className="mt-1 w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Например, AB123"
              maxLength={5}
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-col space-y-3">
          <button
            onClick={handleJoinGame}
            disabled={isConnecting || !name.trim() || joinCode.trim().length !== 5}
            className="w-full bg-zinc-600 hover:bg-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition"
          >
            Войти по коду
          </button>
          <div className="text-center text-xs text-zinc-400">или</div>
          <button
            onClick={handleCreateGame}
            disabled={isConnecting || !name.trim()}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded transition"
          >
            Создать игру
          </button>
        </div>
        {isConnecting && <p className="text-center text-sm text-zinc-400">Соединение...</p>}
      </div>
    </div>
  )

  const renderLobby = () => {
    if (!lobby) return null
    return (
      <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-zinc-800 p-8 rounded-lg shadow-2xl border border-zinc-700 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-title text-red-500">Лобби</h2>
            <div className="text-sm text-zinc-300">
              Код сессии: <span className="font-mono text-xl text-yellow-400">{lobby.session.code}</span>
            </div>
          </div>
          <p className="text-sm text-zinc-400">
            Минимум {MIN_PLAYERS} игроков, максимум {MAX_PLAYERS}. Сейчас: {lobby.session.players.length}
          </p>
          <ul className="space-y-2">
            {lobby.session.players.map((player) => (
              <li
                key={player.id}
                className={`flex items-center justify-between bg-zinc-700/50 rounded px-4 py-2 border ${
                  player.isHost ? 'border-yellow-500' : 'border-transparent'
                }`}
              >
                <span className="font-medium">
                  {player.name}
                  {player.isHost && <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Хост</span>}
                  {player.id === playerId && <span className="ml-2 text-xs text-zinc-300">(Вы)</span>}
                </span>
              </li>
            ))}
          </ul>
          {isHost ? (
            <button
              onClick={startGame}
              disabled={!canStartGame}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded"
            >
              Начать игру
            </button>
          ) : (
            <p className="text-center text-zinc-300">Ожидаем начала игры...</p>
          )}
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        </div>
      </div>
    )
  }

  const renderGame = () => {
    if (!game) return null
    const modal = game.modal

    return (
      <div className="flex flex-col h-screen bg-zinc-900 text-white">
        <header className="p-4 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-title text-red-500">Нуар: Шпионские Игры</h1>
            <p className="text-zinc-300">
              Ход: <span className="font-bold text-yellow-300">{currentPlayer?.name ?? '—'}</span>
            </p>
          </div>
          <div className="text-right text-sm text-zinc-400">
            Код: <span className="font-mono text-lg text-yellow-400">{sessionCode}</span>
          </div>
        </header>
        <div className="flex-grow flex flex-col lg:flex-row">
          <div className="flex flex-1 flex-col">
            {error && (
              <div className="bg-red-900/60 text-red-200 text-center py-2 text-sm border-b border-red-700">
                {error}
              </div>
            )}
            <GameBoard
              board={game.board}
              onCardClick={handleCardClick}
              onShift={handleShift}
              selectablePositions={game.selectablePositions}
              currentPlayer={currentPlayer ?? null}
              players={game.players}
              isCompacting={game.isCompacting}
              isCurrentPlayerView={isCurrentPlayer}
            />
            <div className="w-full bg-zinc-800 p-4 border-t-2 border-zinc-700 flex justify-center items-center space-x-4">
              <ActionButton
                label="Опрос"
                action="interrogate"
                active={game.activeAction === 'interrogate'}
                disabled={!isCurrentPlayer}
                onClick={handleActionClick}
              />
              <ActionButton
                label="Убить"
                action="kill"
                active={game.activeAction === 'kill'}
                disabled={!isCurrentPlayer}
                onClick={handleActionClick}
              />
            </div>
          </div>
          <ActionHistory entries={game.actionHistory} />
        </div>
        <PlayerDashboard
          players={game.players}
          currentPlayerId={currentPlayer?.id ?? ''}
          viewerPlayerId={playerId}
          onToggleIdentity={handleToggleIdentity}
        />
        <Modal isOpen={Boolean(modal)} title={modal?.title ?? ''} onClose={modal ? closeModal : undefined}>
          <p>{modal?.body}</p>
        </Modal>
      </div>
    )
  }

  if (game) {
    return renderGame()
  }

  if (lobby) {
    return renderLobby()
  }

  return renderLanding()
}

export default GameApp
