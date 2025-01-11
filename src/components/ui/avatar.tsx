"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/lib/utils"

export type UserStatus = 'online' | 'away' | 'busy' | 'offline'

interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  status?: UserStatus
  children?: React.ReactNode
}

interface AvatarImageProps extends Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>, 'src'> {
  src?: string | null
  alt?: string
}

interface AvatarFallbackProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {}

const StatusIndicator = React.memo(({ status }: { status: UserStatus }) => (
  <span
    className={cn(
      "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
      {
        "bg-green-500": status === "online",
        "bg-yellow-500": status === "away",
        "bg-red-500": status === "busy",
        "bg-gray-500": status === "offline",
      }
    )}
  />
))
StatusIndicator.displayName = "StatusIndicator"

const AvatarRoot = React.memo(
  React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
    ({ className, status, children, ...props }, ref) => (
      <div className="relative inline-block">
        <AvatarPrimitive.Root
          ref={ref}
          className={cn(
            "relative flex aspect-square h-10 w-10 shrink-0 overflow-hidden rounded-full",
            className
          )}
          {...props}
        >
          {children}
        </AvatarPrimitive.Root>
        {status && <StatusIndicator status={status} />}
      </div>
    )
  )
)
AvatarRoot.displayName = "Avatar"

const AvatarImage = React.memo(
  React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Image>, AvatarImageProps>(
    ({ className, src, alt = "", ...props }, ref) => {
      if (!src) return null
      return (
        <AvatarPrimitive.Image
          ref={ref}
          src={src}
          alt={alt}
          className={cn("aspect-square h-full w-full", className)}
          {...props}
        />
      )
    }
  )
)
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.memo(
  React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Fallback>, AvatarFallbackProps>(
    ({ className, children, ...props }, ref) => (
      <AvatarPrimitive.Fallback
        ref={ref}
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground",
          className
        )}
        {...props}
      >
        {children}
      </AvatarPrimitive.Fallback>
    )
  )
)
AvatarFallback.displayName = "AvatarFallback"

export { AvatarRoot as Avatar, AvatarImage, AvatarFallback }
