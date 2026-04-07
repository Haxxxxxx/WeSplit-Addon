/**
 * Contact types.
 */

// ---------------------------------------------------------------------------
// Contact (contacts collection) — Enhanced with relationship metadata
// ---------------------------------------------------------------------------

export interface Contact {
  id: string;
  owner_id: string; // User who owns this contact
  contact_user_id: string; // The user being saved as a contact
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  wallet_address?: string;
  isFavorite: boolean;
  first_met_at: string;
  last_interaction_at?: string;
  interaction_count?: number;
  source?: 'transaction' | 'split' | 'payment_request' | 'manual' | 'shared_wallet';
  created_at: string;
  updated_at?: string;
}
