import Editor, { Monaco } from '@monaco-editor/react';
import { useRef, useCallback, useEffect } from 'react';
import { Language, UserPresence, CursorPosition } from '@/types/editor';
import { motion } from 'framer-motion';

interface CodeEditorProps {
  code: string;
  language: Language;
  onChange: (value: string) => void;
  isReadOnly?: boolean;
  remotePresence?: UserPresence[];
  onCursorChange?: (cursor: CursorPosition | null, selection?: { start: CursorPosition; end: CursorPosition }) => void;
}

const LANGUAGE_MAP: Record<Language, string> = {
  javascript: 'javascript',
  python: 'python',
  cpp: 'cpp',
  java: 'java',
};

export function CodeEditor({ 
  code, 
  language, 
  onChange, 
  isReadOnly = false,
  remotePresence = [],
  onCursorChange,
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleEditorDidMount = useCallback((editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define custom dark theme
    monaco.editor.defineTheme('collabcode-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'operator', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#161b22',
        'editor.selectionBackground': '#264f78',
        'editorLineNumber.foreground': '#6e7681',
        'editorLineNumber.activeForeground': '#e6edf3',
        'editorGutter.background': '#0d1117',
        'editorCursor.foreground': '#58a6ff',
        'editor.inactiveSelectionBackground': '#264f7855',
        'editorIndentGuide.background': '#21262d',
        'editorIndentGuide.activeBackground': '#30363d',
        'scrollbarSlider.background': '#30363d80',
        'scrollbarSlider.hoverBackground': '#484f5880',
        'scrollbarSlider.activeBackground': '#6e768180',
      },
    });

    monaco.editor.setTheme('collabcode-dark');

    // Track cursor position changes
    editor.onDidChangeCursorPosition((e: any) => {
      if (onCursorChange) {
        const selection = editor.getSelection();
        if (selection && !selection.isEmpty()) {
          onCursorChange(
            { lineNumber: e.position.lineNumber, column: e.position.column },
            {
              start: { lineNumber: selection.startLineNumber, column: selection.startColumn },
              end: { lineNumber: selection.endLineNumber, column: selection.endColumn },
            }
          );
        } else {
          onCursorChange({ lineNumber: e.position.lineNumber, column: e.position.column });
        }
      }
    });

    // Add custom hover providers for better error messages
    monaco.languages.registerHoverProvider('javascript', {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        const hovers: Record<string, string> = {
          'const': '📘 **const** - Declares a block-scoped constant variable',
          'let': '📘 **let** - Declares a block-scoped variable',
          'function': '📘 **function** - Declares a function',
          'return': '📘 **return** - Returns a value from a function',
          'console': '📘 **console** - Browser console object for logging',
        };

        const content = hovers[word.word];
        if (content) {
          return {
            range: new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            ),
            contents: [{ value: content }],
          };
        }

        return null;
      },
    });

    // Focus editor
    editor.focus();
  }, [onCursorChange]);

  // Update remote cursor decorations
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Create decorations for remote cursors
    const newDecorations: any[] = [];
    
    remotePresence.forEach(user => {
      if (user.cursor) {
        // Add cursor decoration
        newDecorations.push({
          range: new monaco.Range(
            user.cursor.lineNumber,
            user.cursor.column,
            user.cursor.lineNumber,
            user.cursor.column + 1
          ),
          options: {
            className: `remote-cursor-${user.id}`,
            beforeContentClassName: `remote-cursor-line`,
            hoverMessage: { value: user.name },
            stickiness: 1,
          },
        });
      }

      if (user.selection) {
        // Add selection decoration
        newDecorations.push({
          range: new monaco.Range(
            user.selection.start.lineNumber,
            user.selection.start.column,
            user.selection.end.lineNumber,
            user.selection.end.column
          ),
          options: {
            className: `remote-selection`,
            inlineClassName: `remote-selection-inline`,
            hoverMessage: { value: `${user.name}'s selection` },
          },
        });
      }
    });

    // Apply decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);

    // Add dynamic styles for remote cursors
    const styleId = 'remote-cursor-styles';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    
    const styles = remotePresence.map(user => `
      .remote-cursor-${user.id}::before {
        content: '';
        position: absolute;
        width: 2px;
        height: 18px;
        background-color: ${user.color};
        margin-left: -1px;
        animation: cursor-blink 1s infinite;
      }
      .remote-cursor-${user.id}::after {
        content: '${user.name}';
        position: absolute;
        top: -18px;
        left: -1px;
        font-size: 10px;
        background-color: ${user.color};
        color: white;
        padding: 1px 4px;
        border-radius: 2px;
        white-space: nowrap;
        z-index: 100;
      }
    `).join('\n');
    
    styleEl.textContent = `
      @keyframes cursor-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      .remote-selection-inline {
        background-color: rgba(100, 150, 255, 0.3);
      }
      ${styles}
    `;
  }, [remotePresence]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  }, [onChange]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full rounded-lg overflow-hidden relative"
    >
      {/* Remote user indicators */}
      {remotePresence.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          {remotePresence.map(user => (
            <div
              key={user.id}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs"
              style={{ backgroundColor: user.color + '33', color: user.color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: user.color }} />
              {user.name}
            </div>
          ))}
        </div>
      )}
      
      <Editor
        height="100%"
        language={LANGUAGE_MAP[language]}
        value={code}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly: isReadOnly,
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontLigatures: true,
          lineHeight: 22,
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'all',
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          bracketPairColorization: { enabled: true },
          guides: {
            indentation: true,
            bracketPairs: true,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
            showFunctions: true,
            showVariables: true,
          },
        }}
      />
    </motion.div>
  );
}
