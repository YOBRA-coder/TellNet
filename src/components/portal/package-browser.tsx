import { Link } from "@tanstack/react-router"; 
import { Smartphone, X } from "lucide-react"; 
import { useEffect, useMemo, useState } from "react"; 
import { PackageCard } from "@/components/portal/package-card"; 
import { cn } from "@/lib/utils"; 
import type { Package } from "@/lib/types"; 

type Filter = "ALL" | "1" | "2"; 
const DISMISS_KEY = "telnet.guestPromptDismissed"; 

/** 
 * Packages with a small tab bar on top (All / 1 device / 2 devices) and, for 
 * guests, a short "create a free account" prompt. 
 */ 
export function PackageBrowser({ 
  packages, 
  currency, 
  registered, 
  requireAccountForMulti, 
  rewardsOn, 
}: { 
  packages: Package[]; 
  currency: string; 
  /** true = signed in with an account; false = guest; null = still loading (no prompt, no locks) */ 
  registered: boolean | null; 
  requireAccountForMulti: boolean; 
  rewardsOn: boolean; 
}) { 
  const [filter, setFilter] = useState<Filter>("ALL"); 
  const [dismissed, setDismissed] = useState(true); // hidden until we know (avoids a flash) 

  useEffect(() => { 
    try { 
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1"); 
    } catch { 
      setDismissed(false); 
    } 
  }, []); 

  // Memoized package filtering so data only updates when packages change
  const single = useMemo(() => packages.filter((p) => p.maxDevices <= 1), [packages]);
  const multi = useMemo(() => packages.filter((p) => p.maxDevices > 1), [packages]);

  const showTabs = single.length > 0 && multi.length > 0; 

  const shown = useMemo( 
    () => (!showTabs || filter === "ALL" ? packages : filter === "1" ? single : multi), 
    [packages, single, multi, filter, showTabs], 
  ); 

  const known = registered !== null; 
  const lockMulti = known && !registered && requireAccountForMulti; 

  const tabs: [Filter, string, number][] = [ 
    ["ALL", "All", packages.length], 
    ["1", "1 device", single.length], 
    ["2", "2 devices", multi.length], 
  ]; 

  const promptText = 
    lockMulti && rewardsOn 
      ? "Create a free account to unlock 2 devices and referral rewards." 
      : lockMulti 
        ? "Create a free account to unlock 2 devices." 
        : rewardsOn 
          ? "Create a free account to earn loyalty points and referral rewards." 
          : null; 

  return ( 
    <div> 
      {known && !registered && promptText && !dismissed ? ( 
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/5 px-3.5 py-3"> 
          <div className="min-w-0 flex-1"> 
            <p className="text-sm font-medium">{promptText}</p> 
            <div className="mt-2 flex gap-2"> 
              <Link 
                to="/portal/auth" 
                search={{ mode: "signup", ref: "", next: "/portal" }} 
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-bg" 
              > 
                Sign up free 
              </Link> 
              <Link 
                to="/portal/auth" 
                search={{ mode: "signin", ref: "", next: "/portal" }} 
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-fg" 
              > 
                Sign in 
              </Link> 
            </div> 
          </div> 
          <button 
            type="button" 
            aria-label="Dismiss" 
            className="rounded p-1 text-subtle hover:text-fg" 
            onClick={() => { 
              setDismissed(true); 
              try { 
                sessionStorage.setItem(DISMISS_KEY, "1"); 
              } catch { 
                /* ignore */ 
              } 
            }} 
          > 
            <X className="size-4" /> 
          </button> 
        </div> 
      ) : null} 

      {showTabs ? ( 
        <div role="tablist" className="mb-3 flex gap-1 rounded-xl border border-border bg-surface p-1"> 
          {tabs.map(([key, label, n]) => ( 
            <button 
              key={key} 
              role="tab" 
              type="button" 
              aria-selected={filter === key} 
              onClick={() => setFilter(key)} 
              className={cn( 
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition", 
                filter === key ? "bg-accent text-bg" : "text-muted hover:text-fg", 
              )} 
            > 
              {key !== "ALL" ? <Smartphone className="size-3.5" /> : null} 
              {label} 
              <span className={cn("tabular-nums", filter === key ? "opacity-80" : "text-subtle")}>{n}</span> 
            </button> 
          ))} 
        </div> 
      ) : null} 

      {/* Changed layout from 'flex flex-col gap-2' to responsive css grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3"> 
        {shown.map((pkg, i) => ( 
          <PackageCard 
            key={pkg.id} 
            pkg={pkg} 
            currency={currency} 
            maxDevices={pkg.maxDevices} 
            locked={lockMulti && pkg.maxDevices > 1} 
            style={{ animationDelay: `${i * 40}ms` }} 
          /> 
        ))} 
        {shown.length === 0 ? <p className="col-span-full py-6 text-center text-sm text-muted">Loading packages...</p> : null} 
      </div> 
    </div> 
  ); 
}
