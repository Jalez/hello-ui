import type { RemoteEditorCaret } from "./types";

interface RemoteCaretsOverlayProps {
  carets: RemoteEditorCaret[];
}

export function RemoteCaretsOverlay({ carets }: RemoteCaretsOverlayProps) {
  if (carets.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {carets.map((caret) => (
        <div
          key={caret.id}
          className="absolute"
          style={{ left: caret.x, top: caret.y }}
        >
          <div
            className="h-5 w-[2px]"
            style={{ backgroundColor: caret.color }}
          />
        </div>
      ))}
    </div>
  );
}
