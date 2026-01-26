import { Tldraw } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { motion } from 'framer-motion';

interface WhiteboardCanvasProps {
  isReadOnly?: boolean;
}

export function WhiteboardCanvas({ isReadOnly = false }: WhiteboardCanvasProps) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full rounded-lg overflow-hidden bg-[#1e1e1e]"
      style={{ 
        // Custom styles to match dark theme
        ['--color-background' as any]: '#1e1e1e',
        ['--color-panel' as any]: '#252525',
      }}
    >
      <Tldraw
        inferDarkMode
        hideUi={isReadOnly}
        onMount={(editor) => {
          // Set dark mode
          editor.user.updateUserPreferences({ colorScheme: 'dark' });
          
          if (isReadOnly) {
            // Disable all tools for read-only mode
            editor.updateInstanceState({ isReadonly: true });
          }
        }}
      />
    </motion.div>
  );
}
