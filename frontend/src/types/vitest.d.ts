/// <reference types="vitest" />

// This file provides TypeScript definitions for Vitest globals
// that might be missing in the project

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_DEV_MODE?: string
}

// Define window globals
declare global {
  interface Window {
    ENV?: ImportMetaEnv
  }
}

export {}
