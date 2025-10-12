import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSpinner } from "./LoadingSpinner";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ComponentType<{ className?: string }>;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  isLoading,
  emptyMessage = "No hay datos disponibles",
  emptyIcon,
  onRowClick,
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingSpinner size="lg" />;
  }

  if (data.length === 0) {
    return <EmptyState message={emptyMessage} icon={emptyIcon} />;
  }

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border/30 hover:bg-transparent">
            {columns.map((col, i) => (
              <TableHead key={i} className={cn("h-10 px-6 text-[11px] font-medium uppercase tracking-wider text-muted-foreground", col.className)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={cn(
                "border-b border-border/30 hover:bg-muted/30 transition-all duration-150 ease-linear-ease",
                onRowClick && "cursor-pointer"
              )}
            >
              {columns.map((col, i) => (
                <TableCell key={i} className={cn("py-4 px-6 text-sm font-normal", col.className)}>
                  {typeof col.accessor === "function"
                    ? col.accessor(row)
                    : String(row[col.accessor])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
