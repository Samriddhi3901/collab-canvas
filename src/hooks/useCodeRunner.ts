import { useState, useCallback, useRef } from 'react';
import { Language, RunStatus, OutputLine } from '@/types/editor';

declare global {
  interface Window {
    loadPyodide: () => Promise<any>;
    pyodide: any;
  }
}

export function useCodeRunner() {
  const [status, setStatus] = useState<RunStatus>('idle');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const pyodideRef = useRef<any>(null);
  const pyodideLoadingRef = useRef<Promise<any> | null>(null);

  const addOutput = useCallback((type: OutputLine['type'], content: string) => {
    setOutput(prev => [...prev, { type, content, timestamp: new Date() }]);
  }, []);

  const clearOutput = useCallback(() => {
    setOutput([]);
  }, []);

  const loadPyodide = useCallback(async () => {
    if (pyodideRef.current) {
      return pyodideRef.current;
    }

    if (pyodideLoadingRef.current) {
      return pyodideLoadingRef.current;
    }

    pyodideLoadingRef.current = (async () => {
      // Load Pyodide script
      if (!document.getElementById('pyodide-script')) {
        const script = document.createElement('script');
        script.id = 'pyodide-script';
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        document.head.appendChild(script);
        
        await new Promise<void>((resolve) => {
          script.onload = () => resolve();
        });
      }

      addOutput('info', '⏳ Loading Python runtime...');
      const pyodide = await window.loadPyodide();
      pyodideRef.current = pyodide;
      addOutput('info', '✅ Python runtime loaded!');
      return pyodide;
    })();

    return pyodideLoadingRef.current;
  }, [addOutput]);

  const runJavaScript = useCallback(async (code: string) => {
    // Capture console outputs
    const logs: OutputLine[] = [];
    const originalConsole = { ...console };

    const captureLog = (type: OutputLine['type']) => (...args: any[]) => {
      const content = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      logs.push({ type, content, timestamp: new Date() });
    };

    console.log = captureLog('log');
    console.error = captureLog('error');
    console.warn = captureLog('warn');
    console.info = captureLog('info');

    try {
      // Create a sandboxed eval
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction(code);
      const result = await fn();
      
      if (result !== undefined) {
        logs.push({ 
          type: 'log', 
          content: typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result),
          timestamp: new Date() 
        });
      }

      return logs;
    } finally {
      // Restore console
      Object.assign(console, originalConsole);
    }
  }, []);

  const runPython = useCallback(async (code: string) => {
    const pyodide = await loadPyodide();
    
    // Redirect Python stdout
    pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
    `);

    const logs: OutputLine[] = [];

    try {
      pyodide.runPython(code);
      
      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      const stderr = pyodide.runPython('sys.stderr.getvalue()');

      if (stdout) {
        stdout.split('\n').filter(Boolean).forEach((line: string) => {
          logs.push({ type: 'log', content: line, timestamp: new Date() });
        });
      }

      if (stderr) {
        stderr.split('\n').filter(Boolean).forEach((line: string) => {
          logs.push({ type: 'error', content: line, timestamp: new Date() });
        });
      }

      return logs;
    } catch (error: any) {
      logs.push({ type: 'error', content: error.message, timestamp: new Date() });
      return logs;
    }
  }, [loadPyodide]);

  const runCode = useCallback(async (code: string, language: Language) => {
    setStatus('running');
    clearOutput();
    addOutput('info', `▶ Running ${language} code...`);

    try {
      let logs: OutputLine[] = [];

      switch (language) {
        case 'javascript':
          logs = await runJavaScript(code);
          break;
        case 'python':
          logs = await runPython(code);
          break;
        case 'cpp':
        case 'java':
          addOutput('warn', `⚠️ ${language.toUpperCase()} execution requires a backend compiler.`);
          addOutput('info', '💡 For now, JavaScript and Python are fully supported in-browser.');
          setStatus('success');
          return;
        default:
          throw new Error(`Unsupported language: ${language}`);
      }

      logs.forEach(log => addOutput(log.type, log.content));
      
      const hasErrors = logs.some(l => l.type === 'error');
      setStatus(hasErrors ? 'error' : 'success');
    } catch (error: any) {
      addOutput('error', `❌ Error: ${error.message}`);
      setStatus('error');
    }
  }, [clearOutput, addOutput, runJavaScript, runPython]);

  return {
    status,
    output,
    runCode,
    clearOutput,
  };
}
