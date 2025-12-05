"use client";

import { useState } from "react";
import { DocumentCard, FolderCard, EmptyState } from "@/components/common";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Filter, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [fileType, setFileType] = useState<string[]>([]);
  const [scope, setScope] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("relevance");
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = () => {
    if (!query.trim()) return;
    // TODO: Implement actual search
    console.log("Search:", { query, fileType, scope, sortBy });
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Advanced Search</h1>
          <p className="text-muted-foreground">
            Search documents, folders, and content with advanced filters
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Filters</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFileType([]);
                    setScope([]);
                    setSortBy("relevance");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-6">
                {/* File Type Filter */}
                <div className="space-y-2">
                  <Label>File Type</Label>
                  <div className="space-y-2">
                    {["PDF", "DOCX", "XLSX", "Images"].map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <Checkbox
                          id={type}
                          checked={fileType.includes(type)}
                          onCheckedChange={(checked) => {
                            setFileType((prev) =>
                              checked
                                ? [...prev, type]
                                : prev.filter((t) => t !== type)
                            );
                          }}
                        />
                        <Label htmlFor={type} className="cursor-pointer text-sm">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scope Filter */}
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <div className="space-y-2">
                    {["Company-wide", "Department", "Division"].map((s) => (
                      <div key={s} className="flex items-center space-x-2">
                        <Checkbox
                          id={s}
                          checked={scope.includes(s)}
                          onCheckedChange={(checked) => {
                            setScope((prev) =>
                              checked
                                ? [...prev, s]
                                : prev.filter((t) => t !== s)
                            );
                          }}
                        />
                        <Label htmlFor={s} className="cursor-pointer text-sm">
                          {s}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div className="space-y-2">
                  <Label>Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="date">Date Modified</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="size">Size</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </div>

          {/* Search Results */}
          <div className="lg:col-span-3 space-y-4">
            {/* Search Bar */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents, folders, or content..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch}>Search</Button>
            </div>

            {/* Results */}
            {query ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Found {results.length} results for "{query}"
                  </p>
                </div>

                <Tabs defaultValue="all">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                    <TabsTrigger value="folders">Folders</TabsTrigger>
                  </TabsList>

                  <TabsContent value="all" className="space-y-4">
                    {results.length === 0 ? (
                      <EmptyState
                        icon={Search}
                        title="No results found"
                        description="Try adjusting your search query or filters"
                      />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {/* Results will be rendered here */}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            ) : (
              <Card className="p-12">
                <div className="text-center">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Enter a search query to find documents and folders
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
  );
}
