import { PrismaClient } from "@prisma/client";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

interface ArticleData {
  title: string;
  body: string;
  mainKeyword: string;
  category: string;
  tags: string[];
  imageUrl: string;
  authorName: string;
  originalSourceUrl: string;
}

const articlesData: ArticleData[] = [
  {
    title: "The Rise of Generative AI: Transforming Content Creation in 2024",
    mainKeyword: "generative ai content creation 2024",
    category: "Artificial Intelligence",
    tags: ["Generative AI", "Machine Learning", "AI Automation"],
    imageUrl: "/uploads/pexels-amar-8911655.jpg",
    authorName: "Tech Today",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>Generative AI has revolutionized how businesses create content at scale. From text generation to image synthesis, these powerful tools are reshaping industries.</p>
    <img src="/uploads/pexels-bakytzhan-baurzhanov-854600-9951389.jpg" alt="AI Technology" />
    <h2>Key Breakthroughs</h2>
    <p>The latest advancements in large language models have made it possible to create human-quality content faster than ever before. Organizations are leveraging these technologies to automate content workflows and improve productivity.</p>
    <h3>Real-World Applications</h3>
    <ul>
    <li>Automated customer support chatbots</li>
    <li>Content marketing at scale</li>
    <li>Code generation for developers</li>
    <li>Image synthesis and design automation</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/4pL8lj7uYQA" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>As we move forward, the integration of generative AI with human creativity will define the future of digital transformation.</p>`,
  },
  {
    title: "Humanoid Robots: The Future of Manufacturing and Service Industries",
    mainKeyword: "humanoid robots manufacturing automation",
    category: "Robotics",
    tags: ["Humanoid Robots", "Industrial Robotics", "Autonomous Vehicles"],
    imageUrl: "/uploads/pexels-bakytzhan-baurzhanov-854600-9951392.jpg",
    authorName: "Innovation News",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>Humanoid robots are advancing rapidly, with companies investing billions in next-generation robots designed to work alongside humans.</p>
    <img src="/uploads/pexels-cjanimus-7989742.jpg" alt="Robot Technology" />
    <h2>Current State of Humanoid Robotics</h2>
    <p>Modern humanoid robots can now perform complex tasks in manufacturing, healthcare, and service sectors. With improved dexterity and cognitive abilities, these machines are becoming indispensable in various industries.</p>
    <h3>Major Players</h3>
    <ul>
    <li>Boston Dynamics - Atlas and Spot robots</li>
    <li>Tesla - Optimus humanoid robot project</li>
    <li>Honda - Asimo and latest models</li>
    <li>Figure AI - AI-powered humanoid robots</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/2uuS8mL44zw" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>The integration of AI with robotic systems promises to transform how we work and live.</p>`,
  },
  {
    title: "Zero Trust Security: The New Standard for Cybersecurity in 2024",
    mainKeyword: "zero trust security cybersecurity framework",
    category: "Cybersecurity",
    tags: ["Zero Trust Security", "Network Security", "Data Privacy"],
    imageUrl: "/uploads/pexels-gabriel-albino-de-jesus-56315623-8473285.jpg",
    authorName: "Security Today",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>Zero Trust Architecture is becoming the industry standard, replacing traditional perimeter-based security models with continuous verification.</p>
    <img src="/uploads/pexels-ilabappa-19545620.jpg" alt="Cybersecurity" />
    <h2>Understanding Zero Trust</h2>
    <p>Zero Trust operates on the principle that no user, device, or system should be trusted by default. Every access request is authenticated, authorized, and encrypted.</p>
    <h3>Core Principles</h3>
    <ul>
    <li>Verify every user and device</li>
    <li>Encrypt all data in transit and at rest</li>
    <li>Monitor and validate all network activity</li>
    <li>Implement least privilege access</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/ZO764VPloRU" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>Organizations adopting Zero Trust frameworks report 27% reduction in breach impact and faster response times.</p>`,
  },
  {
    title: "Blockchain Revolution: Smart Contracts Reshaping Digital Commerce",
    mainKeyword: "blockchain smart contracts web3",
    category: "Blockchain",
    tags: ["Blockchain Infrastructure", "Smart Contracts", "Web3"],
    imageUrl: "/uploads/pexels-ilabappa-19545625.jpg",
    authorName: "Crypto Insights",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>Smart contracts are automating complex business logic on blockchain networks, enabling trustless transactions without intermediaries.</p>
    <img src="/uploads/pexels-ilabappa-19545626.jpg" alt="Blockchain Technology" />
    <h2>Smart Contract Applications</h2>
    <p>From decentralized finance (DeFi) to supply chain management, smart contracts are proving their utility across multiple sectors.</p>
    <h3>Use Cases</h3>
    <ul>
    <li>Automated lending and borrowing protocols</li>
    <li>Supply chain transparency</li>
    <li>Digital identity verification</li>
    <li>Autonomous organizations (DAOs)</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/VZF15liQhYo" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>The evolution of blockchain technology continues to unlock new possibilities for decentralized applications.</p>`,
  },
  {
    title: "Cloud Infrastructure: Serverless Computing Takes the Lead",
    mainKeyword: "serverless computing cloud infrastructure",
    category: "Cloud Computing",
    tags: ["Cloud Infrastructure", "Serverless Computing", "DevOps"],
    imageUrl: "/uploads/pexels-lovenzky-jonathan-2150290221-31058700.jpg",
    authorName: "Cloud Tech Weekly",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>Serverless computing is revolutionizing cloud architecture, allowing developers to focus on code rather than infrastructure management.</p>
    <img src="/uploads/pexels-lucky-cungwa-2482254-4549831.jpg" alt="Cloud Computing" />
    <h2>Benefits of Serverless Architecture</h2>
    <p>Serverless platforms automatically scale, manage infrastructure, and charge only for actual usage, making them ideal for modern applications.</p>
    <h3>Key Advantages</h3>
    <ul>
    <li>Automatic scaling and high availability</li>
    <li>Pay-per-use pricing model</li>
    <li>Faster deployment cycles</li>
    <li>Reduced operational complexity</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/TtEJNPwy39A" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>Major cloud providers continue to expand serverless offerings to meet growing demand.</p>`,
  },
  {
    title: "Mobile App Development: React Native and Cross-Platform Solutions",
    mainKeyword: "mobile app development react native",
    category: "Software Development",
    tags: ["Mobile App Development", "Web Development", "Developer Tools"],
    imageUrl: "/uploads/pexels-mediahooch-14785825.jpg",
    authorName: "Dev Culture",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>Cross-platform development frameworks like React Native are enabling developers to build iOS and Android apps simultaneously.</p>
    <img src="/uploads/pexels-mediahooch-14785828.jpg" alt="Mobile Development" />
    <h2>Evolution of Mobile Development</h2>
    <p>The rise of React Native and Flutter has democratized mobile app development, reducing time-to-market and development costs.</p>
    <h3>Popular Frameworks</h3>
    <ul>
    <li>React Native for JavaScript developers</li>
    <li>Flutter for high-performance apps</li>
    <li>Kotlin for native Android development</li>
    <li>Swift for native iOS development</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/r5dvUz8yq2c" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>Cross-platform solutions continue to improve, offering near-native performance while reducing development overhead.</p>`,
  },
  {
    title: "Wearable Technology: The Future of Personal Health Monitoring",
    mainKeyword: "wearable technology health monitoring",
    category: "Consumer Electronics",
    tags: ["Wearable Technology", "Smart Home Devices", "Health AI"],
    imageUrl: "/uploads/pexels-nihongraphy-2-22469233-6624608.jpg",
    authorName: "Tech Gadgets",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>Wearable devices are transforming personal health monitoring, enabling continuous tracking of vital signs and early disease detection.</p>
    <img src="/uploads/pexels-omkarpatyane-238480.jpg" alt="Wearable Tech" />
    <h2>Advanced Health Monitoring</h2>
    <p>Modern smartwatches and fitness trackers now incorporate advanced sensors that can detect irregular heartbeats, measure blood oxygen, and predict health issues before they become serious.</p>
    <h3>Latest Innovations</h3>
    <ul>
    <li>ECG monitoring in smartwatches</li>
    <li>Blood glucose tracking without finger pricks</li>
    <li>Sleep quality analysis and improvement</li>
    <li>AI-powered health predictions</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/59NQElP4pLs" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>Wearable technology is extending healthcare beyond traditional clinics into everyday life.</p>`,
  },
  {
    title: "Green Technology: Innovation in Renewable Energy Solutions",
    mainKeyword: "renewable energy green technology",
    category: "Green Technology",
    tags: ["Renewable Energy Tech", "Climate Tech", "Electric Vehicles"],
    imageUrl: "/uploads/pexels-optlasers-7097230.jpg",
    authorName: "Green Future",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>Renewable energy technologies are advancing rapidly, with solar, wind, and battery storage becoming increasingly cost-effective.</p>
    <img src="/uploads/pexels-phong-thanh-3607237-36680544.jpg" alt="Green Energy" />
    <h2>Renewable Energy Breakthroughs</h2>
    <p>Recent innovations in renewable energy are making clean power more accessible and affordable than ever before.</p>
    <h3>Key Technologies</h3>
    <ul>
    <li>Perovskite solar cells with higher efficiency</li>
    <li>Advanced battery storage solutions</li>
    <li>Offshore wind farms expansion</li>
    <li>Hydrogen fuel cell development</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/nwiqHCWFJVI" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>The transition to renewable energy is accelerating globally as costs continue to decline.</p>`,
  },
  {
    title: "Space Technology: Next Generation of Satellite Communications",
    mainKeyword: "satellite communications space technology",
    category: "Space Technology",
    tags: ["Satellites", "Space Communications", "Space Exploration"],
    imageUrl: "/uploads/pexels-rovshan-nazirli-691066883-18205769.jpg",
    authorName: "Space News",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>Satellite technology is revolutionizing global communications, providing internet access to remote areas and enabling real-time global connectivity.</p>
    <img src="/uploads/pexels-sirius-df-440758016-34956927.jpg" alt="Satellite Technology" />
    <h2>Satellite Internet Constellations</h2>
    <p>Companies are deploying thousands of satellites to create global broadband networks, bridging the digital divide worldwide.</p>
    <h3>Major Projects</h3>
    <ul>
    <li>Starlink - SpaceX's internet constellation</li>
    <li>Amazon Project Kuiper</li>
    <li>OneWeb global network</li>
    <li>Chinese megaconstellation plans</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/QccbFNjpsaQ" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>Satellite technology promises to transform connectivity and enable new applications we haven't yet imagined.</p>`,
  },
  {
    title: "Biotechnology: Gene Editing and CRISPR Innovations",
    mainKeyword: "gene editing crispr biotechnology",
    category: "Biotechnology",
    tags: ["Gene Editing", "Medical Technology", "Health AI"],
    imageUrl: "/uploads/pexels-tsering-drokgyal-151633803-17919491.jpg",
    authorName: "Bio Innovation",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>CRISPR gene editing technology is enabling unprecedented medical breakthroughs, offering hope for treating previously incurable genetic diseases.</p>
    <img src="/uploads/pexels-vafphotos-29012802.jpg" alt="Biotechnology" />
    <h2>The CRISPR Revolution</h2>
    <p>CRISPR-Cas9 has democratized genetic engineering, making it accessible to researchers worldwide and accelerating the pace of biological innovation.</p>
    <h3>Therapeutic Applications</h3>
    <ul>
    <li>Sickle cell disease treatment</li>
    <li>Cancer immunotherapy</li>
    <li>Inherited blindness restoration</li>
    <li>HIV and infectious disease treatment</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/HI8GAydmHA8" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>Gene editing technology is moving rapidly from laboratory to clinical practice, changing lives worldwide.</p>`,
  },
  {
    title: "Artificial Intelligence in Autonomous Vehicles: Safety and Ethics",
    mainKeyword: "autonomous vehicles ai safety ethics",
    category: "Artificial Intelligence",
    tags: ["Autonomous Vehicles", "Computer Vision", "AI Automation"],
    imageUrl: "/uploads/pexels-amar-8911655.jpg",
    authorName: "Auto Tech",
    originalSourceUrl: "https://www.ultimatecomputersoftware.com",
    body: `<p>Autonomous vehicle technology has reached a critical inflection point, with multiple companies testing fully self-driving cars on public roads.</p>
    <img src="/uploads/pexels-bakytzhan-baurzhanov-854600-9951389.jpg" alt="Autonomous Vehicles" />
    <h2>Safety and Regulation</h2>
    <p>As autonomous vehicles become more common, ensuring safety and developing appropriate regulations is paramount.</p>
    <h3>Key Challenges</h3>
    <ul>
    <li>Perception system robustness in adverse weather</li>
    <li>Decision-making in ethical dilemmas</li>
    <li>Regulatory framework development</li>
    <li>Public acceptance and trust building</li>
    </ul>
    <iframe src="https://www.youtube.com/embed/LQ_eG0A1F5g" width="560" height="315" frameborder="0" allowfullscreen></iframe>
    <p>The future of transportation depends on solving these technical and ethical challenges.</p>`,
  },
];

async function createArticles() {
  try {
    console.log("📝 Fetching categories and tags...");
    const categories = await prisma.category.findMany();
    const tags = await prisma.tag.findMany();

    const categoryMap = new Map(categories.map((c) => [c.name, c.id]));
    const tagMap = new Map(tags.map((t) => [t.name, t.id]));

    console.log(`✅ Found ${categories.length} categories and ${tags.length} tags\n`);

    for (const articleData of articlesData) {
      const categoryId = categoryMap.get(articleData.category);
      if (!categoryId) {
        console.log(`⚠️  Category "${articleData.category}" not found, skipping`);
        continue;
      }

      const tagIds = articleData.tags
        .map((tagName) => tagMap.get(tagName))
        .filter((id) => id !== undefined) as string[];

      // Generate excerpt
      const plainText = articleData.body
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const excerpt = plainText.substring(0, 150) + "...";

      // Create article
      const article = await prisma.article.create({
        data: {
          title: articleData.title,
          slug: articleData.mainKeyword
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, ""),
          body: articleData.body,
          excerpt,
          mainKeyword: articleData.mainKeyword,
          authorName: articleData.authorName,
          originalSourceUrl: articleData.originalSourceUrl,
          imageUrl: articleData.imageUrl,
          categoryId,
          userId: (await prisma.user.findFirst({ where: { role: "ADMIN" } }))?.id || "",
          status: "PUBLISHED",
          publishedAt: new Date(),
          ...(tagIds.length > 0 && {
            tags: {
              create: tagIds.map((tagId) => ({ tagId })),
            },
          }),
        },
      });

      console.log(`✅ Created: "${article.title}"`);
    }

    console.log("\n🎉 All articles created successfully!");
  } catch (error) {
    console.error("❌ Error creating articles:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createArticles();
