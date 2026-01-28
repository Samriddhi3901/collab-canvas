import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, RotateCcw, Download, X, AlertCircle } from 'lucide-react';
import { FlowchartData } from '@/hooks/useFlowchartGenerator';

interface FlowchartPanelProps {
  data: FlowchartData | null;
  error: string | null;
  isGenerating: boolean;
  onClose: () => void;
  onNodeClick?: (lineNumber: number) => void;
}

export function FlowchartPanel({ data, error, isGenerating, onClose, onNodeClick }: FlowchartPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.25, Math.min(3, prev + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle node clicks for code highlighting
  useEffect(() => {
    if (!containerRef.current || !onNodeClick) return;

    const handleNodeClick = (e: Event) => {
      const target = e.target as SVGElement;
      const node = target.closest('.flowchart-node');
      if (node) {
        const lineNumber = node.getAttribute('data-line');
        if (lineNumber) {
          onNodeClick(parseInt(lineNumber, 10));
        }
      }
    };

    const container = containerRef.current;
    container.addEventListener('click', handleNodeClick);
    return () => container.removeEventListener('click', handleNodeClick);
  }, [onNodeClick]);

  const handleExportSVG = useCallback(() => {
    if (!data?.svg) return;
    
    const blob = new Blob([data.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flowchart.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, [data?.svg]);

  const handleExportPNG = useCallback(async () => {
    if (!data?.svg) return;

    const img = new Image();
    const svgBlob = new Blob([data.svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'hsl(220, 20%, 10%)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = 'flowchart.png';
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    
    img.src = url;
  }, [data?.svg]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="h-full flex flex-col bg-card rounded-lg border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="console-header">
        <div className="flex items-center gap-2">
          <span className="text-foreground font-medium">Flowchart</span>
          {isGenerating && (
            <span className="text-xs text-muted-foreground animate-pulse">Generating...</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleZoomOut}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
          </motion.button>
          <span className="text-xs text-muted-foreground min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleZoomIn}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleReset}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
          </motion.button>
          <div className="w-px h-4 bg-border mx-1" />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleExportSVG}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
            title="Export SVG"
            disabled={!data?.svg}
          >
            <Download className="w-4 h-4 text-muted-foreground" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-1.5 rounded hover:bg-destructive/20 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ background: 'hsl(220, 20%, 10%)' }}
      >
        {error && !data?.svg ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center p-6">
              <AlertCircle className="w-12 h-12 text-warning mx-auto mb-3" />
              <p className="text-muted-foreground">{error}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Try simplifying the code structure
              </p>
            </div>
          </div>
        ) : data?.svg ? (
          <div
            className="w-full h-full flex items-start justify-center p-4"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            dangerouslySetInnerHTML={{ __html: data.svg }}
          />
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center p-6">
              <p className="text-muted-foreground">
                Click "Flowchart" to generate a visual representation of your code
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Export options */}
      {data?.svg && (
        <div className="px-4 py-2 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Click nodes to jump to code • Scroll to zoom • Drag to pan
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportSVG}
              className="text-xs text-primary hover:underline"
            >
              Export SVG
            </button>
            <span className="text-muted-foreground">•</span>
            <button
              onClick={handleExportPNG}
              className="text-xs text-primary hover:underline"
            >
              Export PNG
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
