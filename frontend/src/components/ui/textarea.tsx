import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content max-h-52 min-h-20 w-full min-w-0 resize-none overflow-y-auto rounded-lg wrap-anywhere border border-input bg-background px-4 py-3 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-disabled aria-invalid:border-destructive dark:bg-input/30 dark:disabled:bg-input/80 ",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
