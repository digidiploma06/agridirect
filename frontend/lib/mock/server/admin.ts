// Admin endpoints (/admin/*) plus in-app notifications.

import { ApiError } from '../../api-error';
import { sanitizeText } from '../../validation';
import type { AppNotification, AuditEntry, DealStatus, ModelMetric, PipelineRun, PipelineSource } from '../../types';
import type { AdminOverview, FlagView, VerificationItem } from '../../views';
import type { MockDb } from '../seed';
import { MODEL_VERSION } from '../signals';
import { mutate, readDb } from '../store';
import { audit, currentUser, delay, notify, nowIso, requireRole, toDealView, toListingView } from './context';

const ALL_STATUSES: DealStatus[] = ['enquiry', 'offer_sent', 'negotiation', 'accepted', 'rejected', 'cancelled', 'completed'];

function flagViews(db: MockDb): FlagView[] {
  const admin = currentUser(db);
  return db.flags
    .filter((f) => f.status === 'open')
    .flatMap((f) => {
      const listing = db.listings.find((l) => l.id === f.listingId);
      if (!listing) return [];
      const reporter = db.users.find((u) => u.id === f.reporterId);
      return [{ ...f, listing: toListingView(db, listing, admin), reporterName: reporter?.name ?? '' }];
    });
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const db = readDb();
  const admin = requireRole(db, 'admin');
  const companies = db.users.filter((u) => u.role === 'company');
  const dealsByStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<DealStatus, number>;
  db.deals.forEach((d) => (dealsByStatus[d.status] += 1));
  return delay({
    farmers: db.users.filter((u) => u.role === 'farmer').length,
    companiesVerified: companies.filter((u) => u.status === 'verified').length,
    companiesPending: companies.filter((u) => u.status === 'pending').length,
    activeListings: db.listings.filter((l) => l.status === 'active' && !l.hidden).length,
    openRequirements: db.requirements.filter((r) => r.status === 'open').length,
    dealsByStatus,
    recentDeals: [...db.deals]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
      .map((d) => toDealView(db, d, admin)),
    flags: flagViews(db),
  });
}

export async function listVerifications(): Promise<VerificationItem[]> {
  const db = readDb();
  requireRole(db, 'admin');
  const items = db.users
    .filter((u) => u.role === 'company' && u.status === 'pending')
    .flatMap((user) => {
      const company = db.companies.find((c) => c.userId === user.id);
      return company ? [{ user, company }] : [];
    })
    .sort((a, b) => a.company.submittedAt.localeCompare(b.company.submittedAt));
  return delay(items);
}

export async function verifyCompany(userId: string, decision: 'approve' | 'reject', reason?: string): Promise<void> {
  const cleanReason = reason ? sanitizeText(reason) : '';
  if (decision === 'reject' && !cleanReason) throw new ApiError(422, 'reason_required');
  mutate((db) => {
    const admin = requireRole(db, 'admin');
    const user = db.users.find((u) => u.id === userId && u.role === 'company');
    const company = db.companies.find((c) => c.userId === userId);
    if (!user || !company) throw new ApiError(404, 'not_found');
    if (user.status !== 'pending') throw new ApiError(409, 'already_decided');
    user.status = decision === 'approve' ? 'verified' : 'rejected';
    if (decision === 'approve') company.verifiedAt = nowIso();
    else company.rejectionReason = cleanReason;
    audit(db, {
      actorId: admin.id,
      action: decision === 'approve' ? 'company.verify' : 'company.reject',
      entity: 'company',
      entityId: userId,
      before: { status: 'pending' },
      after: { status: user.status, reason: cleanReason || undefined },
    });
    notify(db, userId, decision === 'approve' ? 'company_verified' : 'company_rejected', { reason: cleanReason });
  });
  return delay(undefined);
}

export async function resolveFlag(flagId: string, action: 'dismiss' | 'hide' | 'block'): Promise<void> {
  mutate((db) => {
    const admin = requireRole(db, 'admin');
    const flag = db.flags.find((f) => f.id === flagId);
    if (!flag) throw new ApiError(404, 'not_found');
    const listing = db.listings.find((l) => l.id === flag.listingId);
    flag.status = action === 'dismiss' ? 'dismissed' : action === 'hide' ? 'hidden' : 'blocked';
    if (listing && action !== 'dismiss') listing.hidden = true;
    if (listing && action === 'block') {
      const owner = db.users.find((u) => u.id === listing.farmerId);
      if (owner) owner.status = 'blocked';
    }
    audit(db, { actorId: admin.id, action: `flag.${action}`, entity: 'listing', entityId: flag.listingId, after: { flag: flag.status } });
  });
  return delay(undefined);
}

export interface SystemHealth {
  pipeline: PipelineRun[];
  modelVersion: string;
  metrics: ModelMetric[];
  audit: AuditEntry[];
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const db = readDb();
  requireRole(db, 'admin');
  return delay({
    pipeline: db.pipeline,
    modelVersion: MODEL_VERSION,
    metrics: db.modelMetrics,
    audit: [...db.audit].reverse().slice(0, 25),
  });
}

export async function retryPipeline(source: PipelineSource): Promise<void> {
  mutate((db) => {
    const admin = requireRole(db, 'admin');
    const run = db.pipeline.find((p) => p.source === source);
    if (!run) throw new ApiError(404, 'not_found');
    Object.assign(run, { status: 'ok', lastRunAt: nowIso(), records: source === 'soil' ? 42 : run.records, message: 'Manual re-run (demo)' });
    audit(db, { actorId: admin.id, action: 'pipeline.retry', entity: 'pipeline', entityId: source });
  });
  return delay(undefined, 600);
}

export async function listNotifications(): Promise<AppNotification[]> {
  const db = readDb();
  const me = currentUser(db);
  return delay(db.notifications.filter((n) => n.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), 0);
}

export async function markNotificationsRead(): Promise<void> {
  mutate((db) => {
    const me = currentUser(db);
    db.notifications.forEach((n) => {
      if (n.userId === me.id) n.read = true;
    });
  });
}
