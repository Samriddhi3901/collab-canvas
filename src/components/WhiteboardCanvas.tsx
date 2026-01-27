import { useCallback, useEffect, useRef } from 'react';
import { 
  Tldraw, 
  useEditor, 
  getSnapshot, 
  loadSnapshot,
  TLEditorSnapshot,
  Editor 
} from 'tldraw';
import 'tldraw/tldraw.css';
import { motion } from 'framer-motion';

interface WhiteboardCanvasProps {
  isReadOnly?: boolean;
  onSnapshot?: (snapshot: TLEditorSnapshot) => void;
  remoteSnapshot?: TLEditorSnapshot | null;
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

  // Listen to store changes and broadcast
  useEffect(() => {
    if (!editor || isReadOnly) return;

    const handleStoreChange = () => {
      if (isApplyingRemote.current) return;
      
      const snapshot = getSnapshot(editor.store);
      const snapshotStr = JSON.stringify(snapshot.document);
      
      // Only broadcast if content actually changed
      if (snapshotStr !== lastSnapshotRef.current) {
        lastSnapshotRef.current = snapshotStr;
        onSnapshot?.({ document: snapshot.document, session: snapshot.session });
      }
    };

    // Throttle updates to avoid too many broadcasts
    let timeoutId: number | null = null;
    const throttledHandler = () => {
      if (timeoutId) return;
      timeoutId = window.setTimeout(() => {
        handleStoreChange();
        timeoutId = null;
      }, 100);
    };

    const unsubscribe = editor.store.listen(throttledHandler, { 
      source: 'user',
      scope: 'document' 
    });

    return () => {
      unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [editor, isReadOnly, onSnapshot]);

  // Apply remote snapshots
  useEffect(() => {
    if (!editor || !remoteSnapshot) return;
    
    const remoteStr = JSON.stringify(remoteSnapshot.document);
    if (remoteStr === lastSnapshotRef.current) return;
    
    isApplyingRemote.current = true;
    try {
      loadSnapshot(editor.store, { document: remoteSnapshot.document });
      lastSnapshotRef.current = remoteStr;
    } catch (error) {
      console.error('Failed to load remote snapshot:', error);
    } finally {
      isApplyingRemote.current = false;
    }
  }, [editor, remoteSnapshot]);

  // Set read-only mode
  useEffect(() => {
    if (!editor) return;
    
    if (isReadOnly) {
      editor.updateInstanceState({ isReadonly: true });
    }
  }, [editor, isReadOnly]);

  return null;
}

export function WhiteboardCanvas({ 
  isReadOnly = false, 
  onSnapshot,
  remoteSnapshot,
  roomId 
}: WhiteboardCanvasProps) {
  const handleMount = useCallback((editor: Editor) => {
    // Set dark mode
    editor.user.updateUserPreferences({ colorScheme: 'dark' });
  }, []);

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
