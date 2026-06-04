"use client";

import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";

interface Props {
  hasSearched: boolean;
  hasProfile: boolean;
}

export function EmptyJobs({ hasSearched, hasProfile }: Props) {
  const message = !hasProfile
    ? { title: "Sube tu CV para empezar", sub: "El agente analizará tu perfil y generará términos de búsqueda personalizados." }
    : !hasSearched
    ? { title: "Listo para buscar", sub: "Haz clic en 'Buscar vacantes' para iniciar la búsqueda en LinkedIn, Indeed, Computrabajo y Magneto." }
    : { title: "Sin resultados con estos filtros", sub: "Intenta cambiar los filtros o ejecuta una nueva búsqueda." };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/12 bg-white/2 py-16 px-8 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <Briefcase className="h-6 w-6 text-white/30" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-white/70">{message.title}</p>
        <p className="max-w-xs text-xs text-white/35">{message.sub}</p>
      </div>
    </motion.div>
  );
}
