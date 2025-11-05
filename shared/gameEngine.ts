import { randomUUID } from 'crypto'
import {
  ActionType,
  Board,
  BoardCard,
  GamePhase,
  GameState,
  ModalMessage,
  Player,
  Position,
  Suspect,
} from './types.js'
import {
  LOSE_CONDITION_BOMBS,
  MIN_PLAYERS,
  SUSPECTS,
  WIN_CONDITION_TROPHIES,
} from './constants.js'

const shuffleArray = <T,>(items: T[]): T[] => {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const compactBoard = (board: Board): Board => {
  const rows = board.length
  if (!rows) return board
  const cols = board[0]?.length ?? 0
  if (!cols) return board

  const everyColHasDead = Array.from({ length: cols }).every((_, c) =>
    board.some((row) => !row[c]?.isAlive),
  )

  if (everyColHasDead) {
    const columns = Array.from({ length: cols }, (_, c) => board.map((row) => row[c]))
    const filtered = columns.map((col) => col.filter((card) => card.isAlive))
    const newRows = filtered[0]?.length ?? 0

    if (newRows < rows && filtered.every((col) => col.length === newRows)) {
      if (newRows === 0) return []
      return Array.from({ length: newRows }, (_, r) => filtered.map((col) => col[r]))
    }
  }

  const everyRowHasDead = board.every((row) => row.some((card) => !card.isAlive))
  if (everyRowHasDead) {
    const filteredRows = board.map((row) => row.filter((card) => card.isAlive))
    const newCols = filteredRows[0]?.length ?? 0

    if (newCols < cols && filteredRows.every((row) => row.length === newCols)) {
      if (newCols === 0) return []
      return filteredRows
    }
  }

  return board
}

const cloneBoard = (board: Board): Board => board.map((row) => row.map((card) => ({ ...card })))

const getAdjacentPositions = (board: Board, row: number, col: number, includeSelf = false): Position[] => {
  const positions: Position[] = []
  const rows = board.length
  if (!rows) return positions
  const cols = board[0]?.length ?? 0

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!includeSelf && dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        positions.push({ row: nr, col: nc })
      }
    }
  }
  return positions
}

const findSuspect = (board: Board, suspectId: number): Position | null => {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c].suspect.id === suspectId) return { row: r, col: c }
    }
  }
  return null
}

const createModal = (title: string, body: string): ModalMessage => ({
  id: randomUUID(),
  title,
  body,
})

export interface PlayerSeed {
  id: string
  name: string
}

export const createInitialState = (players: PlayerSeed[]): GameState => {
  if (players.length < MIN_PLAYERS) {
    throw new Error('Недостаточно игроков для начала игры')
  }
  const boardSize = players.length <= 4 ? 5 : players.length <= 6 ? 6 : 7
  const shuffledSuspects = shuffleArray(SUSPECTS)
  const suspectsOnBoard = shuffledSuspects.slice(0, boardSize * boardSize)
  const boardSuspects = shuffleArray(suspectsOnBoard)
  const identities = shuffleArray(suspectsOnBoard).slice(0, players.length)

  const board: Board = []
  for (let i = 0; i < boardSize; i++) {
    board.push(
      boardSuspects.slice(i * boardSize, (i + 1) * boardSize).map((suspect) => ({
        suspect,
        isAlive: true,
        isRevealed: false,
      })),
    )
  }

  const playerState: Player[] = players.map((player, index) => ({
    id: player.id,
    name: player.name,
    secretIdentity: identities[index],
    trophies: [],
    bombs: 0,
    isEliminated: false,
    isIdentityVisible: false,
  }))

  const state: GameState = {
    phase: GamePhase.Playing,
    board,
    players: playerState,
    currentPlayerIndex: 0,
    winnerId: null,
    activeAction: null,
    selectablePositions: [],
    isCompacting: false,
    modal: null,
  }

  return state
}

export class GameEngine {
  public state: GameState

  constructor(players: PlayerSeed[]) {
    this.state = createInitialState(players)
  }

  private get currentPlayer(): Player | undefined {
    return this.state.players[this.state.currentPlayerIndex]
  }

  private ensurePlayerTurn(playerId: string) {
    const current = this.currentPlayer
    if (!current || current.id !== playerId) {
      throw new Error('Сейчас не ваш ход')
    }
  }

  private recomputeSelectable(action: ActionType) {
    const current = this.currentPlayer
    if (!current) {
      this.state.selectablePositions = []
      return
    }

    if (!action) {
      this.state.selectablePositions = []
      return
    }

    const playerPos = findSuspect(this.state.board, current.secretIdentity.id)
    if (!playerPos) {
      this.state.selectablePositions = []
      return
    }

    if (action === 'interrogate') {
      this.state.selectablePositions = getAdjacentPositions(this.state.board, playerPos.row, playerPos.col, true)
    } else if (action === 'kill') {
      const adjacent = getAdjacentPositions(this.state.board, playerPos.row, playerPos.col)
      this.state.selectablePositions = adjacent.filter((pos) => this.state.board[pos.row][pos.col].isAlive)
    } else {
      this.state.selectablePositions = []
    }
  }

  public selectAction(playerId: string, action: ActionType) {
    this.ensurePlayerTurn(playerId)
    this.state.activeAction = this.state.activeAction === action ? null : action
    this.recomputeSelectable(this.state.activeAction)
  }

  private eliminatePlayer(playerId: string, reason: string) {
    const player = this.state.players.find((p) => p.id === playerId)
    if (!player || player.isEliminated) return
    player.isEliminated = true

    const position = findSuspect(this.state.board, player.secretIdentity.id)
    if (position) {
      const newBoard = cloneBoard(this.state.board)
      const card = newBoard[position.row][position.col]
      card.isAlive = false
      card.isRevealed = true
      this.state.board = compactBoard(newBoard)
    }

    const activePlayers = this.state.players.filter((p) => !p.isEliminated)
    if (activePlayers.length <= 1) {
      this.state.winnerId = activePlayers[0]?.id ?? null
      this.state.phase = GamePhase.GameOver
    }

    this.state.modal = createModal('Игрок выбыл', `${player.name} покидает игру: ${reason}.`)
  }

  public dropPlayer(playerId: string, reason: string) {
    this.eliminatePlayer(playerId, reason)
  }

  private advanceTurnInternal() {
    const startingIndex = this.state.currentPlayerIndex
    let nextIndex = (startingIndex + 1) % this.state.players.length
    while (this.state.players[nextIndex]?.isEliminated) {
      nextIndex = (nextIndex + 1) % this.state.players.length
      if (nextIndex === startingIndex) {
        const activePlayers = this.state.players.filter((p) => !p.isEliminated)
        this.state.winnerId = activePlayers[0]?.id ?? null
        this.state.phase = GamePhase.GameOver
        return
      }
    }
    this.state.currentPlayerIndex = nextIndex
    this.state.activeAction = null
    this.state.selectablePositions = []
  }

  public advanceTurn(playerId: string) {
    this.ensurePlayerTurn(playerId)
    this.state.modal = null
    this.advanceTurnInternal()
  }

  private transferIdentity(victim: Player) {
    const livingCards = this.state.board
      .flat()
      .filter((card) => card.isAlive && !this.state.players.some((p) => !p.isEliminated && p.secretIdentity.id === card.suspect.id))

    if (!livingCards.length) {
      return null
    }

    const newIdentity = shuffleArray(livingCards)[0].suspect
    victim.secretIdentity = newIdentity
    victim.isIdentityVisible = false
    return newIdentity
  }

  public kill(playerId: string, target: Position) {
    this.ensurePlayerTurn(playerId)
    if (this.state.activeAction !== 'kill') {
      throw new Error('Действие "Убить" не активно')
    }
    if (!this.state.selectablePositions.some((pos) => pos.row === target.row && pos.col === target.col)) {
      throw new Error('Эта карта недоступна для атаки')
    }

    const current = this.currentPlayer
    if (!current) return

    const board = cloneBoard(this.state.board)
    const card = board[target.row][target.col]
    const targetPlayer = this.state.players.find(
      (player) => !player.isEliminated && player.secretIdentity.id === card.suspect.id,
    )

    this.state.activeAction = null
    this.state.selectablePositions = []

    if (targetPlayer) {
      const trophies = [...current.trophies, targetPlayer.secretIdentity]
      current.trophies = trophies
      const oldPosition = findSuspect(this.state.board, targetPlayer.secretIdentity.id)
      if (oldPosition) {
        const killBoard = cloneBoard(board)
        const killCard = killBoard[oldPosition.row][oldPosition.col]
        killCard.isAlive = false
        killCard.isRevealed = true
        this.state.board = compactBoard(killBoard)
      } else {
        this.state.board = compactBoard(board)
      }

      if (trophies.length >= WIN_CONDITION_TROPHIES) {
        this.state.winnerId = current.id
        this.state.phase = GamePhase.GameOver
        this.state.modal = createModal('Победа!', `${current.name} собрал достаточное число трофеев.`)
        return
      }

      const newIdentity = this.transferIdentity(targetPlayer)
      if (newIdentity) {
        this.state.modal = createModal(
          'Личность раскрыта',
          `${targetPlayer.name} был раскрыт игроком ${current.name} и получил новую личность.`,
        )
        this.advanceTurnInternal()
      } else {
        this.eliminatePlayer(targetPlayer.id, 'на поле не осталось свободных личностей')
        this.advanceTurnInternal()
      }
    } else {
      card.isAlive = false
      card.isRevealed = true
      this.state.board = compactBoard(board)

      current.bombs += 1
      if (current.bombs >= LOSE_CONDITION_BOMBS) {
        this.state.modal = createModal(
          'Фатальная ошибка',
          `${current.name} убил мирного и накопил ${LOSE_CONDITION_BOMBS} бомб.`,
        )
        this.eliminatePlayer(current.id, 'накопил слишком много бомб')
      } else {
        this.state.modal = createModal(
          'Ошибка',
          `${current.name} убил мирного жителя и получил бомбу (${current.bombs}/${LOSE_CONDITION_BOMBS}).`,
        )
        this.advanceTurnInternal()
      }
    }
  }

  public interrogate(playerId: string, target: Position) {
    this.ensurePlayerTurn(playerId)
    if (this.state.activeAction !== 'interrogate') {
      throw new Error('Действие "Опрос" не активно')
    }
    if (!this.state.selectablePositions.some((pos) => pos.row === target.row && pos.col === target.col)) {
      throw new Error('Эта карта недоступна для опроса')
    }

    const card = this.state.board[target.row][target.col]
    const positions = getAdjacentPositions(this.state.board, target.row, target.col)
    const responders = new Set<string>()
    const adjacentPlayers = this.state.players.filter(
      (player) =>
        !player.isEliminated &&
        positions.some((pos) => this.state.board[pos.row][pos.col].suspect.id === player.secretIdentity.id),
    )
    adjacentPlayers.forEach((p) => responders.add(p.name))
    const targetPlayer = this.state.players.find(
      (player) => !player.isEliminated && player.secretIdentity.id === card.suspect.id,
    )
    if (targetPlayer) responders.add(targetPlayer.name)

    const names = Array.from(responders)
    const content =
      names.length > 0
        ? `На вопрос о ${card.suspect.name} откликнулись: ${shuffleArray(names).join(', ')}.`
        : `Никто не откликнулся на вопрос о ${card.suspect.name}.`

    this.state.modal = createModal('Результаты опроса', content)
    this.state.activeAction = null
    this.state.selectablePositions = []
    this.advanceTurnInternal()
  }

  public shift(playerId: string, axis: 'row' | 'col', index: number, direction: 1 | -1) {
    this.ensurePlayerTurn(playerId)
    if (this.state.activeAction || this.state.isCompacting) {
      throw new Error('Сейчас нельзя сдвинуть ряд или колонку')
    }
    const board = cloneBoard(this.state.board)
    if (axis === 'row') {
      const row = board[index]
      if (!row) throw new Error('Неверный индекс ряда')
      const moved = direction === 1 ? row.pop() : row.shift()
      if (moved) {
        if (direction === 1) row.unshift(moved)
        else row.push(moved)
      }
    } else {
      if (!board[0] || index >= board[0].length) throw new Error('Неверный индекс колонки')
      const column = board.map((row) => row[index])
      const moved = direction === 1 ? column.pop() : column.shift()
      if (moved) {
        if (direction === 1) column.unshift(moved)
        else column.push(moved)
        column.forEach((card, i) => {
          board[i][index] = card
        })
      }
    }
    this.state.board = board
    this.advanceTurnInternal()
  }

  public toggleIdentity(playerId: string, targetId: string) {
    const player = this.state.players.find((p) => p.id === targetId)
    if (!player) return
    if (player.id !== playerId && this.state.players[this.state.currentPlayerIndex]?.id !== playerId) return
    player.isIdentityVisible = !player.isIdentityVisible
  }

  public closeModal() {
    this.state.modal = null
  }
}
