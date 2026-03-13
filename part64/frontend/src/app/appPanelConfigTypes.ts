import { type AutopilotActionEvent } from "../autopilot";
import type {
  Catalog,
  AgentWorkspaceContext,
  SimulationState,
  UIProjectionBundle,
  UIProjectionElementState,
  WorldInteractionResponse,
} from "../types";
import { type UserPresenceInputPayload } from "./appShellTypes";
import { type CoreSimulationTuning } from "./coreSimulationConfig";
import { type WorldAnchorTarget } from "./worldPanelLayout";

export interface UseAppPanelConfigsArgs {
  activeAgentPresenceId: string;
  activeProjection: UIProjectionBundle | null;
  autopilotEvents: AutopilotActionEvent[];
  catalog: Catalog | null;
  deferredCoreSimulationTuning: CoreSimulationTuning;
  deferredPanelsReady: boolean;
  flyCameraToAnchor: (anchor: WorldAnchorTarget) => void;
  handleAgentWorkspaceBindingsChange: (presenceId: string, fileNodeIds: string[]) => void;
  handleAgentWorkspaceContextChange: (presenceId: string, workspace: AgentWorkspaceContext) => void;
  handleAgentWorkspaceSend: (text: string, musePresenceId: string, workspace: AgentWorkspaceContext) => void;
  handleRecord: () => Promise<void>;
  handleSendVoice: (musePresenceId: string, workspace: AgentWorkspaceContext) => Promise<void>;
  handleTranscribe: () => Promise<string | undefined>;
  handleUserPresenceInput: (payload: UserPresenceInputPayload) => void;
  handleWorldInteract: (personId: string, action: "speak" | "pray" | "sing") => Promise<void>;
  interactingPersonId: string | null;
  isRecording: boolean;
  isThinking: boolean;
  agentWorkspaceBindings: Record<string, string[]>;
  agentWorkspaceContexts: Record<string, AgentWorkspaceContext>;
  projectionStateByElement: Map<string, UIProjectionElementState>;
  setActiveAgentPresenceId: (presenceId: string) => void;
  simulation: SimulationState | null;
  voiceInputMeta: string;
  worldInteraction: WorldInteractionResponse | null;
}
