"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  ExternalLink,
  Tag,
  Download,
} from "lucide-react";

function formatMrr(value) {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return `$${value}`;
}

function formatGrowth(value) {
  if (value === null || value === undefined) return null;
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard() {
  const [startups, setStartups] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const fetchData = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = refresh ? "/api/startups?refresh=true" : "/api/startups";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch startups");
      setStartups(data.startups || []);
      setFetchedAt(data.fetchedAt);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = useMemo(() => {
    const cats = new Set(startups.map((s) => s.category));
    return ["All", ...Array.from(cats).sort()];
  }, [startups]);

  const filtered = useMemo(() => {
    let list = startups;
    if (activeCategory !== "All") {
      list = list.filter((s) => s.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [startups, activeCategory, search]);

  const exportData = useCallback(
    (format) => {
      const data = filtered.length > 0 ? filtered : startups;
      if (data.length === 0) return;

      let content, filename, type;

      if (format === "csv") {
        const headers = ["Name", "Slug", "MRR", "MoM Growth (%)", "Category", "Founder", "Description", "For Sale", "Tech Stack"];
        const rows = data.map((s) => [
          s.name,
          s.slug,
          s.mrr,
          s.momGrowth ?? "",
          s.category,
          s.founderName,
          `"${(s.description || "").replace(/"/g, '""')}"`,
          s.forSale ? "Yes" : "No",
          `"${(s.techStack || []).join(", ")}"`,
        ]);
        content = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        filename = "desklite-startups.csv";
        type = "text/csv";
      } else {
        content = JSON.stringify(data, null, 2);
        filename = "desklite-startups.json";
        type = "application/json";
      }

      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [filtered, startups]
  );

  const totalMrr = useMemo(
    () => startups.reduce((sum, s) => sum + (s.mrr || 0), 0),
    [startups]
  );

  const avgGrowth = useMemo(() => {
    const withGrowth = startups.filter(
      (s) => s.momGrowth !== null && s.momGrowth !== undefined
    );
    if (withGrowth.length === 0) return 0;
    return withGrowth.reduce((sum, s) => sum + s.momGrowth, 0) / withGrowth.length;
  }, [startups]);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-zinc-50">
                DeskLite
              </h1>
              <p className="text-sm text-zinc-500">
                Startup inspiration from TrustMRR
              </p>
            </div>
            <div className="flex items-center gap-3">
              {fetchedAt && (
                <span className="text-xs text-zinc-500">
                  Updated {timeAgo(fetchedAt)}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportData("csv")}
                disabled={loading || startups.length === 0}
              >
                <Download className="h-4 w-4 mr-1.5" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportData("json")}
                disabled={loading || startups.length === 0}
              >
                <Download className="h-4 w-4 mr-1.5" />
                JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(true)}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BarChart3 className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Total Startups</p>
                <p className="text-2xl font-bold text-zinc-50">
                  {startups.length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Combined MRR</p>
                <p className="text-2xl font-bold text-zinc-50">
                  {formatMrr(totalMrr)}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <TrendingUp className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-400">Avg MoM Growth</p>
                <p className="text-2xl font-bold text-zinc-50">
                  {formatGrowth(avgGrowth)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search startups by name, description, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory(cat)}
              >
                {cat === "All" ? "All" : cat}
              </Button>
            ))}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-red-400 text-sm">
            {error}. Try refreshing.
          </div>
        )}

        {/* Loading skeleton */}
        {loading && startups.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 bg-zinc-800 rounded w-2/3" />
                  <div className="h-3 bg-zinc-800 rounded w-full mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-zinc-800 rounded w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Cards grid */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((startup) => (
              <StartupCard key={startup.slug} startup={startup} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && startups.length > 0 && (
          <div className="text-center py-12 text-zinc-500">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-lg">No startups match your filters</p>
            <p className="text-sm mt-1">Try a different search term or category</p>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-zinc-800 pt-4 pb-8 text-center text-xs text-zinc-600">
          Data sourced from{" "}
          <a
            href="https://trustmrr.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-300"
          >
            trustmrr.com
          </a>
          {" "}for personal research. Not affiliated.
        </footer>
      </main>
    </div>
  );
}

function StartupCard({ startup }) {
  const growth = formatGrowth(startup.momGrowth);
  const isPositive = startup.momGrowth !== null && startup.momGrowth >= 0;

  return (
    <Card className="group hover:border-zinc-700 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{startup.name}</CardTitle>
          <div className="flex gap-1.5 shrink-0">
            {startup.forSale && (
              <Badge variant="warning">For Sale</Badge>
            )}
            <Badge variant="secondary">
              <Tag className="h-3 w-3 mr-1" />
              {startup.category}
            </Badge>
          </div>
        </div>
        {startup.description && (
          <p className="text-sm text-zinc-400 line-clamp-2 mt-1">
            {startup.description}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider">MRR</p>
            <p className="text-2xl font-bold text-zinc-50">
              {formatMrr(startup.mrr)}
            </p>
          </div>
          {growth && (
            <div
              className={`flex items-center gap-1 text-sm font-medium ${
                isPositive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {growth} MoM
            </div>
          )}
        </div>
        {startup.techStack && startup.techStack.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {startup.techStack.map((tech) => (
              <span
                key={tech}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700/50"
              >
                {tech}
              </span>
            ))}
          </div>
        )}
        {startup.founderName && (
          <p className="text-xs text-zinc-500 mt-2">
            by {startup.founderName}
          </p>
        )}
        <a
          href={`https://trustmrr.com/startup/${startup.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          View on TrustMRR
          <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}
