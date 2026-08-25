import type { EntityKind } from "../types/entities";
import { entityLabels } from "../types/entities";

type EntityTabsProps = {
  activeEntity: EntityKind;
  onChange: (entity: EntityKind) => void;
};

const entityIcons: Record<EntityKind, string> = {
  folder: "▣",
  bucket: "◫",
  task: "✓",
  subtask: "☷",
};

// The four tabs are deliberately data-driven: adding another tester panel later
// only needs a new EntityKind instead of four copied button elements.
export function EntityTabs({ activeEntity, onChange }: EntityTabsProps) {
  return (
    <nav aria-label="API resource types" className="grid gap-1">
      {(Object.keys(entityLabels) as EntityKind[]).map((entity) => {
        const isActive = entity === activeEntity;

        return (
          <button
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
              isActive
                ? "bg-[#fff0e9] text-[#b84934] dark:bg-[#4a2c25] dark:text-[#ff9d87]"
                : "text-[#595652] hover:bg-[#f2efeb] dark:text-[#c8c0b8] dark:hover:bg-[#302d29]"
            }`}
            key={entity}
            onClick={() => onChange(entity)}
            type="button"
          >
            <span className="w-5 text-center text-base" aria-hidden="true">
              {entityIcons[entity]}
            </span>
            {entityLabels[entity]}
          </button>
        );
      })}
    </nav>
  );
}
