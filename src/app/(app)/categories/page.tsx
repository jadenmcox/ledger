import { db } from "@/db";
import { categories } from "@/db/schema";
import { asc } from "drizzle-orm";
import { Container, PageHeader } from "@/components/ui";
import { CategoriesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const rows = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.classification), asc(categories.sortOrder));

  return (
    <>
      <PageHeader
        eyebrow="CATEGORIES"
        title="Buckets,"
        italic="limits, intent."
        subtitle="Every transaction lands somewhere. Set a monthly limit on the ones that matter — Budgetly will warn you as you approach it."
      />
      <Container>
        <CategoriesClient initial={rows} />
      </Container>
    </>
  );
}
