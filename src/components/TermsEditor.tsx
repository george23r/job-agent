"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus } from "lucide-react";

interface Props {
  terms: string[];
  onChange: (terms: string[]) => void;
}

export function TermsEditor({ terms, onChange }: Props) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function addTerm(value: string) {
    const trimmed = value.trim();
    if (!trimmed || terms.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onChange([...terms, trimmed]);
    setInputValue("");
  }

  function removeTerm(term: string) {
    onChange(terms.filter((t) => t !== term));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTerm(inputValue);
    }
    if (e.key === "Backspace" && !inputValue && terms.length > 0) {
      removeTerm(terms[terms.length - 1]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Términos de búsqueda
        </span>
        <span className="text-xs text-white/25">{terms.length} términos</span>
      </div>

      <div
        className="flex min-h-[72px] flex-wrap gap-2 rounded-xl border border-white/10 bg-white/4 p-3 focus-within:border-white/25 transition-colors cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <AnimatePresence initial={false}>
          {terms.map((term) => (
            <motion.span
              key={term}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-neon-500/25 bg-neon-500/10 px-2.5 py-1 text-xs font-medium text-neon-400"
            >
              {term}
              <button
                onClick={(e) => { e.stopPropagation(); removeTerm(term); }}
                className="rounded-full p-0.5 text-neon-400/50 hover:text-neon-400 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>

        <input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (inputValue.trim()) addTerm(inputValue); }}
          placeholder={terms.length === 0 ? "Escribe un término y presiona Enter…" : "Agregar…"}
          className="min-w-[120px] flex-1 bg-transparent text-xs text-white placeholder-white/25 outline-none"
        />
      </div>

      <p className="text-[11px] text-white/25">
        Presiona <kbd className="rounded border border-white/15 bg-white/5 px-1 py-0.5 font-mono text-[10px]">Enter</kbd> o <kbd className="rounded border border-white/15 bg-white/5 px-1 py-0.5 font-mono text-[10px]">coma</kbd> para agregar. Clic en <X className="inline h-2.5 w-2.5" /> para quitar.
      </p>
    </div>
  );
}
