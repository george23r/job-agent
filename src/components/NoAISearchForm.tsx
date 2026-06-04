"use client";

import { motion } from "framer-motion";
import { MapPin, Briefcase } from "lucide-react";

const QUICK_ROLES = [
  "Soporte TI",
  "Desarrollador Web",
  "Desarrollador Backend",
  "Desarrollador Frontend",
  "Analista de Datos",
  "QA Tester",
  "DevOps",
  "Administrador de Redes",
  "Diseñador UX",
  "Auxiliar Contable",
  "Coordinador de Proyectos",
  "Analista de Sistemas",
];

interface Props {
  jobTitle: string;
  city: string;
  onJobTitleChange: (v: string) => void;
  onCityChange: (v: string) => void;
}

export function NoAISearchForm({ jobTitle, city, onJobTitleChange, onCityChange }: Props) {
  const available = QUICK_ROLES.filter(
    (r) => r.toLowerCase() !== jobTitle.toLowerCase()
  ).slice(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
        ¿Qué buscas?
      </p>

      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 focus-within:border-white/25 transition-colors">
          <Briefcase className="h-4 w-4 flex-shrink-0 text-white/30" />
          <input
            value={jobTitle}
            onChange={(e) => onJobTitleChange(e.target.value)}
            placeholder="Cargo (ej: Soporte TI)"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2.5 focus-within:border-white/25 transition-colors">
          <MapPin className="h-4 w-4 flex-shrink-0 text-white/30" />
          <input
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="Ciudad (ej: Cali, Bogotá)"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
          />
        </div>
      </div>

      {/* Quick-pick role chips */}
      {available.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-white/25">Sugerencias rápidas</p>
          <div className="flex flex-wrap gap-1.5">
            {available.map((role) => (
              <motion.button
                key={role}
                onClick={() => onJobTitleChange(role)}
                whileTap={{ scale: 0.95 }}
                className="rounded-full border border-white/8 bg-white/4 px-2.5 py-1 text-xs text-white/50 transition-all hover:border-white/20 hover:bg-white/8 hover:text-white/80"
              >
                {role}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
