import { useEffect, useState } from "react";

/**
 * Renders the current year on the client. Keeps the footer copyright current
 * without reading the dynamic `Date` API during server render, which would make
 * the SSR output non-deterministic / uncacheable.
 */
export function CurrentYear() {
  const [year, setYear] = useState<number | null>(null);
  useEffect(() => setYear(new Date().getFullYear()), []);
  return <>{year ?? ""}</>;
}
