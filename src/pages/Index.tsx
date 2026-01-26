import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import { CodeEditor } from '@/components/CodeEditor';
import { WhiteboardCanvas } from '@/components/WhiteboardCanvas';
import { OutputConsole } from '@/components/OutputConsole';
import { RunButton } from '@/components/RunButton';
import { useRoom } from '@/hooks/useRoom';
import { useCodeRunner } from '@/hooks/useCodeRunner';
import { ViewMode, Language } from '@/types/editor';
import { Code2, PenTool } from 'lucide-react';

const Index = () => {
  const [searchParams] = useSearchParams();
  const roomIdFromUrl = searchParams.get('room');
  
  const { room, isViewOnly, updateCode, updateLanguage } = useRoom(roomIdFromUrl || undefined);
  const { status, output, runCode, clearOutput } = useCodeRunner();
  
  const [viewMode, setViewMode] = useState<ViewMode>('split');

  const handleRun = useCallback(() => {
    if (room) {
      runCode(room.code, room.language);
    }
  }, [room, runCode]);

  const handleLanguageChange = useCallback((lang: Language) => {
    updateLanguage(lang);
    clearOutput();
  }, [updateLanguage, clearOutput]);

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
            <RunButton onRun={handleRun} status={status} disabled={isViewOnly} />
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
                  />
                </div>
                <div className="w-96 min-h-0">
                  <OutputConsole output={output} status={status} onClear={clearOutput} />
                </div>
              </motion.div>
            )}

            {/* Whiteboard View */}
            {viewMode === 'whiteboard' && (
              <motion.div
                key="whiteboard-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex-1 panel min-h-0"
              >
                <WhiteboardCanvas isReadOnly={isViewOnly} />
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
                  />
                </div>

                {/* Right Panel - Output */}
                <div className="w-96 min-h-0">
                  <OutputConsole output={output} status={status} onClear={clearOutput} />
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
}

function SplitViewPanel({ code, language, onChange, isViewOnly }: SplitViewPanelProps) {
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
          Custom Whiteboard
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
              <WhiteboardCanvas isReadOnly={isViewOnly} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Index;
