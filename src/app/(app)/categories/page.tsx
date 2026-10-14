import { redirect } from "next/navigation";

// Categories live on Budget now: each one shows its plan, what's spent, and
// opens to edit. Old links and bookmarks land there.
export default function CategoriesPage() {
  redirect("/budget");
}
