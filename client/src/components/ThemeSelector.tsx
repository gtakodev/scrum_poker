import { useTheme, type ThemeName } from "@/themes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function ThemeSelector() {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);

  function handleSelect(name: ThemeName) {
    setTheme(name);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Change theme">
          <Palette className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Choose Theme</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          {themes.map((t) => (
            <button
              key={t.name}
              onClick={() => handleSelect(t.name)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
                theme === t.name && "border-primary bg-accent/30 ring-1 ring-primary/20"
              )}
            >
              {/* Tri-color swatch */}
              <div className="flex h-8 w-12 flex-shrink-0 overflow-hidden rounded-md border border-border/50">
                {t.swatches.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight">{t.label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {t.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
