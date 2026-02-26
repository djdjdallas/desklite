const CACHE_DURATION = 3600; // 1 hour in seconds
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let cache = {
  data: null,
  fetchedAt: null,
};

function normalizeStartup(raw) {
  return {
    name: raw.name || raw.title || "Unknown",
    slug: raw.slug || raw.name?.toLowerCase().replace(/\s+/g, "-") || "",
    mrr: raw.mrr ?? raw.revenue ?? raw.monthlyRevenue ?? 0,
    momGrowth: raw.momGrowth ?? raw.growth ?? raw.monthlyGrowth ?? null,
    category: raw.category || raw.type || "Uncategorized",
    founderName: raw.founderName || raw.founder || raw.owner || "",
    description: raw.description || raw.tagline || "",
    forSale: raw.forSale ?? raw.isForSale ?? false,
  };
}

async function scrapeFromHtml() {
  const res = await fetch("https://trustmrr.com", {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: CACHE_DURATION },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch trustmrr.com: ${res.status}`);
  }

  const html = await res.text();

  // Extract __NEXT_DATA__ JSON
  const match = html.match(
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json">([\s\S]*?)<\/script>/
  );

  if (!match) {
    return null;
  }

  const nextData = JSON.parse(match[1]);
  const pageProps = nextData?.props?.pageProps;

  if (!pageProps) {
    return null;
  }

  // Try common property names for the startup list
  const startupList =
    pageProps.startups ||
    pageProps.leaderboard ||
    pageProps.companies ||
    pageProps.projects ||
    pageProps.items ||
    [];

  // Also check for recently listed
  const recentList =
    pageProps.recentlyListed ||
    pageProps.recent ||
    pageProps.newStartups ||
    [];

  const combined = [...startupList, ...recentList];

  if (combined.length === 0) {
    // If no recognized keys, try to find any array in pageProps
    for (const key of Object.keys(pageProps)) {
      if (Array.isArray(pageProps[key]) && pageProps[key].length > 0) {
        const first = pageProps[key][0];
        if (first && (first.name || first.title || first.mrr !== undefined)) {
          return pageProps[key].map(normalizeStartup);
        }
      }
    }
    return null;
  }

  return combined.map(normalizeStartup);
}

async function scrapeFromApi() {
  const res = await fetch("https://trustmrr.com/api/startups", {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: CACHE_DURATION },
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();

  const list = Array.isArray(data)
    ? data
    : data.startups || data.items || data.data || [];

  if (list.length === 0) return null;

  return list.map(normalizeStartup);
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
    console.error("HTML scrape failed:", e.message);
  }

  if (!startups || startups.length === 0) {
    try {
      startups = await scrapeFromApi();
    } catch (e) {
      console.error("API fallback failed:", e.message);
    }
  }

  // If both methods fail, return demo data so the UI still works
  if (!startups || startups.length === 0) {
    startups = getDemoData();
  }

  const fetchedAt = new Date().toISOString();

  // Update in-memory cache
  cache = { data: startups, fetchedAt };

  return Response.json({
    startups,
    fetchedAt,
    cached: false,
  });
}

function getDemoData() {
  return [
    {
      name: "ScreenshotAPI",
      slug: "screenshotapi",
      mrr: 18500,
      momGrowth: 12.3,
      category: "API",
      founderName: "Demo Founder",
      description: "Automated screenshot API for developers",
      forSale: false,
    },
    {
      name: "PingBear",
      slug: "pingbear",
      mrr: 4200,
      momGrowth: 8.7,
      category: "Monitoring",
      founderName: "Demo Founder",
      description: "Uptime monitoring for indie hackers",
      forSale: false,
    },
    {
      name: "ShipFast",
      slug: "shipfast",
      mrr: 32000,
      momGrowth: 15.1,
      category: "Boilerplate",
      founderName: "Demo Founder",
      description: "Next.js boilerplate to ship your startup fast",
      forSale: false,
    },
    {
      name: "ByeDispute",
      slug: "byedispute",
      mrr: 7800,
      momGrowth: -2.4,
      category: "Fintech",
      founderName: "Demo Founder",
      description: "Chargeback prevention for SaaS companies",
      forSale: true,
    },
    {
      name: "LogSnag",
      slug: "logsnag",
      mrr: 21000,
      momGrowth: 22.5,
      category: "Developer Tools",
      founderName: "Demo Founder",
      description: "Event tracking for your apps",
      forSale: false,
    },
    {
      name: "Supabase Wrapper",
      slug: "supabase-wrapper",
      mrr: 1200,
      momGrowth: 5.0,
      category: "Developer Tools",
      founderName: "Demo Founder",
      description: "Simplified Supabase client for React",
      forSale: true,
    },
    {
      name: "FormBold",
      slug: "formbold",
      mrr: 9400,
      momGrowth: 3.8,
      category: "Forms",
      founderName: "Demo Founder",
      description: "Form backend as a service",
      forSale: false,
    },
    {
      name: "CronJobs.io",
      slug: "cronjobs-io",
      mrr: 5600,
      momGrowth: -1.2,
      category: "Infrastructure",
      founderName: "Demo Founder",
      description: "Managed cron job scheduling service",
      forSale: false,
    },
    {
      name: "TinyAnalytics",
      slug: "tinyanalytics",
      mrr: 3100,
      momGrowth: 18.9,
      category: "Analytics",
      founderName: "Demo Founder",
      description: "Privacy-first analytics for indie projects",
      forSale: false,
    },
    {
      name: "MailPace",
      slug: "mailpace",
      mrr: 11200,
      momGrowth: 6.4,
      category: "Email",
      founderName: "Demo Founder",
      description: "Transactional email API built for developers",
      forSale: false,
    },
    {
      name: "LaunchList",
      slug: "launchlist",
      mrr: 2800,
      momGrowth: 45.2,
      category: "Marketing",
      founderName: "Demo Founder",
      description: "Waitlist and launch management tool",
      forSale: false,
    },
    {
      name: "InvoiceNinja",
      slug: "invoiceninja",
      mrr: 28000,
      momGrowth: 4.1,
      category: "Fintech",
      founderName: "Demo Founder",
      description: "Open-source invoicing for freelancers",
      forSale: false,
    },
  ];
}
