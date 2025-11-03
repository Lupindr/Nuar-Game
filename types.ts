import { SUSPECTS } from './constants';

export interface Suspect {
  id: number;
  name: string;
}

export interface BoardCard {
  suspect: Suspect;
  isAlive: boolean;
  isRevealed?: boolean;
}

export interface Player {
  id: number;
  name: string;
  secretIdentity: Suspect;
  trophies: Suspect[];
  bombs: number;
  isEliminated: boolean;
  isIdentityVisible: boolean;
}

export enum GamePhase {
  Setup,
  Playing,
  GameOver
}

export type ActionType = 'interrogate' | 'kill' | 'shift' | null;

export type Board = BoardCard[][];