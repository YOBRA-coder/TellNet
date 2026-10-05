import { useEffect } from "react";

/**
 * Marks <body> while a public (customer) page is on screen so portalled things
 * like toasts can use the glass look there. Admin pages never call this.
 */
export function useGlassBody() {
  useEffect(() => {
    document.body.classList.add("glass-public");
    return () => document.body.classList.remove("glass-public");
  }, []);
}
