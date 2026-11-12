"use client";

import { ChevronRight, Handshake } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { DealCard } from "@/components/deals/DealCard";
import { useDistrictName } from "@/components/forms/options";
import { ListingCard } from "@/components/listings/ListingCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/States";
import * as api from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useSession } from "@/lib/session";

export default function FarmerDashboard() {
  const t = useTranslations("farmer.dashboard");
  const { session } = useSession();
  const districtName = useDistrictName();
  const listings = useApi(() => api.listMyListings(), []);
  const deals = useApi(() => api.listMyDeals(), []);

  const waiting = deals.data?.filter((d) => d.awaiting === "farmer") ?? [];
  const active = listings.data?.filter((l) => l.status === "active") ?? [];
  const farmer = session?.farmer;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">
          {t("greeting", { name: session?.user.name.split(" ")[0] ?? "" })}
        </h1>
        {farmer && (
          <p className="text-gray-600">
            {farmer.village}, {districtName(farmer.districtId)}
          </p>
        )}
      </div>

      <div className="grid overflow-hidden rounded-2xl border border-leaf-200 bg-white shadow-card sm:grid-cols-2">
        {(
          [
            {
              href: "/farmer/advice",
              title: "adviceTitle",
              body: "adviceBody",
            },
            {
              href: "/farmer/listings?new=1",
              title: "listTitle",
              body: "listBody",
            },
          ] as const
        ).map((a, i) => (
          <Link
            key={a.href}
            href={a.href}
            className={`group flex items-center justify-between gap-4 p-4 hover:bg-leaf-50 ${i > 0 ? "border-t border-gray-200 sm:border-l sm:border-t-0" : ""}`}
          >
            <span>
              <span className="block text-lg font-semibold text-leaf-900">
                {t(a.title)}
              </span>
              <span className="block text-gray-600">{t(a.body)}</span>
            </span>
            <ChevronRight
              aria-hidden
              className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-leaf-700"
            />
          </Link>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card title={t("waitingTitle")}>
          {deals.loading && <Loading />}
          <ErrorNote code={deals.error} onRetry={deals.reload} />
          {deals.data && waiting.length === 0 && (
            <p className="text-gray-600">{t("waitingEmpty")}</p>
          )}
          <div className="space-y-2">
            {waiting.map((d) => (
              <DealCard key={d.id} deal={d} />
            ))}
          </div>
        </Card>

        <Card
          title={t("listingsTitle")}
          action={
            <ButtonLink href="/farmer/listings" variant="ghost">
              {t("viewAll")}
            </ButtonLink>
          }
        >
          {listings.loading && <Loading />}
          <ErrorNote code={listings.error} onRetry={listings.reload} />
          {listings.data && active.length === 0 && (
            <EmptyState
              icon={<Handshake className="h-8 w-8" />}
              title={t("listingsEmpty")}
            />
          )}
          <div className="space-y-2">
            {active.slice(0, 3).map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                href={`/farmer/listings/${l.id}`}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
