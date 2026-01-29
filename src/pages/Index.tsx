import { useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { CodeEditor } from '@/components/CodeEditor';
import { WhiteboardCanvas } from '@/components/WhiteboardCanvas';
import { OutputConsole } from '@/components/OutputConsole';
import { RunButton } from '@/components/RunButton';
import { FlowchartButton } from '@/components/FlowchartButton';
import { FlowchartPanel } from '@/components/FlowchartPanel';
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom';
import { useCodeRunner } from '@/hooks/useCodeRunner';
import { useFlowchartGenerator } from '@/hooks/useFlowchartGenerator';
import { ViewMode, Language, UserPresence, CursorPosition } from '@/types/editor';
import { Code2, PenTool } from 'lucide-react';
import { WhiteboardSnapshot } from '@/components/WhiteboardCanvas';

const Index = () => {
  const [searchParams] = useSearchParams();
  const roomIdFromUrl = searchParams.get('room');
  
  const { 
    room, 
    isViewOnly, 
    connectedUsers, 
    remotePresence,
    remoteWhiteboardSnapshot,
    updateCode, 
    updateLanguage,
    updateCursor,
    broadcastWhiteboard,
  } = useRealtimeRoom(roomIdFromUrl || undefined);
  const { status, output, runCode, clearOutput } = useCodeRunner();
  const { flowchartData, isGenerating, error: flowchartError, generateFlowchart, clearFlowchart } = useFlowchartGenerator();
  
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showFlowchart, setShowFlowchart] = useState(false);
  const editorRef = useRef<any>(null);

  const handleRun = useCallback(() => {
    if (room) {
      runCode(room.code, room.language);
    }
  }, [room, runCode]);

  const handleFlowchart = useCallback(() => {
    if (room) {
      if (showFlowchart) {
        setShowFlowchart(false);
        clearFlowchart();
      } else {
        setShowFlowchart(true);
        generateFlowchart(room.code, room.language);
      }
    }
  }, [room, showFlowchart, generateFlowchart, clearFlowchart]);

  const handleCloseFlowchart = useCallback(() => {
    setShowFlowchart(false);
    clearFlowchart();
  }, [clearFlowchart]);

  const handleNodeClick = useCallback((lineNumber: number) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(lineNumber);
      editorRef.current.setPosition({ lineNumber, column: 1 });
      editorRef.current.focus();
    }
  }, []);

  const handleLanguageChange = useCallback((lang: Language) => {
    updateLanguage(lang);
    clearOutput();
    if (showFlowchart) {
      setShowFlowchart(false);
      clearFlowchart();
    }
  }, [updateLanguage, clearOutput, showFlowchart, clearFlowchart]);

  if (!room) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Code2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Loading CollabCode...</h1>
          <div className="w-48 h-1 bg-secondary rounded-full mx-auto overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        language={room.language}
        setLanguage={handleLanguageChange}
        roomId={room.id}
        isViewOnly={isViewOnly}
        connectedUsers={connectedUsers}
      />

      <div className="flex-1 p-4 flex flex-col gap-4 overflow-hidden">
        {/* Control Bar - Only show for code view or split view */}
        {(viewMode === 'code' || viewMode === 'split') && !isViewOnly && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-secondary rounded-md text-sm text-muted-foreground">
                {room.language === 'javascript' && '📜 JavaScript'}
                {room.language === 'python' && '🐍 Python'}
                {room.language === 'cpp' && '⚙️ C++'}
                {room.language === 'java' && '☕ Java'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FlowchartButton 
                onClick={handleFlowchart} 
                isGenerating={isGenerating} 
                isActive={showFlowchart}
                disabled={isViewOnly}
              />
              <RunButton onRun={handleRun} status={status} disabled={isViewOnly} />
            </div>
          </motion.div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          <AnimatePresence mode="wait">
            {/* Code View */}
            {viewMode === 'code' && (
              <motion.div
                key="code-view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex gap-4 min-h-0"
              >
                <div className="flex-1 panel min-h-0">
                  <CodeEditor
                    code={room.code}
                    language={room.language}
                    onChange={updateCode}
                    isReadOnly={isViewOnly}
                    remotePresence={remotePresence}
                    onCursorChange={updateCursor}
                  />
                </div>
                <div className="w-96 min-h-0">
                  <AnimatePresence mode="wait">
                    {showFlowchart ? (
                      <FlowchartPanel
                        key="flowchart"
                        data={flowchartData}
                        error={flowchartError}
                        isGenerating={isGenerating}
                        onClose={handleCloseFlowchart}
                        onNodeClick={handleNodeClick}
                      />
                    ) : (
                      <motion.div key="output" className="h-full">
                        <OutputConsole output={output} status={status} onClear={clearOutput} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* Whiteboard View */}
            {viewMode === 'whiteboard' && (
              <motion.div
                key="whiteboard-view"
                // IMPORTANT: Avoid transform animations here.
                // CSS transforms on the tldraw container (even translateX(0)) can break pointer math
                // and lead to offset/laggy drawing.
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 panel min-h-0"
              >
                <WhiteboardCanvas 
                  isReadOnly={isViewOnly} 
                  onSnapshot={broadcastWhiteboard}
                  remoteSnapshot={remoteWhiteboardSnapshot}
                  roomId={room.id}
                />
              </motion.div>
            )}

            {/* Split View */}
            {viewMode === 'split' && (
              <motion.div
                key="split-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex gap-4 min-h-0"
              >
                {/* Left Panel - Tabs for Code/Whiteboard */}
                <div className="flex-1 flex flex-col min-h-0">
                  <SplitViewPanel
                    code={room.code}
                    language={room.language}
                    onChange={updateCode}
                    isViewOnly={isViewOnly}
                    remotePresence={remotePresence}
                    onCursorChange={updateCursor}
                    onWhiteboardSnapshot={broadcastWhiteboard}
                    remoteWhiteboardSnapshot={remoteWhiteboardSnapshot}
                    roomId={room.id}
                  />
                </div>

                {/* Right Panel - Output or Flowchart */}
                <div className="w-96 min-h-0">
                  <AnimatePresence mode="wait">
                    {showFlowchart ? (
                      <FlowchartPanel
                        key="flowchart"
                        data={flowchartData}
                        error={flowchartError}
                        isGenerating={isGenerating}
                        onClose={handleCloseFlowchart}
                        onNodeClick={handleNodeClick}
                      />
                    ) : (
                      <motion.div key="output" className="h-full">
                        <OutputConsole output={output} status={status} onClear={clearOutput} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

interface SplitViewPanelProps {
  code: string;
  language: Language;
  onChange: (code: string) => void;
  isViewOnly: boolean;
  remotePresence?: UserPresence[];
  onCursorChange?: (cursor: CursorPosition | null, selection?: { start: CursorPosition; end: CursorPosition }) => void;
  onWhiteboardSnapshot?: (snapshot: WhiteboardSnapshot) => void;
  remoteWhiteboardSnapshot?: WhiteboardSnapshot | null;
  roomId?: string;
}

function SplitViewPanel({ 
  code, 
  language, 
  onChange, 
  isViewOnly, 
  remotePresence, 
  onCursorChange,
  onWhiteboardSnapshot,
  remoteWhiteboardSnapshot,
  roomId,
}: SplitViewPanelProps) {
  const [activeTab, setActiveTab] = useState<'code' | 'whiteboard'>('code');

  return (
    <div className="flex-1 flex flex-col panel min-h-0">
      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'code' ? 'tab-active' : 'tab-inactive'
          }`}
        >
          <Code2 className="w-4 h-4" />
          Code Editor
        </button>
        <button
          onClick={() => setActiveTab('whiteboard')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'whiteboard' ? 'tab-active' : 'tab-inactive'
          }`}
        >
          <PenTool className="w-4 h-4" />
          Whiteboard
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === 'code' ? (
            <motion.div
              key="code"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <CodeEditor
                code={code}
                language={language}
                onChange={onChange}
                isReadOnly={isViewOnly}
                remotePresence={remotePresence}
                onCursorChange={onCursorChange}
              />
            </motion.div>
          ) : (
            <motion.div
              key="whiteboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <WhiteboardCanvas 
                isReadOnly={isViewOnly}
                onSnapshot={onWhiteboardSnapshot}
                remoteSnapshot={remoteWhiteboardSnapshot}
                roomId={roomId}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Index;
