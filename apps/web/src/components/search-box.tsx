import { cn } from "@btc/ui";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/home/icons";

/** Search input that navigates to /search?q=… on submit. */
export function SearchBox({
  defaultValue = "",
  autoFocus = false,
  className,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState(defaultValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (query) navigate({ to: "/search", search: { q: query } });
      }}
      className={cn(
        "flex h-11 items-center gap-2.5 rounded-[140px] border border-btc-border bg-btc-surface px-4 text-btc-muted transition-colors focus-within:border-btc-faint",
        className,
      )}
    >
      <SearchIcon className="size-4 shrink-0" />
      <input
        ref={ref}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search videos"
        aria-label="Search videos"
        className="w-full bg-transparent text-[14px] text-btc-text outline-none placeholder:text-btc-muted"
      />
    </form>
  );
}
