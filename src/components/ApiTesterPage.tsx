import { useState } from "react";
import type { EntityKind } from "../types/entities";
import { AppShell } from "./AppShell";
import { CrudPanel } from "./CrudPanel";

export function ApiTesterPage() {
  // State belongs here because both the sidebar tabs and the main panel need to
  // read and change the currently selected entity.
  const [activeEntity, setActiveEntity] = useState<EntityKind>("folder");

  return (
    <AppShell activeEntity={activeEntity} onEntityChange={setActiveEntity}>
      {/* The key remounts the form when tabs change, which naturally clears
          the previous resource's name, parent selection, and status message. */}
      <CrudPanel activeEntity={activeEntity} key={activeEntity} />
    </AppShell>
  );
}
