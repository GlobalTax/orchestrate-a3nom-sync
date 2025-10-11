import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export interface Field {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}

export interface ColumnMapperProps {
  headers: string[];
  fields: Field[];
  mapping: Record<string, string>;
  onMappingChange: (targetField: string, sourceColumn: string) => void;
  title?: string;
  description?: string;
}

export const ColumnMapper = ({
  headers,
  fields,
  mapping,
  onMappingChange,
  title = "Mapeo de Columnas",
  description = "Relaciona las columnas del archivo con los campos de la base de datos",
}: ColumnMapperProps) => {
  const requiredFields = fields.filter(f => f.required);
  const optionalFields = fields.filter(f => !f.required);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {requiredFields.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Campos Obligatorios
              <Badge variant="destructive">Requeridos</Badge>
            </h3>
            <div className="grid gap-4">
              {requiredFields.map((field) => (
                <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                  <Label>
                    {field.label}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({field.type})
                    </span>
                  </Label>
                  <Select
                    value={mapping[field.key] || ""}
                    onValueChange={(value) => onMappingChange(field.key, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin mapear</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {optionalFields.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              Campos Opcionales
              <Badge variant="secondary">Opcionales</Badge>
            </h3>
            <div className="grid gap-4">
              {optionalFields.map((field) => (
                <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                  <Label>
                    {field.label}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({field.type})
                    </span>
                  </Label>
                  <Select
                    value={mapping[field.key] || ""}
                    onValueChange={(value) => onMappingChange(field.key, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar columna..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sin mapear</SelectItem>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
