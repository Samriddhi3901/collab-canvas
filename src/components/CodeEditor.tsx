import Editor, { Monaco } from '@monaco-editor/react';
import { useRef, useCallback } from 'react';
import { Language } from '@/types/editor';
import { motion } from 'framer-motion';

interface CodeEditorProps {
  code: string;
  language: Language;
  onChange: (value: string) => void;
  isReadOnly?: boolean;
}

const LANGUAGE_MAP: Record<Language, string> = {
  javascript: 'javascript',
  python: 'python',
  cpp: 'cpp',
  java: 'java',
};

export function CodeEditor({ code, language, onChange, isReadOnly = false }: CodeEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = useCallback((editor: any, monaco: Monaco) => {
    editorRef.current = editor;

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

    // Add custom hover providers for better error messages
    monaco.languages.registerHoverProvider('javascript', {
      provideHover: (model, position) => {
        const word = model.getWordAtPosition(position);
        if (!word) return null;

        // Basic hover info for common keywords
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
  }, []);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  }, [onChange]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full rounded-lg overflow-hidden"
    >
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
