-- Migration: Add reply_to_id to messages
-- Replaces the old hack of encoding reply IDs inside the nonce field as "reply:UUID"

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id UUID
    REFERENCES public.messages(id)
    ON DELETE SET NULL;

-- Index for efficient lookup of replies to a given message
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id
  ON public.messages(reply_to_id)
  WHERE reply_to_id IS NOT NULL;
