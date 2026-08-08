'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { importClientsCsvMappedAction } from '@/app/(dashboard)/clients/_actions/acquisition';

type FieldKey = 'ignore' | 'fullName' | 'phone' | 'source' | 'optIn';

const FIELD_OPTIONS: { value: FieldKey; label: string }[] = [
  { value: 'ignore', label: 'Ignorer' },
  { value: 'fullName', label: 'Nom' },
  { value: 'phone', label: 'Téléphone / WhatsApp' },
  { value: 'source', label: 'Source' },
  { value: 'optIn', label: 'Consentement WhatsApp' },
];

function guessField(header: string): FieldKey {
  const h = header.toLowerCase().trim();
  if (['name', 'full_name', 'fullname', 'client', 'full name'].includes(h)) return 'fullName';
  if (['phone', 'telephone', 'téléphone', 'whatsapp', 'mobile', 'tel'].includes(h)) return 'phone';
  if (['source', 'acquisition_source', 'origine'].includes(h)) return 'source';
  if (['opt_in', 'opt_in_whatsapp', 'whatsapp_opt_in', 'consentement'].includes(h)) return 'optIn';
  return 'ignore';
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function CsvImportWizard() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [rawText, setRawText] = useState('');
  const [mapping, setMapping] = useState<FieldKey[]>([]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const canImport = useMemo(() => {
    return mapping.includes('fullName') && mapping.includes('phone') && rawText.length > 0;
  }, [mapping, rawText]);

  async function onFile(file: File | null) {
    setMsg(null);
    if (!file) return;
    if (file.size > 2_000_000) {
      setMsg('Fichier trop volumineux (max 2 Mo)');
      return;
    }
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      setMsg('CSV vide ou sans données');
      return;
    }
    const hdr = splitCsvLine(lines[0]!);
    const rows = lines.slice(1, 6).map(splitCsvLine);
    setRawText(text);
    setHeaders(hdr);
    setPreviewRows(rows);
    setMapping(hdr.map(guessField));
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-muted-foreground">1. Sélectionner un fichier CSV</label>
        <Input
          type="file"
          accept=".csv,text/csv"
          className="mt-1 max-w-sm"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {headers.length > 0 && (
        <>
          <div>
            <p className="text-sm font-medium">2–3. Aperçu & mapping des colonnes</p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-secondary/40">
                  <tr>
                    {headers.map((h, i) => (
                      <th key={`${h}-${i}`} className="px-3 py-2 font-medium">
                        <div className="mb-1 text-muted-foreground">{h || `Col ${i + 1}`}</div>
                        <select
                          className="w-full rounded border border-border bg-background px-1 py-1"
                          value={mapping[i] ?? 'ignore'}
                          onChange={(e) => {
                            const next = [...mapping];
                            next[i] = e.target.value as FieldKey;
                            setMapping(next);
                          }}
                        >
                          {FIELD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} className="border-t border-border/60">
                      {headers.map((_, ci) => (
                        <td key={ci} className="px-3 py-2 text-muted-foreground">
                          {row[ci] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Colonnes requises : Nom + Téléphone. Doublons téléphone ignorés.
            </p>
          </div>

          <Button
            type="button"
            disabled={!canImport || pending}
            onClick={() => {
              setMsg(null);
              start(async () => {
                const res = await importClientsCsvMappedAction({
                  csvText: rawText,
                  mapping,
                });
                setMsg(res.error ?? res.success ?? null);
                if (res.errors?.length) {
                  setMsg((prev) => `${prev ?? ''}\n${res.errors!.join('\n')}`);
                }
              });
            }}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            4. Importer
          </Button>
        </>
      )}

      {msg && (
        <pre className="whitespace-pre-wrap rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
          {msg}
        </pre>
      )}
    </div>
  );
}
