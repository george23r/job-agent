"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  onUpload: (file: File) => void;
  isAnalyzing: boolean;
  isReady: boolean;
  fileName?: string;
  isNoAI?: boolean;
}

export function CVUploadZone({ onUpload, isAnalyzing, isReady, fileName, isNoAI }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  }

  const state = isAnalyzing ? "analyzing" : isReady ? "ready" : isDragging ? "drag" : "idle";

  return (
    <div
      className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
        state === "drag"
          ? "border-neon-500/60 bg-neon-500/8"
          : state === "ready"
          ? "border-neon-500/30 bg-neon-500/5"
          : state === "analyzing"
          ? "border-tide-500/30 bg-tide-500/5"
          : "border-white/12 bg-white/3 hover:border-white/20 hover:bg-white/5"
      }`}
      onClick={() => !isAnalyzing && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={handleChange}
      />

      <AnimatePresence mode="wait">
        {state === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-2"
          >
            <Loader2 className="h-7 w-7 animate-spin text-tide-400" />
            <p className="text-sm font-medium text-tide-400">
              {isNoAI ? "Extrayendo perfil del CV…" : "Analizando CV con IA…"}
            </p>
            <p className="text-xs text-white/35">
              {isNoAI ? "Detectando cargo y ciudad…" : "GPT-4o-mini extrayendo perfil"}
            </p>
          </motion.div>
        )}
        {state === "ready" && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-2"
          >
            <CheckCircle2 className="h-7 w-7 text-neon-400" />
            <p className="text-sm font-medium text-neon-400">CV analizado</p>
            {fileName && (
              <p className="flex items-center gap-1 text-xs text-white/40">
                <FileText className="h-3 w-3" />
                {fileName}
              </p>
            )}
            <p className="text-xs text-white/30">Clic para subir otro</p>
          </motion.div>
        )}
        {(state === "idle" || state === "drag") && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-2"
          >
            <Upload className={`h-7 w-7 ${state === "drag" ? "text-neon-400" : "text-white/30"}`} />
            <p className="text-sm font-medium text-white/60">
              {state === "drag" ? "Suelta aquí" : "Arrastra tu CV"}
            </p>
            <p className="text-xs text-white/30">
              PDF o DOCX · máx. 10 MB
              {isNoAI && <span className="text-white/20"> · detecta cargo automáticamente</span>}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
