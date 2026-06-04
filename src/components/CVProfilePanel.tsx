"use client";

import { motion } from "framer-motion";
import { User, MapPin, Briefcase, Star, Code2, Globe } from "lucide-react";
import type { CVProfile } from "@/types/cv";

interface Props {
  profile: CVProfile;
  terms: string[];
}

export function CVProfilePanel({ profile, terms }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Hero: name + meta */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neon-500/30 to-tide-500/30 text-lg font-bold text-white">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white">{profile.name}</h2>
            <p className="text-sm text-white/50">{profile.seniority}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat icon={<MapPin className="h-3.5 w-3.5" />} label="Ubicación" value={profile.location || "—"} />
          <Stat icon={<Briefcase className="h-3.5 w-3.5" />} label="Experiencia" value={`${profile.experienceYears} años`} />
        </div>
      </div>

      {/* Skills */}
      {profile.skills.length > 0 && (
        <SkillSection
          icon={<Star className="h-3.5 w-3.5 text-neon-400" />}
          title="Habilidades"
          items={profile.skills}
          color="neon"
        />
      )}

      {/* Technologies */}
      {profile.technologies.length > 0 && (
        <SkillSection
          icon={<Code2 className="h-3.5 w-3.5 text-tide-400" />}
          title="Tecnologías"
          items={profile.technologies}
          color="tide"
        />
      )}

      {/* Languages */}
      {profile.languages.length > 0 && (
        <SkillSection
          icon={<Globe className="h-3.5 w-3.5 text-violet-400" />}
          title="Idiomas"
          items={profile.languages}
          color="violet"
        />
      )}

      {/* Search terms */}
      {terms.length > 0 && (
        <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-white/40" />
            <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Términos de búsqueda
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {terms.slice(0, 12).map((term) => (
              <span
                key={term}
                className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/70"
              >
                {term}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-white/40 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-medium text-white/80 truncate">{value}</p>
    </div>
  );
}

function SkillSection({
  icon,
  title,
  items,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  color: "neon" | "tide" | "violet";
}) {
  const badgeClass = {
    neon: "border-neon-500/25 bg-neon-500/10 text-neon-400",
    tide: "border-tide-500/25 bg-tide-500/10 text-tide-400",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-400",
  }[color];

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {title}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 14).map((item) => (
          <span
            key={item}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
