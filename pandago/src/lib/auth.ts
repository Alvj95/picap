/** Sustituir por el proveedor real (Supabase/Firebase Auth). El backend valida este JWT. */
export async function getAuthToken(): Promise<string> {
  return 'dev-token';
}
