import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ImportResult {
  success: boolean;
  total: number;
  inserted: number;
  updated: number;
  errors: number;
  errorDetails?: Array<{ restaurant: string; error: string }>;
  message: string;
}

export class ImportService {
  /**
   * Import restaurants from CSV data
   */
  static async importRestaurantsFromCSV(csvData: any[]): Promise<ImportResult> {
    try {
      const { data, error } = await supabase.functions.invoke(
        'import_restaurants_csv',
        {
          body: { csvData },
        }
      );

      if (error) {
        console.error('Error invoking import function:', error);
        throw error;
      }

      return data as ImportResult;
    } catch (error: any) {
      console.error('Import service error:', error);
      throw new Error(`Failed to import restaurants: ${error.message}`);
    }
  }

  /**
   * Parse CSV data from the public folder
   */
  static async parsePublicCSV(): Promise<any[]> {
    try {
      const response = await fetch('/restaurant_rows.csv');
      const text = await response.text();
      
      // Parse CSV
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      const data: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        data.push(row);
      }

      return data;
    } catch (error: any) {
      console.error('Error parsing CSV:', error);
      throw new Error(`Failed to parse CSV: ${error.message}`);
    }
  }

  /**
   * Execute full import from public CSV
   */
  static async executePublicCSVImport(): Promise<ImportResult> {
    toast.info('Leyendo archivo CSV...');
    
    const csvData = await this.parsePublicCSV();
    toast.info(`Procesando ${csvData.length} restaurantes...`);
    
    const result = await this.importRestaurantsFromCSV(csvData);
    
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error('Importación falló: ' + result.message);
    }
    
    return result;
  }
}
