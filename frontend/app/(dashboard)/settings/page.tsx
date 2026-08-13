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
import { useCurrentUser, useUpdateOwnProfile } from "@/lib/hooks/use-users";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useMemo } from "react";
import {
  FONT_SCALE_OPTIONS,
  getStoredFontScale,
  setFontScale,
  type FontScale,
} from "@/lib/font-scale";
import { cn } from "@/lib/utils";
import { ManageSavedSignatures } from "@/components/features/signatures/ManageSavedSignatures";
import { PermissionsPanel } from "@/components/common/PermissionsPanel";
import { getPermissions } from "@/lib/permissions";

export default function SettingsPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: companies = [] } = useCompanies();
  const updateOwnProfile = useUpdateOwnProfile();
  const permissions = useMemo(
    () => getPermissions(currentUser),
    [currentUser],
  );
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [fontScale, setFontScaleState] = useState<FontScale>("md");

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

  useEffect(() => {
    setFontScaleState(getStoredFontScale());
  }, []);

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
      await updateOwnProfile.mutateAsync({
        name: profileData.name,
        phone: profileData.phone,
      });
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleFontScaleChange = (scale: FontScale) => {
    setFontScaleState(scale);
    setFontScale(scale);
    toast.success("Text size updated");
  };

  // Notification preferences have no store behind them yet — there is no
  // preference model on the API. Rather than report a save that did not
  // happen, the controls stay read-only until that lands.
  const notificationPreferencesSupported = false;

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
          <TabsTrigger value="role">Role & access</TabsTrigger>
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
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
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={permissions.role || "Not assigned"}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Your role is set by an administrator. See Role & access for
                  what you can do.
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

        <TabsContent value="role" className="space-y-4">
          <PermissionsPanel />
        </TabsContent>

        <TabsContent value="signatures">
          <Card>
            <CardHeader>
              <CardTitle>Saved signatures</CardTitle>
              <CardDescription>
                Draw or upload signatures once, then select them when you sign
                documents.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManageSavedSignatures />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Text size</CardTitle>
              <CardDescription>
                Make the whole app easier to read. You can also use A− / A+ in
                the header. This preference stays on this device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {FONT_SCALE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleFontScaleChange(option.value)}
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      fontScale === option.value &&
                        "border-primary bg-primary/5 ring-1 ring-primary",
                    )}
                  >
                    <span
                      className="block font-semibold leading-none"
                      style={{ fontSize: `${option.percent}%` }}
                    >
                      {option.sample}
                    </span>
                    <span className="mt-2 block text-sm font-medium">
                      {option.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {option.percent}%
                    </span>
                  </button>
                ))}
              </div>
              <p
                className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                style={{
                  fontSize: `${
                    FONT_SCALE_OPTIONS.find((o) => o.value === fontScale)
                      ?.percent ?? 100
                  }%`,
                }}
              >
                Sample: File, route and approve documents across departments.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how you want to be notified about activities. Saving
                preferences is not available yet — notifications currently use
                the system defaults shown below.
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
                        disabled={!notificationPreferencesSupported}
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
                        disabled={!notificationPreferencesSupported}
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
                        disabled={!notificationPreferencesSupported}
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
                        disabled={!notificationPreferencesSupported}
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
                        disabled={!notificationPreferencesSupported}
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
                        disabled={!notificationPreferencesSupported}
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

                <Button disabled>Save Preferences</Button>
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
