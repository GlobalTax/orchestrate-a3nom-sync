import { describe, it, expect } from "vitest";
import {
  restaurantSchema,
  franchiseeSchema,
  serviceSchema,
  costCentreSchema,
  validateRestaurant,
  validateFranchisee,
  validateService,
  validateCostCentre,
} from "@/lib/validators/restaurantValidators";
import {
  employeeSchema,
  scheduleSchema,
  absenceSchema,
  validateEmployee,
  validateSchedule,
  validateAbsence,
  validateScheduleHours,
} from "@/lib/validators/employeeValidators";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// ---------------------------------------------------------------------------
// Restaurant Validators
// ---------------------------------------------------------------------------

describe("restaurantSchema", () => {
  const validRestaurant = {
    codigo: "R001",
    nombre: "Restaurante Central",
  };

  it("accepts valid restaurant data with only required fields", () => {
    const result = restaurantSchema.safeParse(validRestaurant);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.codigo).toBe("R001");
      expect(result.data.nombre).toBe("Restaurante Central");
    }
  });

  it("accepts valid restaurant data with all fields populated", () => {
    const full = {
      codigo: "R002",
      nombre: "Restaurante Norte",
      direccion: "Calle Mayor 1",
      ciudad: "Madrid",
      state: "Madrid",
      pais: "España",
      postal_code: "28001",
      franchisee_id: VALID_UUID,
      seating_capacity: 80,
      square_meters: 120.5,
      opening_date: "2024-01-15",
    };
    const result = restaurantSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it("fails when codigo is missing", () => {
    const result = restaurantSchema.safeParse({ nombre: "Test" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const codes = result.error.issues.map((i) => i.path[0]);
      expect(codes).toContain("codigo");
    }
  });

  it("fails when codigo is empty string", () => {
    const result = restaurantSchema.safeParse({ codigo: "", nombre: "Test" });
    expect(result.success).toBe(false);
  });

  it("fails when nombre is missing", () => {
    const result = restaurantSchema.safeParse({ codigo: "R001" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const codes = result.error.issues.map((i) => i.path[0]);
      expect(codes).toContain("nombre");
    }
  });

  it("fails when nombre is empty string", () => {
    const result = restaurantSchema.safeParse({ codigo: "R001", nombre: "" });
    expect(result.success).toBe(false);
  });

  it("allows optional fields to be null", () => {
    const data = {
      ...validRestaurant,
      direccion: null,
      ciudad: null,
      state: null,
      postal_code: null,
      franchisee_id: null,
      seating_capacity: null,
      square_meters: null,
      opening_date: null,
    };
    const result = restaurantSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it("allows optional fields to be undefined (omitted)", () => {
    const result = restaurantSchema.safeParse(validRestaurant);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.direccion).toBeUndefined();
      expect(result.data.ciudad).toBeUndefined();
    }
  });

  it("defaults pais to 'España' when not provided", () => {
    const result = restaurantSchema.safeParse(validRestaurant);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pais).toBe("España");
    }
  });

  it("allows overriding pais", () => {
    const result = restaurantSchema.safeParse({
      ...validRestaurant,
      pais: "Portugal",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pais).toBe("Portugal");
    }
  });

  it("fails when franchisee_id is not a valid UUID", () => {
    const result = restaurantSchema.safeParse({
      ...validRestaurant,
      franchisee_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid UUID for franchisee_id", () => {
    const result = restaurantSchema.safeParse({
      ...validRestaurant,
      franchisee_id: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("fails when seating_capacity is negative", () => {
    const result = restaurantSchema.safeParse({
      ...validRestaurant,
      seating_capacity: -10,
    });
    expect(result.success).toBe(false);
  });

  it("fails when seating_capacity is zero", () => {
    const result = restaurantSchema.safeParse({
      ...validRestaurant,
      seating_capacity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("fails when seating_capacity is a float", () => {
    const result = restaurantSchema.safeParse({
      ...validRestaurant,
      seating_capacity: 50.5,
    });
    expect(result.success).toBe(false);
  });

  it("fails when square_meters is negative", () => {
    const result = restaurantSchema.safeParse({
      ...validRestaurant,
      square_meters: -5,
    });
    expect(result.success).toBe(false);
  });

  it("fails when square_meters is zero", () => {
    const result = restaurantSchema.safeParse({
      ...validRestaurant,
      square_meters: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a positive float for square_meters", () => {
    const result = restaurantSchema.safeParse({
      ...validRestaurant,
      square_meters: 99.9,
    });
    expect(result.success).toBe(true);
  });
});

describe("validateRestaurant", () => {
  it("returns success true for valid data", () => {
    const result = validateRestaurant({ codigo: "R1", nombre: "Test" });
    expect(result.success).toBe(true);
  });

  it("returns success false for invalid data", () => {
    const result = validateRestaurant({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Franchisee Validators
// ---------------------------------------------------------------------------

describe("franchiseeSchema", () => {
  const validFranchisee = {
    name: "Franquiciado Uno",
    email: "franquiciado@example.com",
  };

  it("accepts valid franchisee data", () => {
    const result = franchiseeSchema.safeParse(validFranchisee);
    expect(result.success).toBe(true);
  });

  it("accepts valid data with optional company_tax_id", () => {
    const result = franchiseeSchema.safeParse({
      ...validFranchisee,
      company_tax_id: "B12345678",
    });
    expect(result.success).toBe(true);
  });

  it("allows company_tax_id to be null", () => {
    const result = franchiseeSchema.safeParse({
      ...validFranchisee,
      company_tax_id: null,
    });
    expect(result.success).toBe(true);
  });

  it("fails when name is missing", () => {
    const result = franchiseeSchema.safeParse({ email: "a@b.com" });
    expect(result.success).toBe(false);
  });

  it("fails when name is empty string", () => {
    const result = franchiseeSchema.safeParse({ name: "", email: "a@b.com" });
    expect(result.success).toBe(false);
  });

  it("fails when email is missing", () => {
    const result = franchiseeSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("fails when email is invalid", () => {
    const result = franchiseeSchema.safeParse({
      name: "Test",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("fails when email is empty string", () => {
    const result = franchiseeSchema.safeParse({ name: "Test", email: "" });
    expect(result.success).toBe(false);
  });

  it("fails when email has no domain", () => {
    const result = franchiseeSchema.safeParse({
      name: "Test",
      email: "user@",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateFranchisee", () => {
  it("returns success true for valid data", () => {
    const result = validateFranchisee({
      name: "Test",
      email: "a@b.com",
    });
    expect(result.success).toBe(true);
  });

  it("returns success false for invalid data", () => {
    const result = validateFranchisee({ name: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Service Validators
// ---------------------------------------------------------------------------

describe("serviceSchema", () => {
  const validService = {
    centro_id: VALID_UUID,
    orquest_service_id: "SRV-001",
  };

  it("accepts valid service data", () => {
    const result = serviceSchema.safeParse(validService);
    expect(result.success).toBe(true);
  });

  it("defaults activo to true when not provided", () => {
    const result = serviceSchema.safeParse(validService);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activo).toBe(true);
    }
  });

  it("allows activo to be set to false", () => {
    const result = serviceSchema.safeParse({ ...validService, activo: false });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activo).toBe(false);
    }
  });

  it("accepts descripcion as a string", () => {
    const result = serviceSchema.safeParse({
      ...validService,
      descripcion: "Servicio de almuerzo",
    });
    expect(result.success).toBe(true);
  });

  it("allows descripcion to be null", () => {
    const result = serviceSchema.safeParse({
      ...validService,
      descripcion: null,
    });
    expect(result.success).toBe(true);
  });

  it("fails when centro_id is not a valid UUID", () => {
    const result = serviceSchema.safeParse({
      centro_id: "invalid",
      orquest_service_id: "SRV-001",
    });
    expect(result.success).toBe(false);
  });

  it("fails when centro_id is missing", () => {
    const result = serviceSchema.safeParse({
      orquest_service_id: "SRV-001",
    });
    expect(result.success).toBe(false);
  });

  it("fails when orquest_service_id is empty string", () => {
    const result = serviceSchema.safeParse({
      centro_id: VALID_UUID,
      orquest_service_id: "",
    });
    expect(result.success).toBe(false);
  });

  it("fails when orquest_service_id is missing", () => {
    const result = serviceSchema.safeParse({ centro_id: VALID_UUID });
    expect(result.success).toBe(false);
  });
});

describe("validateService", () => {
  it("returns success true for valid data", () => {
    const result = validateService({
      centro_id: VALID_UUID,
      orquest_service_id: "SRV-001",
    });
    expect(result.success).toBe(true);
  });

  it("returns success false for invalid data", () => {
    const result = validateService({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cost Centre Validators
// ---------------------------------------------------------------------------

describe("costCentreSchema", () => {
  const validCostCentre = {
    centro_id: VALID_UUID,
    a3_centro_code: "CC-001",
  };

  it("accepts valid cost centre data", () => {
    const result = costCentreSchema.safeParse(validCostCentre);
    expect(result.success).toBe(true);
  });

  it("defaults activo to true when not provided", () => {
    const result = costCentreSchema.safeParse(validCostCentre);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activo).toBe(true);
    }
  });

  it("allows activo to be set to false", () => {
    const result = costCentreSchema.safeParse({
      ...validCostCentre,
      activo: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.activo).toBe(false);
    }
  });

  it("allows descripcion to be null", () => {
    const result = costCentreSchema.safeParse({
      ...validCostCentre,
      descripcion: null,
    });
    expect(result.success).toBe(true);
  });

  it("fails when centro_id is not a valid UUID", () => {
    const result = costCentreSchema.safeParse({
      centro_id: "bad-id",
      a3_centro_code: "CC-001",
    });
    expect(result.success).toBe(false);
  });

  it("fails when centro_id is missing", () => {
    const result = costCentreSchema.safeParse({ a3_centro_code: "CC-001" });
    expect(result.success).toBe(false);
  });

  it("fails when a3_centro_code is empty string", () => {
    const result = costCentreSchema.safeParse({
      centro_id: VALID_UUID,
      a3_centro_code: "",
    });
    expect(result.success).toBe(false);
  });

  it("fails when a3_centro_code is missing", () => {
    const result = costCentreSchema.safeParse({ centro_id: VALID_UUID });
    expect(result.success).toBe(false);
  });
});

describe("validateCostCentre", () => {
  it("returns success true for valid data", () => {
    const result = validateCostCentre({
      centro_id: VALID_UUID,
      a3_centro_code: "CC-001",
    });
    expect(result.success).toBe(true);
  });

  it("returns success false for invalid data", () => {
    const result = validateCostCentre({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Employee Validators
// ---------------------------------------------------------------------------

describe("employeeSchema", () => {
  const validEmployee = {
    nombre: "Juan",
    apellidos: "Garcia Lopez",
  };

  it("accepts valid employee data with only required fields", () => {
    const result = employeeSchema.safeParse(validEmployee);
    expect(result.success).toBe(true);
  });

  it("accepts valid employee data with all fields", () => {
    const full = {
      nombre: "Maria",
      apellidos: "Fernandez Ruiz",
      email: "maria@example.com",
      centro: "Centro Norte",
      codtrabajador_a3nom: "A3-1234",
      employee_id_orquest: "ORQ-5678",
      fecha_alta: "2023-06-01",
      fecha_baja: null,
    };
    const result = employeeSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it("fails when nombre is missing", () => {
    const result = employeeSchema.safeParse({ apellidos: "Garcia" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("nombre");
    }
  });

  it("fails when nombre is empty string", () => {
    const result = employeeSchema.safeParse({
      nombre: "",
      apellidos: "Garcia",
    });
    expect(result.success).toBe(false);
  });

  it("fails when apellidos is missing", () => {
    const result = employeeSchema.safeParse({ nombre: "Juan" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toContain("apellidos");
    }
  });

  it("fails when apellidos is empty string", () => {
    const result = employeeSchema.safeParse({
      nombre: "Juan",
      apellidos: "",
    });
    expect(result.success).toBe(false);
  });

  it("fails when email is invalid", () => {
    const result = employeeSchema.safeParse({
      ...validEmployee,
      email: "not-valid",
    });
    expect(result.success).toBe(false);
  });

  it("allows email to be null", () => {
    const result = employeeSchema.safeParse({
      ...validEmployee,
      email: null,
    });
    expect(result.success).toBe(true);
  });

  it("allows email to be omitted", () => {
    const result = employeeSchema.safeParse(validEmployee);
    expect(result.success).toBe(true);
  });

  it("allows optional fields to be null", () => {
    const data = {
      ...validEmployee,
      email: null,
      centro: null,
      codtrabajador_a3nom: null,
      employee_id_orquest: null,
      fecha_alta: null,
      fecha_baja: null,
    };
    const result = employeeSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe("validateEmployee", () => {
  it("returns success true for valid data", () => {
    const result = validateEmployee({
      nombre: "Juan",
      apellidos: "Garcia",
    });
    expect(result.success).toBe(true);
  });

  it("returns success false for invalid data", () => {
    const result = validateEmployee({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Schedule Validators
// ---------------------------------------------------------------------------

describe("scheduleSchema", () => {
  const validSchedule = {
    employee_id: VALID_UUID,
    fecha: "2024-03-15",
    hora_inicio: "08:00",
    hora_fin: "16:00",
    horas_planificadas: 8,
  };

  it("accepts valid schedule data", () => {
    const result = scheduleSchema.safeParse(validSchedule);
    expect(result.success).toBe(true);
  });

  it("accepts valid schedule with optional fields", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      service_id: "SRV-001",
      tipo_asignacion: "regular",
    });
    expect(result.success).toBe(true);
  });

  it("allows service_id and tipo_asignacion to be null", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      service_id: null,
      tipo_asignacion: null,
    });
    expect(result.success).toBe(true);
  });

  it("fails when employee_id is not a valid UUID", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      employee_id: "bad-id",
    });
    expect(result.success).toBe(false);
  });

  it("fails when employee_id is missing", () => {
    const { employee_id, ...rest } = validSchedule;
    const result = scheduleSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  // Date format tests
  it("fails when fecha is not in YYYY-MM-DD format", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      fecha: "15-03-2024",
    });
    expect(result.success).toBe(false);
  });

  it("fails when fecha is in DD/MM/YYYY format", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      fecha: "15/03/2024",
    });
    expect(result.success).toBe(false);
  });

  it("fails when fecha includes time", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      fecha: "2024-03-15T10:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("fails when fecha is an arbitrary string", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      fecha: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  // Time format tests
  it("fails when hora_inicio is not in HH:mm format", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      hora_inicio: "8:00",
    });
    expect(result.success).toBe(false);
  });

  it("fails when hora_inicio includes seconds", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      hora_inicio: "08:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("fails when hora_fin is not in HH:mm format", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      hora_fin: "4pm",
    });
    expect(result.success).toBe(false);
  });

  it("fails when hora_fin is a single digit hour", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      hora_fin: "4:00",
    });
    expect(result.success).toBe(false);
  });

  // Planned hours tests
  it("fails when horas_planificadas is negative", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      horas_planificadas: -1,
    });
    expect(result.success).toBe(false);
  });

  it("fails when horas_planificadas is zero", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      horas_planificadas: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts fractional horas_planificadas", () => {
    const result = scheduleSchema.safeParse({
      ...validSchedule,
      horas_planificadas: 4.5,
    });
    expect(result.success).toBe(true);
  });
});

describe("validateSchedule", () => {
  it("returns success true for valid data", () => {
    const result = validateSchedule({
      employee_id: VALID_UUID,
      fecha: "2024-01-01",
      hora_inicio: "09:00",
      hora_fin: "17:00",
      horas_planificadas: 8,
    });
    expect(result.success).toBe(true);
  });

  it("returns success false for invalid data", () => {
    const result = validateSchedule({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Absence Validators
// ---------------------------------------------------------------------------

describe("absenceSchema", () => {
  const validAbsence = {
    employee_id: VALID_UUID,
    fecha: "2024-03-15",
    tipo: "vacaciones",
    horas_ausencia: 8,
  };

  it("accepts valid absence data", () => {
    const result = absenceSchema.safeParse(validAbsence);
    expect(result.success).toBe(true);
  });

  it("accepts valid absence with motivo", () => {
    const result = absenceSchema.safeParse({
      ...validAbsence,
      motivo: "Vacaciones anuales",
    });
    expect(result.success).toBe(true);
  });

  it("allows motivo to be null", () => {
    const result = absenceSchema.safeParse({
      ...validAbsence,
      motivo: null,
    });
    expect(result.success).toBe(true);
  });

  it("fails when employee_id is not a valid UUID", () => {
    const result = absenceSchema.safeParse({
      ...validAbsence,
      employee_id: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("fails when fecha is not in YYYY-MM-DD format", () => {
    const result = absenceSchema.safeParse({
      ...validAbsence,
      fecha: "03/15/2024",
    });
    expect(result.success).toBe(false);
  });

  it("fails when tipo is empty string", () => {
    const result = absenceSchema.safeParse({
      ...validAbsence,
      tipo: "",
    });
    expect(result.success).toBe(false);
  });

  it("fails when tipo is missing", () => {
    const { tipo, ...rest } = validAbsence;
    const result = absenceSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("fails when horas_ausencia is zero", () => {
    const result = absenceSchema.safeParse({
      ...validAbsence,
      horas_ausencia: 0,
    });
    expect(result.success).toBe(false);
  });

  it("fails when horas_ausencia is negative", () => {
    const result = absenceSchema.safeParse({
      ...validAbsence,
      horas_ausencia: -4,
    });
    expect(result.success).toBe(false);
  });

  it("accepts fractional horas_ausencia", () => {
    const result = absenceSchema.safeParse({
      ...validAbsence,
      horas_ausencia: 3.5,
    });
    expect(result.success).toBe(true);
  });
});

describe("validateAbsence", () => {
  it("returns success true for valid data", () => {
    const result = validateAbsence({
      employee_id: VALID_UUID,
      fecha: "2024-01-01",
      tipo: "baja",
      horas_ausencia: 4,
    });
    expect(result.success).toBe(true);
  });

  it("returns success false for invalid data", () => {
    const result = validateAbsence({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateScheduleHours
// ---------------------------------------------------------------------------

describe("validateScheduleHours", () => {
  it("returns true for 08:00 to 16:00 with 8 hours", () => {
    expect(validateScheduleHours("08:00", "16:00", 8)).toBe(true);
  });

  it("returns true for 08:00 to 16:30 with 8.5 hours", () => {
    expect(validateScheduleHours("08:00", "16:30", 8.5)).toBe(true);
  });

  it("returns true for 09:00 to 17:00 with 8 hours", () => {
    expect(validateScheduleHours("09:00", "17:00", 8)).toBe(true);
  });

  it("returns true for midnight-crossing shift: 22:00 to 06:00 with 8 hours", () => {
    expect(validateScheduleHours("22:00", "06:00", 8)).toBe(true);
  });

  it("returns true for midnight-crossing shift: 23:00 to 07:00 with 8 hours", () => {
    expect(validateScheduleHours("23:00", "07:00", 8)).toBe(true);
  });

  it("returns true for midnight-crossing short shift: 23:00 to 03:00 with 4 hours", () => {
    expect(validateScheduleHours("23:00", "03:00", 4)).toBe(true);
  });

  it("returns false when planned hours exceed actual by more than tolerance", () => {
    // 08:00 to 16:00 = 8 hours, but claiming 9
    expect(validateScheduleHours("08:00", "16:00", 9)).toBe(false);
  });

  it("returns false when planned hours are less than actual by more than tolerance", () => {
    // 08:00 to 16:00 = 8 hours, but claiming 7
    expect(validateScheduleHours("08:00", "16:00", 7)).toBe(false);
  });

  it("returns true when within 0.1h tolerance (planned slightly above)", () => {
    // 08:00 to 16:00 = 8 hours, claiming 8.1 (exactly at tolerance boundary)
    expect(validateScheduleHours("08:00", "16:00", 8.1)).toBe(true);
  });

  it("returns true when within 0.1h tolerance (planned slightly below)", () => {
    // 08:00 to 16:00 = 8 hours, claiming 7.9 (exactly at tolerance boundary)
    expect(validateScheduleHours("08:00", "16:00", 7.9)).toBe(true);
  });

  it("returns false when just outside tolerance (above)", () => {
    // 08:00 to 16:00 = 8 hours, claiming 8.2 (beyond tolerance)
    expect(validateScheduleHours("08:00", "16:00", 8.2)).toBe(false);
  });

  it("returns false when just outside tolerance (below)", () => {
    // 08:00 to 16:00 = 8 hours, claiming 7.8 (beyond tolerance)
    expect(validateScheduleHours("08:00", "16:00", 7.8)).toBe(false);
  });

  it("handles short shifts correctly", () => {
    // 10:00 to 14:00 = 4 hours
    expect(validateScheduleHours("10:00", "14:00", 4)).toBe(true);
  });

  it("handles shifts with 30-minute increments", () => {
    // 06:30 to 14:30 = 8 hours
    expect(validateScheduleHours("06:30", "14:30", 8)).toBe(true);
  });

  it("handles shifts ending at midnight", () => {
    // 16:00 to 00:00 = 8 hours (crosses midnight)
    expect(validateScheduleHours("16:00", "00:00", 8)).toBe(true);
  });
});
