import { motion } from 'framer-motion';
import { Play, Loader2 } from 'lucide-react';
import { RunStatus } from '@/types/editor';

interface RunButtonProps {
  onRun: () => void;
  status: RunStatus;
  disabled?: boolean;
}

export function RunButton({ onRun, status, disabled = false }: RunButtonProps) {
  const isRunning = status === 'running';

  return (
    <motion.button
      whileHover={!disabled && !isRunning ? { scale: 1.02 } : {}}
      whileTap={!disabled && !isRunning ? { scale: 0.98 } : {}}
      onClick={onRun}
      disabled={disabled || isRunning}
      className={`btn-run ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isRunning ? 'animate-pulse-glow' : ''}`}
    >
      {isRunning ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Running...
        </>
      ) : (
        <>
          <Play className="w-4 h-4" />
          Run
        </>
      )}
    </motion.button>
  );
}
