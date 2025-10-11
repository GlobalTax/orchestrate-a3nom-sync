import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet } from "lucide-react";

export interface FileUploadZoneProps {
  onFileSelected: (file: File) => void;
  accept?: Record<string, string[]>;
  title?: string;
  description?: string;
}

export const FileUploadZone = ({
  onFileSelected,
  accept = {
    "application/vnd.ms-excel": [".xls"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "text/csv": [".csv"],
  },
  title = "Cargar Archivo",
  description = "Arrastra o selecciona un archivo CSV/Excel",
}: FileUploadZoneProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (file) onFileSelected(file);
    },
    accept,
    maxFiles: 1,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-12 text-center cursor-pointer 
            transition-colors hover:border-primary/50
            ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            {isDragActive ? (
              <>
                <Upload className="h-12 w-12 text-primary animate-bounce" />
                <p className="text-lg font-medium">Suelta el archivo aquí</p>
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
                <div>
                  <p className="text-lg font-medium mb-1">
                    Arrastra un archivo o haz clic para seleccionar
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Formatos soportados: CSV, XLS, XLSX
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
