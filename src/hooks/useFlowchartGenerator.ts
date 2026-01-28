import { useState, useCallback, useRef, useEffect } from 'react';
import { Language } from '@/types/editor';

export interface FlowchartNode {
  id: string;
  type: 'start' | 'end' | 'process' | 'decision' | 'loop' | 'function' | 'input' | 'output';
  label: string;
  lineNumber?: number;
  children: string[];
  x?: number;
  y?: number;
}

export interface FlowchartData {
  nodes: FlowchartNode[];
  svg: string;
  error?: string;
}

declare global {
  interface Window {
    js2flowchart?: {
      convertCodeToFlowTree: (code: string) => any;
      convertFlowTreeToSvg: (flowTree: any) => string;
    };
  }
}

export function useFlowchartGenerator() {
  const [flowchartData, setFlowchartData] = useState<FlowchartData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const scriptLoadedRef = useRef(false);

  // Load js2flowchart library
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    
    const existingScript = document.querySelector('script[src*="js2flowchart"]');
    if (existingScript) {
      scriptLoadedRef.current = true;
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/js2flowchart@1.3.4/dist/js2flowchart.min.js';
    script.async = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
    };
    document.head.appendChild(script);

    return () => {
      // Don't remove script on cleanup
    };
  }, []);

  const parseJavaScript = useCallback((code: string): FlowchartData => {
    try {
      if (window.js2flowchart) {
        const flowTree = window.js2flowchart.convertCodeToFlowTree(code);
        const svg = window.js2flowchart.convertFlowTreeToSvg(flowTree);
        
        // Apply dark theme styling to SVG
        const themedSvg = svg
          .replace(/fill="[^"]*"/g, 'fill="hsl(220, 18%, 13%)"')
          .replace(/stroke="[^"]*"/g, 'stroke="hsl(217, 91%, 60%)"')
          .replace(/<text/g, '<text fill="hsl(210, 20%, 95%)"')
          .replace(/style="[^"]*background[^"]*"/gi, 'style="background: hsl(220, 20%, 10%)"');
        
        return { nodes: [], svg: themedSvg };
      }
      
      // Fallback: generate simple flowchart from AST-like analysis
      return generateSimpleFlowchart(code, 'javascript');
    } catch (err) {
      console.error('JS parsing error:', err);
      return generateSimpleFlowchart(code, 'javascript');
    }
  }, []);

  const parsePython = useCallback(async (code: string): Promise<FlowchartData> => {
    try {
      // Use simple regex-based parsing for Python
      return generateSimpleFlowchart(code, 'python');
    } catch (err) {
      console.error('Python parsing error:', err);
      return { nodes: [], svg: '', error: 'Cannot parse Python code' };
    }
  }, []);

  const generateFlowchart = useCallback(async (code: string, language: Language): Promise<void> => {
    if (!code.trim()) {
      setFlowchartData(null);
      setError('No code to generate flowchart from');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      let data: FlowchartData;
      
      if (language === 'python') {
        data = await parsePython(code);
      } else {
        // Use JS parser for JS, and fallback for C++/Java
        data = parseJavaScript(code);
      }
      
      setFlowchartData(data);
      
      if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate flowchart';
      setError(message);
      setFlowchartData({ nodes: [], svg: '', error: message });
    } finally {
      setIsGenerating(false);
    }
  }, [parseJavaScript, parsePython]);

  const generateFlowchartDebounced = useCallback((code: string, language: Language) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      generateFlowchart(code, language);
    }, 500);
  }, [generateFlowchart]);

  const clearFlowchart = useCallback(() => {
    setFlowchartData(null);
    setError(null);
  }, []);

  return {
    flowchartData,
    isGenerating,
    error,
    generateFlowchart,
    generateFlowchartDebounced,
    clearFlowchart,
  };
}

// Simple flowchart generator using regex patterns
function generateSimpleFlowchart(code: string, language: string): FlowchartData {
  const lines = code.split('\n');
  const nodes: FlowchartNode[] = [];
  let nodeId = 0;
  
  // Add start node
  nodes.push({
    id: `node_${nodeId++}`,
    type: 'start',
    label: 'Start',
    children: [],
  });

  const patterns = {
    function: language === 'python' 
      ? /^\s*def\s+(\w+)/
      : /^\s*(?:function|const|let|var)\s+(\w+)\s*(?:=\s*(?:\([^)]*\)\s*=>|\function)|\()/,
    condition: language === 'python'
      ? /^\s*(if|elif|else)\s*/
      : /^\s*(if|else\s*if|else)\s*/,
    loop: language === 'python'
      ? /^\s*(for|while)\s+/
      : /^\s*(for|while|do)\s*/,
    return: /^\s*return\s*/,
    print: language === 'python'
      ? /^\s*print\s*\(/
      : /^\s*console\.(log|error|warn|info)\s*\(/,
    assignment: language === 'python'
      ? /^\s*(\w+)\s*=/
      : /^\s*(?:const|let|var)?\s*(\w+)\s*=/,
  };

  lines.forEach((line, lineNum) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return;

    let node: FlowchartNode | null = null;

    if (patterns.function.test(trimmed)) {
      const match = trimmed.match(patterns.function);
      node = {
        id: `node_${nodeId++}`,
        type: 'function',
        label: `Function: ${match?.[1] || 'anonymous'}`,
        lineNumber: lineNum + 1,
        children: [],
      };
    } else if (patterns.condition.test(trimmed)) {
      const match = trimmed.match(patterns.condition);
      const condition = trimmed.slice(match?.[0].length || 0).replace(/[{:]/g, '').trim();
      node = {
        id: `node_${nodeId++}`,
        type: 'decision',
        label: condition ? `${match?.[1]}: ${condition.slice(0, 30)}` : match?.[1] || 'condition',
        lineNumber: lineNum + 1,
        children: [],
      };
    } else if (patterns.loop.test(trimmed)) {
      const match = trimmed.match(patterns.loop);
      const loopCond = trimmed.slice(match?.[0].length || 0).replace(/[{:]/g, '').trim();
      node = {
        id: `node_${nodeId++}`,
        type: 'loop',
        label: `${match?.[1]}: ${loopCond.slice(0, 25)}`,
        lineNumber: lineNum + 1,
        children: [],
      };
    } else if (patterns.return.test(trimmed)) {
      const value = trimmed.replace(/return\s*/, '').replace(/;/g, '').trim();
      node = {
        id: `node_${nodeId++}`,
        type: 'output',
        label: `Return: ${value.slice(0, 25)}`,
        lineNumber: lineNum + 1,
        children: [],
      };
    } else if (patterns.print.test(trimmed)) {
      node = {
        id: `node_${nodeId++}`,
        type: 'output',
        label: 'Output',
        lineNumber: lineNum + 1,
        children: [],
      };
    }

    if (node) {
      nodes.push(node);
    }
  });

  // Add end node
  nodes.push({
    id: `node_${nodeId++}`,
    type: 'end',
    label: 'End',
    children: [],
  });

  // Link nodes sequentially
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].children.push(nodes[i + 1].id);
  }

  // Generate SVG
  const svg = generateSVG(nodes);
  
  return { nodes, svg };
}

function generateSVG(nodes: FlowchartNode[]): string {
  const nodeHeight = 50;
  const nodeWidth = 180;
  const verticalGap = 30;
  const startX = 50;
  const startY = 30;
  
  let svgContent = '';
  let y = startY;

  nodes.forEach((node, index) => {
    const x = startX;
    node.x = x;
    node.y = y;

    const shape = getNodeShape(node, x, y, nodeWidth, nodeHeight);
    svgContent += shape;

    // Draw arrow to next node
    if (index < nodes.length - 1) {
      const arrowY = y + nodeHeight;
      const nextY = y + nodeHeight + verticalGap;
      svgContent += `
        <line x1="${x + nodeWidth / 2}" y1="${arrowY}" x2="${x + nodeWidth / 2}" y2="${nextY}" 
              stroke="hsl(217, 91%, 60%)" stroke-width="2" marker-end="url(#arrowhead)" />
      `;
    }

    y += nodeHeight + verticalGap;
  });

  const totalHeight = y + 20;
  const totalWidth = nodeWidth + startX * 2 + 50;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" 
         width="100%" height="100%" style="background: hsl(220, 20%, 10%); max-height: 100%;">
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(217, 91%, 60%)" />
        </marker>
      </defs>
      ${svgContent}
    </svg>
  `;
}

function getNodeShape(node: FlowchartNode, x: number, y: number, width: number, height: number): string {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const label = node.label.length > 25 ? node.label.slice(0, 22) + '...' : node.label;
  
  const textStyle = `fill="hsl(210, 20%, 95%)" font-family="Inter, sans-serif" font-size="12" text-anchor="middle" dominant-baseline="middle"`;
  const strokeStyle = `stroke="hsl(217, 91%, 60%)" stroke-width="2" fill="hsl(220, 18%, 13%)"`;
  
  switch (node.type) {
    case 'start':
    case 'end':
      return `
        <ellipse cx="${cx}" cy="${cy}" rx="${width / 2 - 10}" ry="${height / 2 - 5}" ${strokeStyle} 
                 data-line="${node.lineNumber || ''}" class="flowchart-node" />
        <text x="${cx}" y="${cy}" ${textStyle}>${node.type === 'start' ? 'Start' : 'End'}</text>
      `;
    
    case 'decision':
      const halfW = width / 2 - 5;
      const halfH = height / 2;
      return `
        <polygon points="${cx},${y} ${x + width - 5},${cy} ${cx},${y + height} ${x + 5},${cy}" 
                 ${strokeStyle} data-line="${node.lineNumber || ''}" class="flowchart-node" />
        <text x="${cx}" y="${cy}" ${textStyle} font-size="10">${label}</text>
      `;
    
    case 'loop':
      return `
        <rect x="${x + 5}" y="${y}" width="${width - 10}" height="${height}" rx="15" ry="15" 
              ${strokeStyle} data-line="${node.lineNumber || ''}" class="flowchart-node" />
        <text x="${cx}" y="${cy}" ${textStyle}>${label}</text>
      `;
    
    case 'function':
      return `
        <rect x="${x + 5}" y="${y}" width="${width - 10}" height="${height}" 
              ${strokeStyle} data-line="${node.lineNumber || ''}" class="flowchart-node" />
        <line x1="${x + 15}" y1="${y}" x2="${x + 15}" y2="${y + height}" stroke="hsl(217, 91%, 60%)" stroke-width="1" />
        <line x1="${x + width - 15}" y1="${y}" x2="${x + width - 15}" y2="${y + height}" stroke="hsl(217, 91%, 60%)" stroke-width="1" />
        <text x="${cx}" y="${cy}" ${textStyle}>${label}</text>
      `;
    
    case 'input':
      return `
        <polygon points="${x + 15},${y} ${x + width - 5},${y} ${x + width - 15},${y + height} ${x + 5},${y + height}" 
                 ${strokeStyle} data-line="${node.lineNumber || ''}" class="flowchart-node" />
        <text x="${cx}" y="${cy}" ${textStyle}>${label}</text>
      `;
    
    case 'output':
      return `
        <polygon points="${x + 5},${y} ${x + width - 15},${y} ${x + width - 5},${y + height} ${x + 15},${y + height}" 
                 ${strokeStyle.replace('hsl(217, 91%, 60%)', 'hsl(142, 70%, 45%)')} data-line="${node.lineNumber || ''}" class="flowchart-node" />
        <text x="${cx}" y="${cy}" ${textStyle}>${label}</text>
      `;
    
    default: // process
      return `
        <rect x="${x + 5}" y="${y}" width="${width - 10}" height="${height}" rx="3" ry="3" 
              ${strokeStyle} data-line="${node.lineNumber || ''}" class="flowchart-node" />
        <text x="${cx}" y="${cy}" ${textStyle}>${label}</text>
      `;
  }
}
