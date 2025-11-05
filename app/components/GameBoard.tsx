import React from 'react';
import { Board, Player } from '../types.js';
import SuspectCard from './SuspectCard';

interface GameBoardProps {
  board: Board;
  onCardClick: (row: number, col: number) => void;
  onShift: (axis: 'row' | 'col', index: number, direction: 1 | -1) => void;
  selectablePositions: { row: number; col: number }[];
  currentPlayer: Player | null;
  players: Player[];
  isCompacting: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ board, onCardClick, onShift, selectablePositions, currentPlayer, players, isCompacting }) => {
  if (!board.length || !board[0]?.length) return null;
  
  const numRows = board.length;
  const numCols = board[0].length;

  const getPlayerPosition = (player: Player | null) => {
    if (!player) return null;
    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        if (board[r][c].suspect.id === player.secretIdentity.id) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  };
  
  const playerPosition = getPlayerPosition(currentPlayer);
  
  return (
    <div className="flex-grow flex items-center justify-center p-4">
      <div className="grid items-center gap-x-4 gap-y-2 transition-all duration-500" style={{
          gridTemplateColumns: `auto repeat(${numCols}, minmax(0, 1fr)) auto`,
          gridTemplateRows: `auto repeat(${numRows}, minmax(0, 1fr)) auto`,
      }}>
        
        {/* Top Column Shift Buttons */}
        {Array.from({ length: numCols }).map((_, colIndex) => (
            <div key={`top-${colIndex}`} className="flex justify-center" style={{gridRow: 1, gridColumn: colIndex + 2}}>
                <button onClick={() => onShift('col', colIndex, -1)} className="w-8 h-8 bg-zinc-700 rounded-full hover:bg-red-600 transition-colors">↑</button>
            </div>
        ))}

        {/* Left Row Shift Buttons */}
        {Array.from({ length: numRows }).map((_, rowIndex) => (
            <div key={`left-${rowIndex}`} className="flex items-center justify-center" style={{gridRow: rowIndex + 2, gridColumn: 1}}>
                <button onClick={() => onShift('row', rowIndex, -1)} className="w-8 h-8 bg-zinc-700 rounded-full hover:bg-red-600 transition-colors">←</button>
            </div>
        ))}

        {/* Game Board Grid */}
        {board.map((row, rowIndex) =>
          row.map((card, colIndex) => {
            const isEliminatedPlayer = players.some(p => p.isEliminated && p.secretIdentity.id === card.suspect.id);
            const isDisappearing = isCompacting && !card.isAlive;
            return (
                <div key={`${card.suspect.id}-${rowIndex}-${colIndex}`} style={{gridRow: rowIndex + 2, gridColumn: colIndex + 2}}>
                    <SuspectCard
                        card={card}
                        onClick={() => onCardClick(rowIndex, colIndex)}
                        isSelectable={selectablePositions.some(p => p.row === rowIndex && p.col === colIndex)}
                        isPlayerIdentity={playerPosition?.row === rowIndex && playerPosition?.col === colIndex}
                        isEliminatedPlayer={isEliminatedPlayer}
                        isRevealed={card.isRevealed}
                        isDisappearing={isDisappearing}
                    />
                </div>
            )
          })
        )}

        {/* Right Row Shift Buttons */}
        {Array.from({ length: numRows }).map((_, rowIndex) => (
             <div key={`right-${rowIndex}`} className="flex items-center justify-center" style={{gridRow: rowIndex + 2, gridColumn: numCols + 2}}>
                <button onClick={() => onShift('row', rowIndex, 1)} className="w-8 h-8 bg-zinc-700 rounded-full hover:bg-red-600 transition-colors">→</button>
            </div>
        ))}

        {/* Bottom Column Shift Buttons */}
        {Array.from({ length: numCols }).map((_, colIndex) => (
            <div key={`bottom-${colIndex}`} className="flex justify-center" style={{gridRow: numRows + 2, gridColumn: colIndex + 2}}>
                <button onClick={() => onShift('col', colIndex, 1)} className="w-8 h-8 bg-zinc-700 rounded-full hover:bg-red-600 transition-colors">↓</button>
            </div>
        ))}
      </div>
    </div>
  );
};

export default GameBoard;