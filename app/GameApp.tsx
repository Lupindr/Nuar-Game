'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameSetup from './components/GameSetup';
import GameBoard from './components/GameBoard';
import PlayerDashboard from './components/PlayerDashboard';
import Modal from './components/Modal';
import { GamePhase, Player, Suspect, ActionType, Board, BoardCard } from './types';
import { SUSPECTS, WIN_CONDITION_TROPHIES, LOSE_CONDITION_BOMBS } from './constants';

// FIX: Replaced the unstable sort-based shuffle with the Fisher-Yates algorithm
// to prevent TypeScript from incorrectly inferring array elements as 'unknown'
// due to the non-standard comparator function. This resolves the property access error.
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * Реализует механику «гравитационного сжатия» игрового поля.
 * Эта функция проверяет два условия:
 * 1. Сжатие по столбцам: Если в КАЖДОМ столбце на поле есть хотя бы одна «убитая» карта (isAlive: false).
 * 2. Сжатие по рядам: Если в КАЖДОМ ряду на поле есть хотя бы одна «убитая» карта.
 *
 * При выполнении условия для столбцов, все «убитые» карты удаляются из каждого столбца,
 * а оставшиеся карты «падают» вверх, заполняя пустоты и сокращая количество рядов.
 *
 * При выполнении условия для рядов, аналогичный процесс происходит по горизонтали,
 * сокращая количество столбцов.
 *
 * Сжатие происходит только в том случае, если итоговое поле остаётся прямоугольным и
 * становится меньше исходного. Проверка столбцов имеет приоритет над проверкой рядов.
 */
const compactBoard = (boardToCompact: Board): Board => {
    const board = boardToCompact; // No need to clone here, caller provides a new board
    
    const numRows = board.length;
    if (numRows === 0) return boardToCompact;
    const numCols = board[0]?.length || 0;
    if (numCols === 0) return boardToCompact;

    // --- Column Gravity ("Сжатие") Check ---
    const everyColHasDead = numCols > 0 && Array.from({ length: numCols }).every((_, c) => 
        board.some(row => !row[c]?.isAlive)
    );

    if (everyColHasDead) {
        const columns = Array.from({ length: numCols }, (_, c) => board.map(row => row[c]));
        const filteredColumns = columns.map(col => col.filter(card => card.isAlive));
        
        const newNumRows = filteredColumns[0]?.length ?? 0;

        if (newNumRows < numRows && filteredColumns.every(col => col.length === newNumRows)) {
            if (newNumRows === 0) return [];
            return Array.from({ length: newNumRows }, (_, r) => 
                filteredColumns.map(col => col[r])
            );
        }
    }

    // --- Row Gravity ("Сжатие") Check ---
    const everyRowHasDead = numRows > 0 && board.every(row => 
        row.some(card => !card.isAlive)
    );

    if (everyRowHasDead) {
        const filteredRows = board.map(row => row.filter(card => card.isAlive));
        const newNumCols = filteredRows[0]?.length ?? 0;

        if (newNumCols < numCols && filteredRows.every(row => row.length === newNumCols)) {
            if (newNumCols === 0) return [];
            return filteredRows;
        }
    }

    return boardToCompact;
};


const GameApp: React.FC = () => {
    const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.Setup);
    const [players, setPlayers] = useState<Player[]>([]);
    const [board, setBoard] = useState<Board>([]);
    const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
    const [winner, setWinner] = useState<Player | null>(null);
    const [activeAction, setActiveAction] = useState<ActionType>(null);
    const [selectablePositions, setSelectablePositions] = useState<{row: number, col: number}[]>([]);
    const [modal, setModal] = useState<{isOpen: boolean, title: string, content: React.ReactNode, onClose?: () => void}>({isOpen: false, title: '', content: null});
    const [isCompacting, setIsCompacting] = useState(false);
    
    const boardRef = useRef(board);
    boardRef.current = board;

    useEffect(() => {
        if (isCompacting) {
            const timer = setTimeout(() => {
                const compacted = compactBoard(boardRef.current);
                setBoard(compacted);
                setIsCompacting(false);
            }, 600); // Duration should be slightly longer than CSS transition
            return () => clearTimeout(timer);
        }
    }, [isCompacting]);

    const performCompactionCheck = (boardAfterAction: Board) => {
        const testBoard = compactBoard(boardAfterAction);
        const shouldCompact = testBoard.length < boardAfterAction.length || (testBoard[0]?.length ?? 0) < (boardAfterAction[0]?.length ?? 0);

        setBoard(boardAfterAction);

        if (shouldCompact) {
            setIsCompacting(true);
        }
    };


    const findSuspectOnBoard = useCallback((suspectId: number) => {
        for (let r = 0; r < board.length; r++) {
            for (let c = 0; c < board[r].length; c++) {
                if (board[r][c].suspect.id === suspectId) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }, [board]);
    
    const currentPlayer = players[currentPlayerIndex];

    const getAdjacentPositions = useCallback((row: number, col: number, includeSelf = false) => {
        const positions: {row: number, col: number}[] = [];
        const numRows = board.length;
        if (numRows === 0) return [];
        const numCols = board[0].length;

        for (let r = -1; r <= 1; r++) {
            for (let c = -1; c <= 1; c++) {
                if (!includeSelf && r === 0 && c === 0) continue;
                
                const newRow = row + r;
                const newCol = col + c;

                if (newRow >= 0 && newRow < numRows && newCol >= 0 && newCol < numCols) {
                    positions.push({ row: newRow, col: newCol });
                }
            }
        }
        
        return positions;
    }, [board]);

    useEffect(() => {
        if (activeAction === 'interrogate' || activeAction === 'kill') {
            const playerPos = findSuspectOnBoard(currentPlayer.secretIdentity.id);
            if (playerPos) {
                 if(activeAction === 'interrogate') {
                    // Можно допросить себя или любого смежного подозреваемого (живого или нет)
                    const adjacentAndSelf = getAdjacentPositions(playerPos.row, playerPos.col, true);
                    setSelectablePositions(adjacentAndSelf);
                 } else { // 'kill'
                    // Можно убить только смежных ЖИВЫХ подозреваемых
                    const allAdjacent = getAdjacentPositions(playerPos.row, playerPos.col, false);
                    const livingAdjacent = allAdjacent.filter(p => board[p.row][p.col].isAlive);
                    setSelectablePositions(livingAdjacent);
                 }
            }
        } else {
            setSelectablePositions([]);
        }
    }, [activeAction, currentPlayer, findSuspectOnBoard, getAdjacentPositions, board]);

    const handleStartGame = (playerNames: string[]) => {
        const numPlayers = playerNames.length;
        let boardSize: number;
        if (numPlayers <= 4) boardSize = 5;
        else if (numPlayers <= 6) boardSize = 6;
        else boardSize = 7; // Для 7-16 игроков
        
        const allSuspects = shuffleArray(SUSPECTS);
        
        const numOnBoard = boardSize * boardSize;
        const suspectsForBoard = allSuspects.slice(0, numOnBoard);
        
        const identitiesForPlayers = shuffleArray(suspectsForBoard).slice(0, numPlayers);

        const newPlayers = playerNames.map((name, index) => ({
            id: index,
            name,
            secretIdentity: identitiesForPlayers[index],
            trophies: [],
            bombs: 0,
            isEliminated: false,
            isIdentityVisible: false,
        }));

        const finalBoardSuspects = shuffleArray(suspectsForBoard);
        const newBoard: Board = [];
        for (let i = 0; i < boardSize; i++) {
            newBoard.push(finalBoardSuspects.slice(i * boardSize, (i + 1) * boardSize).map(s => ({suspect: s, isAlive: true, isRevealed: false})));
        }

        setPlayers(newPlayers);
        setBoard(newBoard);
        setGamePhase(GamePhase.Playing);
        setCurrentPlayerIndex(0);
        setWinner(null);
    };
    
    const advanceTurn = useCallback(() => {
        setActiveAction(null);
        setSelectablePositions([]);
        const nextPlayerIndex = (currentPlayerIndex + 1) % players.length;
        
        let nextIndex = nextPlayerIndex;
        while (players[nextIndex]?.isEliminated) {
            nextIndex = (nextIndex + 1) % players.length;
            if(nextIndex === currentPlayerIndex) { 
                const activePlayers = players.filter(p => !p.isEliminated);
                if (activePlayers.length <= 1) { // Изменено на <= 1 для случая, когда все выбыли
                    setWinner(activePlayers[0] || null);
                    setGamePhase(GamePhase.GameOver);
                }
                return;
            }
        }
        setCurrentPlayerIndex(nextIndex);

    }, [currentPlayerIndex, players]);

    const handlePlayerElimination = useCallback((playerId: number, reason: string) => {
        const playerToEliminate = players.find(p => p.id === playerId);
        if(!playerToEliminate || playerToEliminate.isEliminated) return;

        const playerPos = findSuspectOnBoard(playerToEliminate.secretIdentity.id);
        if(playerPos) {
            const newBoard: Board = board.map(r => r.map(c => ({ ...c })));
            const card = newBoard[playerPos.row][playerPos.col];
            card.isAlive = false;
            card.isRevealed = true;
            performCompactionCheck(newBoard);
        }

        setPlayers(prev => prev.map(p => p.id === playerId ? {...p, isEliminated: true} : p));
        
        const activePlayers = players.filter(p => !p.isEliminated && p.id !== playerId);
        if (activePlayers.length <= 1) { // Изменено на <= 1
            setWinner(activePlayers[0] || null);
            setGamePhase(GamePhase.GameOver);
             setModal({isOpen: true, title: "Игрок выбыл!", content: `${playerToEliminate.name} выбывает из игры, так как ${reason}.`});
        } else {
             setModal({isOpen: true, title: "Игрок выбыл!", content: `${playerToEliminate.name} выбывает из игры, так как ${reason}.`, onClose: () => {
                setModal({isOpen: false, title: '', content: null});
                if (players[currentPlayerIndex]?.id === playerId) {
                    advanceTurn();
                }
             } });
        }
    }, [players, findSuspectOnBoard, advanceTurn, currentPlayerIndex, board]);

    const handleKill = (row: number, col: number) => {
        const targetSuspect = board[row][col].suspect;
        const victimPlayer = players.find(p => !p.isEliminated && p.secretIdentity.id === targetSuspect.id);
        const killer = currentPlayer;

        setActiveAction(null);

        // СЛУЧАЙ 1: Попали в шпиона
        if (victimPlayer) {
            const newTrophies = [...killer.trophies, victimPlayer.secretIdentity];
            
            if (newTrophies.length >= WIN_CONDITION_TROPHIES) {
                setPlayers(prev => prev.map(p => p.id === killer.id ? { ...p, trophies: newTrophies } : p));
                setWinner(killer);
                setGamePhase(GamePhase.GameOver);
                return;
            }

            const currentIdentities = new Set(players.filter(p => !p.isEliminated).map(p => p.secretIdentity.id));
            // FIX: Flatten the board to resolve a type inference issue where card was 'unknown'.
            // Using a typed concat with spread is a robust way to flatten the nested array.
            const availableSuspects = ([] as BoardCard[]).concat(...board).filter(card => card.isAlive && !currentIdentities.has(card.suspect.id));
            
            if (availableSuspects.length > 0) {
                const oldPlayerPos = findSuspectOnBoard(victimPlayer.secretIdentity.id);
                if (oldPlayerPos) {
                     const newBoard: Board = board.map(r => r.map(c => ({ ...c })));
                     const card = newBoard[oldPlayerPos.row][oldPlayerPos.col];
                     card.isAlive = false;
                     card.isRevealed = true;
                     performCompactionCheck(newBoard);
                }
                
                const newIdentity = shuffleArray(availableSuspects)[0].suspect;
                setPlayers(prev => prev.map(p => {
                    if (p.id === killer.id) return { ...p, trophies: newTrophies };
                    if (p.id === victimPlayer.id) return { ...p, secretIdentity: newIdentity, isIdentityVisible: false };
                    return p;
                }));

                setModal({
                    isOpen: true,
                    title: "Личность раскрыта!",
                    content: `${victimPlayer.name} был(а) раскрыт(а) игроком ${killer.name} и получает новую тайную личность.`,
                    onClose: () => {
                        setModal({ isOpen: false, title: '', content: null });
                        advanceTurn();
                    }
                });
            } else {
                setPlayers(prev => prev.map(p => p.id === killer.id ? { ...p, trophies: newTrophies } : p));
                handlePlayerElimination(victimPlayer.id, `был(а) убит(а), и на поле не осталось свободных личностей`);
            }
        } 
        // СЛУЧАЙ 2: Попали в мирного жителя
        else {
            const newBoard: Board = board.map(r => r.map(c => ({ ...c })));
            const card = newBoard[row][col];
            card.isAlive = false;
            card.isRevealed = true;
            performCompactionCheck(newBoard);
            
            const newBombs = killer.bombs + 1;
            setPlayers(prev => prev.map(p => p.id === killer.id ? { ...p, bombs: newBombs } : p));
            
            if (newBombs >= LOSE_CONDITION_BOMBS) {
                setModal({
                    isOpen: true,
                    title: "Фатальная ошибка!",
                    content: `Вы убили мирного жителя и получаете последнюю, ${LOSE_CONDITION_BOMBS}-ю бомбу!`,
                    onClose: () => {
                        setModal({isOpen: false, title: '', content: null});
                        handlePlayerElimination(killer.id, "накопил(а) слишком много бомб");
                    }
                });
            } else {
                setModal({
                    isOpen: true,
                    title: "Ошибка!",
                    content: `Вы убили мирного жителя и получаете бомбу. Теперь у вас ${newBombs} из ${LOSE_CONDITION_BOMBS}.`,
                    onClose: () => {
                        setModal({isOpen: false, title: '', content: null});
                        advanceTurn();
                    }
                });
            }
        }
    };
    
    const handleInterrogate = (row: number, col: number) => {
        setActiveAction(null);
        const targetSuspect = board[row][col].suspect;

        const adjacentPositions = getAdjacentPositions(row, col);
        const adjacentPlayers = players.filter(p => 
            !p.isEliminated &&
            adjacentPositions.some(pos => {
                if (!board[pos.row] || !board[pos.row][pos.col]) return false;
                return board[pos.row][pos.col].suspect.id === p.secretIdentity.id;
            })
        );

        const targetPlayer = players.find(p => !p.isEliminated && p.secretIdentity.id === targetSuspect.id);

        const respondingPlayerSet = new Set([...adjacentPlayers]);
        if (targetPlayer) {
            respondingPlayerSet.add(targetPlayer);
        }
        
        const respondingPlayers = Array.from(respondingPlayerSet);

        const content = (
            <div>
                <p className="mb-2">Откликнулись на опрос по <span className="font-bold text-yellow-400">{targetSuspect.name}</span>:</p>
                {respondingPlayers.length > 0 ? (
                    <ul className="list-disc list-inside">
                        {shuffleArray(respondingPlayers).map(p => <li key={p.id}>{p.name}</li>)}
                    </ul>
                ) : (
                    <p>Никто не откликнулся.</p>
                )}
                <p className="text-sm text-zinc-400 mt-3">Среди откликнувшихся: все игроки рядом с целью и сама цель.</p>
            </div>
        );

        setModal({isOpen: true, title: "Результаты опроса", content, onClose: () => {
            setModal({isOpen: false, title: '', content: null});
            advanceTurn();
        }});
    };


    const handleCardClick = (row: number, col: number) => {
        if (!activeAction || !selectablePositions.some(p => p.row === row && p.col === col)) return;
        if (activeAction === 'kill') handleKill(row, col);
        if (activeAction === 'interrogate') handleInterrogate(row, col);
    };

    const handleActionSelect = (action: ActionType) => {
        setActiveAction(prev => prev === action ? null : action);
    };

    const handleToggleIdentity = (playerId: number) => {
        setPlayers(players.map(p => p.id === playerId ? {...p, isIdentityVisible: !p.isIdentityVisible} : p));
    };

    const handleShift = (axis: 'row' | 'col', index: number, direction: 1 | -1) => {
        if (activeAction || isCompacting) return;
        const newBoard: Board = board.map(r => r.map(c => ({...c})));
        if (axis === 'row') {
            const row = newBoard[index];
            if (!row) return;
            const movedCard = direction === 1 ? row.pop() : row.shift();
            if(movedCard) {
                if(direction === 1) row.unshift(movedCard);
                else row.push(movedCard);
            }
        } else {
            if (!newBoard[0] || index >= newBoard[0].length) return;
            const col = newBoard.map(r => r[index]);
            const movedCard = direction === 1 ? col.pop() : col.shift();
            if(movedCard) {
                if(direction === 1) col.unshift(movedCard);
                else col.push(movedCard);
                col.forEach((card, i) => newBoard[i][index] = card);
            }
        }
        setBoard(newBoard);
        advanceTurn();
    };

    const renderGameContent = () => {
        switch(gamePhase) {
            case GamePhase.Setup:
                return <GameSetup onStartGame={handleStartGame} />;
            case GamePhase.Playing:
                if (!currentPlayer) {
                     // Это может произойти на короткое время при смене состояний или если все игроки выбыли
                     return <div className="flex items-center justify-center h-screen">Загрузка...</div>;
                }
                return (
                    <div className="flex flex-col h-screen bg-zinc-900 text-white">
                        <header className="p-2 text-center bg-zinc-800 border-b border-zinc-700">
                            <h1 className="text-3xl font-title text-red-500">Нуар: Шпионские Игры</h1>
                            <p>Ход: <span className="font-bold text-yellow-300">{currentPlayer?.name}</span></p>
                        </header>
                         <GameBoard board={board} onCardClick={handleCardClick} onShift={handleShift} selectablePositions={selectablePositions} currentPlayer={currentPlayer} players={players} isCompacting={isCompacting} />
                        <div className="w-full bg-zinc-800 p-4 border-t-2 border-zinc-700 flex justify-center items-center space-x-4">
                            <button onClick={() => handleActionSelect('interrogate')} className={`px-6 py-3 rounded font-title text-lg transition-colors ${activeAction === 'interrogate' ? 'bg-yellow-500 text-black' : 'bg-zinc-700 hover:bg-zinc-600'}`}>Опрос</button>
                            <button onClick={() => handleActionSelect('kill')} className={`px-6 py-3 rounded font-title text-lg transition-colors ${activeAction === 'kill' ? 'bg-red-600 text-white' : 'bg-zinc-700 hover:bg-zinc-600'}`}>Убить</button>
                        </div>
                        <PlayerDashboard players={players} currentPlayerId={currentPlayerIndex} onToggleIdentity={handleToggleIdentity} />
                        <Modal isOpen={modal.isOpen} title={modal.title} onClose={modal.onClose}>
                            {modal.content}
                        </Modal>
                    </div>
                );
            case GamePhase.GameOver:
                 return (
                    <Modal isOpen={true} title="Игра окончена">
                        <div className="text-center">
                            <p className="text-xl mb-4">{winner ? 'Победитель' : 'Победителей нет'}</p>
                            {winner && <p className="text-4xl font-bold text-yellow-400">{winner?.name}</p>}
                            <button onClick={() => {
                                setGamePhase(GamePhase.Setup);
                                setPlayers([]);
                                setBoard([]);
                            }} className="mt-6 bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-6 rounded">Играть снова</button>
                        </div>
                    </Modal>
                );
        }
    };
    
    return <div>{renderGameContent()}</div>;
};

export default GameApp;
