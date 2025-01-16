import { useState } from 'react'
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
import { ChannelManagement } from '@/components/channel-management'
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
  onDeleteWorkspace?: (workspaceId: string) => Promise<boolean>
  onTabChange: (tab: string) => void
}

export function AdminPanel({ workspaces = [], onDeleteWorkspace, onTabChange }: AdminPanelProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<'member' | 'admin'>('member')
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>({
    maxChannelsPerUser: 5,
    requireChannelApproval: false,
  })

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

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) return
    await addMember(newUserEmail.trim(), newUserRole)
    setNewUserEmail('')
    setNewUserRole('member')
  }

  const handleWorkspaceSelect = (workspaceId: string) => {
    const workspace = workspaces?.find(w => w.id === workspaceId)
    setSelectedWorkspace(workspace || null)
  }

  const handleDeleteWorkspace = async () => {
    if (!selectedWorkspace || !onDeleteWorkspace) return
    const success = await onDeleteWorkspace(selectedWorkspace.id)
    if (success) {
      setSelectedWorkspace(null)
    }
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Admin Panel</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onTabChange('chat')}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-4">
          <Label htmlFor="workspace-select">Select Workspace</Label>
          <div className="flex gap-2">
            <select
              id="workspace-select"
              value={selectedWorkspace?.id || ''}
              onChange={(e) => handleWorkspaceSelect(e.target.value)}
              className="flex-1 p-2 border rounded mt-1"
            >
              <option value="">Select a workspace</option>
              {workspaces && workspaces.length > 0 ? (
                workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))
              ) : (
                <option value="" disabled>No workspaces available</option>
              )}
            </select>
            {selectedWorkspace && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="mt-1">
                    <Trash2 className="h-4 w-4" />
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
            )}
          </div>
        </div>

        {selectedWorkspace && (
          <Tabs defaultValue="members" className="mt-6">
            <TabsList>
              <TabsTrigger value="members">Members</TabsTrigger>
              {isAdmin && (
                <>
                  <TabsTrigger value="channels">Channels</TabsTrigger>
                  <TabsTrigger value="settings">Settings</TabsTrigger>
                </>
              )}
            </TabsList>

            <TabsContent value="members" className="mt-4">
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
                            />
                            <span className="text-sm">{member.role}</span>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeMember(member.id)}
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
              <>
                <TabsContent value="channels" className="mt-4">
                  {selectedWorkspace && (
                    <ChannelManagement 
                      workspace={selectedWorkspace}
                      onTabChange={onTabChange}
                    />
                  )}
                </TabsContent>

                <TabsContent value="settings" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="maxChannelsPerUser">Max Channels Per User</Label>
                      <Input
                        id="maxChannelsPerUser"
                        type="number"
                        value={workspaceSettings.maxChannelsPerUser}
                        onChange={(e) => setWorkspaceSettings({ ...workspaceSettings, maxChannelsPerUser: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="requireChannelApproval"
                        checked={workspaceSettings.requireChannelApproval}
                        onCheckedChange={(checked) => setWorkspaceSettings({ ...workspaceSettings, requireChannelApproval: checked })}
                      />
                      <Label htmlFor="requireChannelApproval">Require Channel Approval</Label>
                    </div>
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        )}
      </div>
    </div>
  )
}

