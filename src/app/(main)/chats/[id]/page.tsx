import ConversationView from "@/components/chat/ConversationView"

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ConversationView conversationId={id} />
}
