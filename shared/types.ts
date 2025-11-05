export interface Suspect {
  id: number
  name: string
  imageUrl: string
}

export interface BoardCard {
  suspect: Suspect
  isAlive: boolean
  isRevealed?: boolean
}

export interface Player {
  id: string
  name: string
  secretIdentity: Suspect
  trophies: Suspect[]
  bombs: number
  isEliminated: boolean
  isIdentityVisible: boolean
}

export enum GamePhase {
  Lobby = 'Lobby',
  Setup = 'Setup',
  Playing = 'Playing',
  GameOver = 'GameOver',
}

export type ActionType = 'interrogate' | 'kill' | 'shift' | null

export type Board = BoardCard[][]

export interface Position {
  row: number
  col: number
}

export interface ModalMessage {
  id: string
  title: string
  body: string
  autoClose?: boolean
}

export interface GameState {
  phase: GamePhase
  board: Board
  players: Player[]
  currentPlayerIndex: number
  winnerId: string | null
  activeAction: ActionType
  selectablePositions: Position[]
  isCompacting: boolean
  modal: ModalMessage | null
}

export interface PlayerSummary {
  id: string
  name: string
  isHost: boolean
  isEliminated: boolean
  trophies: number
  bombs: number
  isIdentityVisible: boolean
}

export interface SessionSummary {
  code: string
  players: PlayerSummary[]
  phase: GamePhase
  hostId: string
}

export interface LobbyState {
  session: SessionSummary
  you: PlayerSummary
}

export type GameMessage =
  | { type: 'lobbyState'; payload: LobbyState }
  | { type: 'gameState'; payload: GameState }
  | { type: 'error'; payload: { message: string } }
  | { type: 'sessionClosed' }

export type ServerInboundMessage =
  | { type: 'createSession'; payload: { name: string } }
  | { type: 'joinSession'; payload: { name: string; code: string } }
  | { type: 'startGame' }
  | { type: 'selectAction'; payload: { action: Exclude<ActionType, null> | null } }
  | { type: 'interrogate'; payload: Position }
  | { type: 'kill'; payload: Position }
  | { type: 'shift'; payload: { axis: 'row' | 'col'; index: number; direction: 1 | -1 } }
  | { type: 'toggleIdentity'; payload: { playerId: string } }
  | { type: 'closeModal' }
  | { type: 'advanceTurn' }
