import Topbar from "@/components/Topbar";
import Sidebar from "@/components/Sidebar";

/**
 * Shared shell for every authenticated page (dashboard, journal, analytics,
 * community, etc.) — everything except /login and /owner (which has its own
 * admin shell).
 *
 * This used to be duplicated inside every single page.tsx: each page
 * rendered its own <Topbar />/<Sidebar />, so Next.js had no way to know
 * they were "the same" component across routes — every client-side
 * navigation unmounted and remounted them from scratch. That meant:
 *   - the WebSocket connection tore down and reconnected on every nav
 *   - authStore.initialise() re-ran on every nav (cheap once guarded, but
 *     still enough concurrent-mount timing to race the single-use refresh
 *     token — see authStore.ts)
 *   - every page showed a fresh loading spinner even when its store's data
 *     was already fetched and sitting in memory from the last visit
 *
 * A layout.tsx persists across navigations within the routes it wraps —
 * Next.js only swaps `children`, so Topbar/Sidebar (and the connect() /
 * initialise() calls their effects make) now run once per session instead
 * of once per page.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-canvas text-fg">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {children}
      </div>
    </div>
  );
}
