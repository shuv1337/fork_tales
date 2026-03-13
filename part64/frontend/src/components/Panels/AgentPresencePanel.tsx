import { ChatPanel } from "./Chat";
import type {
  Catalog,
  AgentWorkspaceContext,
  SimulationState,
  UIProjectionChatSession,
  UIProjectionElementState,
} from "../../types";

interface Props {
  agentId: string;
  onSend: (text: string, agentPresenceId: string, workspace: AgentWorkspaceContext) => void;
  onRecord: () => void;
  onTranscribe: () => void;
  onSendVoice: (agentPresenceId: string, workspace: AgentWorkspaceContext) => void;
  isRecording: boolean;
  isThinking: boolean;
  voiceInputMeta: string;
  catalog: Catalog | null;
  simulation: SimulationState | null;
  workspaceContext?: AgentWorkspaceContext | null;
  onWorkspaceContextChange?: (agentPresenceId: string, workspace: AgentWorkspaceContext) => void;
  onWorkspaceBindingsChange?: (agentPresenceId: string, pinnedFileNodeIds: string[]) => void;
  chatLensState?: UIProjectionElementState | null;
  activeChatSession?: UIProjectionChatSession | null;
  activeAgentPresenceId?: string;
  onAgentPresenceChange?: (presenceId: string) => void;
}

export function AgentPresencePanel({
  agentId,
  onSend,
  onRecord,
  onTranscribe,
  onSendVoice,
  isRecording,
  isThinking,
  voiceInputMeta,
  catalog,
  simulation,
  workspaceContext,
  onWorkspaceContextChange,
  onWorkspaceBindingsChange,
  chatLensState,
  activeChatSession,
  activeAgentPresenceId,
  onAgentPresenceChange,
}: Props) {
  return (
    <ChatPanel
      onSend={onSend}
      onRecord={onRecord}
      onTranscribe={onTranscribe}
      onSendVoice={onSendVoice}
      isRecording={isRecording}
      isThinking={isThinking}
      voiceInputMeta={voiceInputMeta}
      catalog={catalog}
      simulation={simulation}
      fixedAgentPresenceId={agentId}
      workspaceContext={workspaceContext}
      onWorkspaceContextChange={onWorkspaceContextChange}
      onWorkspaceBindingsChange={onWorkspaceBindingsChange}
      chatLensState={chatLensState}
      activeChatSession={activeChatSession}
      activeAgentPresenceId={activeAgentPresenceId}
      onAgentPresenceChange={onAgentPresenceChange}
      minimalAgentView
    />
  );
}
