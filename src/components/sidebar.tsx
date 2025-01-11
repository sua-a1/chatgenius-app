'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PlusCircle, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Workspace } from '@/types'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Logo } from '@/components/logo'

interface SidebarProps {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  onSelectWorkspace: (workspaceId: string) => void
  onCreateWorkspace: (name: string) => Promise<Workspace | null>
  onOpenProfileSettings: () => void
}

export default function Sidebar({ 
  workspaces, 
  activeWorkspace, 
  onSelectWorkspace,
  onCreateWorkspace,
  onOpenProfileSettings,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const { toast } = useToast()

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Workspace name required',
        description: 'Please enter a name for your workspace.',
      })
      return
    }

    const workspace = await onCreateWorkspace(newWorkspaceName.trim())
    if (workspace) {
      setNewWorkspaceName('')
      setIsCreating(false)
      onSelectWorkspace(workspace.id)
      toast({
        title: 'Workspace created',
        description: `${workspace.name} has been created successfully.`,
      })
    }
  }

  return (
    <div className="grid grid-rows-[auto,1fr] h-full bg-[#3A2E6E] text-white overflow-hidden" style={{ width: isCollapsed ? '4rem' : '16rem' }}>
      {/* Workspace Header */}
      <div className="border-b border-white/10">
        <div className="h-16 flex items-center justify-between py-4">
          <div 
            className={`flex-1 min-w-0 ${isCollapsed ? 'px-3 cursor-pointer' : 'px-4'}`}
            onClick={() => isCollapsed && setIsCollapsed(false)}
          >
            <div className="flex items-center">
              {!isCollapsed ? (
                <Logo size="md" showText={true} />
              ) : (
                <Logo size="md" showText={false} />
              )}
            </div>
          </div>
          <div className={`flex-shrink-0 ${isCollapsed ? 'pr-1' : 'pr-2'}`}>
            <Button variant="ghost" size="icon" className="hover:bg-white/10" onClick={() => setIsCollapsed(!isCollapsed)}>
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Workspaces List */}
      <div className="overflow-hidden">
        <ScrollArea className="h-full">
          <div className={`p-2 ${isCollapsed ? 'px-1' : ''}`}>
            {!isCollapsed && <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight truncate">Workspaces</h2>}
            <div className="space-y-1">
              {workspaces.map((workspace) => (
                <Button
                  key={workspace.id}
                  variant="ghost"
                  className={`w-full justify-start hover:bg-white/10 overflow-hidden ${
                    activeWorkspace?.id === workspace.id ? 'bg-white/20' : ''
                  } ${isCollapsed ? 'px-3' : 'px-3'}`}
                  onClick={() => onSelectWorkspace(workspace.id)}
                >
                  <span className={`truncate ${isCollapsed ? 'w-6 text-center block' : ''}`}>
                    {isCollapsed ? workspace.name[0] : workspace.name}
                  </span>
                </Button>
              ))}
              {isCreating && !isCollapsed ? (
                <div className="p-2 space-y-2">
                  <Input
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace name"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/60 w-full"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateWorkspace()
                      } else if (e.key === 'Escape') {
                        setIsCreating(false)
                        setNewWorkspaceName('')
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="secondary" 
                      className="flex-1 bg-white/10 hover:bg-white/20"
                      onClick={handleCreateWorkspace}
                    >
                      Create
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="hover:bg-white/10"
                      onClick={() => {
                        setIsCreating(false)
                        setNewWorkspaceName('')
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  className={`w-full justify-start hover:bg-white/10 overflow-hidden ${isCollapsed ? 'px-3' : 'px-3'}`}
                  onClick={() => !isCollapsed && setIsCreating(true)}
                >
                  <PlusCircle className={`h-4 w-4 flex-shrink-0 ${!isCollapsed ? 'mr-2' : ''}`} />
                  {!isCollapsed && <span className="truncate">Add Workspace</span>}
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

