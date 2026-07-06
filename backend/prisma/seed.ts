import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("testpassword123", 10);

  // ── Free user with 3 tasks ──
  const freeUser = await prisma.user.upsert({
    where: { email: "free@example.com" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Free User",
      email: "free@example.com",
      passwordHash,
      isPremium: false,
    },
  });

  const freeTasks = [
    { title: "Buy groceries", description: "Milk, eggs, bread, butter" },
    { title: "Finish project report", description: "Complete Q3 summary for review" },
    { title: "Schedule dentist appointment", description: "Call Dr. Smith at 555-0123" },
  ];

  for (const task of freeTasks) {
    await prisma.task.upsert({
      where: { id: `free-task-${task.title.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `free-task-${task.title.toLowerCase().replace(/\s+/g, "-")}`,
        title: task.title,
        description: task.description,
        status: "TODO",
        ownerId: freeUser.id,
      },
    });
  }

  // ── Premium user with 5 tasks ──
  const premiumUser = await prisma.user.upsert({
    where: { email: "premium@example.com" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Premium User",
      email: "premium@example.com",
      passwordHash,
      isPremium: true,
    },
  });

  const premiumTasks = [
    { title: "Set up CI/CD pipeline", description: "Configure GitHub Actions for automated deployment" },
    { title: "Write API documentation", description: "Document all REST endpoints with examples" },
    { title: "Review pull requests", description: "Review open PRs from the team" },
    { title: "Plan sprint 12", description: "Prepare backlog and assign tickets" },
    { title: "Update dependencies", description: "Run pnpm audit and update vulnerable packages" },
  ];

  for (const task of premiumTasks) {
    await prisma.task.upsert({
      where: { id: `premium-task-${task.title.toLowerCase().replace(/\s+/g, "-")}` },
      update: {},
      create: {
        id: `premium-task-${task.title.toLowerCase().replace(/\s+/g, "-")}`,
        title: task.title,
        description: task.description,
        status: "TODO",
        ownerId: premiumUser.id,
      },
    });
  }

  console.log("Seed complete:");
  console.log(`  - Free user: free@example.com / testpassword123 (3 tasks)`);
  console.log(`  - Premium user: premium@example.com / testpassword123 (5 tasks)`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
