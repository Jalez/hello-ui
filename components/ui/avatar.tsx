"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type ImageLoadingStatus = "idle" | "loading" | "loaded" | "error"

const AvatarContext = React.createContext<{
  imageLoadingStatus: ImageLoadingStatus
  setImageLoadingStatus: (status: ImageLoadingStatus) => void
} | null>(null)

const Avatar = React.forwardRef<
  React.ElementRef<"span">,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => {
  const [imageLoadingStatus, setImageLoadingStatus] = React.useState<ImageLoadingStatus>("idle")

  return (
    <AvatarContext.Provider value={{ imageLoadingStatus, setImageLoadingStatus }}>
      <span
        ref={ref}
        className={cn(
          "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
          className
        )}
        {...props}
      />
    </AvatarContext.Provider>
  )
})
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  React.ElementRef<"img">,
  React.ComponentPropsWithoutRef<"img">
>(({ className, onLoad, onError, src, ...props }, ref) => {
  const context = React.useContext(AvatarContext)

  React.useEffect(() => {
    if (!context) return
    context.setImageLoadingStatus(src ? "loading" : "error")
  }, [context, src])

  if (!src) {
    return null
  }

  return (
    <img
      ref={ref}
      className={cn(
        "aspect-square h-full w-full",
        context?.imageLoadingStatus === "loaded" ? "block" : "hidden",
        className
      )}
      src={src}
      onLoad={(event) => {
        context?.setImageLoadingStatus("loaded")
        onLoad?.(event)
      }}
      onError={(event) => {
        context?.setImageLoadingStatus("error")
        onError?.(event)
      }}
      {...props}
    />
  )
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  React.ElementRef<"span">,
  React.ComponentPropsWithoutRef<"span">
>(({ className, ...props }, ref) => {
  const context = React.useContext(AvatarContext)

  if (context?.imageLoadingStatus === "loaded") {
    return null
  }

  return (
    <span
      ref={ref}
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-muted",
        className
      )}
      {...props}
    />
  )
})
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
