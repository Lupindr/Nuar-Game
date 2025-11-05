import React, { useState } from 'react';

interface GameSetupProps {
  onStartGame: (playerNames: string[]) => void;
}

const GameSetup: React.FC<GameSetupProps> = ({ onStartGame }) => {
  const [playerNames, setPlayerNames] = useState<string[]>(['Игрок 1', 'Игрок 2', 'Игрок 3']);

  const handlePlayerNameChange = (index: number, name: string) => {
    const newPlayerNames = [...playerNames];
    newPlayerNames[index] = name;
    setPlayerNames(newPlayerNames);
  };

  const addPlayer = () => {
    if (playerNames.length < 16) {
      setPlayerNames([...playerNames, `Игрок ${playerNames.length + 1}`]);
    }
  };

  const removePlayer = (index: number) => {
    if (playerNames.length > 3) {
      const newPlayerNames = [...playerNames];
      newPlayerNames.splice(index, 1);
      setPlayerNames(newPlayerNames);
    }
  };

  const startGame = () => {
    const validPlayerNames = playerNames.filter(name => name.trim() !== '');
    if (validPlayerNames.length >= 3) {
      onStartGame(validPlayerNames);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-800 p-8 rounded-lg shadow-2xl border border-zinc-700">
        <h1 className="text-5xl font-title text-center mb-2 text-red-500">НУАР</h1>
        <h2 className="text-2xl font-title text-center mb-6">ШПИОНСКИЕ ИГРЫ</h2>
        <div className="space-y-3 mb-6 max-h-96 overflow-y-auto pr-2">
          {playerNames.map((name, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={name}
                onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                className="flex-grow bg-zinc-700 border border-zinc-600 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder={`Игрок ${index + 1}`}
              />
              <button
                onClick={() => removePlayer(index)}
                className="bg-red-700 hover:bg-red-600 text-white font-bold p-2 rounded disabled:opacity-50"
                disabled={playerNames.length <= 3}
              >
                X
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-between space-x-4">
           <button
            onClick={addPlayer}
            className="w-full bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-2 px-4 rounded transition duration-200 disabled:opacity-50"
            disabled={playerNames.length >= 16}
          >
            Добавить игрока
          </button>
          <button
            onClick={startGame}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded transition duration-200"
          >
            Начать игру
          </button>
        </div>
        <p className="text-center text-zinc-400 text-sm mt-4">{playerNames.length} / 16 игроков</p>
      </div>
    </div>
  );
};

export default GameSetup;