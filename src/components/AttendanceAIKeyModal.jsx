import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Sparkles, X, Check, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { AttendanceAIService } from '../services/AttendanceAIService';

export default function AttendanceAIKeyModal({
  isOpen,
  onClose,
  onKeySaved,
  errorMessage = ''
}) {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      AttendanceAIService.getGeminiApiKey().then((saved) => {
        if (saved) setApiKey(saved);
      });
    }
  }, [isOpen]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!apiKey || apiKey.trim().length < 15) {
      setError('Please enter a valid Gemini API Key (typically 39 characters starting with AIza...).');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await AttendanceAIService.saveGeminiApiKey(apiKey.trim());
      onKeySaved(apiKey.trim());
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save API Key.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
              <Key size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight flex items-center gap-1.5">
                AI Scanner Setup
                <span className="text-[10px] font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20">
                  Required Once
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Google Gemini Vision Configuration</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 text-xs text-slate-300 space-y-2">
            <p className="font-medium text-slate-200 flex items-center gap-1.5">
              <Sparkles size={14} className="text-brand-400" />
              Why is this needed?
            </p>
            <p className="leading-relaxed text-slate-400">
              The server edge function returned a non-2xx status code (not deployed or missing server key on Dokploy). You can enable instant client-side AI register scanning by providing a Google Gemini API Key.
            </p>
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300 font-semibold underline underline-offset-2"
            >
              Get a free API Key from Google AI Studio <ExternalLink size={12} />
            </a>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Gemini API Key
            </label>
            <input 
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError('');
              }}
              placeholder="AIzaSy..."
              className="w-full h-11 px-3.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              autoFocus
            />
            {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !apiKey.trim()}
              className="flex-1 bg-brand-600 hover:bg-brand-500 text-white font-bold h-11 shadow-lg shadow-brand-900/30"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Check size={16} className="mr-1.5" />}
              Save & Scan
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
