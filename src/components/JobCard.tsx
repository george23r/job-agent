"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, MapPin, Clock } from "lucide-react";
import type { JobMatch } from "@/types/job";
import { MatchScoreRing } from "./MatchScoreRing";
import { SourceBadge } from "./SourceBadge";

interface Props {
  job: JobMatch;
  index: number;
}

export function JobCard({ job, index }: Props) {
  const score = job.matchScore ?? 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="group relative flex gap-4 rounded-2xl border border-white/8 bg-white/4 p-5 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/6"
    >
      {/* Left: Company initial avatar */}
      <div className="flex-shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-sm font-bold text-white/60">
          {job.company.charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Center: Content */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white/90 group-hover:text-white">
              {job.title}
            </h3>
            <p className="text-xs text-white/50">{job.company}</p>
          </div>
          <SourceBadge source={job.source} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
          {job.postedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {job.postedAt}
            </span>
          )}
          {job.modality && (
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
              {job.modality}
            </span>
          )}
        </div>

        {job.matchReason && (
          <p className="line-clamp-2 text-xs text-white/40">{job.matchReason}</p>
        )}
      </div>

      {/* Right: Score + Link */}
      <div className="flex flex-shrink-0 flex-col items-end gap-3">
        {score > 0 && <MatchScoreRing score={score} size={48} />}
        <a
          href={job.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          Ver
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </motion.article>
  );
}
