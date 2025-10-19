import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RestaurantRow {
  id: string;
  name: string;
  site_number: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  franchisee_name: string;
  franchisee_email: string;
  company_tax_id: string;
  seating_capacity: string;
  square_meters: string;
  opening_date: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    console.log('🚀 Starting restaurant import from CSV');

    // Fetch CSV file from public storage
    const csvUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/restaurant_rows.csv`;
    console.log('📥 Fetching CSV from:', csvUrl);
    
    // For now, we'll use the hardcoded data since the CSV is in public folder
    // In production, you'd read from storage or pass the CSV data in the request
    const { csvData } = await req.json();
    
    if (!csvData || csvData.length === 0) {
      throw new Error('No CSV data provided');
    }

    console.log(`📊 Processing ${csvData.length} restaurants`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: any[] = [];

    // Step 1: Extract unique franchisees and ensure they exist
    const franchiseeMap = new Map<string, string>(); // email -> id
    const uniqueFranchisees = new Map<string, { name: string; email: string; tax_id: string }>();

    for (const row of csvData) {
      if (row.franchisee_email) {
        uniqueFranchisees.set(row.franchisee_email, {
          name: row.franchisee_name || row.franchisee_email,
          email: row.franchisee_email,
          tax_id: row.company_tax_id || null,
        });
      }
    }

    console.log(`👥 Found ${uniqueFranchisees.size} unique franchisees`);

    // Upsert franchisees
    for (const [email, franchisee] of uniqueFranchisees) {
      const { data, error } = await supabaseClient
        .from('franchisees')
        .upsert(
          {
            email: franchisee.email,
            name: franchisee.name,
            company_tax_id: franchisee.tax_id,
          },
          {
            onConflict: 'email',
            ignoreDuplicates: false,
          }
        )
        .select('id')
        .single();

      if (error) {
        console.error(`❌ Error upserting franchisee ${email}:`, error);
        continue;
      }

      if (data) {
        franchiseeMap.set(email, data.id);
        console.log(`✅ Franchisee ${email} -> ${data.id}`);
      }
    }

    console.log(`💾 Processed ${franchiseeMap.size} franchisees`);

    // Step 2: Import restaurants
    for (const row of csvData) {
      try {
        const franchiseeId = row.franchisee_email 
          ? franchiseeMap.get(row.franchisee_email) 
          : null;

        const restaurantData = {
          id: row.id,
          codigo: row.site_number || row.id,
          nombre: row.name,
          site_number: row.site_number,
          direccion: row.address,
          ciudad: row.city,
          state: row.state,
          pais: row.country || 'España',
          postal_code: row.postal_code,
          franchisee_id: franchiseeId,
          franchisee_name: row.franchisee_name,
          franchisee_email: row.franchisee_email,
          company_tax_id: row.company_tax_id,
          seating_capacity: row.seating_capacity ? parseInt(row.seating_capacity) : null,
          square_meters: row.square_meters ? parseFloat(row.square_meters) : null,
          opening_date: row.opening_date || null,
          activo: true,
          orquest_business_id: null,
          orquest_service_id: null,
        };

        const { error: upsertError } = await supabaseClient
          .from('centres')
          .upsert(restaurantData, {
            onConflict: 'id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`❌ Error upserting restaurant ${row.name}:`, upsertError);
          errors++;
          errorDetails.push({
            restaurant: row.name,
            error: upsertError.message,
          });
        } else {
          // Check if it was an insert or update
          const { count: existingCount } = await supabaseClient
            .from('centres')
            .select('id', { count: 'exact', head: true })
            .eq('id', row.id);

          if (existingCount && existingCount > 0) {
            updated++;
            console.log(`🔄 Updated: ${row.name}`);
          } else {
            inserted++;
            console.log(`✨ Inserted: ${row.name}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error processing restaurant ${row.name}:`, err);
        errors++;
        errorDetails.push({
          restaurant: row.name,
          error: err.message,
        });
      }
    }

    const result = {
      success: true,
      total: csvData.length,
      inserted,
      updated,
      errors,
      errorDetails: errorDetails.slice(0, 10), // Only return first 10 errors
      message: `Import completed: ${inserted} inserted, ${updated} updated, ${errors} errors`,
    };

    console.log('✅ Import completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('❌ Import failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
