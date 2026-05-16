import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function fixAdminRole() {
  try {
    // Find and update the admin user
    const adminUser = await prisma.user.update({
      where: { email: "admin@ultimatecomputersoftware.com" },
      data: { role: "ADMIN" },
    });

    console.log("✅ Admin role restored successfully!");
    console.log(`User: ${adminUser.name}`);
    console.log(`Email: ${adminUser.email}`);
    console.log(`Role: ${adminUser.role}`);
  } catch (error) {
    console.error("❌ Error updating admin role:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminRole();
