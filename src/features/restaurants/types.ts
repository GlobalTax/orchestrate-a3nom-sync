export interface Centre {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  pais: string;
  orquest_service_id: string | null;
  orquest_business_id: string | null;
  activo: boolean;
  franchisee_id: string | null;
}

export interface RestaurantWithFranchisee extends Centre {
  franchisee_name: string | null;
  franchisee_email: string | null;
  company_tax_id: string | null;
  postal_code?: string | null;
  state?: string | null;
  site_number?: string | null;
  seating_capacity?: number | null;
  square_meters?: number | null;
  opening_date?: string | null;
}

export interface Franchisee {
  id: string;
  email: string;
  name: string;
  company_tax_id: string | null;
  orquest_api_key?: string | null;
  orquest_business_id?: string | null;
}

export interface RestaurantService {
  id: string;
  centro_id: string;
  orquest_service_id: string;
  descripcion: string | null;
  activo: boolean;
  centres: {
    codigo: string;
    nombre: string;
  };
}

export interface CostCentre {
  id: string;
  centro_id: string;
  a3_centro_code: string;
  descripcion: string | null;
  activo: boolean;
  centres: {
    codigo: string;
    nombre: string;
  };
}

export interface UserWithRoles {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  roles: Array<{
    id: string;
    role: string;
    centro: string | null;
  }>;
}

export interface GestorAssignment {
  userId: string;
  email: string;
  nombre: string;
  apellidos: string;
  roleId: string;
}

export interface RestaurantFormData {
  codigo: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  pais: string;
  postal_code: string;
  state: string;
  site_number: string;
  franchisee_id: string | null;
  seating_capacity: number | null;
  square_meters: number | null;
  opening_date: string | null;
  orquest_business_id: string;
  orquest_service_id: string;
}

export interface FranchiseeFormData {
  email: string;
  name: string;
  company_tax_id: string;
  orquest_api_key?: string; // API Key de Orquest (Bearer Token)
  orquest_business_id?: string; // Business ID de Orquest (default: MCDONALDS_ES)
}

export interface ServiceFormData {
  centro_id: string;
  orquest_service_id: string;
  descripcion: string;
}

export interface CostCentreFormData {
  centro_id: string;
  a3_centro_code: string;
  descripcion: string;
}
