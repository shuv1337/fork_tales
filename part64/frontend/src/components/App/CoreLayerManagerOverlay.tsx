import {
  CORE_LAYER_OPTIONS,
  type CoreLayerId,
} from "../../app/coreSimulationConfig";

interface Props {
  activeLayerCount: number;
  inline?: boolean;
  isOpen: boolean;
  layerVisibility: Record<CoreLayerId, boolean>;
  onToggleOpen: () => void;
  onSetAllLayers: (enabled: boolean) => void;
  onSetLayerEnabled: (layerId: CoreLayerId, enabled: boolean) => void;
}

export function CoreLayerManagerOverlay({
  activeLayerCount,
  inline = false,
  isOpen,
  layerVisibility,
  onToggleOpen,
  onSetAllLayers,
  onSetLayerEnabled,
}: Props) {
  const shellClassName = inline
    ? "w-full"
    : "pointer-events-none fixed top-24 right-2 z-[70] w-[min(92vw,19rem)]";
  const cardClassName = inline
    ? "pointer-events-auto rounded-xl border border-[#3b4e69] bg-[linear-gradient(170deg,#16182a,#17192c)] p-2 shadow-[0_6px_12px_#151628]"
    : "pointer-events-auto rounded-xl border border-[#3f5570] bg-[linear-gradient(170deg,#15182a,#17192c)] p-2 shadow-[0_8px_18px_#141526]";

  return (
    <div className={shellClassName}>
      <section className={cardClassName}>
        <header className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[12px] uppercase tracking-[0.12em] text-[#a4dcff]">layers manager</p>
            <p className="text-[12px] text-[#c7e8ff]">active <code>{activeLayerCount}</code>/<code>{CORE_LAYER_OPTIONS.length}</code></p>
          </div>
          <button
            type="button"
            onClick={onToggleOpen}
            className="rounded border border-[#495a72] px-2 py-0.5 text-[12px] font-semibold text-[#cde7fa] hover:bg-[#2b3850]"
          >
            {isOpen ? "hide" : "show"}
          </button>
        </header>

        {isOpen ? (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSetAllLayers(true)}
                className="rounded border border-[#4c6d67] px-2 py-0.5 text-[12px] font-semibold text-[#bcf5d7] hover:bg-[#27393e]"
              >
                all on
              </button>
              <button
                type="button"
                onClick={() => onSetAllLayers(false)}
                className="rounded border border-[#72565d] px-2 py-0.5 text-[12px] font-semibold text-[#ffd5ca] hover:bg-[#3f2d38]"
              >
                all off
              </button>
            </div>

            <div className="grid gap-1">
              {CORE_LAYER_OPTIONS.map((layer) => (
                <label
                  key={layer.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-[#32425c] bg-[#0f1625] px-2 py-1"
                >
                  <span className="text-[12px] text-[#d6ecff]">{layer.label}</span>
                  <input
                    type="checkbox"
                    checked={layerVisibility[layer.id]}
                    onChange={(event) => onSetLayerEnabled(layer.id, event.target.checked)}
                    className="h-3.5 w-3.5 accent-[#8fd8ff]"
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
