import { cn } from "@btc/ui";
import { Badge } from "@btc/ui/components/badge";
import { Button } from "@btc/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@btc/ui/components/card";
import { Spinner } from "@btc/ui/components/spinner";
import { toast } from "@btc/ui/components/toaster";
import { Link } from "@tanstack/react-router";
import {
  Check,
  CircleCheck,
  CircleDashed,
  Copy,
  Database,
  TriangleAlert,
  Upload,
} from "lucide-react";
import * as React from "react";
import { useAction } from "@/hooks/use-action";
import {
  clearDemoContentAction,
  loadDemoContentAction,
  type SetupStatus,
  type SetupStep,
} from "@/server/setup";

/* ───────────────────────── Copy-to-clipboard field ───────────────────────── */

function useCopy() {
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually");
    }
  }, []);
  return { copied, copy };
}

/**
 * A read-only, monospaced value with a copy button. Used for the public values
 * (callback URL, customer code) and the "how to set it" command — never a
 * secret.
 */
function CopyField({ label, value }: { label: string; value: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-stretch gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs text-foreground">
          {value}
        </code>
        <Button
          type="button"
          variant="glass"
          size="icon-sm"
          className="h-auto self-stretch"
          aria-label={`Copy ${label}`}
          onClick={() => copy(value)}
        >
          {copied ? <Check className="text-success" /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

/* ───────────────────────── Status badge ───────────────────────── */

function StatusBadge({ step }: { step: SetupStep }) {
  if (step.configured) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-success/30 bg-success/10 text-success"
      >
        <CircleCheck className="size-3" />
        Connected
      </Badge>
    );
  }
  if (step.required) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-warning/30 bg-warning/10 text-warning"
      >
        <CircleDashed className="size-3" />
        Not configured
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 text-muted-foreground">
      <CircleDashed className="size-3" />
      Optional
    </Badge>
  );
}

/* ───────────────────────── One config step ───────────────────────── */

function StepCard({ step }: { step: SetupStep }) {
  return (
    <Card className="glass shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{step.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </div>
        <StatusBadge step={step} />
      </CardHeader>
      <CardContent className="space-y-3">
        {step.warning && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{step.warning}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {step.envVars.map((name) => (
            <code
              key={name}
              className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
            >
              {name}
            </code>
          ))}
        </div>

        {step.value !== undefined && (
          <CopyField label="Value" value={step.value} />
        )}

        {!step.configured && (
          <CopyField label="How to set it" value={step.setHint} />
        )}
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── First-upload step ───────────────────────── */

function FirstUploadCard({ hasVideos }: { hasVideos: boolean }) {
  return (
    <Card className="glass shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Your first upload</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a video to Cloudflare Stream and publish it to your catalog.
          </p>
        </div>
        {hasVideos ? (
          <Badge
            variant="outline"
            className="gap-1 border-success/30 bg-success/10 text-success"
          >
            <CircleCheck className="size-3" />
            Done
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-muted-foreground">
            <CircleDashed className="size-3" />
            No videos yet
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <Button asChild variant={hasVideos ? "glass" : "gradient"}>
          <Link to="/admin/videos/new">
            <Upload />
            {hasVideos ? "Upload another video" : "Upload your first video"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── Demo content step ───────────────────────── */

function DemoContentCard({ hasDemoContent }: { hasDemoContent: boolean }) {
  const { busy, busyId, run } = useAction();

  function load() {
    run("load-demo", () => loadDemoContentAction({ data: {} }), {
      success: "Demo content loaded",
      error: "Could not load demo content",
    });
  }

  function clear() {
    if (
      !window.confirm(
        "Remove all demo categories and their videos? This can't be undone.",
      )
    ) {
      return;
    }
    run("clear-demo", () => clearDemoContentAction({ data: {} }), {
      success: "Demo content cleared",
      error: "Could not clear demo content",
    });
  }

  return (
    <Card className="glass shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">Demo content</CardTitle>
          <p className="text-sm text-muted-foreground">
            Load a sample catalog (categories + videos) to explore the platform,
            then clear it before you go live.
          </p>
        </div>
        {hasDemoContent ? (
          <Badge variant="secondary" className="gap-1 text-muted-foreground">
            <Database className="size-3" />
            Loaded
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button
          variant="glass"
          onClick={load}
          disabled={busy || hasDemoContent}
        >
          {busyId === "load-demo" ? <Spinner /> : <Database />}
          Load demo content
        </Button>
        <Button
          variant="ghost"
          onClick={clear}
          disabled={busy || !hasDemoContent}
          className="text-destructive hover:text-destructive"
        >
          {busyId === "clear-demo" ? <Spinner /> : null}
          Clear demo content
        </Button>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────── Summary banner ───────────────────────── */

function SummaryBanner({ status }: { status: SetupStatus }) {
  const remaining = status.steps.filter(
    (s) => s.required && !s.configured,
  ).length;

  return (
    <div
      className={cn(
        "glass flex items-center gap-3 rounded-xl px-4 py-3 text-sm",
        status.ready ? "text-success" : "text-foreground",
      )}
    >
      {status.ready ? (
        <CircleCheck className="size-5 shrink-0 text-success" />
      ) : (
        <CircleDashed className="size-5 shrink-0 text-warning" />
      )}
      <span>
        {status.ready ? (
          <span className="font-medium">
            All required configuration is in place. You're ready to publish.
          </span>
        ) : (
          <>
            <span className="font-medium">{remaining}</span> required step
            {remaining === 1 ? "" : "s"} left to configure.
          </>
        )}
      </span>
    </div>
  );
}

/* ───────────────────────── Wizard ───────────────────────── */

export function SetupWizard({ status }: { status: SetupStatus }) {
  return (
    <div className="max-w-2xl space-y-6">
      <SummaryBanner status={status} />

      <section className="space-y-3">
        <div>
          <h2 className="font-serif text-lg font-medium tracking-tight">
            Configuration
          </h2>
          <p className="text-sm text-muted-foreground">
            Set these as secrets with{" "}
            <code className="font-mono text-xs">wrangler secret put</code> in
            production, or in{" "}
            <code className="font-mono text-xs">.dev.vars</code> locally.
          </p>
        </div>
        {status.steps.map((step) => (
          <StepCard key={step.id} step={step} />
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-serif text-lg font-medium tracking-tight">
            Get started
          </h2>
          <p className="text-sm text-muted-foreground">
            Add some content and take the platform for a spin.
          </p>
        </div>
        <FirstUploadCard hasVideos={status.videoCount > 0} />
        <DemoContentCard hasDemoContent={status.hasDemoContent} />
      </section>
    </div>
  );
}
