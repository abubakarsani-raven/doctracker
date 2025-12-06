"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  FileText,
  Clock,
} from "lucide-react";
import { EmptyState } from "@/components/common";
import { DocumentCard } from "@/components/common";
import { formatDistanceToNow } from "date-fns";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useDocuments } from "@/lib/hooks/use-documents";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const { data: allDocuments = [] } = useDocuments();

  const [profileData, setProfileData] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    role: "",
    department: "",
    division: "",
    avatar: null,
  });
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setProfileData({
        id: currentUser.id || "",
        name: currentUser.name || "",
        email: currentUser.email || "",
        phone: currentUser.phone || "",
        role: currentUser.role || "",
        department: currentUser.department || "",
        division: currentUser.division || "",
        avatar: currentUser.avatar || null,
      });
    }
  }, [currentUser]);

  // Get user's documents (documents created by this user)
  const userDocuments = allDocuments.filter(
    (doc: any) => doc.createdBy === currentUser?.id || doc.createdBy === currentUser?.email || doc.createdBy === currentUser?.name
  ).slice(0, 6); // Show first 6

  // Mock activity data - TODO: Create activity tracking API
  const activities: any[] = []; // Empty for now, can be populated from API later

  // Mock permissions data - TODO: Create permissions API
  const permissions: any[] = []; // Empty for now

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // TODO: Replace with actual API call when endpoint is available
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const initials = profileData.name
    ? profileData.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Profile</h1>
        <p className="text-muted-foreground">
          View and manage your profile information
        </p>
      </div>

      {/* Profile Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{profileData.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span>{profileData.email}</span>
                </div>
                {profileData.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{profileData.phone}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-4">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  {profileData.role}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  {profileData.department}
                  {profileData.division && ` - ${profileData.division}`}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information
                  </CardDescription>
                </div>
                {!isEditing && (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Edit Profile
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={profileData.name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, name: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={profileData.email} disabled />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) =>
                    setProfileData({ ...profileData, phone: e.target.value })
                  }
                  disabled={!isEditing}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Role</Label>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{profileData.role}</Badge>
                  <span className="text-sm text-muted-foreground">
                    (Cannot be changed)
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{profileData.department}</span>
                </div>
              </div>
              {isEditing && (
                <div className="flex gap-2">
                  <Button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      if (currentUser) {
                        setProfileData({
                          id: currentUser.id || "",
                          name: currentUser.name || "",
                          email: currentUser.email || "",
                          phone: currentUser.phone || "",
                          role: currentUser.role || "",
                          department: currentUser.department || "",
                          division: currentUser.division || "",
                          avatar: currentUser.avatar || null,
                        });
                      }
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Your recent actions and interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No activity yet"
                  description="Your activity will appear here"
                />
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 pb-4 border-b last:border-0"
                    >
                      <div className="mt-1">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{activity.action}</span>
                          {" - "}
                          <span className="text-muted-foreground">
                            {activity.resource}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(activity.timestamp, {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>My Documents</CardTitle>
              <CardDescription>
                Documents you have created or have access to
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userDocuments.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents yet"
                  description="Documents you create or have access to will appear here"
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {userDocuments.map((doc: any) => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      onView={(id) => router.push(`/documents/${id}`)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>
                Resources you have access to and your permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {permissions.length === 0 ? (
                <EmptyState
                  icon={Shield}
                  title="No permissions"
                  description="You don't have any specific permissions yet"
                />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Resource</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Permissions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions.map((perm, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {perm.resource}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{perm.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {perm.permissions.map((p: string) => (
                                <Badge key={p} variant="secondary">
                                  {p}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
