# Frontend App

Frontend project migrated into the `apps/frontend` monorepo package.

Current state:

- Project configuration now lives in `apps/frontend`.
- The Vite entrypoint now lives in `apps/frontend/src/main.tsx`.
- The component tree is owned by this package and can be built or tested from this directory.
