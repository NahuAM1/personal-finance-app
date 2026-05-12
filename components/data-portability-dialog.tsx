'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Upload, FileJson, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import {
  buildCanonicalExport,
  serializeJSON,
  serializeXLSX,
  triggerDownload,
  buildExportFilename,
} from '@/lib/data-portability/export';
import {
  parseFile,
  importMerge,
  totalInserted,
} from '@/lib/data-portability/import';
import {
  ALL_ENTITIES,
  ENTITY_LABELS,
} from '@/lib/data-portability/types';
import type {
  EntityKey,
  ExportFormat,
  CanonicalExport,
  EntityCounts,
  ImportResult,
} from '@/lib/data-portability/types';

interface DataPortabilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DateScope = 'all' | 'range';

interface ParsedImportState {
  parsed: CanonicalExport;
  counts: EntityCounts;
  errors: string[];
  fileName: string;
}

const SUMMARY_ENTITIES: ReadonlyArray<{ key: keyof EntityCounts; label: string }> = [
  { key: 'transactions', label: 'movimientos' },
  { key: 'expense_plans', label: 'planes de gasto' },
  { key: 'credit_purchases', label: 'compras con tarjeta' },
  { key: 'credit_installments', label: 'cuotas de tarjeta' },
  { key: 'investments', label: 'inversiones' },
  { key: 'loans', label: 'préstamos' },
  { key: 'loan_payments', label: 'pagos de préstamo' },
  { key: 'tickets', label: 'tickets' },
  { key: 'ticket_items', label: 'items de ticket' },
];

export function DataPortabilityDialog({
  open,
  onOpenChange,
}: DataPortabilityDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [selectedEntities, setSelectedEntities] = useState<Set<EntityKey>>(
    () => new Set(ALL_ENTITIES)
  );
  const [dateScope, setDateScope] = useState<DateScope>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [exporting, setExporting] = useState(false);

  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedImportState | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allSelected = useMemo(
    () => selectedEntities.size === ALL_ENTITIES.length,
    [selectedEntities]
  );

  const toggleEntity = useCallback((key: EntityKey, checked: boolean) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedEntities((prev) =>
      prev.size === ALL_ENTITIES.length ? new Set() : new Set(ALL_ENTITIES)
    );
  }, []);

  const resetImport = useCallback(() => {
    setParsed(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleExport = useCallback(async () => {
    if (!user) {
      toast({
        title: 'Necesitás iniciar sesión',
        variant: 'destructive',
      });
      return;
    }
    if (selectedEntities.size === 0) {
      toast({
        title: 'Seleccioná al menos una entidad',
        variant: 'destructive',
      });
      return;
    }
    if (dateScope === 'range') {
      if (!from || !to) {
        toast({
          title: 'Completá Desde y Hasta',
          variant: 'destructive',
        });
        return;
      }
      if (from > to) {
        toast({
          title: 'La fecha Desde debe ser menor que Hasta',
          variant: 'destructive',
        });
        return;
      }
    }

    setExporting(true);
    try {
      const payload = await buildCanonicalExport(
        user.id,
        user.email ?? '',
        {
          entities: selectedEntities,
          dateRange: dateScope === 'range' ? { from, to } : null,
        }
      );

      const blob =
        format === 'json' ? serializeJSON(payload) : serializeXLSX(payload);
      triggerDownload(blob, buildExportFilename(format));

      toast({
        title: 'Export listo',
        description: `Se descargó tu archivo en formato ${format.toUpperCase()}.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: 'Error al exportar',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  }, [user, selectedEntities, dateScope, from, to, format, toast]);

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setParsing(true);
      setImportResult(null);
      try {
        const result = await parseFile(file);
        if (!result.ok || !result.parsed) {
          setParsed(null);
          toast({
            title: 'Archivo inválido',
            description: result.errors.slice(0, 3).join(' · ') || 'Schema no reconocido',
            variant: 'destructive',
          });
          return;
        }
        setParsed({
          parsed: result.parsed,
          counts: result.counts,
          errors: result.errors,
          fileName: file.name,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({
          title: 'No pude leer el archivo',
          description: msg,
          variant: 'destructive',
        });
        setParsed(null);
      } finally {
        setParsing(false);
      }
    },
    [toast]
  );

  const handleImport = useCallback(async () => {
    if (!user || !parsed) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await importMerge(user.id, parsed.parsed);
      setImportResult(result);
      const total = totalInserted(result.inserted);
      if (result.errors.length === 0) {
        toast({
          title: 'Importación completada',
          description: `Se agregaron ${total} registros.`,
        });
      } else {
        toast({
          title: 'Importación con errores',
          description: `Se agregaron ${total} registros. Revisá el detalle.`,
          variant: 'info',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: 'Error al importar',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  }, [user, parsed, toast]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          resetImport();
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar / Importar datos</DialogTitle>
          <DialogDescription>
            Descargá una copia de tus datos o cargá un archivo para sumarlo a tu cuenta.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">Exportar</TabsTrigger>
            <TabsTrigger value="import">Importar</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-5 py-3">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Rango de fechas</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={dateScope === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateScope('all')}
                >
                  Todo el historial
                </Button>
                <Button
                  type="button"
                  variant={dateScope === 'range' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateScope('range')}
                >
                  Rango personalizado
                </Button>
              </div>
              {dateScope === 'range' && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="space-y-1">
                    <Label htmlFor="export-from" className="text-xs">
                      Desde
                    </Label>
                    <Input
                      id="export-from"
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="export-to" className="text-xs">
                      Hasta
                    </Label>
                    <Input
                      id="export-to"
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Entidades a exportar</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                  className="h-7 text-xs"
                >
                  {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </Button>
              </div>
              <div className="space-y-2 rounded-lg border border-emerald-100 dark:border-emerald-900 p-3">
                {ALL_ENTITIES.map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label
                      htmlFor={`entity-${key}`}
                      className="text-sm cursor-pointer"
                    >
                      {ENTITY_LABELS[key]}
                    </Label>
                    <Switch
                      id={`entity-${key}`}
                      checked={selectedEntities.has(key)}
                      onCheckedChange={(c) => toggleEntity(key, c)}
                    />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Formato</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={format === 'xlsx' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormat('xlsx')}
                  className="justify-start"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel (.xlsx)
                </Button>
                <Button
                  type="button"
                  variant={format === 'json' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormat('json')}
                  className="justify-start"
                >
                  <FileJson className="mr-2 h-4 w-4" />
                  JSON
                </Button>
              </div>
            </section>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Download className="mr-2 h-4 w-4" />
                {exporting ? 'Generando…' : 'Descargar'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 py-3">
            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <span>
                Los datos se <strong>agregan</strong> a tu cuenta — no reemplazan ni borran nada existente. Se generan IDs nuevos para evitar conflictos.
              </span>
            </div>

            <section className="space-y-2">
              <Label htmlFor="import-file" className="text-sm font-semibold">
                Archivo (.json o .xlsx)
              </Label>
              <Input
                id="import-file"
                ref={fileInputRef}
                type="file"
                accept=".json,.xlsx,.xls"
                onChange={handleFileSelected}
                disabled={parsing || importing}
              />
            </section>

            {parsing && (
              <div className="text-sm text-muted-foreground">Procesando archivo…</div>
            )}

            {parsed && !importResult && (
              <section className="space-y-2 rounded-lg border border-emerald-100 dark:border-emerald-900 p-3">
                <h3 className="text-sm font-semibold">
                  Resumen de {parsed.fileName}
                </h3>
                <ul className="text-sm space-y-0.5">
                  {SUMMARY_ENTITIES.map(({ key, label }) =>
                    parsed.counts[key] > 0 ? (
                      <li key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{parsed.counts[key]}</span>
                      </li>
                    ) : null
                  )}
                </ul>
                {parsed.errors.length > 0 && (
                  <div className="text-xs text-amber-700 dark:text-amber-300 pt-2 border-t border-emerald-100 dark:border-emerald-900">
                    {parsed.errors.length} advertencia(s). El import omite los rows inválidos.
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetImport}
                    disabled={importing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleImport}
                    disabled={importing}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {importing ? 'Importando…' : 'Importar'}
                  </Button>
                </div>
              </section>
            )}

            {importResult && (
              <section className="space-y-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-3">
                <h3 className="text-sm font-semibold">Resultado</h3>
                <ul className="text-sm space-y-0.5">
                  {SUMMARY_ENTITIES.map(({ key, label }) =>
                    importResult.inserted[key] > 0 ? (
                      <li key={key} className="flex justify-between">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">
                          {importResult.inserted[key]}
                        </span>
                      </li>
                    ) : null
                  )}
                </ul>
                {importResult.errors.length > 0 && (
                  <div className="text-xs text-red-700 dark:text-red-300 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                    <strong>Errores:</strong>
                    <ul className="list-disc list-inside pt-1">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={resetImport}
                  >
                    Cargar otro archivo
                  </Button>
                </div>
              </section>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
