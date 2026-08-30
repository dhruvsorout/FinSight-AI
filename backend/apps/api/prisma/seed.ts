import { env } from "../src/config/env.js";
import { prisma } from "../src/services/prisma.js";
import { seedDefaultCategoriesForUser } from "../src/services/categoryService.js";
import { hashPassword } from "../src/utils/password.js";

const transactionBlueprints = [
  ["2026-06-24", "June salary payroll", 4200, "Salary", "Main Checking"],
  ["2026-06-25", "Rent for apartment", -1450, "Rent", "Main Checking"],
  ["2026-06-25", "Electric utility bill", -110, "Utilities", "Main Checking"],
  ["2026-06-26", "Whole Foods groceries", -132.4, "Groceries", "Rewards Card"],
  ["2026-06-27", "Uber ride to airport", -34.7, "Transportation", "Rewards Card"],
  ["2026-06-28", "Dinner at local cafe", -48.3, "Food & Dining", "Rewards Card"],
  ["2026-06-29", "Netflix subscription", -15.99, "Entertainment", "Rewards Card"],
  ["2026-06-30", "Pharmacy purchase", -27.15, "Healthcare", "Rewards Card"],
  ["2026-07-01", "Freelance invoice payment", 900, "Freelance", "Main Checking"],
  ["2026-07-02", "Metro recharge", -22, "Transportation", "Cash Wallet"],
  ["2026-07-03", "Amazon shopping order", -86.75, "Shopping", "Rewards Card"],
  ["2026-07-04", "Farmer's market groceries", -58.2, "Groceries", "Cash Wallet"],
  ["2026-07-05", "Cinema tickets", -31, "Entertainment", "Rewards Card"],
  ["2026-07-06", "Monthly SIP return", 120, "Investments", "Main Checking"],
  ["2026-07-07", "Coffee with client", -14.5, "Food & Dining", "Rewards Card"],
  ["2026-07-08", "Fuel refill", -54.8, "Transportation", "Rewards Card"],
  ["2026-07-09", "Salary payroll", 4200, "Salary", "Main Checking"],
  ["2026-07-10", "Rent for apartment", -1450, "Rent", "Main Checking"],
  ["2026-07-11", "Internet bill", -62, "Utilities", "Main Checking"],
  ["2026-07-12", "Grocery mart", -144.1, "Groceries", "Rewards Card"],
  ["2026-07-13", "Lunch at office cafeteria", -19.4, "Food & Dining", "Cash Wallet"],
  ["2026-07-14", "Doctor consultation", -75, "Healthcare", "Rewards Card"],
  ["2026-07-15", "Myntra shopping", -120, "Shopping", "Rewards Card"],
  ["2026-07-16", "Train tickets", -45, "Travel", "Main Checking"],
  ["2026-07-17", "Hotel booking refund", 80, "Travel", "Main Checking"],
  ["2026-07-18", "Dinner with friends", -67.25, "Food & Dining", "Rewards Card"],
  ["2026-07-19", "Spotify family plan", -12.99, "Entertainment", "Rewards Card"],
  ["2026-07-20", "Freelance retainer", 650, "Freelance", "Main Checking"],
  ["2026-07-21", "Airport taxi", -29.9, "Transportation", "Rewards Card"],
  ["2026-07-22", "Supermarket groceries", -96.5, "Groceries", "Rewards Card"],
  ["2026-07-23", "Cash ATM withdrawal", -100, "Shopping", "Main Checking"],
  ["2026-07-24", "Electricity bill", -118.3, "Utilities", "Main Checking"],
  ["2026-07-25", "Weekend brunch", -42.8, "Food & Dining", "Rewards Card"],
  ["2026-07-26", "Movie night snacks", -18.6, "Entertainment", "Cash Wallet"],
  ["2026-07-27", "Quarterly investment dividend", 210, "Investments", "Main Checking"],
  ["2026-07-28", "Medicine refill", -24.9, "Healthcare", "Rewards Card"],
  ["2026-07-29", "Uber ride home", -16.3, "Transportation", "Rewards Card"],
  ["2026-07-30", "Grocery delivery", -89.7, "Groceries", "Rewards Card"],
  ["2026-07-31", "Salary payroll", 4200, "Salary", "Main Checking"],
  ["2026-08-01", "Rent for apartment", -1450, "Rent", "Main Checking"],
  ["2026-08-02", "Streaming bundle", -21.49, "Entertainment", "Rewards Card"],
  ["2026-08-03", "Zomato dinner", -33.2, "Food & Dining", "Rewards Card"],
  ["2026-08-04", "Petrol pump", -61.4, "Transportation", "Rewards Card"],
  ["2026-08-05", "Freelance milestone payout", 1100, "Freelance", "Main Checking"],
  ["2026-08-06", "Organic groceries", -124.9, "Groceries", "Rewards Card"],
  ["2026-08-07", "Flight booking", -220, "Travel", "Main Checking"],
  ["2026-08-08", "Doctor lab tests", -95, "Healthcare", "Rewards Card"],
  ["2026-08-09", "Amazon device purchase", -249.99, "Shopping", "Rewards Card"],
  ["2026-08-10", "Cafe meeting", -17.8, "Food & Dining", "Cash Wallet"],
  ["2026-08-11", "Metro pass recharge", -30, "Transportation", "Cash Wallet"]
] as const;

async function main() {
  const forceSeed = process.env.FORCE_SEED === "true";

  // Idempotency guard: skip seeding if data already exists, unless forced.
  // This makes `npm run prisma:seed` safe to call at any time — it will
  // no-op on a populated database. Use `npm run prisma:seed:force` to
  // intentionally wipe the demo user and re-seed from scratch.
  if (!forceSeed) {
    const existingUserCount = await prisma.user.count();
    if (existingUserCount > 0) {
      console.log(
        `Seed skipped: database already has ${existingUserCount} user(s). ` +
        `Run \`npm run prisma:seed:force\` to wipe and re-seed the demo user.`
      );
      return;
    }
  } else {
    console.log("FORCE_SEED=true — wiping demo user data and re-seeding.");
  }

  const passwordHash = await hashPassword(env.DEMO_USER_PASSWORD);

  const user = await prisma.user.upsert({
    where: {
      email: env.DEMO_USER_EMAIL
    },
    update: {
      name: "FinSight Demo",
      passwordHash
    },
    create: {
      email: env.DEMO_USER_EMAIL,
      passwordHash,
      name: "FinSight Demo"
    }
  });

  // Only delete existing data when explicitly forcing a reseed.
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.category.deleteMany({ where: { userId: user.id } });

  await seedDefaultCategoriesForUser(user.id);

  const accounts = await prisma.$transaction([
    prisma.account.create({
      data: {
        userId: user.id,
        name: "Main Checking",
        type: "bank",
        balance: 0
      }
    }),
    prisma.account.create({
      data: {
        userId: user.id,
        name: "Rewards Card",
        type: "card",
        balance: 0
      }
    }),
    prisma.account.create({
      data: {
        userId: user.id,
        name: "Cash Wallet",
        type: "cash",
        balance: 0
      }
    })
  ]);

  const categories = await prisma.category.findMany({
    where: { userId: user.id }
  });

  const accountByName = new Map(accounts.map((account: { name: string; id: string }) => [account.name, account.id]));
  const categoryByName = new Map(categories.map((category: { name: string; id: string }) => [category.name, category.id]));

  // Use each transaction's own date for createdAt/updatedAt so seeded data
  // looks historically accurate rather than all stamped at seed-run time.
  await prisma.transaction.createMany({
    data: transactionBlueprints.map(([date, description, amount, categoryName, accountName]) => {
      const historicalDate = new Date(`${date}T12:00:00.000Z`);
      return {
        userId: user.id,
        accountId: accountByName.get(accountName)!,
        categoryId: categoryByName.get(categoryName) ?? null,
        amount,
        description,
        date: historicalDate,
        createdAt: historicalDate,
        updatedAt: historicalDate,
        source: "manual"
      };
    })
  });

  const totals = transactionBlueprints.reduce<Record<string, number>>((acc, [, , amount, , accountName]) => {
    acc[accountName] = (acc[accountName] ?? 0) + amount;
    return acc;
  }, {});

  for (const account of accounts) {
    await prisma.account.update({
      where: { id: account.id },
      data: { balance: totals[account.name] ?? 0 }
    });
  }

  console.log(`Seeded demo user ${env.DEMO_USER_EMAIL} with ${transactionBlueprints.length} transactions.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
