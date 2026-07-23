import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { restoreDatabase } from "@/data/restore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, UploadCloud, FileCode2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/restore")({ component: RestorePage });

const CONFIRM_WORD = "RESTORE";

function RestorePage() {
  const [file, setFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = !!file && confirmText === CONFIRM_WORD && !running;

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setRunning(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("confirm", confirmText);
      const res = await restoreDatabase({ data: fd });
      const msg = `Restore complete: ${res.statementsRun} statements executed${
        res.failed ? `, ${res.failed} failed` : ""
      } from ${res.fileName}.`;
      setResult(msg);
      toast.success("Database restored");
      setFile(null);
      setConfirmText("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Restore failed";
      setResult(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display font-bold text-3xl">Restore Database from Backup</h1>

      <div className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
        <ShieldAlert className="size-5 shrink-0 text-destructive" />
        <p className="text-sm text-destructive-foreground/90">
          This <strong>overwrites the live production database</strong> with the uploaded backup. Any
          orders or changes made after that backup was taken will be permanently lost. This cannot be
          undone. Download the backup file from Google Drive first, then upload it below.
        </p>
      </div>

      <form onSubmit={submit} className="bg-card border rounded-2xl p-6 space-y-4">
        <div>
          <Label>Backup file (.sql)</Label>
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={cn(
              "mt-1 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
              dragActive ? "border-primary bg-accent" : "border-border bg-muted/30 hover:border-primary/50 hover:bg-accent/50",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".sql"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            {file ? (
              <>
                <FileCode2 className="size-8 text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB — click or drop to replace
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Click to choose a file, or drag and drop it here</p>
                <p className="text-xs text-muted-foreground">.sql backup file downloaded from Google Drive</p>
              </>
            )}
          </div>
        </div>

        <div>
          <Label>
            Type <code className="bg-muted px-1.5 py-0.5 rounded">{CONFIRM_WORD}</code> to confirm
          </Label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
          />
        </div>

        <Button type="submit" variant="destructive" disabled={!canSubmit} className="w-full">
          {running ? "Restoring…" : "Restore Database"}
        </Button>
      </form>

      {result && <p className="text-sm text-muted-foreground">{result}</p>}
    </div>
  );
}
