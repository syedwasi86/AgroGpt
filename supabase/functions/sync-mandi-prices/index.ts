import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

const DATA_GOV_API_KEY = Deno.env.get("DATA_GOV_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")

interface MandiRecord {
  state: string;
  commodity: string;
  market: string;
  modal_price: string;
}

serve(async () => {
  try {
    const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!)

    const apiUrl = `https://api.data.gov.in/resource/9ef273d1-c141-4209-906d-bc1315843b4d?api-key=${DATA_GOV_API_KEY}&format=json&limit=50`
    const response = await fetch(apiUrl)
    const data = await response.json()

    if (!data.records) {
      throw new Error("No records found in API response")
    }

    const filteredData = data.records
      .filter((record: MandiRecord) => {
        const stateUpper = record.state.toUpperCase();
        return stateUpper === 'TELANGANA' || stateUpper === 'ANDHRA PRADESH';
      })
      .map((record: MandiRecord) => {
        let crop_name = record.commodity.toLowerCase();
        if (crop_name === 'paddy') {
          crop_name = 'rice';
        }
        
        return {
          crop_name: crop_name,
          market: record.market,
          state: record.state,
          price: parseFloat(record.modal_price),
          updated_at: new Date().toISOString(),
          trend: 'stable'
        };
      });

    console.log('Records found for TS/AP:', filteredData.length)

    if (filteredData.length > 0) {
      const { error } = await supabase
        .from('mandi_rates')
        .upsert(filteredData, { onConflict: 'crop_name,market' })

      if (error) {
        console.error("Supabase database error:", error)
        throw error
      }
    }

    return new Response(JSON.stringify({ status: "success", count: filteredData.length }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: unknown) {
    const err = error as Error;
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})
