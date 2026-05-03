// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const estimateCosts = (params: {
  standSize: string;
  teamSize: number;
  travelDistanceKm: number;
  countryCostIndex: number;
}) => {
  const standBase = params.standSize === "large" ? 42000 : params.standSize === "medium" ? 26000 : 14000;
  const travelBase = Math.max(1200, params.teamSize * Math.max(250, params.travelDistanceKm * 0.45));
  const accommodationBase = params.teamSize * 3200;
  const logisticsBase = standBase * 0.18;
  const designBase = standBase * 0.22;
  const marketingMaterials = standBase * 0.12;
  const equipmentRental = standBase * 0.15;
  const sponsorship = standBase * 0.1;

  const build = (multiplier: number) => {
    const index = params.countryCostIndex;
    const stand_cost = Math.round(standBase * multiplier * index);
    const design_cost = Math.round(designBase * multiplier * index);
    const logistics_cost = Math.round(logisticsBase * multiplier * index);
    const travel_cost = Math.round(travelBase * multiplier * index);
    const accommodation_cost = Math.round(accommodationBase * multiplier * index);
    const marketing_materials_cost = Math.round(marketingMaterials * multiplier * index);
    const equipment_rental_cost = Math.round(equipmentRental * multiplier * index);
    const sponsorship_cost = Math.round(sponsorship * multiplier * index);
    const total_cost = stand_cost + design_cost + logistics_cost + travel_cost + accommodation_cost + marketing_materials_cost + equipment_rental_cost + sponsorship_cost;
    return {
      stand_cost,
      design_cost,
      logistics_cost,
      travel_cost,
      accommodation_cost,
      marketing_materials_cost,
      equipment_rental_cost,
      sponsorship_cost,
      total_cost,
    };
  };

  return {
    low: build(0.85),
    medium: build(1),
    high: build(1.25),
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const baseUrl = Deno.env.get("TRAVEL_COST_API_BASE_URL");
    const apiKey = Deno.env.get("TRAVEL_COST_API_KEY");
    const fallback = {
      source: "fallback",
      travel_distance_km: Number(body.travelDistanceKm || 1200),
      country_cost_index: Number(body.countryCostIndex || 1),
      scenarios: estimateCosts({
        standSize: String(body.event?.stand_size || "medium"),
        teamSize: Number(body.teamSize || 6),
        travelDistanceKm: Number(body.travelDistanceKm || 1200),
        countryCostIndex: Number(body.countryCostIndex || 1),
      }),
      last_updated_at: new Date().toISOString(),
    };

    if (!baseUrl || !apiKey) {
      return json(fallback);
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/travel/cost-estimate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Travel cost estimation failed (${response.status}): ${JSON.stringify(result)}`);
    }

    return json({
      source: "provider",
      travel_distance_km: Number(result.travel_distance_km || body.travelDistanceKm || 1200),
      country_cost_index: Number(result.country_cost_index || body.countryCostIndex || 1),
      scenarios: result.scenarios || fallback.scenarios,
      last_updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("trade-show-travel-costs error", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected travel cost error" }, 500);
  }
});