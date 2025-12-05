"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HardDrive, TrendingUp, Building2, FileText } from "lucide-react";

const storageData = {
  total: 60,
  used: 45.2,
  available: 14.8,
  companies: [
    {
      id: "1",
      name: "Acme Corporation",
      used: 25.5,
      files: 1234,
      percentage: 85,
    },
    {
      id: "2",
      name: "Tech Solutions Ltd",
      used: 19.7,
      files: 856,
      percentage: 65,
    },
  ],
  largeFiles: [
    {
      id: "1",
      name: "presentation.pdf",
      size: 125.5,
      type: "pdf",
      location: "Legal Documents",
    },
    {
      id: "2",
      name: "video_recording.mp4",
      size: 89.3,
      type: "mp4",
      location: "Training Materials",
    },
  ],
};

export default function StoragePage() {
  const usagePercentage = (storageData.used / storageData.total) * 100;

  return (
    <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Storage Analytics</h1>
          <p className="text-muted-foreground">
            Monitor storage usage across the system
          </p>
        </div>

        {/* Overall Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{storageData.total} GB</div>
              <p className="text-xs text-muted-foreground">Total capacity</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{storageData.used} GB</div>
              <p className="text-xs text-muted-foreground">
                {usagePercentage.toFixed(1)}% of total
              </p>
              <Progress value={usagePercentage} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Space</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{storageData.available} GB</div>
              <p className="text-xs text-muted-foreground">Remaining capacity</p>
            </CardContent>
          </Card>
        </div>

        {/* Company Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Storage by Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {storageData.companies.map((company) => (
                <div key={company.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {company.files.toLocaleString()} files
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{company.used} GB</p>
                      <Badge variant="secondary">{company.percentage}%</Badge>
                    </div>
                  </div>
                  <Progress value={company.percentage} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Large Files */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Largest Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Size (MB)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storageData.largeFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">{file.name}</TableCell>
                    <TableCell>{file.location}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{file.type.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{file.size} MB</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Storage Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Storage Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Chart will be displayed here
              <br />
              (Install recharts for visualization)
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
