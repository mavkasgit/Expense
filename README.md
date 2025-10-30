# Expense Tracker

A modern web application for tracking personal expenses built with Next.js 15, TypeScript, and Supabase.

## Features

- User authentication and authorization
- Multiple expense input methods (single entry, bulk table import)
- Automatic expense categorization with keyword matching
- Analytics and expense visualization
- Responsive design for all devices

## Tech Stack

- **Frontend**: Next.js 15 (App Router, Server Components, Server Actions)
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel
- **Integration**: MCP Supabase Server
- **Styling**: Tailwind CSS
- **Type Safety**: TypeScript

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
expense-tracker/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/              # Auth route group
│   │   ├── (dashboard)/         # Protected routes
│   │   └── auth/                # Auth confirmation
│   ├── components/              # Reusable components
│   │   ├── ui/                  # Base UI components
│   │   ├── forms/               # Form components
│   │   ├── expense-input/       # Expense input methods
│   │   ├── categorization/      # Auto-categorization components
│   │   ├── charts/              # Analytics components
│   │   └── layout/              # Layout components
│   ├── lib/                     # Utilities and configurations
│   │   ├── supabase/            # Supabase clients
│   │   ├── actions/             # Server Actions
│   │   ├── validations/         # Zod schemas
│   │   └── utils.ts
│   ├── types/                   # TypeScript definitions
│   └── middleware.ts            # Auth middleware
```

## Development

This project follows a spec-driven development approach. See the `.kiro/specs/expense-tracker/` directory for detailed requirements, design, and implementation tasks.

## Building

### Offline syntax check (default in constrained environments)
- Run `npm run build`.
- If `node_modules/.bin/next` is not available, the script executes `scripts/build.mjs`.
- The fallback loads the globally available TypeScript compiler and transpiles every `.ts`/`.tsx` file to make sure there are no syntax errors.
- This path does **not** perform a full Next.js build, but it guarantees that the source compiles at least at the syntax level when dependencies cannot be installed (e.g. due to restricted registries).

### Full Next.js production build
1. Ensure npm can reach the package registry (configure the corporate proxy if needed).
2. Install dependencies with `npm install` (or `pnpm install`/`yarn install`).
3. Run `npm run build` again. When `node_modules/.bin/next` is present the script automatically delegates to `next build`, giving you the real production output.
4. Optionally run `npm run start` to serve the production bundle locally.

The custom build script lives in `scripts/build.mjs` and can be extended with additional checks if required.

## License

This project is private and not licensed for public use.
