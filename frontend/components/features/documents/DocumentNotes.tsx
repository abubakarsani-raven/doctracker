"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Separator } from "@/components/ui/separator";

interface Note {
  id: string;
  content: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
}

interface DocumentNotesProps {
  documentId: string;
}

export function DocumentNotes({ documentId }: DocumentNotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Load notes when component mounts
  useEffect(() => {
    loadNotes();
  }, [documentId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call when backend endpoint is available
      // const notesData = await api.getDocumentNotes(documentId);
      // setNotes(notesData);
      
      // For now, show empty state (no dummy data)
      setNotes([]);
    } catch (error) {
      console.error("Failed to load notes:", error);
    } finally {
      setLoading(false);
    }
  };
  const [newNote, setNewNote] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [addingNote, setAddingNote] = useState(false);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    setAddingNote(true);

    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      const note: Note = {
        id: Date.now().toString(),
        content: newNote,
        isPublic: isPublic,
        createdBy: "Current User", // Replace with actual user
        createdAt: new Date(),
      };

      setNotes([note, ...notes]);
      setNewNote("");
    } finally {
      setAddingNote(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add Note Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Add Note
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              placeholder="Add a note about this document..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="public"
                checked={isPublic}
                onCheckedChange={setIsPublic}
              />
              <Label htmlFor="public" className="cursor-pointer">
                Public note (visible to all)
              </Label>
            </div>
            <Button onClick={handleAddNote} disabled={!newNote.trim() || addingNote}>
              <Plus className="mr-2 h-4 w-4" />
              Add Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      <Card>
        <CardHeader>
          <CardTitle>Notes ({notes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Loading notes...
            </p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No notes yet. Add one above.
            </p>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {notes.map((note, index) => (
                  <div key={note.id}>
                    <div className="flex items-start gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {note.createdBy
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{note.createdBy}</p>
                          {!note.isPublic && (
                            <span className="text-xs text-muted-foreground">(Private)</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(note.createdAt, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                      </div>
                    </div>
                    {index < notes.length - 1 && <Separator className="mt-4" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
