export type ClinicStatusType =
  | "accepting"
  | "limited"
  | "not_accepting"
  | "closed";

export type VerificationType =
  | "confirmed_open"
  | "confirmed_closed"
  | "accepting_emergencies"
  | "phone_not_working";

export type VerificationSource = "community" | "owner" | "system";

export type TriageCategory = "trauma" | "poisoning" | "respiratory";

export type UserRole = "pet_owner" | "clinic_admin" | "admin";

export interface NearbyClinic {
  id: string;
  slug: string | null;
  name: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  location_verified: boolean;
  emergency_capable: boolean;
  owner_verified: boolean;
  services: string[];
  hours: string | null;
  confidence_score: number;
  distance_meters: number;
  current_status: ClinicStatusType;
  status_updated_at: string | null;
  rank_score: number;
  review_count: number;
  average_rating: number | null;
  image_url: string | null;
  google_maps_url: string | null;
}

export interface ClinicDetail extends NearbyClinic {
  claimed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Verification {
  id: string;
  clinic_id: string;
  user_id: string | null;
  verification_type: VerificationType;
  source: VerificationSource;
  created_at: string;
}

export interface Profile {
  id: string;
  role: UserRole;
  email: string;
}

export type ReviewStatus = "published" | "pending" | "hidden";

export interface ClinicReview {
  id: string;
  clinic_id: string;
  user_id: string | null;
  rating: number;
  body: string;
  reviewer_name: string;
  experience_tags: string[];
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
}

export interface ReviewSummary {
  review_count: number;
  average_rating: number | null;
}
