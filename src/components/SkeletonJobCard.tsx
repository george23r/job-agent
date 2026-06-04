export function SkeletonJobCard() {
  return (
    <div className="flex gap-4 rounded-2xl border border-white/8 bg-white/4 p-5">
      <div className="h-10 w-10 flex-shrink-0 animate-pulse rounded-xl bg-white/8" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded-lg bg-white/8" />
        <div className="h-3 w-1/3 animate-pulse rounded-lg bg-white/5" />
        <div className="flex gap-2">
          <div className="h-3 w-20 animate-pulse rounded-full bg-white/5" />
          <div className="h-3 w-16 animate-pulse rounded-full bg-white/5" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="h-12 w-12 animate-pulse rounded-full bg-white/5" />
        <div className="h-6 w-12 animate-pulse rounded-full bg-white/5" />
      </div>
    </div>
  );
}
