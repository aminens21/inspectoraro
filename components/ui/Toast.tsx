import React, { useEffect, useState } from 'react';

interface ToastProps {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  autoClose?: boolean;
  onClose: (id: number) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type, autoClose = true, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(() => {
        handleClose();
      }, 3000); // Auto-dismiss after 3 seconds

      return () => {
        clearTimeout(timer);
      };
    }
  }, [id, onClose, autoClose]);

  const handleClose = () => {
    setIsExiting(true);
    // Wait for animation to finish before calling onClose
    setTimeout(() => onClose(id), 200);
  };

  const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'info' ? 'bg-sky-600' : 'bg-rose-600';
  const iconColor = 'text-white';
  const textColor = 'text-white';
  const icon = type === 'success' ? 'fa-check-circle' : type === 'info' ? 'fa-info-circle' : 'fa-exclamation-triangle';

  return (
    <div className={`toast-item ${isExiting ? 'fade-out' : ''} flex items-center p-4 rounded-xl shadow-2xl ${bgColor} text-white w-auto min-w-[300px] max-w-sm border border-white/20 backdrop-blur-sm`}>
      <div className="flex-shrink-0">
        <i className={`fas ${icon} fa-2x ${iconColor} ${type === 'info' ? 'animate-pulse' : ''}`}></i>
      </div>
      <div className="mx-4 flex-grow text-center" dir="auto">
        <p className="text-base font-bold">{message}</p>
      </div>
      <button onClick={handleClose} className={`flex-shrink-0 rounded-lg p-1.5 inline-flex h-8 w-8 text-white hover:bg-white/20 transition-colors`}>
        <span className="sr-only">Close</span>
        <i className="fas fa-times"></i>
      </button>
    </div>
  );
};