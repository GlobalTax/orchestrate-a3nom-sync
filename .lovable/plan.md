

## Plan: Fix TypeScript Build Errors

4 files need fixes for the remaining build errors.

### 1. `src/components/NotificationBell.tsx`
- Cast `payload.new` as `Notification` in both INSERT and UPDATE handlers (lines 51, 70-71)
- Cast `data` from Supabase as `Notification[]` in `fetchNotifications` (line 99)

### 2. `src/components/NewEmployeeDialog.tsx`
- The `EmployeeInput` type from zod may produce `null` for optional fields like `email`, but `Employee` uses `string | undefined`. Fix: change `EmployeesService.create` parameter to accept the zod output by casting, or adjust the `Employee` interface to accept `null`.
- Simplest fix: cast `data` in the mutation call: `EmployeesService.create(data as unknown as Omit<Employee, "id">)`

### 3. `supabase/functions/sync_orquest/index.ts`
- `orquestCookie` is `string | undefined` but `syncEmployees`, `syncSchedules`, `syncAbsences` expect `string | null` for the `legacyCookie` parameter.
- Fix: pass `orquestCookie ?? null` at each call site (lines 257, 279, 302)

### 4. Verify no other errors remain
- The `useUserRole.ts` errors from the previous build should already be fixed based on the current code.

### Technical details
- NotificationBell: 3 cast fixes for `payload.new as Notification` and `data as unknown as Notification[]`
- NewEmployeeDialog: 1 cast fix at line 46
- sync_orquest: 3 `?? null` fixes at lines 257, 279, 302

