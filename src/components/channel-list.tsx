import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Hash, PlusCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Channel } from '@/types'

interface ChannelListProps {
  channels: Channel[]
  isLoading: boolean
  isCollapsed: boolean
  onSelectChannel: (channelId: string) => void
  createChannel: (name: string) => Promise<Channel | null>
}

export function ChannelList({ channels, isLoading, isCollapsed, onSelectChannel, createChannel }: ChannelListProps) {
  const [newChannelName, setNewChannelName] = useState('')
  const [showAllChannels, setShowAllChannels] = useState(false)
  const { toast } = useToast()

  const visibleChannels = showAllChannels ? channels : channels.slice(0, 5)

  const handleAddChannel = async () => {
    if (!newChannelName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Channel name required',
        description: 'Please enter a name for your channel.',
      })
      return
    }

    const channel = await createChannel(newChannelName.trim())
    if (channel) {
      setNewChannelName('')
      onSelectChannel(channel.id)
      toast({
        title: 'Channel created',
        description: `#${channel.name} has been created successfully.`,
      })
    }
  }

  return (
    <div>
      <h2 className={`text-lg font-semibold px-2 mb-2 ${isCollapsed ? 'text-center' : ''}`}>
        {isCollapsed ? '#' : 'Channels'}
      </h2>
      <div className="space-y-1">
        {isLoading ? (
          <div className="text-sm text-muted-foreground px-2">Loading channels...</div>
        ) : channels.length === 0 ? (
          <div className="text-sm text-muted-foreground px-2">No channels yet</div>
        ) : (
          <>
            {visibleChannels.map((channel) => (
              <Button
                key={channel.id}
                variant="ghost"
                className="w-full justify-start px-2 hover:bg-[#3A2E6E]/10"
                onClick={() => onSelectChannel(channel.id)}
              >
                <Hash className="mr-2 h-4 w-4 shrink-0" />
                {!isCollapsed && <span className="truncate">{channel.name}</span>}
              </Button>
            ))}
            {!isCollapsed && channels.length > 5 && (
              <Button
                variant="ghost"
                className="w-full justify-center text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setShowAllChannels(!showAllChannels)}
              >
                {showAllChannels ? 'Show Less' : `Show ${channels.length - 5} More`}
              </Button>
            )}
          </>
        )}
        {!isCollapsed && (
          <div className="flex items-center gap-2 mt-2 px-2">
            <Input
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="New channel name"
              className="flex-1 h-8"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddChannel()
                } else if (e.key === 'Escape') {
                  setNewChannelName('')
                }
              }}
            />
            <Button 
              size="sm" 
              onClick={handleAddChannel}
              className="bg-[#3A2E6E] hover:bg-[#2A2154]"
            >
              <PlusCircle className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
} 