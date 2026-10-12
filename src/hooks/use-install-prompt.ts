import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Chrome/Edge/Android "Install app" prompt. `canInstall` is false once installed or where unsupported (iOS: use Share → Add to Home Screen). */
export function useInstallPrompt() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return {
    canInstall: evt !== null,
    install: async () => {
      if (!evt) return;
      await evt.prompt();
      await evt.userChoice.catch(() => null);
      setEvt(null);
    },
  };
}
