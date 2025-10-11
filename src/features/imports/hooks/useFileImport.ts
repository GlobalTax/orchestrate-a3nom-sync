import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export interface ImportStep {
  current: "upload" | "mapping" | "preview" | "importing" | "complete";
  progress: number;
}

export interface ImportStats {
  total: number;
  loaded: number;
  skipped: number;
  errors: number;
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
  isCritical?: boolean;
}

export interface UseFileImportOptions {
  onDataParsed?: (data: any[], headers: string[]) => void;
  onValidationComplete?: (errors: ValidationError[]) => void;
  onImportComplete?: (stats: ImportStats) => void;
}

export const useFileImport = (options: UseFileImportOptions = {}) => {
  const [step, setStep] = useState<ImportStep["current"]>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats>({
    total: 0,
    loaded: 0,
    skipped: 0,
    errors: 0,
  });
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  const parseFile = useCallback(async (uploadedFile: File) => {
    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });

      if (jsonData.length === 0) {
        toast.error("El archivo está vacío");
        return;
      }

      const parsedHeaders = Object.keys(jsonData[0] as any);
      
      setFile(uploadedFile);
      setRawData(jsonData);
      setHeaders(parsedHeaders);
      setStats(prev => ({ ...prev, total: jsonData.length }));
      
      options.onDataParsed?.(jsonData, parsedHeaders);
      
      toast.success(`Archivo cargado: ${jsonData.length} filas detectadas`);
      return { data: jsonData, headers: parsedHeaders };
    } catch (error: any) {
      console.error("Error parsing file:", error);
      toast.error("Error al procesar el archivo: " + error.message);
      throw error;
    }
  }, [options]);

  const validateData = useCallback((
    data: any[],
    mapping: Record<string, string>,
    validationFn: (row: any, index: number) => ValidationError[]
  ) => {
    const errors: ValidationError[] = [];

    data.forEach((row, index) => {
      const rowErrors = validationFn(row, index);
      errors.push(...rowErrors);
    });

    setValidationErrors(errors);
    options.onValidationComplete?.(errors);

    return errors;
  }, [options]);

  const updateProgress = useCallback((current: number, total: number) => {
    const percentage = Math.round((current / total) * 100);
    setProgress(percentage);
  }, []);

  const updateStats = useCallback((newStats: Partial<ImportStats>) => {
    setStats(prev => ({ ...prev, ...newStats }));
  }, []);

  const reset = useCallback(() => {
    setStep("upload");
    setFile(null);
    setRawData([]);
    setHeaders([]);
    setProgress(0);
    setStats({ total: 0, loaded: 0, skipped: 0, errors: 0 });
    setValidationErrors([]);
  }, []);

  return {
    // State
    step,
    file,
    rawData,
    headers,
    progress,
    stats,
    validationErrors,
    
    // Actions
    setStep,
    parseFile,
    validateData,
    updateProgress,
    updateStats,
    reset,
  };
};
