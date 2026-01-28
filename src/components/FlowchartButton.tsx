import { motion } from 'framer-motion';
import { GitBranch, Loader2 } from 'lucide-react';

interface FlowchartButtonProps {
  onClick: () => void;
  isGenerating: boolean;
  isActive: boolean;
  disabled?: boolean;
}

export function FlowchartButton({ onClick, isGenerating, isActive, disabled = false }: FlowchartButtonProps) {
  return (
    <motion.button
      whileHover={!disabled && !isGenerating ? { scale: 1.02 } : {}}
      whileTap={!disabled && !isGenerating ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={disabled || isGenerating}
      className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 flex items-center gap-2
        ${isActive 
          ? 'bg-accent text-white shadow-lg shadow-accent/30' 
          : 'bg-primary text-white hover:brightness-110 shadow-lg shadow-primary/30'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${isGenerating ? 'animate-pulse' : ''}
      `}
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <GitBranch className="w-4 h-4" />
          Flowchart
        </>
      )}
    </motion.button>
  );
}
