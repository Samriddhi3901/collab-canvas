import { useCallback, useEffect, useRef, useState } from 'react';
import { 
  Tldraw, 
  useEditor, 
  Editor,
  TLStoreSnapshot,
} from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { motion } from 'framer-motion';

// Simplified snapshot type for our use case
export interface WhiteboardSnapshot {
  shapes: any[];
}

interface WhiteboardCanvasProps {
  isReadOnly?: boolean;
  onSnapshot?: (snapshot: WhiteboardSnapshot) => void;
  remoteSnapshot?: WhiteboardSnapshot | null;
  roomId?: string;
}

// Inner component that has access to editor context
function WhiteboardInner({ 
  isReadOnly, 
  onSnapshot, 
  remoteSnapshot 
}: Omit<WhiteboardCanvasProps, 'roomId'>) {
  const editor = useEditor();
  const lastSnapshotRef = useRef<string>('');
  const isApplyingRemote = useRef(false);

  // Get current shapes as snapshot
  const getSnapshotFromEditor = useCallback(() => {
    if (!editor) return null;
    const shapes = editor.getCurrentPageShapes();
    return {
      shapes: shapes.map(s => ({ ...s })),
    };
  }, [editor]);

  // Apply snapshot to editor (diff-based to prevent lag/flicker)
  const applySnapshotToEditor = useCallback((snapshot: WhiteboardSnapshot) => {
    if (!editor || !snapshot) return;

    try {
      isApplyingRemote.current = true;

      const nextShapes = Array.isArray(snapshot.shapes) ? snapshot.shapes : [];
      const currentShapes = editor.getCurrentPageShapes();

      const currentById = new Map(currentShapes.map((s: any) => [s.id, s]));
      const nextById = new Map(nextShapes.map((s: any) => [s.id, s]));

      const toDelete: any[] = [];
      const toCreate: any[] = [];
      const toUpdate: any[] = [];

      for (const cur of currentShapes as any[]) {
        if (!nextById.has(cur.id)) toDelete.push(cur);
      }

      for (const next of nextShapes as any[]) {
        const cur = currentById.get(next.id);
        if (!cur) {
          toCreate.push(next);
        } else {
          // Only update when shape actually changed
          // (avoids store churn and reduces perceived lag)
          const curStr = JSON.stringify(cur);
          const nextStr = JSON.stringify(next);
          if (curStr !== nextStr) {
            toUpdate.push(next);
          }
        }
      }

      const run = (editor as any).run;
      const apply = () => {
        if (toDelete.length) editor.deleteShapes(toDelete);
        if (toCreate.length) editor.createShapes(toCreate);
        if (toUpdate.length) editor.updateShapes(toUpdate);
      };

      // Batch mutations when available
      if (typeof run === 'function') {
        run(apply);
      } else {
        apply();
      }
    } catch (error) {
      console.error('Failed to apply snapshot:', error);
    } finally {
      isApplyingRemote.current = false;
    }
  }, [editor]);

  // Listen to store changes and broadcast
  useEffect(() => {
    if (!editor || isReadOnly) return;

    let timeoutId: number | null = null;
    
    const handleChange = () => {
      if (isApplyingRemote.current) return;
      
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = window.setTimeout(() => {
        const snapshot = getSnapshotFromEditor();
        if (!snapshot) return;
        
        const snapshotStr = JSON.stringify(snapshot);
        
        // Only broadcast if content actually changed
        if (snapshotStr !== lastSnapshotRef.current) {
          lastSnapshotRef.current = snapshotStr;
          onSnapshot?.(snapshot);
        }
        timeoutId = null;
      }, 100);
    };

    const unsubscribe = editor.store.listen(handleChange, { 
      source: 'user',
      scope: 'document' 
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [editor, isReadOnly, onSnapshot, getSnapshotFromEditor]);

  // Apply remote snapshots
  useEffect(() => {
    if (!editor || !remoteSnapshot) return;
    
    const remoteStr = JSON.stringify(remoteSnapshot);
    if (remoteStr === lastSnapshotRef.current) return;
    
    lastSnapshotRef.current = remoteStr;
    applySnapshotToEditor(remoteSnapshot);
  }, [editor, remoteSnapshot, applySnapshotToEditor]);

  // Set read-only mode
  useEffect(() => {
    if (!editor) return;

    // Keep this in sync both ways (not only when turning on)
    editor.updateInstanceState({ isReadonly: !!isReadOnly });
  }, [editor, isReadOnly]);

  return null;
}

export function WhiteboardCanvas({ 
  isReadOnly = false, 
  onSnapshot,
  remoteSnapshot,
  roomId 
}: WhiteboardCanvasProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMount = useCallback((editor: Editor) => {
    // Set dark mode
    editor.user.updateUserPreferences({ colorScheme: 'dark' });
  }, []);

  if (!mounted) {
    return (
      <div className="h-full w-full rounded-lg overflow-hidden bg-[#1e1e1e] flex items-center justify-center">
        <span className="text-muted-foreground">Loading whiteboard...</span>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full rounded-lg overflow-hidden"
      style={{ 
        backgroundColor: '#1e1e1e',
      }}
    >
      <Tldraw
        inferDarkMode
        hideUi={isReadOnly}
        onMount={handleMount}
      >
        <WhiteboardInner 
          isReadOnly={isReadOnly}
          onSnapshot={onSnapshot}
          remoteSnapshot={remoteSnapshot}
        />
      </Tldraw>
    </motion.div>
  );
}
