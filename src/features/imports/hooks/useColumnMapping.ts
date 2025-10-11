import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface FieldAlias {
  [field: string]: string[];
}

export interface UseColumnMappingOptions {
  fieldAliases?: FieldAlias;
  requiredFields?: string[];
}

export const useColumnMapping = (options: UseColumnMappingOptions = {}) => {
  const { fieldAliases = {}, requiredFields = [] } = options;
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  const autoDetectMapping = useCallback((headers: string[]) => {
    const mapping: Record<string, string> = {};
    const lowerHeaders = headers.map(h => h.toLowerCase().trim().replace(/\s+/g, "_"));

    Object.entries(fieldAliases).forEach(([field, aliases]) => {
      const matchedHeader = headers.find((header, idx) => {
        const normalized = lowerHeaders[idx];
        // Exact match first
        if (aliases.includes(normalized) || aliases.includes(header.toLowerCase().trim())) {
          return true;
        }
        // Partial match as fallback
        return aliases.some(alias => {
          const normalizedAlias = alias.toLowerCase().replace(/\s+/g, "_");
          return normalized.includes(normalizedAlias) || normalizedAlias.includes(normalized);
        });
      });

      if (matchedHeader) {
        mapping[field] = matchedHeader;
      }
    });

    setColumnMapping(mapping);
    return mapping;
  }, [fieldAliases]);

  const updateMapping = useCallback((targetField: string, sourceColumn: string) => {
    setColumnMapping(prev => ({ ...prev, [targetField]: sourceColumn }));
  }, []);

  const validateMapping = useCallback(() => {
    const missingRequired = requiredFields.filter(
      field => !columnMapping[field]
    );

    if (missingRequired.length > 0) {
      toast.error(
        `Faltan campos obligatorios: ${missingRequired.join(", ")}`
      );
      return false;
    }

    return true;
  }, [columnMapping, requiredFields]);

  const clearMapping = useCallback(() => {
    setColumnMapping({});
  }, []);

  return {
    columnMapping,
    autoDetectMapping,
    updateMapping,
    validateMapping,
    clearMapping,
  };
};
