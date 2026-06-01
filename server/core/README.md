# Backend Foundation

This folder holds the backend foundation for `server/data-server.mjs`.

## Boundaries

- Keep runtime paths, environment variables, local persistence helpers, and the canonical backend domain flow here.
- Do not add UI routes, menu definitions, page metadata, or copied frontend behavior here.
- The canonical business order is fixed as: organization -> employee -> attendance -> payroll.
- Keep this folder small and cohesive. Do not split every helper into a separate file unless there is a real maintenance reason.

## Modules

- `foundation.mjs`: runtime config, local JSON store helpers, and backend domain flow.

## Domain Flow

1. Organization: organization structures, positions, ranks, and organization settings.
2. Employee: employee records and employment data, resolved against organization data.
3. Attendance: attendance settings, schedules, clock records, leave, field work, and monthly outputs.
4. Payroll: payroll/statistical inputs that consume organization, employee, and attendance outputs.

## Foundation Endpoints

- `GET /api/health`: exposes the canonical domain flow and runtime source directories.
- `GET /api/hr-core/migration-bundle`: exports data in organization -> employee -> attendance -> payroll order.
- `GET /api/organization-management/foundation`: organization source, write rules, employee output contract, and quality checks.
- `GET /api/employee-management/foundation`: employee source, organization linkage, attendance/payroll output contracts, and quality checks.
- `GET /api/attendance-management/foundation`: attendance settings, schedules, clock records, monthly outputs, payroll contract, and quality checks.
- `GET /api/payroll-management/foundation`: payroll input boundary, stat items, external records, formula trace contract, and quality checks.
