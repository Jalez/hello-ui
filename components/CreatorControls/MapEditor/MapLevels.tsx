'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Level } from "@/types";

type MapLevelsProps = {
  levels: Level[];
  getThumbnailForLevel: (level: Level) => string | null;
  onSelectLevel: (index: number) => void;
};

const MapLevels = ({ levels, getThumbnailForLevel, onSelectLevel }: MapLevelsProps) => {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">
        Game Levels
      </h2>
      {levels.length === 0 && (
        <p className="text-sm text-muted-foreground">No levels found.</p>
      )}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {levels.map((level, index) => {
          const thumbnailUrl = getThumbnailForLevel(level);
          return (
            <Button
              type="button"
              key={level.identifier ?? `${level.name}-${index}`}
              variant="outline"
              className="h-auto w-full justify-start p-2"
              onClick={() => onSelectLevel(index)}
            >
              <div className="flex w-full items-center gap-3 text-left">
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded border bg-muted">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt={`${level.name} solution`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-sm font-medium">{level.name}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {level.difficulty}
                    </Badge>
                    <Badge variant={level.lockHTML ? "default" : "outline"} className="text-[10px]">H</Badge>
                    <Badge variant={level.lockCSS ? "default" : "outline"} className="text-[10px]">C</Badge>
                    <Badge variant={level.lockJS ? "default" : "outline"} className="text-[10px]">J</Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {level.points}/{level.maxPoints}
                    </span>
                  </div>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default MapLevels;
