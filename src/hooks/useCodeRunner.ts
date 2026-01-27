import { useState, useCallback, useRef } from 'react';
import { Language, RunStatus, OutputLine } from '@/types/editor';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    loadPyodide: (config?: { indexURL?: string }) => Promise<any>;
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
      const PYODIDE_VERSION = '0.27.0';
      const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
      
      // Load Pyodide script
      if (!document.getElementById('pyodide-script')) {
        const script = document.createElement('script');
        script.id = 'pyodide-script';
        script.src = `${PYODIDE_CDN}pyodide.js`;
        document.head.appendChild(script);
        
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Pyodide'));
        });
      }

      addOutput('info', '⏳ Loading Python runtime (this may take a moment)...');
      
      try {
        const pyodide = await window.loadPyodide({
          indexURL: PYODIDE_CDN,
        });
        pyodideRef.current = pyodide;
        addOutput('info', '✅ Python runtime ready!');
        return pyodide;
      } catch (err: any) {
        addOutput('error', `Failed to load Python: ${err.message}`);
        throw err;
      }
    })();

    return pyodideLoadingRef.current;
  }, [addOutput]);

  const runJavaScript = useCallback(async (code: string) => {
    // Capture console outputs
    const logs: OutputLine[] = [];
    
    // Store original console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    const captureLog = (type: OutputLine['type']) => (...args: any[]) => {
      const content = args.map(arg => {
        if (arg === undefined) return 'undefined';
        if (arg === null) return 'null';
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      logs.push({ type, content, timestamp: new Date() });
    };

    // Override console methods
    console.log = captureLog('log');
    console.error = captureLog('error');
    console.warn = captureLog('warn');
    console.info = captureLog('info');

    try {
      // Create a sandboxed function with console available
      // Wrap code to capture the result of expressions
      const wrappedCode = `
        "use strict";
        ${code}
      `;
      
      // Use Function constructor for synchronous code first
      const fn = new Function(wrappedCode);
      const result = fn();
      
      // If result is a promise, await it
      if (result instanceof Promise) {
        await result;
      } else if (result !== undefined) {
        logs.push({ 
          type: 'log', 
          content: typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result),
          timestamp: new Date() 
        });
      }

      return logs;
    } catch (error: any) {
      logs.push({ 
        type: 'error', 
        content: `${error.name}: ${error.message}`,
        timestamp: new Date() 
      });
      return logs;
    } finally {
      // Restore original console methods
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      console.info = originalInfo;
    }
  }, []);

  const runPython = useCallback(async (code: string) => {
    const logs: OutputLine[] = [];
    
    try {
      const pyodide = await loadPyodide();
      
      // Reset stdout/stderr before each run
      pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
      `);

      // Run the user code
      await pyodide.runPythonAsync(code);
      
      // Capture output
      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      const stderr = pyodide.runPython('sys.stderr.getvalue()');

      if (stdout) {
        stdout.split('\n').forEach((line: string) => {
          if (line) logs.push({ type: 'log', content: line, timestamp: new Date() });
        });
      }

      if (stderr) {
        stderr.split('\n').forEach((line: string) => {
          if (line) logs.push({ type: 'error', content: line, timestamp: new Date() });
        });
      }

      if (logs.length === 0) {
        logs.push({ type: 'info', content: '(No output)', timestamp: new Date() });
      }

      return logs;
    } catch (error: any) {
      // Format Python error nicely
      const errorMsg = error.message || String(error);
      logs.push({ type: 'error', content: errorMsg, timestamp: new Date() });
      return logs;
    }
  }, [loadPyodide]);

  const runBackend = useCallback(async (code: string, language: 'cpp' | 'java'): Promise<OutputLine[]> => {
    const logs: OutputLine[] = [];
    
    try {
      const { data, error } = await supabase.functions.invoke('run-code', {
        body: { code, language },
      });

      if (error) {
        logs.push({ type: 'error', content: `Backend error: ${error.message}`, timestamp: new Date() });
        return logs;
      }

      if (data.success) {
        if (data.output) {
          data.output.split('\n').forEach((line: string) => {
            logs.push({ type: 'log', content: line, timestamp: new Date() });
          });
        }
        if (data.executionTime !== undefined) {
          logs.push({ type: 'info', content: `⏱ Execution time: ${data.executionTime}ms`, timestamp: new Date() });
        }
      } else {
        logs.push({ type: 'error', content: data.error || 'Unknown error', timestamp: new Date() });
      }

      return logs;
    } catch (err: any) {
      logs.push({ type: 'error', content: `Failed to run code: ${err.message}`, timestamp: new Date() });
      return logs;
    }
  }, []);

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
          addOutput('info', `🔧 Compiling ${language.toUpperCase()} on server...`);
          logs = await runBackend(code, language);
          break;
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
  }, [clearOutput, addOutput, runJavaScript, runPython, runBackend]);

  return {
    status,
    output,
    runCode,
    clearOutput,
  };
}
