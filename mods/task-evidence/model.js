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
