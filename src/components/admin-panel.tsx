import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Trash2, Hash, X } from 'lucide-react'
import { useWorkspaceMembers } from '@/hooks/use-workspace-members'
import { useWorkspaces } from '@/hooks/use-workspaces'
import { useChannels } from '@/hooks/use-channels'
import { Workspace } from '@/types'
import { useAuth } from '@/contexts/auth-context'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface WorkspaceSettings {
  maxChannelsPerUser: number
  requireChannelApproval: boolean
}

interface AdminPanelProps {
  workspaces: Workspace[]
  currentWorkspaceId: string
  onDeleteWorkspace?: (workspaceId: string) => Promise<boolean>
  onClose?: () => void
}

export function AdminPanel({ workspaces = [], currentWorkspaceId, onDeleteWorkspace, onClose }: AdminPanelProps) {
  const { profile } = useAuth()
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<'member' | 'admin'>('member')

  const {
    members,
    isLoading: isLoadingMembers,
    addMember,
    updateMemberRole,
    removeMember,
    isAdmin
  } = useWorkspaceMembers(selectedWorkspace?.id || null)

  const {
    channels,
    isLoading: isLoadingChannels,
    deleteChannel
  } = useChannels(selectedWorkspace?.id)

  // Set current workspace
  useEffect(() => {
    const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId)
    if (currentWorkspace) {
      setSelectedWorkspace(currentWorkspace)
    }
  }, [currentWorkspaceId, workspaces])

  // Show no access message if not admin
  if (!isAdmin) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">Admin Panel</h2>
        <p className="text-muted-foreground">You don't have admin access to this workspace.</p>
      </div>
    )
  }

  if (!selectedWorkspace) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4">Admin Panel</h2>
        <p className="text-muted-foreground">Workspace not found.</p>
      </div>
    )
  }

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) return
    await addMember(newUserEmail.trim(), newUserRole)
    setNewUserEmail('')
    setNewUserRole('member')
  }

  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspace || !onDeleteWorkspace) return
    const success = await onDeleteWorkspace(selectedWorkspace.id)
    if (success) {
      setSelectedWorkspace(null)
      onClose?.()
    }
  }

  const handleDeleteChannel = async (channelId: string) => {
    if (!selectedWorkspace || !isAdmin) return
    await deleteChannel(channelId)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Admin Panel</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-medium">{selectedWorkspace.name}</h3>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Workspace
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this workspace? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteWorkspace}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="channels">Channels</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members">
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Add New User</h3>
            <div className="flex space-x-2">
              <Input
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Email"
                type="email"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'member' | 'admin')}
                className="border rounded px-2"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <Button onClick={handleAddUser}>Add User</Button>
            </div>
          </div>
          <ScrollArea className="h-[400px] border rounded p-4">
            {isLoadingMembers ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center text-muted-foreground">
                No members in this workspace
              </div>
            ) : (
              <div className="space-y-4">
                {members.map(member => (
                  <div key={member.id} className="flex justify-between items-center p-2 rounded hover:bg-muted">
                    <div>
                      <div className="font-medium">{member.username || member.email}</div>
                      <div className="text-sm text-muted-foreground">{member.email}</div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={member.role === 'admin'}
                          onCheckedChange={(checked) => 
                            updateMemberRole(member.id, checked ? 'admin' : 'member')
                          }
                          disabled={selectedWorkspace?.owner_id === member.id}
                        />
                        <span className="text-sm">
                          {selectedWorkspace?.owner_id === member.id ? 'owner' : member.role}
                        </span>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeMember(member.id)}
                        disabled={selectedWorkspace?.owner_id === member.id}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="channels">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Manage Channels</h3>
              {isLoadingChannels ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : channels.length === 0 ? (
                <p className="text-sm text-muted-foreground">No channels in this workspace</p>
              ) : (
                <ScrollArea className="h-[300px] rounded-md border p-4">
                  <div className="space-y-2">
                    {channels.map((channel) => (
                      <div key={channel.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-accent">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{channel.name}</span>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Channel</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete #{channel.name}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteChannel(channel.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

