// @ts-nocheck
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = (import.meta as any)?.env?.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = () => createBrowserClient(supabaseUrl!, supabaseKey!);
