// Response shapes returned by the data-access layer (lib/api.ts). These are
// what the FastAPI endpoints will return in Phase 4.

import type {
  CompanyProfile,
  Deal,
  DealAction,
  FarmerProfile,
  Flag,
  Listing,
  Match,
  Party,
  Prediction,
  Requirement,
  Review,
  User,
} from './types';

export interface Session {
  user: User;
  farmer?: FarmerProfile;
  company?: CompanyProfile;
}

export interface ListingView extends Listing {
  farmerName: string; // "Ramesh P." to companies, full name to the owner
  isMine: boolean;
  /** Approximate km from the viewing company, rounded to 5 km. */
  distanceKm?: number;
}

export interface RequirementView extends Requirement {
  companyName: string;
  companyVerified: boolean;
}

export interface ListingMatch extends Match {
  requirement: RequirementView;
}

export interface RequirementMatch extends Match {
  listing: ListingView;
}

export interface ListingInsight {
  prediction: Prediction;
  nearbyDemandKg: number;
  nearbyBuyers: number;
  radiusKm: number;
}

export interface ListingDetail {
  listing: ListingView;
  insight: ListingInsight;
  matches: ListingMatch[];
  deals: DealView[];
}

export interface BrowseFilters {
  cropId?: string;
  districtId?: string;
  minQtyKg?: number;
  readyBefore?: string;
  radiusKm?: number;
}

export interface BrowseResult {
  listing: ListingView;
  bestMatch?: { requirementId: string; score: number };
}

export interface RequirementWithMatches {
  requirement: RequirementView;
  matches: RequirementMatch[];
}

export interface DealView extends Deal {
  cropId: Listing['cropId'];
  listingVariety: string;
  listingRemainingKg: number;
  companyName: string;
  farmerName: string;
  farmerVillage: string;
  /** Masked until the deal is Accepted (Security & Privacy section 3.1). */
  farmerPhone: string;
  companyPhone: string;
  myParty: Party | null;
  allowed: DealAction[];
  awaiting: Party | null;
  review?: Review;
}

export interface VerificationItem {
  user: User;
  company: CompanyProfile;
}

export interface FlagView extends Flag {
  listing: ListingView;
  reporterName: string;
}

export interface AdminOverview {
  farmers: number;
  companiesVerified: number;
  companiesPending: number;
  activeListings: number;
  openRequirements: number;
  dealsByStatus: Record<Deal['status'], number>;
  recentDeals: DealView[];
  flags: FlagView[];
}
