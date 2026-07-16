// Suspended-user writes are blocked at the RLS layer (see the admin_portal
// migration), which surfaces as a generic Postgres "row-level security"
// error. Translate that specific case into something a user can act on.
export function friendlyErrorMessage(error: Error): string {
  if (error.message.toLowerCase().includes("row-level security")) {
    return "Your account has been suspended.";
  }

  return error.message;
}
