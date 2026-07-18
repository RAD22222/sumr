import { MessageSquare } from "lucide-react"

export default function ChatsPage() {
  return (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-muted/30">
      <div className="text-center max-w-sm space-y-4">
        <div className="rounded-full bg-primary/10 p-6 mx-auto w-fit">
          <MessageSquare className="h-12 w-12 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Select a chat</h2>
        <p className="text-sm text-muted-foreground">
          Choose a conversation from the sidebar or start a new one
        </p>
      </div>
    </div>
  )
}
