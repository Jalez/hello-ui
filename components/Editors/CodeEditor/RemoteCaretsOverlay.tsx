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
        <div key={caret.id} className="absolute inset-0">
          {caret.selectionRects.map((rect, index) => (
            <div
              key={`${caret.id}-sel-${index}`}
              className="absolute rounded-[2px]"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
                backgroundColor: caret.color,
                opacity: 0.18,
              }}
            />
          ))}
          {caret.showCaret && (
            <div className="absolute" style={{ left: caret.x, top: caret.y }}>
              <div className="h-5 w-[2px]" style={{ backgroundColor: caret.color }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
