

import React from 'react';
import { BoardCard } from '../types';

interface SuspectCardProps {
  card: BoardCard;
  onClick: () => void;
  isSelectable: boolean;
  isPlayerIdentity: boolean;
  isEliminatedPlayer: boolean;
  isRevealed?: boolean;
}

const PaperclipIcon = () => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-6 w-6 absolute top-1 left-1 transform -rotate-45 text-zinc-600" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth={1.5}
        aria-hidden="true"
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0L4.5 10.5a4.5 4.5 0 016.364-6.364l4.5 4.5a4.5 4.5 0 01-6.364 6.364l-1.5-1.5" />
    </svg>
);


const SuspectCard: React.FC<SuspectCardProps> = ({ card, onClick, isSelectable, isPlayerIdentity, isEliminatedPlayer, isRevealed }) => {
  const imageUrl = `https://picsum.photos/seed/${card.suspect.id}/100/140?grayscale`;
  
  let borderClasses = 'border-zinc-400';
  let otherClasses = '';

  if (isEliminatedPlayer || isRevealed) {
      borderClasses = 'border-red-600 ring-2 ring-red-600';
  } else if (isPlayerIdentity) {
      borderClasses = 'border-green-500 ring-2 ring-green-500';
  } else if (isSelectable) {
      borderClasses = 'border-yellow-400 ring-2 ring-yellow-400';
      otherClasses = 'cursor-pointer hover:scale-105';
  }

  const cardClasses = `
    w-full aspect-[2/3] rounded-md shadow-lg border transition-all duration-200
    flex flex-col p-1 bg-[#f5eeda] relative
    ${borderClasses}
    ${otherClasses}
    ${!card.isAlive ? 'brightness-75' : ''}
  `;

  return (
    <div className={cardClasses} onClick={onClick}>
        <div 
            className="flex-grow bg-cover bg-center border-2 border-white shadow-inner" 
            style={{ backgroundImage: `url(${imageUrl})` }}
            role="img"
            aria-label={card.suspect.name}
        >
        </div>
        <div className="h-[25%] flex items-center justify-center pt-1">
             <h3 className="text-black font-title text-sm text-center leading-tight">{card.suspect.name}</h3>
        </div>
        <PaperclipIcon />
    </div>
  );
};

export default SuspectCard;