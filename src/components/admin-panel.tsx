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
  workspace: Workspace | null;
  workspaces: Workspace[];
  onTabChange: (tab: string) => void;
  onDeleteWorkspace: (workspaceId: string) => Promise<boolean>;
}

export function AdminPanel({ workspace, workspaces, onTabChange, onDeleteWorkspace }: AdminPanelProps) {
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<'member' | 'admin'>('member')
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>({
    maxChannelsPerUser: 5,
    requireChannelApproval: false,
  })
  const [activeTab, setActiveTab] = useState('members')

  const {
    members,
    isLoading: isLoadingMembers,
    addMember,
    updateMemberRole,
    removeMember,
    isAdmin
  } = useWorkspaceMembers(workspace?.id || null)

  const {
    channels,
    isLoading: isLoadingChannels,
    deleteChannel
  } = useChannels(workspace?.id)

  // Reset state when workspace changes
  useEffect(() => {
    if (workspace?.id) {
      setNewUserEmail('')
      setNewUserRole('member')
      setWorkspaceSettings({
        maxChannelsPerUser: 5,
        requireChannelApproval: false,
      })
    }
  }, [workspace?.id])

  const handleAddUser = async () => {
    if (!newUserEmail.trim() || !workspace) return
    await addMember(newUserEmail.trim(), newUserRole)
    setNewUserEmail('')
    setNewUserRole('member')
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Admin Panel{workspace ? ` - ${workspace.name}` : ''}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onTabChange('chat')}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="space-x-2">
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
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground">
                  No members found
                </div>
              ) : (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-accent">
                      <div>
                        <div className="font-medium">{member.email}</div>
                        <div className="text-sm text-muted-foreground">
                          {workspace?.owner_id === member.id ? 'Owner' : member.role}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && workspace?.owner_id !== member.id && (
                          <select
                            value={member.role}
                            onChange={(e) => updateMemberRole(member.id, e.target.value as 'member' | 'admin')}
                            className="border rounded px-2 py-1 text-sm"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                        {isAdmin && workspace?.owner_id !== member.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {member.email} from this workspace?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => removeMember(member.id)}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
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
                {workspace && (
                  <ChannelManagement workspace={workspace} />
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
      </div>
    </div>
  )
}

