# Expense Tracker

A modern web application for tracking personal expenses built with Next.js 15, TypeScript, and Supabase.

## Features

- 🔐 User authentication and authorization
- 💰 Multiple expense input methods (quick entry, full form, bulk table import)
- 🤖 Automatic expense categorization with keyword matching and synonyms
- 📊 **Advanced Analytics Dashboard** (NEW!)
  - Interactive charts (line, bar, pie)
  - Period comparison and trends
  - Category and city analytics
  - Calendar heatmap visualization
  - Multiple time filters (week, month, quarter, year)
- 🏙️ City management with synonyms and geolocation
- 🏷️ Category groups with drag-and-drop sorting
- 📂 Bulk import from CSV and bank statements
- 💾 Backup and restore functionality
- 📱 Responsive design for all devices

## Tech Stack

- **Frontend**: Next.js 15 (App Router, Server Components, Server Actions)
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Deployment**: Vercel
- **Integration**: MCP Supabase Server
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Type Safety**: TypeScript + Zod
- **UI**: Custom components + Radix UI primitives

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
│   │   ├── analytics/           # Analytics charts and visualizations
│   │   ├── categories/          # Category management
│   │   ├── cities/              # City management
│   │   ├── keywords/            # Keyword management
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

## License

This project is private and not licensed for public use.