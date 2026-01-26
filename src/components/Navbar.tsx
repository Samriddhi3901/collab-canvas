import { Code2, Layout, PenTool, Share2, Copy, Check, Eye, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { ViewMode, Language, LANGUAGE_CONFIG } from '@/types/editor';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface NavbarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  roomId: string;
  isViewOnly: boolean;
  connectedUsers?: number;
}

export function Navbar({
  viewMode,
  setViewMode,
  language,
  setLanguage,
  roomId,
  isViewOnly,
  connectedUsers = 1,
}: NavbarProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}?room=${roomId}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.nav 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="navbar px-4 py-3 flex items-center justify-between"
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            CollabCode
          </span>
        </div>

        {isViewOnly && (
          <span className="view-only-badge flex items-center gap-1">
            <Eye className="w-3 h-3" />
            View Only
          </span>
        )}
      </div>

      {/* View Toggles */}
      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setViewMode('split')}
          className={`btn-view ${viewMode === 'split' ? 'btn-view-code' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          <Layout className="w-4 h-4" />
          <span className="hidden sm:inline">Split View</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setViewMode('code')}
          className={`btn-view ${viewMode === 'code' ? 'btn-view-code' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          <Code2 className="w-4 h-4" />
          <span className="hidden sm:inline">Code</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setViewMode('whiteboard')}
          className={`btn-view ${viewMode === 'whiteboard' ? 'btn-view-whiteboard' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
        >
          <PenTool className="w-4 h-4" />
          <span className="hidden sm:inline">Whiteboard</span>
        </motion.button>
      </div>

      {/* Language Selector & Room Info */}
      <div className="flex items-center gap-3">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="language-selector"
          disabled={isViewOnly}
        >
          {Object.entries(LANGUAGE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.label}
            </option>
          ))}
        </select>

        <div className="room-badge">
          <span>Room:</span>
          <code className="text-primary">{roomId}</code>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-success/20 text-success rounded-lg text-sm font-medium">
          <Users className="w-4 h-4" />
          <span>{connectedUsers}</span>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-view-whiteboard"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </motion.button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Share Room</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Share this link with students. They'll have <span className="text-warning font-medium">view-only</span> access to the code and whiteboard in real-time.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="share-input flex-1"
                />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={copyToClipboard}
                  className="btn-view-code"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </motion.button>
              </div>
              <div className="p-3 bg-secondary rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <span className="text-primary font-medium">Room ID:</span>{' '}
                  <code className="bg-background px-2 py-0.5 rounded">{roomId}</code>
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </motion.nav>
  );
}
