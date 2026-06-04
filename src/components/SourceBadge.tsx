import type { JobSource } from "@/types/job";

const SOURCE_CONFIG: Record<JobSource, { label: string; classes: string }> = {
  linkedin: {
    label: "LinkedIn",
    classes: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  indeed: {
    label: "Indeed",
    classes: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  },
  computrabajo: {
    label: "Computrabajo",
    classes: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  magneto: {
    label: "Magneto",
    classes: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
};

export function SourceBadge({ source }: { source: JobSource }) {
  const cfg = SOURCE_CONFIG[source] ?? {
    label: source,
    classes: "bg-white/10 text-white/60 border-white/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.classes}`}
    >
      {cfg.label}
    </span>
  );
}
