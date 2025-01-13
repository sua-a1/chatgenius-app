'use client'

import { useState, useRef, useEffect } from 'react'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useToast } from '@/hooks/use-toast'
import { MessageSquare, User, Hash } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export type SearchResult = {
  type: 'message' | 'user' | 'channel'
  id: string
  content: string
  similarity: number
  channel_id?: string // For message navigation
  channel_name?: string // For displaying channel name in message results
}

interface SearchDialogProps {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectResult: (result: SearchResult) => void
  query: string
  onQueryChange: (value: string) => void
}

export function SearchDialog({ workspaceId, open, onOpenChange, onSelectResult, query, onQueryChange }: SearchDialogProps) {
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const commandRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commandRef.current && !commandRef.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onOpenChange])

  // Search when query changes
  useEffect(() => {
    const handleSearch = async () => {
      if (!query.trim()) {
        setResults([])
        return
      }

      setIsLoading(true)
      try {
        console.log('Searching with params:', {
          workspace_id: workspaceId,
          query,
          similarity_threshold: 0.1,
          match_count: 10
        });

        const { data, error } = await supabase
          .rpc('search_workspace', {
            workspace_id: workspaceId,
            query,
            similarity_threshold: 0.1,
            match_count: 10
          })

        if (error) {
          console.error('Search error:', error);
          throw error;
        }

        console.log('Search results:', data);
        const validResults = (data || []).filter((result: SearchResult) => result.similarity !== null);
        setResults(validResults)
      } catch (error: any) {
        console.error('Search error:', error)
        toast({
          title: 'Search failed',
          description: error.message,
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    handleSearch()
  }, [query, workspaceId, toast])

  const getIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="mr-2 h-4 w-4" />
      case 'user':
        return <User className="mr-2 h-4 w-4" />
      case 'channel':
        return <Hash className="mr-2 h-4 w-4" />
      default:
        return null
    }
  }

  if (!open) return null;

  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-1">
      <Command 
        ref={commandRef} 
        className="rounded-lg border shadow-md bg-popover"
        shouldFilter={false}
      >
        <CommandList className="max-h-[300px] overflow-y-auto p-2">
          <CommandEmpty>
            {isLoading ? 'Searching...' : 'No results found.'}
          </CommandEmpty>
          {results.length > 0 && (
            <CommandGroup heading="Search Results">
              {results.map((result) => (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  value={`${result.type}-${result.id}`}
                  onSelect={() => {
                    console.log('Selected result:', result);
                    onSelectResult(result);
                    onOpenChange(false);
                  }}
                  className="flex items-center gap-2 cursor-pointer hover:bg-[#4A3B8C]/10 aria-selected:bg-[#4A3B8C]/20 px-4 py-3 select-none rounded-md data-[disabled=false]:pointer-events-auto data-[disabled=false]:opacity-100"
                  disabled={false}
                >
                  <div className="flex items-center gap-2 w-full">
                    {getIcon(result.type)}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="truncate font-medium">{result.content}</div>
                      <div className="text-xs text-muted-foreground">
                        {result.type === 'message' ? `Message in #${result.channel_name || 'unknown channel'}` : 
                         result.type === 'user' ? 'Member' : 
                         result.type === 'channel' ? 'Channel' : ''}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {Math.round(result.similarity * 100)}% match
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  )
} 