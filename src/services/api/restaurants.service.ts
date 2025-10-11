import { supabase } from "@/integrations/supabase/client";
import type { RestaurantWithFranchisee, RestaurantFormData } from "@/features/restaurants/types";

export class RestaurantsService {
  static async getAll(): Promise<RestaurantWithFranchisee[]> {
    const { data, error } = await supabase.rpc("get_restaurants_with_franchisees");
    
    if (error) {
      console.error("[RestaurantsService] Error:", error);
      throw error;
    }

    return (data || []).map(r => ({
      id: r.id,
      codigo: r.site_number || r.id,
      nombre: r.name || "",
      direccion: r.address,
      ciudad: r.city,
      pais: r.country || "España",
      orquest_service_id: null,
      orquest_business_id: null,
      activo: true,
      franchisee_id: r.franchisee_id,
      franchisee_name: r.franchisee_name,
      franchisee_email: r.franchisee_email,
      company_tax_id: r.company_tax_id,
      postal_code: r.postal_code,
      state: r.state,
      site_number: r.site_number,
      seating_capacity: r.seating_capacity ? parseInt(r.seating_capacity) : null,
      square_meters: r.square_meters ? parseFloat(r.square_meters) : null,
      opening_date: r.opening_date,
    })) as RestaurantWithFranchisee[];
  }

  static async create(data: RestaurantFormData): Promise<void> {
    const restaurantData = {
      site_number: data.codigo,
      name: data.nombre,
      address: data.direccion,
      city: data.ciudad,
      state: data.state,
      country: data.pais,
      postal_code: data.postal_code,
      franchisee_id: data.franchisee_id,
      seating_capacity: data.seating_capacity?.toString() || null,
      square_meters: data.square_meters?.toString() || null,
      opening_date: data.opening_date,
    };

    const { error } = await supabase
      .from("Restaurants")
      .insert([restaurantData]);
    
    if (error) throw error;
  }

  static async update(id: string, data: RestaurantFormData): Promise<void> {
    const restaurantData = {
      site_number: data.codigo,
      name: data.nombre,
      address: data.direccion,
      city: data.ciudad,
      state: data.state,
      country: data.pais,
      postal_code: data.postal_code,
      franchisee_id: data.franchisee_id,
      seating_capacity: data.seating_capacity?.toString() || null,
      square_meters: data.square_meters?.toString() || null,
      opening_date: data.opening_date,
    };

    const { error } = await supabase
      .from("Restaurants")
      .update(restaurantData)
      .eq("id", id);
    
    if (error) throw error;
  }

  static async toggleActive(id: string, currentStatus: boolean): Promise<void> {
    const { error } = await supabase
      .from("centres")
      .update({ activo: !currentStatus })
      .eq("id", id);
    
    if (error) throw error;
  }

  static async testConnection(serviceId: string, businessId: string) {
    const { data, error } = await supabase.functions.invoke("test_orquest_connection", {
      body: {
        service_id: serviceId,
        business_id: businessId,
      },
    });

    if (error) throw error;
    return data;
  }
}
