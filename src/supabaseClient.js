import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oislqinjwmpgrmivaszf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pc2xxaW5qd21wZ3JtaXZhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MTI2ODYsImV4cCI6MjA5Mjk4ODY4Nn0.yJLs0DoTQq_W6Q80tmn-QuEmKJEtQw2x_UBoA9IhEsA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)