# Vimeo Video Exporter

## Overview

This is a single-page web application that allows users to export video titles and links from their Vimeo albums to Excel files. The application provides a clean, secure interface for entering Vimeo API credentials and album information, then fetches video data using the Vimeo API and enables export to Excel format using SheetJS.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: React hooks for local state, TanStack Query for server state
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Build System**: Vite for frontend bundling, esbuild for backend bundling
- **Development**: Hot module replacement with Vite middleware integration
- **Static Assets**: Served through Vite in development, built to dist/public for production

### Data Storage Solutions
- **Database ORM**: Drizzle ORM configured for PostgreSQL
- **Session Storage**: PostgreSQL sessions using connect-pg-simple
- **Schema Management**: Centralized schema definitions in shared directory
- **Migrations**: Drizzle Kit for database migrations

### Authentication and Authorization
- **User Model**: Basic user schema with username/password fields
- **Storage Interface**: Abstracted storage layer with in-memory fallback
- **Session Management**: Express sessions with PostgreSQL store
- **AI Feature Protection**: Password-protected AI features with dual unlock methods:
  - System password (configurable via environment variable) using server's OpenAI API key
  - Personal OpenAI API key for users with their own credits

### Component Architecture
- **Design System**: Shadcn/ui components with consistent styling
- **Accessibility**: Radix UI primitives ensure WCAG compliance
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Icon System**: Lucide React icons for consistent iconography

### API Integration Pattern
- **Vimeo API**: Direct frontend integration with Vimeo's REST API
- **Excel Export**: Browser-based Excel generation using SheetJS library
- **Error Handling**: Comprehensive error boundaries and user feedback
- **Security**: Masked API token inputs and client-side validation

## External Dependencies

### Core Framework Dependencies
- **React**: Frontend framework with TypeScript support
- **Express.js**: Backend web server framework
- **Vite**: Build tool and development server

### Database and ORM
- **Drizzle ORM**: Type-safe database operations
- **@neondatabase/serverless**: PostgreSQL database driver
- **connect-pg-simple**: PostgreSQL session store

### UI and Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Component library built on Radix UI
- **Radix UI**: Unstyled, accessible UI primitives
- **Lucide React**: Icon library

### Data Management
- **TanStack Query**: Server state management
- **React Hook Form**: Form state and validation
- **Zod**: Runtime type validation
- **date-fns**: Date manipulation utilities

### External APIs and Services
- **Vimeo API**: Video data retrieval from user albums
- **SheetJS (xlsx)**: Excel file generation and export
- **CDN Libraries**: React and dependencies hosted via CDN for client-side operations

### Development Tools
- **TypeScript**: Static type checking
- **ESLint**: Code linting and formatting
- **PostCSS**: CSS processing with Autoprefixer
- **Replit Integration**: Development environment optimizations