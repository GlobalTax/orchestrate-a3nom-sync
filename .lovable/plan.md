
Diagnóstico probable

Do I know what the issue is? Sí, con bastante claridad: ahora mismo hay varios puntos en el código que pueden dejar la app en blanco aunque no haya un error visible.

1. `src/components/Layout.tsx`
   - Si `session` todavía no se ha resuelto, hace `return null`.
   - Eso puede dejar una pantalla vacía durante el arranque o si falla la resolución de sesión.

2. `src/pages/Dashboard.tsx` + `src/hooks/useDashboardMetrics.ts`
   - La home autenticada cae en `/dashboard`.
   - Ese dashboard depende de varias RPC y usa datos que pueden quedar `undefined` si una query falla.
   - Como no hay un `ErrorBoundary` envolviendo la app, un error de render ahí puede terminar en pantalla en blanco.

3. Varias páginas admin (`Sync`, `OrquestSync`, `Audit`)
   - Siguen el patrón `if (!isAdmin) return null`.
   - Si algo falla con roles/permisos, el resultado visible puede ser “no veo nada”.

4. `src/components/common/ErrorBoundary.tsx`
   - Existe, pero no está montado alrededor de la app, así que ahora un fallo de render no muestra fallback.

Plan de implementación

1. Endurecer el arranque de autenticación
   - En `src/components/Layout.tsx`, separar:
     - “sesión todavía cargando”
     - “sin sesión”
     - “sesión lista”
   - Sustituir `if (!session) return null` por un loader/pantalla de carga visible.
   - Mantener la redirección a `/auth`, pero solo después de resolver explícitamente la sesión.

2. Añadir protección global contra pantallas en blanco
   - Envolver la app/rutas con `ErrorBoundary` desde `src/main.tsx` o `src/App.tsx`.
   - Así, si falla `Dashboard` u otra página, veremos un mensaje útil en vez de un lienzo vacío.

3. Hacer el dashboard resistente a errores de datos
   - En `src/hooks/useDashboardMetrics.ts`, devolver defaults seguros:
     - `dailyData: []`
     - `serviceMetrics: []`
     - métricas nulas o vacías controladas
   - Exponer también el estado de error de las queries.
   - En `src/pages/Dashboard.tsx`, renderizar:
     - loader mientras carga
     - alerta/empty state si falla
     - contenido solo con arrays/objetos seguros

4. Eliminar `return null` en pantallas críticas
   - Reemplazar en `src/pages/admin/Sync.tsx`, `src/pages/admin/OrquestSync.tsx` y páginas similares el patrón:
     - `if (!isAdmin) return null`
   - Por una de estas dos opciones:
     - redirección controlada con toast
     - estado vacío explícito tipo “No tienes permisos”
   - Objetivo: que nunca haya una página completamente vacía por permisos.

5. Revisar la ruta raíz
   - En `src/pages/Index.tsx`, mantener la decisión `/auth` vs `/dashboard`, pero con un flujo consistente con el bootstrap de sesión.
   - Si hace falta, reutilizar el mismo estado de “auth loading” para evitar transiciones invisibles.

Detalles técnicos

Archivos a tocar:
- `src/components/Layout.tsx`
- `src/App.tsx` o `src/main.tsx`
- `src/hooks/useDashboardMetrics.ts`
- `src/pages/Dashboard.tsx`
- `src/pages/admin/Sync.tsx`
- `src/pages/admin/OrquestSync.tsx`
- posiblemente `src/pages/admin/Audit.tsx` y cualquier otra página con `return null` por permisos

Cambios clave:
- introducir `authResolved` / `sessionLoading`
- usar `LoadingSpinner` en vez de `return null`
- montar `ErrorBoundary`
- devolver arrays por defecto en hooks
- renderizar estados de error explícitos
- quitar renders invisibles por permisos

Resultado esperado

Después de estos cambios:
- la app dejará de quedarse en blanco al arrancar
- si falla el dashboard, se verá un fallback o mensaje de error
- si el problema es de permisos, el usuario verá un mensaje claro en vez de una pantalla vacía
- navegar a `/` mostrará una transición visible hasta llegar a `/auth` o `/dashboard`
