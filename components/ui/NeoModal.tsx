import React from 'react';
import { NeoCard } from './NeoCard';
import { X } from 'lucide-react';

interface NeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const NeoModal: React.FC<NeoModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-2xl animate-in fade-in zoom-in duration-200">
        <NeoCard color="white" className="p-0 overflow-hidden flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b-4 border-black bg-neo-yellow">
            <h3 className="text-2xl font-black">{title}</h3>
            <button 
              onClick={onClose}
              className="p-1 hover:bg-black hover:text-white transition-colors border-2 border-transparent hover:border-black rounded-lg"
            >
              <X size={24} strokeWidth={3} />
            </button>
          </div>
          
          {/* Scrollable Body */}
          <div className="p-6 overflow-y-auto whitespace-pre-line text-lg leading-relaxed">
            {children}
          </div>
        </NeoCard>
      </div>
    </div>
  );
};
