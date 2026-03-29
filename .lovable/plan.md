
Do I know what the issue is? Sí.

El problema más probable no es “una página concreta”, sino el arranque global de la app:
- la autenticación se resuelve en varios sitios a la vez (`Index`, `Auth`, `Layout`, `useUserRole`, `useUserTheme`)
- `useUserRole` consulta `getUser()` antes de que la sesión esté estable
- `RestaurantProvider` y `CentroProvider` se montan antes del router y dependen de `useUserRole`
- `Layout.tsx` todavía tiene `if (!session) return null`, que deja la pantalla blanca
- el `ErrorBoundary` actual no protege los providers de nivel superior

Plan de implementación

1. Crear una fuente única de verdad para auth
- Añadir un hook `useAuthReady` que:
  - haga `supabase.auth.getSession()` al arrancar
  - luego escuche `onAuthStateChange`
  - exponga `session`, `user` e `isReady`
- Objetivo: no depender de varios `getSession/getUser` dispersos.

2. Sustituir los bootstraps duplicados
- `src/pages/Index.tsx`: usar `useAuthReady` y redirigir solo cuando `isReady` sea `true`
- `src/pages/Auth.tsx`: usar el mismo hook para evitar chequeos paralelos
- `src/components/Layout.tsx`: quitar la lógica manual de sesión y consumir `useAuthReady`

3. Eliminar la pantalla blanca real
- En `Layout.tsx`, reemplazar `return null` por un estado visible:
  - loader si auth aún no está lista
  - redirección controlada a `/auth` si ya está lista y no hay sesión
- Mantener el control de permisos admin, pero solo después de `isReady` y de que roles hayan cargado.

4. Frenar queries hasta que auth esté lista
- `src/hooks/useUserRole.ts`:
  - dejar de llamar `supabase.auth.getUser()` dentro de la query
  - recibir `user/isReady` desde `useAuthReady`
  - usar `enabled: isReady && !!user`
- Aplicar el mismo patrón en hooks/efectos de arranque que hoy consultan usuario demasiado pronto:
  - `src/hooks/useUserTheme.ts`
  - `src/components/NotificationBell.tsx`
  - cualquier query montada desde providers globales

5. Proteger el nivel superior con ErrorBoundary
- Mover `ErrorBoundary` para envolver también providers y no solo las rutas
- Así, si falla `RestaurantProvider`, `CentroProvider` o `useUserTheme`, se verá el fallback y no un lienzo blanco.

6. Ajustar providers globales
- `RestaurantProvider` y `CentroProvider` deben esperar a `auth ready`
- Si el usuario no está autenticado todavía, no deben lanzar queries derivadas de roles
- Resultado: menos carreras de estado al abrir `/`

Archivos a tocar
- `src/hooks/useAuthReady.ts` (nuevo)
- `src/components/Layout.tsx`
- `src/pages/Index.tsx`
- `src/pages/Auth.tsx`
- `src/hooks/useUserRole.ts`
- `src/hooks/useUserTheme.ts`
- `src/components/NotificationBell.tsx`
- `src/App.tsx` o `src/main.tsx`
- posiblemente `src/contexts/RestaurantContext.tsx` y `src/contexts/CentroContext.tsx`

Resultado esperado
- Al abrir `/`, la app mostrará un loader visible y luego irá a `/auth` o `/dashboard`
- No habrá más `return null` en el flujo de arranque
- Las queries con RLS no se ejecutarán antes de que la sesión exista
- Si algo falla en providers/hooks globales, aparecerá el fallback del `ErrorBoundary` en vez de pantalla blanca
