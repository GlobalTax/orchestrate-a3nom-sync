import { toast } from "sonner";

export interface ExportColumn<T = any> {
  header: string;
  accessor: keyof T | ((row: T) => string | number);
}

export const ExportUtils = {
  /**
   * Export data to CSV file
   */
  toCSV<T>(
    data: T[],
    columns: ExportColumn<T>[],
    filename: string
  ): void {
    if (data.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = columns.map(col => col.header);
    const rows = data.map(row =>
      columns.map(col => {
        const value = typeof col.accessor === "function"
          ? col.accessor(row)
          : row[col.accessor];
        return value ?? "";
      })
    );

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Datos exportados correctamente");
  },

  /**
   * Export data to Excel file using XLSX library
   */
  async toExcel<T>(
    data: T[],
    sheetName: string,
    filename: string
  ): Promise<void> {
    if (data.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      XLSX.writeFile(workbook, filename);
      toast.success("Datos exportados correctamente");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Error al exportar a Excel");
    }
  },
};
