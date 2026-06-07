import "dotenv/config";
import { db } from "./index";
import { categories } from "./schema";

const seedCategories = [
  // Income
  { name: "Paycheck", classification: "income", color: "#10b981", icon: "wallet", sortOrder: 1 },
  { name: "Side Income", classification: "income", color: "#10b981", icon: "briefcase", sortOrder: 2 },
  { name: "Interest", classification: "income", color: "#10b981", icon: "trending-up", sortOrder: 3 },
  { name: "Other Income", classification: "income", color: "#10b981", icon: "plus-circle", sortOrder: 4 },

  // Needs
  { name: "Rent/Mortgage", classification: "need", color: "#ef4444", icon: "home", sortOrder: 10 },
  { name: "Utilities", classification: "need", color: "#f97316", icon: "zap", sortOrder: 11 },
  { name: "Internet/Phone", classification: "need", color: "#f97316", icon: "wifi", sortOrder: 12 },
  { name: "Groceries", classification: "need", color: "#84cc16", icon: "shopping-cart", sortOrder: 13 },
  { name: "Transportation", classification: "need", color: "#06b6d4", icon: "car", sortOrder: 14 },
  { name: "Insurance", classification: "need", color: "#0ea5e9", icon: "shield", sortOrder: 15 },
  { name: "Health/Medical", classification: "need", color: "#ec4899", icon: "heart-pulse", sortOrder: 16 },
  { name: "Personal Care", classification: "need", color: "#a855f7", icon: "sparkles", sortOrder: 17 },

  // Wants
  { name: "Food & Drink", classification: "want", color: "#f59e0b", icon: "utensils", sortOrder: 20 },
  { name: "Coffee", classification: "want", color: "#92400e", icon: "coffee", sortOrder: 21 },
  { name: "Shopping", classification: "want", color: "#d946ef", icon: "shopping-bag", sortOrder: 22 },
  { name: "Entertainment", classification: "want", color: "#8b5cf6", icon: "tv", sortOrder: 23 },
  { name: "Subscriptions", classification: "want", color: "#6366f1", icon: "repeat", sortOrder: 24 },
  { name: "Travel", classification: "want", color: "#0891b2", icon: "plane", sortOrder: 25 },
  { name: "Costco", classification: "want", color: "#dc2626", icon: "shopping-cart", sortOrder: 26 },
  { name: "Hobbies", classification: "want", color: "#7c3aed", icon: "palette", sortOrder: 27 },
  { name: "Gifts", classification: "want", color: "#e11d48", icon: "gift", sortOrder: 28 },
  { name: "Miscellaneous", classification: "want", color: "#737373", icon: "more-horizontal", sortOrder: 29 },

  // Savings
  { name: "Emergency Fund", classification: "savings", color: "#14b8a6", icon: "shield-check", sortOrder: 40 },
  { name: "Roth IRA", classification: "savings", color: "#0d9488", icon: "piggy-bank", sortOrder: 41 },
  { name: "401(k)", classification: "savings", color: "#0d9488", icon: "piggy-bank", sortOrder: 42 },
  { name: "HSA", classification: "savings", color: "#0891b2", icon: "heart", sortOrder: 43 },
  { name: "Brokerage", classification: "savings", color: "#0e7490", icon: "trending-up", sortOrder: 44 },
  { name: "Goal Savings", classification: "savings", color: "#14b8a6", icon: "target", sortOrder: 45 },

  // System
  { name: "Transfer", classification: "income", color: "#6b7280", icon: "arrow-right-left", sortOrder: 100, isSystem: true },
  { name: "Fees", classification: "need", color: "#6b7280", icon: "alert-circle", sortOrder: 101, isSystem: true },
] as const;

async function main() {
  console.log("Seeding categories...");
  const existing = await db.select().from(categories).limit(1);
  if (existing.length > 0) {
    console.log("Categories already exist, skipping seed.");
    return;
  }
  await db.insert(categories).values(seedCategories as never);
  console.log(`Seeded ${seedCategories.length} categories.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
