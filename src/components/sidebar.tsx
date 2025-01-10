'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PlusCircle, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Workspace } from '@/types'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

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
    <div className="grid grid-rows-[auto,1fr] h-full bg-gray-800 text-white transition-all duration-300" style={{ width: isCollapsed ? '4rem' : '16rem' }}>
      {/* Workspace Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        {!isCollapsed && <h1 className="text-xl font-bold">ChatGenius</h1>}
        <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(!isCollapsed)}>
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Workspaces List */}
      <div className="overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2">
            {!isCollapsed && <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">Workspaces</h2>}
            <div className="space-y-1">
              {workspaces.map((workspace) => (
                <Button
                  key={workspace.id}
                  variant="ghost"
                  className={`w-full justify-start ${activeWorkspace?.id === workspace.id ? 'bg-gray-700' : ''}`}
                  onClick={() => onSelectWorkspace(workspace.id)}
                >
                  {isCollapsed ? workspace.name[0] : workspace.name}
                </Button>
              ))}
              {isCreating && !isCollapsed ? (
                <div className="p-2 space-y-2">
                  <Input
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace name"
                    className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
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
                      className="flex-1"
                      onClick={handleCreateWorkspace}
                    >
                      Create
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
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
                  className="w-full justify-start"
                  onClick={() => !isCollapsed && setIsCreating(true)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {!isCollapsed && 'Add Workspace'}
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

