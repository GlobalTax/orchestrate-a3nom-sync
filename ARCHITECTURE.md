# Arquitectura del Proyecto - Orquest + A3Nom

## 📋 Tabla de Contenidos

- [Visión General](#visión-general)
- [Arquitectura](#arquitectura)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Patrones de Diseño](#patrones-de-diseño)
- [Convenciones de Código](#convenciones-de-código)
- [Guía de Desarrollo](#guía-de-desarrollo)

## 🎯 Visión General

Sistema de integración entre Orquest (planificación) y A3Nom (nóminas) refactorizado para máxima modularidad, mantenibilidad y escalabilidad.

### Características Principales

- **Gestión de Restaurantes**: CRUD completo con franquicias y servicios
- **Análisis de Datos**: Dashboard con métricas de costes y horas
- **Gestión de Personal**: Sincronización empleados y horarios
- **Calidad de Datos**: Detección y resolución de inconsistencias
- **Alertas**: Sistema configurable de notificaciones

## 🏗 Arquitectura

### Stack Tecnológico

#### Frontend
- **React 18** con TypeScript
- **Vite** para build optimizado
- **TanStack Query** para gestión de estado servidor
- **React Router v6** para navegación
- **Tailwind CSS** + **shadcn/ui** para diseño
- **Zod** para validación de datos

#### Backend
- **Supabase** (PostgreSQL + Auth + Edge Functions)
- **Row Level Security (RLS)** para autorización
- **Edge Functions** (Deno) para lógica servidor

#### Integraciones
- **Orquest API** vía proxy Edge Function
- **A3Nom** vía importación Excel

### Capas de la Aplicación

```
┌─────────────────────────────────────────────────┐
│            UI Components Layer                   │
│  (Pages, Features, Common Components)           │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│          Business Logic Layer                    │
│  (Hooks, Validators, Calculations, Formatters)  │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│           Data Access Layer                      │
│  (API Services, Orquest Services)               │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         External Systems Layer                   │
│  (Supabase, Orquest API, Edge Functions)       │
└─────────────────────────────────────────────────┘
```

## 📁 Estructura del Proyecto

```
src/
├── components/              # Componentes UI genéricos
│   ├── common/             # Reutilizables (DataTable, LoadingSpinner, etc.)
│   └── ui/                 # Primitivos shadcn
│
├── features/               # Módulos por funcionalidad (Feature-based)
│   └── restaurants/
│       ├── components/     # Componentes específicos del feature
│       │   ├── RestaurantsList.tsx
│       │   ├── FranchiseesTab.tsx
│       │   └── dialogs/
│       ├── hooks/          # Hooks de datos del feature
│       │   ├── useRestaurants.ts
│       │   ├── useFranchisees.ts
│       │   └── ...
│       ├── state/          # Gestión de estado (reducers)
│       │   └── restaurantState.ts
│       ├── types.ts        # Tipos TypeScript
│       └── index.tsx       # Orquestador principal
│
├── services/               # Capa de servicios (Data Access)
│   ├── api/               # Servicios Supabase
│   │   ├── restaurants.service.ts
│   │   ├── employees.service.ts
│   │   ├── schedules.service.ts
│   │   ├── absences.service.ts
│   │   ├── costs.service.ts
│   │   └── index.ts
│   └── orquest/           # Servicios Orquest API
│       ├── base.ts        # Cliente HTTP base
│       ├── employees.ts
│       ├── schedules.ts
│       ├── absences.ts
│       ├── services.ts
│       └── index.ts
│
├── lib/                   # Utilidades y helpers
│   ├── calculations/      # Funciones de cálculo
│   │   ├── costCalculations.ts
│   │   └── scheduleCalculations.ts
│   ├── validators/        # Esquemas Zod
│   │   ├── restaurantValidators.ts
│   │   └── employeeValidators.ts
│   ├── errorHandling.ts   # Manejo centralizado de errores
│   ├── formatters.ts      # Formateo de datos
│   ├── constants.ts       # Constantes globales
│   └── index.ts
│
├── hooks/                 # Hooks globales reutilizables
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   ├── useTableState.ts
│   ├── useAsync.ts
│   └── index.ts
│
├── pages/                 # Páginas/Rutas
│   ├── Dashboard.tsx
│   ├── Employees.tsx
│   ├── admin/            # Rutas admin
│   │   ├── Restaurantes.tsx
│   │   ├── Users.tsx
│   │   └── ...
│   └── ...
│
├── types/                 # Tipos globales
│   └── index.ts
│
└── integrations/          # Integraciones externas
    └── supabase/
        ├── client.ts
        └── types.ts

supabase/
├── functions/             # Edge Functions
│   ├── orquest_proxy/
│   ├── sync_orquest/
│   ├── compute_alerts/
│   └── ...
└── migrations/            # Migraciones SQL
```

## 🎨 Patrones de Diseño

### 1. Feature-Based Architecture

Cada funcionalidad está contenida en su propio módulo:

```typescript
// features/restaurants/
├── components/    # UI específica
├── hooks/         # Lógica de datos
├── state/         # Estado local
├── types.ts       # Tipos
└── index.tsx      # Punto de entrada
```

**Ventajas:**
- ✅ Alta cohesión, bajo acoplamiento
- ✅ Fácil de encontrar código relacionado
- ✅ Facilita testing y mantenimiento
- ✅ Permite lazy loading por feature

### 2. Service Layer Pattern

Servicios separados para cada fuente de datos:

```typescript
// services/api/restaurants.service.ts
export class RestaurantsService {
  static async getAll(): Promise<Restaurant[]> { }
  static async create(data: RestaurantFormData): Promise<void> { }
  static async update(id: string, data: RestaurantFormData): Promise<void> { }
  static async delete(id: string): Promise<void> { }
}
```

**Ventajas:**
- ✅ Single source of truth para operaciones de datos
- ✅ Fácil de mockear en tests
- ✅ Abstrae detalles de implementación
- ✅ Consistencia en manejo de errores

### 3. Custom Hooks Pattern

Encapsular lógica reutilizable en hooks:

```typescript
// features/restaurants/hooks/useRestaurants.ts
export const useRestaurants = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["restaurants"],
    queryFn: RestaurantsService.getAll,
  });

  const saveMutation = useMutation({
    mutationFn: RestaurantsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries(["restaurants"]);
      toast.success("Guardado");
    },
  });

  return { restaurants: data, isLoading, save: saveMutation.mutate };
};
```

**Ventajas:**
- ✅ Separación de lógica y UI
- ✅ Reutilizable en múltiples componentes
- ✅ Fácil de testear

### 4. Reducer Pattern para Estado Complejo

Estado complejo gestionado con reducers:

```typescript
// features/restaurants/state/restaurantState.ts
export const useRestaurantState = () => {
  const [state, dispatch] = useReducer(restaurantReducer, initialState);

  return {
    state,
    setActiveTab: (tab: string) => dispatch({ type: "SET_TAB", payload: tab }),
    openDialog: (dialog, item) => dispatch({ type: "OPEN_DIALOG", payload: { dialog, item } }),
  };
};
```

**Ventajas:**
- ✅ Estado predecible
- ✅ Transiciones complejas simplificadas
- ✅ Fácil de debuggear

### 5. Validation with Zod

Validación type-safe con schemas:

```typescript
// lib/validators/restaurantValidators.ts
export const restaurantSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  // ...
});

export type RestaurantInput = z.infer<typeof restaurantSchema>;

export const validateRestaurant = (data: unknown) => {
  return restaurantSchema.safeParse(data);
};
```

### 6. Centralized Error Handling

Manejo consistente de errores:

```typescript
// lib/errorHandling.ts
export const ErrorHandler = {
  handle(error: unknown, context?: string) {
    // Logging, toast notifications, etc.
  },
  
  async handleAsync<T>(fn: () => Promise<T>, context: string): Promise<T | null> {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, context);
      return null;
    }
  },
};
```

## 📝 Convenciones de Código

### Nomenclatura

- **Componentes**: PascalCase (`RestaurantDialog.tsx`)
- **Hooks**: camelCase con prefijo `use` (`useRestaurants.ts`)
- **Services**: PascalCase con sufijo `Service` (`RestaurantsService`)
- **Tipos**: PascalCase (`Restaurant`, `RestaurantFormData`)
- **Constantes**: UPPER_SNAKE_CASE (`DEFAULT_PAGE_SIZE`)

### Importaciones

Orden recomendado:

```typescript
// 1. Librerías externas
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// 2. Componentes UI
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// 3. Componentes locales
import { RestaurantsList } from "./components/RestaurantsList";

// 4. Hooks
import { useRestaurants } from "./hooks/useRestaurants";

// 5. Servicios
import { RestaurantsService } from "@/services/api";

// 6. Tipos
import type { Restaurant } from "./types";

// 7. Utilidades
import { formatCurrency } from "@/lib/formatters";
```

### Componentes

```typescript
// Preferir componentes funcionales con tipos explícitos
interface RestaurantCardProps {
  restaurant: Restaurant;
  onEdit: (id: string) => void;
}

export const RestaurantCard = ({ restaurant, onEdit }: RestaurantCardProps) => {
  // Hooks primero
  const [isOpen, setIsOpen] = useState(false);
  
  // Funciones handlers
  const handleClick = () => {
    onEdit(restaurant.id);
  };
  
  // Render
  return (
    <Card onClick={handleClick}>
      {/* ... */}
    </Card>
  );
};
```

### Hooks

```typescript
// Siempre retornar objeto, no tupla (excepto useState)
export const useRestaurants = () => {
  // ✅ CORRECTO
  return {
    restaurants: data,
    isLoading,
    save: saveMutation.mutate,
  };
  
  // ❌ INCORRECTO
  // return [data, isLoading, saveMutation.mutate];
};
```

## 🚀 Guía de Desarrollo

### Crear un Nuevo Feature

1. **Crear estructura de carpetas:**
```bash
src/features/[feature-name]/
├── components/
├── hooks/
├── state/
├── types.ts
└── index.tsx
```

2. **Definir tipos en `types.ts`:**
```typescript
export interface MyEntity {
  id: string;
  name: string;
  // ...
}

export interface MyFormData {
  name: string;
  // ...
}
```

3. **Crear servicio en `services/api/`:**
```typescript
export class MyEntityService {
  static async getAll(): Promise<MyEntity[]> { }
  static async create(data: MyFormData): Promise<void> { }
}
```

4. **Crear hook de datos:**
```typescript
export const useMyEntity = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["my-entity"],
    queryFn: MyEntityService.getAll,
  });
  
  return { entities: data, isLoading };
};
```

5. **Crear componentes UI:**
```typescript
export const MyEntityList = () => {
  const { entities, isLoading } = useMyEntity();
  
  return <DataTable data={entities} isLoading={isLoading} />;
};
```

### Agregar Validación

1. **Crear schema Zod:**
```typescript
// lib/validators/myEntityValidators.ts
export const myEntitySchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
});

export type MyEntityInput = z.infer<typeof myEntitySchema>;
```

2. **Usar en formulario:**
```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const form = useForm<MyEntityInput>({
  resolver: zodResolver(myEntitySchema),
});
```

### Agregar Utilidad de Cálculo

```typescript
// lib/calculations/myCalculations.ts
export const MyCalculations = {
  calculate(a: number, b: number): number {
    return a + b;
  },
};
```

### Testing (Futuro)

```typescript
// __tests__/calculations.test.ts
import { CostCalculations } from '@/lib/calculations/costCalculations';

describe('CostCalculations', () => {
  it('calculates hourly cost correctly', () => {
    expect(CostCalculations.calculateHourlyCost(100, 10)).toBe(10);
  });
});
```

## 📊 Métricas de Éxito

### Refactorización Completada

- ✅ **Reducción de líneas:** Restaurantes.tsx de 1,906 → 437 líneas (-77%)
- ✅ **Modularidad:** 11 componentes + 5 hooks vs 1 archivo monolítico
- ✅ **Reutilización:** 8 componentes comunes reutilizables
- ✅ **Servicios:** 12 módulos de servicios organizados
- ✅ **Utilidades:** 7 módulos de utilidades y validadores

### Objetivos

- ⭐ Ningún archivo > 400 líneas
- ⭐ Reutilización de componentes: 70%+
- ⭐ Cobertura de tests: 60%+ (futuro)
- ⭐ 0 errores TypeScript en modo strict (futuro)

## 📚 Recursos

- [React Query Docs](https://tanstack.com/query/latest)
- [Zod Documentation](https://zod.dev)
- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
