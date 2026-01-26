import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { RunStatus, OutputLine } from '@/types/editor';

interface OutputConsoleProps {
  output: OutputLine[];
  status: RunStatus;
  onClear: () => void;
}

export function OutputConsole({ output, status, onClear }: OutputConsoleProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-warning" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'running':
        return <span className="status-running">Running...</span>;
      case 'success':
        return <span className="status-success">✓ Done</span>;
      case 'error':
        return <span className="status-error">✗ Error</span>;
      default:
        return <span className="text-muted-foreground">Ready</span>;
    }
  };

  const getOutputColor = (type: OutputLine['type']) => {
    switch (type) {
      case 'error':
        return 'text-destructive';
      case 'warn':
        return 'text-warning';
      case 'info':
        return 'text-primary';
      default:
        return 'text-foreground';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col bg-console rounded-lg overflow-hidden border border-border"
    >
      <div className="console-header">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span>Output</span>
          {getStatusIcon()}
          {getStatusText()}
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClear}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          title="Clear console"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-auto p-4 font-mono text-sm scrollbar-thin">
        <AnimatePresence mode="popLayout">
          {output.length === 0 ? (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              className="text-muted-foreground italic"
            >
              Run your code to see output here...
            </motion.p>
          ) : (
            output.map((line, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`${getOutputColor(line.type)} mb-1 flex gap-2`}
              >
                <span className="text-muted-foreground text-xs opacity-50">
                  {line.timestamp.toLocaleTimeString('en-US', { 
                    hour12: false, 
                    hour: '2-digit', 
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
                <pre className="whitespace-pre-wrap break-words flex-1">{line.content}</pre>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
