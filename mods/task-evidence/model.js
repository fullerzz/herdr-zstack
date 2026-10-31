export function filesFor(props) {
  const file = (label, path) => {
    if (typeof path !== "string" || !path) return null;
    const resolved = path.startsWith("/") ? path : props.folder?.startsWith("/") ? `${props.folder.replace(/\/$/, "")}/${path}` : null;
    return resolved ? { label, path: resolved } : null;
  };
  return [file("Task notes", props.notes), file("Acceptance", props.acceptance),
    ...(Array.isArray(props.artifacts) ? props.artifacts.map(a => file(a.label || "Artifact", a.path)) : []),
    file("Handoff", props.handoff)].filter(Boolean);
}

export function taskSpace(props, spaces) {
  const matches = spaces.filter(s => props.space ? s.id === props.space :
    Boolean(props.folder) && s.folder.replace(/\/$/, "") === props.folder.replace(/\/$/, "") && s.machine === (props.machine ?? null));
  return matches.length === 1 ? matches[0] : null;
}

export function taskChoices(config) {
  return (Array.isArray(config.tasks) ? config.tasks : config.record ? [{ label: config.title || "Task", record: config.record, machine: config.machine }] : [])
    .filter(task => task && typeof task === "object" && typeof task.record === "string" && task.record.startsWith("/"));
}

export function recordFiles(record) {
  return filesFor({ folder: record.checkout, notes: record.brief, handoff: record.handoff,
    artifacts: [...record.artifacts, ...(record.receipt?.evidence ?? [])].map(path => ({ label: path, path })) });
}

// The installed AgentInfo exposes neither core nor occupant: address alone cannot prove ownership.
export function taskActivity(record, live) {
  return { owned: [], unverified: live, reason: record?.worker ? "Worker binding recorded; live core and occupant identity unavailable." : "No worker binding recorded." };
}
