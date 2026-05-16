import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const categories = [
  { name: "Artificial Intelligence", slug: "artificial-intelligence", description: "Latest news and breakthroughs in artificial intelligence, machine learning, and deep learning technologies." },
  { name: "Robotics", slug: "robotics", description: "Advances in robotics, automation, humanoid robots, and industrial robotic systems." },
  { name: "Cybersecurity", slug: "cybersecurity", description: "Cybersecurity news covering threats, data privacy, network security, and ethical hacking." },
  { name: "Blockchain", slug: "blockchain", description: "Blockchain technology, cryptocurrency, smart contracts, Web3, and decentralised applications." },
  { name: "Cloud Computing", slug: "cloud-computing", description: "Cloud infrastructure, serverless computing, edge computing, and SaaS platform developments." },
  { name: "Software Development", slug: "software-development", description: "Software engineering, programming languages, developer tools, and open source projects." },
  { name: "Consumer Electronics", slug: "consumer-electronics", description: "Smartphones, wearables, smart home devices, AR/VR, and gaming technology news." },
  { name: "Green Technology", slug: "green-technology", description: "Renewable energy, electric vehicles, battery technology, and climate tech innovations." },
  { name: "Space Technology", slug: "space-technology", description: "Space exploration, satellites, rocket technology, and space communications." },
  { name: "Biotechnology", slug: "biotechnology", description: "Medical technology, gene editing, health AI, lab automation, and bioinformatics." },
];

// Tag → category mapping. Each tag belongs to exactly one of the 10 categories
// above (referenced by category slug). Used to drive category-aware tag
// suggestions in the article editor.
const tags: { name: string; slug: string; categorySlug: string }[] = [
  // Artificial Intelligence
  { name: "Generative AI", slug: "generative-ai", categorySlug: "artificial-intelligence" },
  { name: "Machine Learning", slug: "machine-learning", categorySlug: "artificial-intelligence" },
  { name: "AI Automation", slug: "ai-automation", categorySlug: "artificial-intelligence" },
  { name: "AI Agents", slug: "ai-agents", categorySlug: "artificial-intelligence" },
  { name: "Computer Vision", slug: "computer-vision", categorySlug: "artificial-intelligence" },
  { name: "Natural Language Processing", slug: "natural-language-processing", categorySlug: "artificial-intelligence" },
  // Robotics
  { name: "Humanoid Robots", slug: "humanoid-robots", categorySlug: "robotics" },
  { name: "Industrial Robotics", slug: "industrial-robotics", categorySlug: "robotics" },
  { name: "Autonomous Vehicles", slug: "autonomous-vehicles", categorySlug: "robotics" },
  { name: "Drones", slug: "drones", categorySlug: "robotics" },
  // Cybersecurity
  { name: "Cyber Threats", slug: "cyber-threats", categorySlug: "cybersecurity" },
  { name: "Data Privacy", slug: "data-privacy", categorySlug: "cybersecurity" },
  { name: "Network Security", slug: "network-security", categorySlug: "cybersecurity" },
  { name: "Ethical Hacking", slug: "ethical-hacking", categorySlug: "cybersecurity" },
  { name: "Zero Trust Security", slug: "zero-trust-security", categorySlug: "cybersecurity" },
  // Blockchain
  { name: "Blockchain Infrastructure", slug: "blockchain-infrastructure", categorySlug: "blockchain" },
  { name: "Smart Contracts", slug: "smart-contracts", categorySlug: "blockchain" },
  { name: "Web3", slug: "web3", categorySlug: "blockchain" },
  { name: "Digital Identity", slug: "digital-identity", categorySlug: "blockchain" },
  { name: "Tokenisation", slug: "tokenisation", categorySlug: "blockchain" },
  // Cloud Computing
  { name: "Cloud Infrastructure", slug: "cloud-infrastructure", categorySlug: "cloud-computing" },
  { name: "Serverless Computing", slug: "serverless-computing", categorySlug: "cloud-computing" },
  { name: "Edge Computing", slug: "edge-computing", categorySlug: "cloud-computing" },
  { name: "DevOps", slug: "devops", categorySlug: "cloud-computing" },
  { name: "SaaS Platforms", slug: "saas-platforms", categorySlug: "cloud-computing" },
  // Software Development
  { name: "Web Development", slug: "web-development", categorySlug: "software-development" },
  { name: "Mobile App Development", slug: "mobile-app-development", categorySlug: "software-development" },
  { name: "Open Source Software", slug: "open-source-software", categorySlug: "software-development" },
  { name: "Programming Languages", slug: "programming-languages", categorySlug: "software-development" },
  { name: "Developer Tools", slug: "developer-tools", categorySlug: "software-development" },
  // Consumer Electronics
  { name: "Smartphones", slug: "smartphones", categorySlug: "consumer-electronics" },
  { name: "Wearable Technology", slug: "wearable-technology", categorySlug: "consumer-electronics" },
  { name: "Smart Home Devices", slug: "smart-home-devices", categorySlug: "consumer-electronics" },
  { name: "AR and VR", slug: "ar-and-vr", categorySlug: "consumer-electronics" },
  { name: "Gaming Technology", slug: "gaming-technology", categorySlug: "consumer-electronics" },
  // Green Technology
  { name: "Renewable Energy Tech", slug: "renewable-energy-tech", categorySlug: "green-technology" },
  { name: "Electric Vehicles", slug: "electric-vehicles", categorySlug: "green-technology" },
  { name: "Battery Technology", slug: "battery-technology", categorySlug: "green-technology" },
  { name: "Climate Tech", slug: "climate-tech", categorySlug: "green-technology" },
  { name: "Carbon Capture", slug: "carbon-capture", categorySlug: "green-technology" },
  // Space Technology
  { name: "Satellites", slug: "satellites", categorySlug: "space-technology" },
  { name: "Space Exploration", slug: "space-exploration", categorySlug: "space-technology" },
  { name: "Rocket Technology", slug: "rocket-technology", categorySlug: "space-technology" },
  { name: "Space Communications", slug: "space-communications", categorySlug: "space-technology" },
  { name: "Space Mining", slug: "space-mining", categorySlug: "space-technology" },
  // Biotechnology
  { name: "Medical Technology", slug: "medical-technology", categorySlug: "biotechnology" },
  { name: "Gene Editing", slug: "gene-editing", categorySlug: "biotechnology" },
  { name: "Health AI", slug: "health-ai", categorySlug: "biotechnology" },
  { name: "Lab Automation", slug: "lab-automation", categorySlug: "biotechnology" },
  { name: "Bioinformatics", slug: "bioinformatics", categorySlug: "biotechnology" },
];

async function main() {
  console.log("Seeding database...");

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
  }
  console.log(`Seeded ${categories.length} categories`);

  // Build a slug → id map for the categories we just seeded.
  const seededCategories = await prisma.category.findMany({
    select: { id: true, slug: true },
  });
  const categoryIdBySlug = new Map(seededCategories.map((c) => [c.slug, c.id]));

  for (const tag of tags) {
    const categoryId = categoryIdBySlug.get(tag.categorySlug) ?? null;
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { name: tag.name, categoryId },
      create: { name: tag.name, slug: tag.slug, categoryId },
    });
  }
  console.log(`Seeded ${tags.length} tags (linked to categories)`);

  const adminEmail = "admin@ultimatecomputersoftware.com";
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("Admin@12345", 12);
    await prisma.user.create({
      data: {
        name: "Admin",
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
      },
    });
    console.log(`Created admin user: ${adminEmail} / Admin@12345`);
    console.log("IMPORTANT: Change the admin password after first login!");
  } else {
    console.log("Admin user already exists");
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
