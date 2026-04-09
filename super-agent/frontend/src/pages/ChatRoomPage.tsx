/**
 * ChatRoomPage
 * Page wrapper for the group chat room interface.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ChatRoom } from '@/components/ChatRoom';

export function ChatRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  if (!roomId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No room ID provided
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800">
        <button
          onClick={() => navigate('/chat')}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Back to chat"
        >
          <ArrowLeft size={18} />
        </button>
        <span className="text-sm text-gray-400">Group Chat Room</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatRoom roomId={roomId} />
      </div>
    </div>
  );
}
