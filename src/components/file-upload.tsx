import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Paperclip, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileCancel: () => void;
  maxSize?: number; // in bytes
  allowedTypes?: string[];
}

export function FileUpload({ onFileSelect, onFileCancel, maxSize = 5 * 1024 * 1024, allowedTypes = ['image/*', 'video/*', 'audio/*', 'application/pdf'] }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > maxSize) {
        toast({
          title: "File too large",
          description: `Maximum file size is ${maxSize / 1024 / 1024}MB`,
          variant: "destructive",
        })
        return
      }
      if (!allowedTypes.some(type => selectedFile.type.match(type))) {
        toast({
          title: "Invalid file type",
          description: "Please upload a valid file type",
          variant: "destructive",
        })
        return
      }
      setFile(selectedFile)
      onFileSelect(selectedFile)
      simulateUpload()
      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreview(reader.result as string)
        }
        reader.readAsDataURL(selectedFile)
      }
    }
  }

  const simulateUpload = () => {
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)
      }
    }, 500)
  }

  const handleCancel = () => {
    setFile(null)
    setProgress(0)
    setPreview(null)
    onFileCancel()
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileChange({ target: { files: e.dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }, [])

  return (
    <div 
      className="flex flex-col items-center space-y-2"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept={allowedTypes.join(',')}
      />
      {!file ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-20 border-dashed"
        >
          <Paperclip className="mr-2 h-4 w-4" />
          Drag & drop or click to upload
        </Button>
      ) : (
        <div className="w-full">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm truncate">{file.name}</span>
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="w-full" />
          {preview && (
            <img src={preview} alt="Preview" className="mt-2 max-w-full h-auto max-h-40 rounded" />
          )}
        </div>
      )}
    </div>
  )
}

