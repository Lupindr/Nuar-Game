import React from 'react';
import { Player } from '../types.js';

interface PlayerDashboardProps {
  players: Player[];
  currentPlayerId: string;
  viewerPlayerId: string;
  onToggleIdentity: (playerId: string) => void;
}

const PlayerDashboard: React.FC<PlayerDashboardProps> = ({ players, currentPlayerId, viewerPlayerId, onToggleIdentity }) => {
  return (
    <div className="w-full bg-zinc-900/50 p-4 border-t-2 border-zinc-700">
      <h2 className="text-2xl font-title text-center mb-4">Игроки</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {players.map(player => (
          <div
            key={player.id}
            className={`p-3 rounded-lg border-2 transition-all ${
              player.id === currentPlayerId && !player.isEliminated ? 'border-red-500 bg-red-500/10' : 'border-zinc-700 bg-zinc-800'
            } ${player.isEliminated ? 'opacity-50' : ''}`}
          >
            <h3 className={`font-bold truncate ${player.id === currentPlayerId ? 'text-red-400' : 'text-white'}`}>
              {player.name} {player.isEliminated ? '(Выбыл)' : ''}
            </h3>
            <div className="text-sm text-zinc-300">
              <p>Трофеи: {player.trophies.length}</p>
              <p>Бомбы: {player.bombs}</p>
            </div>
            {!player.isEliminated && (
              <div className="mt-2">
                {player.id === viewerPlayerId ? (
                  player.isIdentityVisible ? (
                    <div className="p-2 bg-zinc-700 rounded text-center">
                      <p className="font-bold text-yellow-300">{player.secretIdentity.name}</p>
                      <button
                        onClick={() => onToggleIdentity(player.id)}
                        className="text-xs text-zinc-400 hover:text-white mt-1"
                      >
                        Скрыть
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onToggleIdentity(player.id)}
                      className="w-full text-xs bg-zinc-600 hover:bg-zinc-500 py-1 rounded"
                    >
                      Показать личность
                    </button>
                  )
                ) : (
                  <div className="p-2 bg-zinc-800 rounded text-center text-xs text-zinc-400">
                    Личность скрыта
                  </div>
                )}
              </div>
            )}
        </div>
      ))}
      </div>
    </div>
  );
};

export default PlayerDashboard;