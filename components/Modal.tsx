
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}

const Modal: React.FC<ModalProps> = ({ isOpen, title, children, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-800 rounded-lg shadow-2xl p-6 w-full max-w-md border border-zinc-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-title text-red-500">{title}</h2>
          {onClose && (
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl">&times;</button>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
