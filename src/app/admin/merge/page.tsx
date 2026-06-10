"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  downloadMergedJson,
  mergeUploadedFiles,
  type MergeSummary,
} from "@/lib/clinic-merge";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileJson,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

export default function MergeClinicsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [merging, setMerging] = useState(false);
  const [summary, setSummary] = useState<MergeSummary | null>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const jsonFiles = Array.from(incoming).filter(
      (f) => f.name.toLowerCase().endsWith(".json") || f.type === "application/json"
    );
    if (!jsonFiles.length) {
      toast.error("Please upload .json files only");
      return;
    }
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const next = [...prev];
      for (const file of jsonFiles) {
        if (!names.has(file.name)) next.push(file);
      }
      return next;
    });
    setSummary(null);
  }, []);

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setSummary(null);
  }

  function clearAll() {
    setFiles([]);
    setSummary(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleMerge() {
    if (!files.length) {
      toast.error("Add at least one JSON file");
      return;
    }
    setMerging(true);
    try {
      const result = await mergeUploadedFiles(files);
      const errors = result.files.filter((f) => f.error);
      if (errors.length) {
        for (const err of errors) {
          toast.error(`${err.fileName}: ${err.error}`);
        }
      }
      if (!result.clinics.length && errors.length === result.files.length) {
        toast.error("No clinics could be parsed from the uploaded files");
        setSummary(null);
        return;
      }
      setSummary(result);
      toast.success(`Merged ${result.uniqueCount} unique clinics`);
    } catch {
      toast.error("Merge failed — check your JSON files");
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 space-y-6">
        <div className="space-y-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to admin
          </Link>
          <h1 className="text-2xl font-bold">Merge clinic JSON</h1>
          <p className="text-muted-foreground text-sm">
            Upload multiple Outscraper or Google Maps JSON exports. Files are merged in your
            browser, bite centers are removed, and you download one combined file. Nothing is
            uploaded to a server.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload JSON files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/40"
              }`}
            >
              <Upload className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium">Drop JSON files here</p>
                <p className="text-muted-foreground text-sm">or click to browse</p>
              </div>
              <p className="text-muted-foreground text-xs">
                Outscraper exports and parsed <code className="text-foreground">clinics</code>{" "}
                files both work
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((file) => (
                  <li
                    key={file.name}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileJson className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{file.name}</span>
                      <span className="text-muted-foreground shrink-0">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.name);
                      }}
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleMerge} disabled={!files.length || merging}>
                {merging ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Merging…
                  </>
                ) : (
                  "Merge files"
                )}
              </Button>
              {files.length > 0 && (
                <Button type="button" variant="outline" onClick={clearAll}>
                  Clear all
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{summary.uniqueCount} unique clinics</Badge>
                <Badge variant="secondary">{summary.emergencyCount} emergency-capable</Badge>
                <Badge variant="secondary">{summary.withCoordinates} with coordinates</Badge>
                <Badge variant="outline">
                  {summary.totalBiteExcluded} bite centers excluded
                </Badge>
              </div>

              <ul className="space-y-2 text-sm">
                {summary.files.map((file) => (
                  <li key={file.fileName} className="flex items-start gap-2">
                    {file.error ? (
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <FileJson className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span>
                      <strong>{file.fileName}</strong>
                      {file.error ? (
                        <span className="text-destructive"> — {file.error}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {" "}
                          — {file.clinics.length} clinics ({file.format}
                          {file.excludedBite ? `, ${file.excludedBite} bite excluded` : ""}
                          {file.excludedOther ? `, ${file.excludedOther} non-vet skipped` : ""})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              {summary.postBiteRemoved > 0 && (
                <p className="text-muted-foreground text-sm">
                  Removed {summary.postBiteRemoved} additional bite center(s) after merge.
                </p>
              )}

              {summary.withCoordinates < summary.uniqueCount && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                  <p className="font-medium text-amber-950 dark:text-amber-100">
                    {summary.uniqueCount - summary.withCoordinates} clinic(s) have no coordinates
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Outscraper JSON often omits lat/lng. Import will skip those until you geocode
                    first (~1 second per clinic).
                  </p>
                </div>
              )}

              <Button
                onClick={() => downloadMergedJson(summary.payload)}
                className="w-full sm:w-auto"
              >
                <Download className="size-4" />
                Download clinics-merged.json
              </Button>

              <p className="text-muted-foreground text-xs">
                Next: save as <code>data/clinics-merged.json</code>, open a terminal at the{" "}
                <strong>project root</strong>, then geocode and import:
              </p>
              <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs">
                {`cd "d:\\Vibe Code\\Emergency Vet clinics\\vet-emergency-ph"
npm run geocode:merged
node scripts/import-clinics.mjs --file=data/clinics-merged.json --upsert`}
              </pre>
              <p className="text-muted-foreground text-xs">
                Or do both in one step:{" "}
                <code className="text-foreground">npm run import:clinics:merged</code> (~15 min for
                900 clinics).
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
