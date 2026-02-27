const CACHE_DURATION = 3600; // 1 hour in seconds
const ENRICH_CONCURRENCY = 10;
const GROWTH_CAP = 500; // Cap MoM growth at ±500% to filter artifacts
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const TECH_NAMES = {
  nextjs: "Next.js",
  react: "React",
  typescript: "TypeScript",
  javascript: "JavaScript",
  tailwindcss: "Tailwind CSS",
  css: "CSS",
  html5: "HTML5",
  stripe: "Stripe",
  vercel: "Vercel",
  mongodb: "MongoDB",
  nodejs: "Node.js",
  python: "Python",
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  aws: "AWS",
  firebase: "Firebase",
  supabase: "Supabase",
  vue: "Vue.js",
  angular: "Angular",
  svelte: "Svelte",
  docker: "Docker",
  redis: "Redis",
  graphql: "GraphQL",
  sass: "Sass",
  wordpress: "WordPress",
  shopify: "Shopify",
  laravel: "Laravel",
  django: "Django",
  flask: "Flask",
  ruby: "Ruby",
  rails: "Rails",
  go: "Go",
  rust: "Rust",
  swift: "Swift",
  kotlin: "Kotlin",
  flutter: "Flutter",
  "react-native": "React Native",
  cloudflare: "Cloudflare",
  nginx: "Nginx",
  heroku: "Heroku",
  digitalocean: "DigitalOcean",
  gcp: "Google Cloud",
};

function formatTechName(slug) {
  if (TECH_NAMES[slug]) return TECH_NAMES[slug];
  return slug
    .replace(/(^|-)(\w)/g, (_, sep, c) => (sep ? " " : "") + c.toUpperCase());
}

function normalizeTechStack(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map((t) => (typeof t === "string" ? t : formatTechName(t.slug)));
}

let cache = {
  data: null,
  fetchedAt: null,
};

function clampGrowth(value) {
  if (value === null || value === undefined) return null;
  if (value > GROWTH_CAP) return null;
  if (value < -GROWTH_CAP) return null;
  return value;
}

function normalizeStartup(raw) {
  return {
    name: raw.name || "Unknown",
    slug: raw.slug || raw.name?.toLowerCase().replace(/\s+/g, "-") || "",
    mrr: raw.currentLast30DaysRevenue ?? raw.currentMrr ?? 0,
    totalRevenue: raw.currentTotalRevenue ?? 0,
    momGrowth: clampGrowth(raw.cachedGrowth30d),
    mrrGrowth: clampGrowth(raw.cachedGrowthMRR30d),
    category: raw.userCategory || "Uncategorized",
    founderName: raw.xFounderName || "",
    xHandle: raw.xHandle || "",
    description: raw.description || "",
    forSale: raw.onSale ?? false,
    askingPrice: raw.askingPrice ?? null,
    icon: raw.icon || null,
    stealthMode: raw.stealthMode ?? false,
    techStack: normalizeTechStack(raw.techStack),
  };
}

function decodeRSCPayload(html) {
  const pushPattern = /self\.__next_f\.push\(\[(\d+),"((?:[^"\\]|\\.)*)"\]\)/g;
  let pushMatch;
  let fullPayload = "";

  while ((pushMatch = pushPattern.exec(html)) !== null) {
    const payload = pushMatch[2]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
    fullPayload += payload;
  }

  return fullPayload;
}

function extractObjectsFromPayload(payload) {
  const objects = [];
  const prefix = '{"_id":"';
  let searchFrom = 0;

  while (true) {
    const start = payload.indexOf(prefix, searchFrom);
    if (start === -1) break;

    let depth = 0;
    let end = start;
    for (let i = start; i < payload.length; i++) {
      if (payload[i] === "{") depth++;
      if (payload[i] === "}") depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }

    const objStr = payload.substring(start, end);
    searchFrom = end;

    try {
      objects.push(JSON.parse(objStr));
    } catch {
      // Skip unparseable objects
    }
  }

  return objects;
}

function extractStartupsFromRSC(html) {
  const startups = new Map();
  const payload = decodeRSCPayload(html);
  const objects = extractObjectsFromPayload(payload);

  for (const obj of objects) {
    if (obj.slug && obj.currentLast30DaysRevenue !== undefined) {
      if (!startups.has(obj.slug)) {
        startups.set(obj.slug, normalizeStartup(obj));
      }
    }
  }

  return startups.size > 0 ? Array.from(startups.values()) : null;
}

async function fetchWithTimeout(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    return res;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}

async function enrichFromDetailPages(startups) {
  // Fetch detail pages in batches to get category and techStack
  const needsEnrichment = startups.filter(
    (s) => s.category === "Uncategorized" || s.techStack.length === 0
  );

  if (needsEnrichment.length === 0) return startups;

  const enrichBatch = async (batch) => {
    const results = await Promise.allSettled(
      batch.map(async (startup) => {
        try {
          const res = await fetchWithTimeout(
            `https://trustmrr.com/startup/${startup.slug}`,
            8000
          );
          if (!res.ok) return null;

          const html = await res.text();
          const payload = decodeRSCPayload(html);
          const objects = extractObjectsFromPayload(payload);

          // Find the full detail object for this startup
          const detail = objects.find(
            (o) => o.slug === startup.slug && o.techStack !== undefined
          );

          if (!detail) return null;

          return {
            slug: startup.slug,
            category: detail.userCategory || null,
            techStack: normalizeTechStack(detail.techStack),
          };
        } catch {
          return null;
        }
      })
    );

    return results
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter(Boolean);
  };

  // Process in batches
  const enrichments = new Map();

  for (let i = 0; i < needsEnrichment.length; i += ENRICH_CONCURRENCY) {
    const batch = needsEnrichment.slice(i, i + ENRICH_CONCURRENCY);
    const results = await enrichBatch(batch);
    for (const r of results) {
      enrichments.set(r.slug, r);
    }
  }

  // Apply enrichments
  return startups.map((s) => {
    const enrichment = enrichments.get(s.slug);
    if (!enrichment) return s;

    return {
      ...s,
      category:
        s.category === "Uncategorized" && enrichment.category
          ? enrichment.category
          : s.category,
      techStack:
        s.techStack.length === 0 && enrichment.techStack.length > 0
          ? enrichment.techStack
          : s.techStack,
    };
  });
}

async function scrapeFromHtml() {
  const res = await fetchWithTimeout("https://trustmrr.com", 15000);

  if (!res.ok) {
    throw new Error(`Failed to fetch trustmrr.com: ${res.status}`);
  }

  const html = await res.text();
  return extractStartupsFromRSC(html);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";

  // Check in-memory cache
  if (
    !forceRefresh &&
    cache.data &&
    cache.fetchedAt &&
    Date.now() - new Date(cache.fetchedAt).getTime() < CACHE_DURATION * 1000
  ) {
    return Response.json({
      startups: cache.data,
      fetchedAt: cache.fetchedAt,
      cached: true,
    });
  }

  let startups = null;

  try {
    startups = await scrapeFromHtml();
  } catch (e) {
    console.error("Scrape failed:", e.message);
  }

  const fetchedAt = new Date().toISOString();

  if (!startups || startups.length === 0) {
    return Response.json(
      {
        startups: [],
        fetchedAt,
        cached: false,
        error:
          "Could not fetch startup data from TrustMRR. The site structure may have changed.",
      },
      { status: 502 }
    );
  }

  // Enrich with detail page data (category + techStack)
  try {
    startups = await enrichFromDetailPages(startups);
  } catch (e) {
    console.error("Enrichment failed:", e.message);
    // Continue with unenriched data
  }

  // Update in-memory cache
  cache = { data: startups, fetchedAt };

  return Response.json({
    startups,
    fetchedAt,
    cached: false,
  });
}
