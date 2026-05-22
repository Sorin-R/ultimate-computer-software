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
  { name: "Quantum Computing", slug: "quantum-computing", description: "Quantum computing breakthroughs, qubit technology, quantum algorithms, and post-quantum cryptography." },
  { name: "Semiconductors & Chips", slug: "semiconductors-chips", description: "Chip manufacturing, processor architecture, GPU/TPU news, and semiconductor industry analysis." },
  { name: "Data Centres & AI Infrastructure", slug: "data-centres-ai-infrastructure", description: "Data centre technology, GPU clusters, AI training infrastructure, and cloud hardware." },
  { name: "FinTech & Digital Payments", slug: "fintech-digital-payments", description: "Financial technology, digital banking, payment innovation, and decentralised finance." },
  { name: "HealthTech & Digital Health", slug: "healthtech-digital-health", description: "Digital health, medical AI, wearable health tech, and telemedicine innovation." },
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
  // Quantum Computing
  { name: "Quantum Supremacy", slug: "quantum-supremacy", categorySlug: "quantum-computing" },
  { name: "Qubit Technology", slug: "qubit-technology", categorySlug: "quantum-computing" },
  { name: "Post-Quantum Cryptography", slug: "post-quantum-cryptography", categorySlug: "quantum-computing" },
  { name: "Quantum Algorithms", slug: "quantum-algorithms", categorySlug: "quantum-computing" },
  { name: "Quantum Hardware", slug: "quantum-hardware", categorySlug: "quantum-computing" },
  // Semiconductors & Chips
  { name: "Chip Manufacturing", slug: "chip-manufacturing", categorySlug: "semiconductors-chips" },
  { name: "Mobile Processors", slug: "mobile-processors", categorySlug: "semiconductors-chips" },
  { name: "GPU & AI Chips", slug: "gpu-ai-chips", categorySlug: "semiconductors-chips" },
  { name: "RISC-V", slug: "risc-v", categorySlug: "semiconductors-chips" },
  { name: "Memory & Storage Chips", slug: "memory-storage-chips", categorySlug: "semiconductors-chips" },
  // Data Centres & AI Infrastructure
  { name: "GPU Clusters", slug: "gpu-clusters", categorySlug: "data-centres-ai-infrastructure" },
  { name: "Liquid Cooling", slug: "liquid-cooling", categorySlug: "data-centres-ai-infrastructure" },
  { name: "AI Supercomputers", slug: "ai-supercomputers", categorySlug: "data-centres-ai-infrastructure" },
  { name: "Edge Data Centres", slug: "edge-data-centres", categorySlug: "data-centres-ai-infrastructure" },
  { name: "Data Centre Power", slug: "data-centre-power", categorySlug: "data-centres-ai-infrastructure" },
  // FinTech & Digital Payments
  { name: "Digital Banking", slug: "digital-banking", categorySlug: "fintech-digital-payments" },
  { name: "Crypto & DeFi", slug: "crypto-defi", categorySlug: "fintech-digital-payments" },
  { name: "Payment Innovation", slug: "payment-innovation", categorySlug: "fintech-digital-payments" },
  { name: "RegTech", slug: "regtech", categorySlug: "fintech-digital-payments" },
  { name: "Embedded Finance", slug: "embedded-finance", categorySlug: "fintech-digital-payments" },
  // HealthTech & Digital Health
  { name: "Medical AI", slug: "medical-ai", categorySlug: "healthtech-digital-health" },
  { name: "Wearable Health Tech", slug: "wearable-health-tech", categorySlug: "healthtech-digital-health" },
  { name: "Telemedicine", slug: "telemedicine", categorySlug: "healthtech-digital-health" },
  { name: "Health Data & Interoperability", slug: "health-data-interoperability", categorySlug: "healthtech-digital-health" },
  { name: "Digital Therapeutics", slug: "digital-therapeutics", categorySlug: "healthtech-digital-health" },
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
