// Loading skeleton for item detail pages — shown while the page chunk loads.
export default function ItemLoading() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-lg overflow-hidden animate-pulse">
        <div className="flex flex-col md:flex-row gap-6 p-6 border-b border-[var(--color-border)]">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-[var(--color-bg-3)] rounded-md shrink-0 mx-auto md:mx-0" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-32 bg-[var(--color-bg-3)] rounded" />
            <div className="h-7 w-2/3 bg-[var(--color-bg-3)] rounded" />
            <div className="h-3 w-full bg-[var(--color-bg-3)] rounded" />
            <div className="h-3 w-3/4 bg-[var(--color-bg-3)] rounded" />
            <div className="flex gap-4 pt-2">
              <div className="h-3 w-16 bg-[var(--color-bg-3)] rounded" />
              <div className="h-3 w-20 bg-[var(--color-bg-3)] rounded" />
              <div className="h-3 w-24 bg-[var(--color-bg-3)] rounded" />
            </div>
          </div>
        </div>
        <div className="p-6 border-b border-[var(--color-border)] grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-[var(--color-bg-3)] rounded mb-3" />
            <div className="h-3 w-full bg-[var(--color-bg-3)] rounded" />
            <div className="h-3 w-5/6 bg-[var(--color-bg-3)] rounded" />
            <div className="h-3 w-4/6 bg-[var(--color-bg-3)] rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-32 bg-[var(--color-bg-3)] rounded mb-3" />
            <div className="h-3 w-full bg-[var(--color-bg-3)] rounded" />
            <div className="h-3 w-5/6 bg-[var(--color-bg-3)] rounded" />
            <div className="h-3 w-3/4 bg-[var(--color-bg-3)] rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
