"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Loader2,
  Briefcase,
  Wifi,
  TrendingUp,
  Building2,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  SlidersHorizontal,
  X,
  Sparkles,
  Zap,
  Clock,
  ChevronRight,
} from "lucide-react";
import type { CVProfile } from "@/types/cv";
import type { JobMatch } from "@/types/job";
import { Button } from "@/components/ui/button";
import { CVUploadZone } from "@/components/CVUploadZone";
import { CVProfilePanel } from "@/components/CVProfilePanel";
import { JobCard } from "@/components/JobCard";
import { SkeletonJobCard } from "@/components/SkeletonJobCard";
import { EmptyJobs } from "@/components/EmptyJobs";
import { TermsEditor } from "@/components/TermsEditor";
import { NoAISearchForm } from "@/components/NoAISearchForm";

type Status = "idle" | "analyzing" | "searching" | "ready" | "error";
type Mode = "ai" | "noai";

const SOURCES = ["all", "linkedin", "indeed", "computrabajo", "magneto"] as const;
const FILTER_MODES = ["all", "remote", "hybrid", "onsite"] as const;
const SOURCE_LABELS: Record<string, string> = {
  all: "Todas", linkedin: "LinkedIn", indeed: "Indeed",
  computrabajo: "Computrabajo", magneto: "Magneto",
};
const MODE_LABELS: Record<string, string> = {
  all: "Todas", remote: "Remoto", hybrid: "Híbrido", onsite: "Presencial",
};

// Synonym map for common Colombian roles — expands search coverage without AI
const ROLE_SYNONYMS: Record<string, string[]> = {
  "soporte ti": ["Soporte Técnico", "Helpdesk", "Mesa de Ayuda"],
  "soporte técnico": ["Soporte TI", "Helpdesk", "Técnico de Soporte"],
  "helpdesk": ["Soporte TI", "Mesa de Ayuda", "Técnico de Soporte"],
  "desarrollador web": ["Desarrollador Frontend", "Web Developer", "Programador Web"],
  "desarrollador frontend": ["Frontend Developer", "Desarrollador Web", "Programador Frontend"],
  "desarrollador backend": ["Backend Developer", "Programador Backend", "Desarrollador Java"],
  "desarrollador": ["Programador", "Developer", "Ingeniero de Software"],
  "programador": ["Desarrollador", "Developer", "Ingeniero de Software"],
  "analista de datos": ["Data Analyst", "Analista BI", "Científico de Datos"],
  "data analyst": ["Analista de Datos", "Analista BI", "Business Analyst"],
  "diseñador ui": ["Diseñador UX", "UI/UX Designer", "Diseñador Gráfico"],
  "diseñador ux": ["Diseñador UI", "UX Designer", "Diseñador de Producto"],
  "administrador de redes": ["Network Administrator", "Administrador de Sistemas", "Sysadmin"],
  "devops": ["DevOps Engineer", "Ingeniero DevOps", "SRE"],
  "qa": ["Tester", "QA Engineer", "Analista de Calidad", "QA Tester"],
  "tester": ["QA", "QA Engineer", "Analista de Pruebas"],
  "analista": ["Analista de Sistemas", "Analista Funcional", "Business Analyst"],
  "coordinador": ["Líder", "Jefe", "Supervisor"],
  "auxiliar": ["Asistente", "Apoyo", "Técnico"],
};

export interface SearchRecord {
  jobTitle: string;
  city: string;
  terms: string[];
  date: string;
}

function buildNoAITerms(jobTitle: string, city: string, detectedLocation: string): string[] {
  const title = jobTitle.trim();
  const loc = city.trim() || detectedLocation;
  if (!title) return [];

  const terms = new Set<string>();
  terms.add(title);
  if (loc) terms.add(`${title} ${loc}`);

  // Seniority variants
  if (!/(senior|junior|semi)/i.test(title)) {
    terms.add(`${title} Junior`);
    terms.add(`${title} Senior`);
    if (loc) {
      terms.add(`${title} Junior ${loc}`);
    }
  }

  // Synonym expansion — pick top 2 synonyms to add diversity without bloat
  const titleLower = title.toLowerCase();
  for (const [key, synonyms] of Object.entries(ROLE_SYNONYMS)) {
    if (titleLower.includes(key) || key.includes(titleLower)) {
      for (const syn of synonyms.slice(0, 2)) {
        terms.add(syn);
        if (loc) terms.add(`${syn} ${loc}`);
      }
      break; // one synonym group is enough
    }
  }

  return [...terms].slice(0, 8);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "justo ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const LS_PREFS = "noai-prefs";
const LS_HISTORY = "noai-history";

export default function Home() {
  const [mode, setMode] = useState<Mode>("ai");
  const [status, setStatus] = useState<Status>("idle");
  const [profile, setProfile] = useState<CVProfile | null>(null);
  const [terms, setTerms] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>();
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters] = useState({ source: "all", mode: "all", city: "" });
  const [showCityInput, setShowCityInput] = useState(false);

  // No-AI specific fields
  const [noAIJobTitle, setNoAIJobTitle] = useState("");
  const [noAICity, setNoAICity] = useState("");

  // Search history (last 5 searches in Sin IA mode)
  const [searchHistory, setSearchHistory] = useState<SearchRecord[]>([]);

  // Auto-search debounce countdown (null = not counting, 0 = firing)
  const [autoSearchCountdown, setAutoSearchCountdown] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load localStorage prefs on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const prefs = JSON.parse(localStorage.getItem(LS_PREFS) ?? "{}");
      if (prefs.jobTitle) setNoAIJobTitle(prefs.jobTitle);
      if (prefs.city) setNoAICity(prefs.city);
      const hist = JSON.parse(localStorage.getItem(LS_HISTORY) ?? "[]");
      if (Array.isArray(hist)) setSearchHistory(hist);
    } catch {
      // ignore malformed JSON
    }
  }, []);

  // Persist prefs whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_PREFS, JSON.stringify({ jobTitle: noAIJobTitle, city: noAICity }));
  }, [noAIJobTitle, noAICity]);

  // Rebuild terms whenever the manual fields change (no-AI mode only)
  useEffect(() => {
    if (mode !== "noai") return;
    const detectedLoc = profile?.location ?? "";
    const generated = buildNoAITerms(noAIJobTitle, noAICity, detectedLoc);
    setTerms(generated);
  }, [mode, noAIJobTitle, noAICity, profile]);

  const stats = useMemo(() => {
    const total = jobs.length;
    const remote = jobs.filter((j) => `${j.location} ${j.modality}`.toLowerCase().match(/remot/)).length;
    const avgScore = total > 0 ? Math.round(jobs.reduce((a, j) => a + (j.matchScore ?? 0), 0) / total) : 0;
    const sources = new Set(jobs.map((j) => j.source)).size;
    return { total, remote, avgScore, sources };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (filters.source !== "all" && job.source !== filters.source) return false;
      const loc = `${job.location} ${job.modality ?? ""}`.toLowerCase();
      if (filters.mode === "remote" && !loc.match(/remot/)) return false;
      if (filters.mode === "hybrid" && !loc.includes("hibrid")) return false;
      if (filters.mode === "onsite" && loc.match(/remot/)) return false;
      if (filters.city && !job.location.toLowerCase().includes(filters.city.toLowerCase())) return false;
      return true;
    });
  }, [jobs, filters]);

  const isSearching = status === "searching";
  const isAnalyzing = status === "analyzing";
  const isNoAI = mode === "noai";
  const canSearch =
    (profile !== null || isNoAI) &&
    terms.length > 0 &&
    !isSearching &&
    !isAnalyzing &&
    (isNoAI ? noAIJobTitle.trim().length > 0 : true);

  // Core search function — accepts explicit overrides so it can be called immediately
  // after setState without waiting for React to flush the new state values.
  const runSearch = useCallback(async (opts: {
    terms?: string[];
    jobTitle?: string;
    city?: string;
  } = {}) => {
    const activeTerms = opts.terms ?? terms;
    const activeJobTitle = opts.jobTitle !== undefined ? opts.jobTitle : noAIJobTitle;
    const activeCity = opts.city !== undefined ? opts.city : noAICity;

    if (mode === "noai" && !activeJobTitle.trim()) {
      setError("Escribe el cargo que estás buscando.");
      return;
    }
    if (!activeTerms.length) {
      setError("Agrega al menos un término de búsqueda.");
      return;
    }
    setStatus("searching");
    setError(null);

    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        terms: activeTerms,
        mode,
        ...(isNoAI && activeCity.trim() ? { location: activeCity.trim() } : {}),
        ...(isNoAI && activeJobTitle.trim() ? { jobTitle: activeJobTitle.trim() } : {}),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        setError(data?.error || "Búsqueda en progreso.");
        setStatus("ready");
        return;
      }
      setError(data?.error || "Error en la búsqueda.");
      setStatus("error");
      return;
    }

    setJobs(data.jobs ?? []);
    setHasSearched(true);
    setStatus("ready");

    // Save to history in Sin IA mode
    if (isNoAI && activeJobTitle.trim()) {
      const record: SearchRecord = {
        jobTitle: activeJobTitle.trim(),
        city: activeCity.trim(),
        terms: activeTerms,
        date: new Date().toISOString(),
      };
      setSearchHistory((prev) => {
        const deduped = prev.filter(
          (h) => !(h.jobTitle === record.jobTitle && h.city === record.city)
        );
        const next = [record, ...deduped].slice(0, 5);
        localStorage.setItem(LS_HISTORY, JSON.stringify(next));
        return next;
      });
    }
  }, [mode, noAIJobTitle, noAICity, isNoAI, terms]);

  // Auto-search: 3-second debounce after job title or city change in noAI mode
  useEffect(() => {
    if (mode !== "noai") return;
    if (!noAIJobTitle.trim() || noAIJobTitle.trim().length < 3) {
      // cancel any pending auto-search
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setAutoSearchCountdown(null);
      return;
    }
    // Don't auto-fire while already searching
    if (isSearching || isAnalyzing) return;

    const DELAY = 3;
    setAutoSearchCountdown(DELAY);

    if (countdownRef.current) clearInterval(countdownRef.current);
    let remaining = DELAY;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setAutoSearchCountdown(remaining);
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    }, 1000);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setAutoSearchCountdown(null);
      // re-compute terms at fire time so we have the freshest values
      const detectedLoc = profile?.location ?? "";
      const freshTerms = buildNoAITerms(noAIJobTitle, noAICity, detectedLoc);
      runSearch({ terms: freshTerms });
    }, DELAY * 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noAIJobTitle, noAICity, mode]);

  function cancelAutoSearch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setAutoSearchCountdown(null);
  }

  async function handleUpload(file: File) {
    setStatus("analyzing");
    setError(null);
    setFileName(file.name);
    const formData = new FormData();
    formData.append("file", file);

    const endpoint = mode === "ai" ? "/api/cv/upload" : "/api/cv/parse";
    const res = await fetch(endpoint, { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      setError(data?.error || "Error al analizar el CV.");
      setStatus("error");
      return;
    }

    setProfile(data.profile);

    if (mode === "noai") {
      // Auto-populate from CV — purely regex-based, no API key needed
      const detectedRole: string = data.profile?.targetRoles?.[0] ?? "";
      const detectedCity: string = data.profile?.location ?? "";
      const serverTerms: string[] = data.terms ?? [];

      // Fill fields from CV (respect anything the user already typed)
      if (detectedRole && !noAIJobTitle) setNoAIJobTitle(detectedRole);
      if (detectedCity && !noAICity) setNoAICity(detectedCity);
      if (serverTerms.length) setTerms(serverTerms);

      setStatus("ready");

      // Auto-launch search immediately — no button click needed
      const launchTitle = detectedRole || noAIJobTitle;
      const launchCity = detectedCity || noAICity;
      const launchTerms = serverTerms.length
        ? serverTerms
        : buildNoAITerms(launchTitle, launchCity, "");

      if (launchTitle && launchTerms.length) {
        cancelAutoSearch();
        setTimeout(() => {
          runSearch({ terms: launchTerms, jobTitle: launchTitle, city: launchCity });
        }, 80);
      }
    } else {
      setTerms(data.terms ?? []);
      setStatus("ready");
    }
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    cancelAutoSearch();
    setMode(next);
    setStatus("idle");
    setProfile(null);
    setTerms([]);
    setJobs([]);
    setError(null);
    setFileName(undefined);
    setHasSearched(false);
    if (next === "noai") {
      // Restore persisted prefs when switching to noAI
      try {
        const prefs = JSON.parse(localStorage.getItem(LS_PREFS) ?? "{}");
        if (prefs.jobTitle) setNoAIJobTitle(prefs.jobTitle);
        if (prefs.city) setNoAICity(prefs.city);
      } catch {/* ignore */}
    } else {
      setNoAIJobTitle("");
      setNoAICity("");
    }
  }

  function applyHistoryEntry(entry: SearchRecord) {
    cancelAutoSearch();
    setNoAIJobTitle(entry.jobTitle);
    setNoAICity(entry.city);
    setTerms(entry.terms);
    setStatus("idle");
    setJobs([]);
    setHasSearched(false);
    setError(null);
    // Immediately run the search with saved terms
    setTimeout(() => runSearch({ terms: entry.terms, jobTitle: entry.jobTitle, city: entry.city }), 50);
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-white/6 bg-ink-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-neon-500 to-tide-500">
              <Briefcase className="h-3.5 w-3.5 text-ink-950" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">Job Agent</span>

            {/* Mode toggle */}
            <div className="ml-3 flex items-center rounded-full border border-white/10 bg-white/5 p-0.5">
              <button
                onClick={() => switchMode("ai")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  mode === "ai" ? "bg-neon-500 text-ink-950" : "text-white/40 hover:text-white/70"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                Con IA
              </button>
              <button
                onClick={() => switchMode("noai")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  mode === "noai" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                <Zap className="h-3 w-3" />
                Sin IA
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {jobs.length > 0 && (
              <div className="flex items-center gap-1.5">
                <a
                  href="/api/jobs/export?format=xlsx"
                  title="Exportar a Excel"
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:border-emerald-500/50 hover:bg-emerald-500/15"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </a>
                <a
                  href="/api/jobs/export?format=pdf"
                  title="Exportar a PDF"
                  className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/8 px-3 py-1.5 text-xs font-medium text-rose-400 transition hover:border-rose-500/50 hover:bg-rose-500/15"
                >
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </a>
              </div>
            )}
            {(profile || hasSearched) && (
              <Button variant="secondary" size="sm" onClick={() => switchMode(mode)} className="gap-1.5">
                <RefreshCw className="h-3 w-3" />
                Reiniciar
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-5 py-6">
        {/* Left sidebar */}
        <aside className="hidden w-72 flex-shrink-0 space-y-4 lg:block">
          <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-white/80">Tu CV</h2>
              <p className="text-xs text-white/35">
                {isNoAI ? "Extrae cargo y ciudad automáticamente" : "Analizado con GPT-4o-mini"}
              </p>
            </div>

            <CVUploadZone
              onUpload={(f) => handleUpload(f).catch(() => undefined)}
              isAnalyzing={isAnalyzing}
              isReady={status === "ready" || isSearching}
              fileName={fileName}
              isNoAI={isNoAI}
            />

            {/* No-AI: manual job title + city form */}
            <AnimatePresence>
              {isNoAI && (
                <motion.div
                  key="noai-form"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-4"
                >
                  <NoAISearchForm
                    jobTitle={noAIJobTitle}
                    city={noAICity}
                    onJobTitleChange={(v) => { cancelAutoSearch(); setNoAIJobTitle(v); }}
                    onCityChange={(v) => { cancelAutoSearch(); setNoAICity(v); }}
                  />
                  {terms.length > 0 && (
                    <TermsEditor terms={terms} onChange={setTerms} />
                  )}

                  {/* Auto-search countdown */}
                  <AnimatePresence>
                    {autoSearchCountdown !== null && !isSearching && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <motion.div
                            key={autoSearchCountdown}
                            initial={{ scale: 1.3 }}
                            animate={{ scale: 1 }}
                            className="flex h-5 w-5 items-center justify-center rounded-full bg-neon-500/20 text-xs font-bold text-neon-400"
                          >
                            {autoSearchCountdown}
                          </motion.div>
                          <span className="text-xs text-white/40">Buscando automáticamente…</span>
                        </div>
                        <button onClick={cancelAutoSearch} className="text-white/30 hover:text-white/60 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Manual search button */}
                  <Button
                    onClick={() => { cancelAutoSearch(); runSearch(); }}
                    disabled={!canSearch}
                    className="w-full gap-2"
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {isSearching ? "Buscando…" : "Buscar ahora"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Search history — Sin IA only */}
          <AnimatePresence>
            {isNoAI && searchHistory.length > 0 && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-white/30" />
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                    Últimas búsquedas
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {searchHistory.map((entry, i) => (
                    <motion.button
                      key={i}
                      onClick={() => applyHistoryEntry(entry)}
                      disabled={isSearching}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group flex w-full items-center justify-between rounded-xl border border-white/6 bg-white/3 px-3 py-2.5 text-left transition-all hover:border-white/15 hover:bg-white/6 disabled:opacity-40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white/80 group-hover:text-white">
                          {entry.jobTitle}
                        </p>
                        <p className="text-xs text-white/35">
                          {entry.city || "Sin ciudad"} · {timeAgo(entry.date)}
                        </p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-white/20 group-hover:text-white/50 transition-colors" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {profile && <CVProfilePanel profile={profile} terms={isNoAI ? [] : terms} />}
          </AnimatePresence>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 space-y-5">
          {/* Hero / CTA */}
          {!hasSearched && !isSearching && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-6 ${
                isNoAI
                  ? "border-white/8 bg-gradient-to-br from-white/4 to-white/2"
                  : "border-white/8 bg-gradient-to-br from-neon-500/6 to-tide-500/4"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${isNoAI ? "bg-white/10" : "bg-neon-500/15"}`}>
                  {isNoAI ? <Zap className="h-4 w-4 text-white/60" /> : <Sparkles className="h-4 w-4 text-neon-400" />}
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white md:text-2xl">
                    {isNoAI ? "Búsqueda autónoma" : "Búsqueda con IA"}
                  </h1>
                  <p className="mt-0.5 text-sm text-white/40">
                    {isNoAI
                      ? "Sube tu CV y la búsqueda inicia sola — o escribe el cargo manualmente. Sin API key."
                      : "Sube tu CV y GPT-4o-mini analiza tu perfil y genera los términos de búsqueda."}
                  </p>
                </div>
              </div>

              {/* Mobile: upload + no-AI form */}
              <div className="mt-4 lg:hidden space-y-3">
                <CVUploadZone
                  onUpload={(f) => handleUpload(f).catch(() => undefined)}
                  isAnalyzing={isAnalyzing}
                  isReady={status === "ready"}
                  fileName={fileName}
                />
                {isNoAI && (
                  <>
                    <NoAISearchForm
                      jobTitle={noAIJobTitle}
                      city={noAICity}
                      onJobTitleChange={(v) => { cancelAutoSearch(); setNoAIJobTitle(v); }}
                      onCityChange={(v) => { cancelAutoSearch(); setNoAICity(v); }}
                    />
                    {terms.length > 0 && <TermsEditor terms={terms} onChange={setTerms} />}
                  </>
                )}
                {error && <p className="text-xs text-red-400">{error}</p>}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!isNoAI && (
                  <Button
                    onClick={() => runSearch()}
                    disabled={!canSearch}
                    size="lg"
                    className="gap-2"
                  >
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {isSearching ? "Buscando…" : "Buscar vacantes"}
                  </Button>
                )}
                {!isNoAI && !profile && <p className="text-xs text-white/30">Primero sube tu CV →</p>}
                {isNoAI && !noAIJobTitle.trim() && (
                  <p className="text-xs text-white/30">Escribe el cargo en el panel izquierdo →</p>
                )}
                {isNoAI && noAIJobTitle.trim() && autoSearchCountdown !== null && (
                  <div className="flex items-center gap-2">
                    <motion.div
                      key={autoSearchCountdown}
                      initial={{ scale: 1.3 }}
                      animate={{ scale: 1 }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white/60"
                    >
                      {autoSearchCountdown}
                    </motion.div>
                    <span className="text-xs text-white/40">Iniciando búsqueda…</span>
                    <button onClick={cancelAutoSearch} className="text-xs text-white/30 hover:text-white/60 underline">
                      cancelar
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Stats bar */}
          <AnimatePresence>
            {(hasSearched || isSearching) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                {[
                  { icon: <Briefcase className="h-4 w-4" />, label: "Vacantes", value: isSearching ? "—" : stats.total.toString(), color: "neon" },
                  { icon: <Wifi className="h-4 w-4" />, label: "Remotas", value: isSearching ? "—" : stats.remote.toString(), color: "tide" },
                  { icon: <TrendingUp className="h-4 w-4" />, label: "Score prom.", value: isSearching ? "—" : (stats.avgScore > 0 ? `${stats.avgScore}%` : "N/A"), color: "violet" },
                  { icon: <Building2 className="h-4 w-4" />, label: "Fuentes", value: isSearching ? "—" : stats.sources.toString(), color: "orange" },
                ].map((s) => <StatCard key={s.label} {...s} />)}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filters */}
          {(hasSearched || isSearching) && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap gap-1.5">
                {SOURCES.map((src) => (
                  <button
                    key={src}
                    onClick={() => setFilters((p) => ({ ...p, source: src }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      filters.source === src ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {SOURCE_LABELS[src]}
                  </button>
                ))}
              </div>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex flex-wrap gap-1.5">
                {FILTER_MODES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setFilters((p) => ({ ...p, mode: m }))}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                      filters.mode === m ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {MODE_LABELS[m]}
                  </button>
                ))}
              </div>
              <div className="h-4 w-px bg-white/10 hidden sm:block" />
              <div className="flex items-center gap-1.5">
                {showCityInput ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      placeholder="Ciudad…"
                      value={filters.city}
                      onChange={(e) => setFilters((p) => ({ ...p, city: e.target.value }))}
                      className="w-28 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white placeholder-white/30 outline-none focus:border-white/30"
                    />
                    <button onClick={() => { setFilters((p) => ({ ...p, city: "" })); setShowCityInput(false); }}>
                      <X className="h-3.5 w-3.5 text-white/40 hover:text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCityInput(true)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white/40 hover:text-white/70 transition-all"
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Ciudad
                  </button>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {filteredJobs.length > 0 && (
                  <span className="text-xs text-white/30">{filteredJobs.length} resultados</span>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => runSearch()}
                  disabled={!canSearch}
                  className="gap-1.5"
                >
                  {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  {isSearching ? "Buscando…" : "Nueva búsqueda"}
                </Button>
              </div>
            </div>
          )}

          {/* Job list */}
          <div className="space-y-2.5">
            {isSearching ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonJobCard key={i} />)
            ) : filteredJobs.length > 0 ? (
              filteredJobs.map((job, i) => <JobCard key={job.id} job={job} index={i} />)
            ) : (
              <EmptyJobs hasSearched={hasSearched} hasProfile={Boolean(profile)} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    neon: "text-neon-400", tide: "text-tide-400", violet: "text-violet-400", orange: "text-orange-400",
  };
  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
      <div className={`mb-2 ${colorMap[color] ?? "text-white/40"}`}>{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/40">{label}</p>
    </div>
  );
}
