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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, Bell, Shield, Palette, Building2 } from "lucide-react";
import { useCurrentUser } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useMemo } from "react";

export default function SettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: companies = [] } = useCompanies();
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
  });

  // Get company name from companyId
  const companyName = useMemo(() => {
    if (!currentUser?.companyId) return null;
    const company = companies.find((c: any) => c.id === currentUser.companyId);
    return company?.name || null;
  }, [currentUser, companies]);

  useEffect(() => {
    if (currentUser) {
      setProfileData({
        name: currentUser.name || "",
        email: currentUser.email || "",
        phone: currentUser.phone || "",
      });
    }
  }, [currentUser]);

  const [notificationPreferences, setNotificationPreferences] = useState({
    assignments: { email: true, inApp: true },
    accessRequests: { email: true, inApp: true },
    actions: { email: true, inApp: true },
    workflow: { email: false, inApp: true },
    comments: { email: false, inApp: true },
  });
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // TODO: Replace with actual API call when endpoint is available
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      // TODO: Replace with actual API call when endpoint is available
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Notification preferences updated");
    } catch (error) {
      toast.error("Failed to update preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
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
                  disabled={saving}
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
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={currentUser?.department || "Not assigned"}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Department cannot be changed
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={companyName || currentUser?.companyId || "Not assigned"}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Company cannot be changed
                </p>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified about activities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Assignment Notifications */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Workflow Assignments</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when workflows are assigned to you
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="assign-email" className="text-sm">
                        Email
                      </Label>
                      <Switch
                        id="assign-email"
                        checked={notificationPreferences.assignments.email}
                        onCheckedChange={(checked) =>
                          setNotificationPreferences({
                            ...notificationPreferences,
                            assignments: {
                              ...notificationPreferences.assignments,
                              email: checked,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="assign-inapp" className="text-sm">
                        In-App
                      </Label>
                      <Switch
                        id="assign-inapp"
                        checked={notificationPreferences.assignments.inApp}
                        onCheckedChange={(checked) =>
                          setNotificationPreferences({
                            ...notificationPreferences,
                            assignments: {
                              ...notificationPreferences.assignments,
                              inApp: checked,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Access Request Notifications */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Access Requests</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified about access request updates
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="access-email" className="text-sm">
                        Email
                      </Label>
                      <Switch
                        id="access-email"
                        checked={notificationPreferences.accessRequests.email}
                        onCheckedChange={(checked) =>
                          setNotificationPreferences({
                            ...notificationPreferences,
                            accessRequests: {
                              ...notificationPreferences.accessRequests,
                              email: checked,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="access-inapp" className="text-sm">
                        In-App
                      </Label>
                      <Switch
                        id="access-inapp"
                        checked={notificationPreferences.accessRequests.inApp}
                        onCheckedChange={(checked) =>
                          setNotificationPreferences({
                            ...notificationPreferences,
                            accessRequests: {
                              ...notificationPreferences.accessRequests,
                              inApp: checked,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Action Notifications */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Action Updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when actions are completed or updated
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="action-email" className="text-sm">
                        Email
                      </Label>
                      <Switch
                        id="action-email"
                        checked={notificationPreferences.actions.email}
                        onCheckedChange={(checked) =>
                          setNotificationPreferences({
                            ...notificationPreferences,
                            actions: {
                              ...notificationPreferences.actions,
                              email: checked,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="action-inapp" className="text-sm">
                        In-App
                      </Label>
                      <Switch
                        id="action-inapp"
                        checked={notificationPreferences.actions.inApp}
                        onCheckedChange={(checked) =>
                          setNotificationPreferences({
                            ...notificationPreferences,
                            actions: {
                              ...notificationPreferences.actions,
                              inApp: checked,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveNotifications} disabled={saving}>
                  {saving ? "Saving..." : "Save Preferences"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Manage your account security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  Security settings will be available here. Password change,
                  two-factor authentication, and session management features
                  coming soon.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
