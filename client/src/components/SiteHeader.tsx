import { useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { currentTheme, selectTheme, THEMES } from "@/lib/theme";

function ThemePicker() {
  const [theme, setTheme] = useState(currentTheme);
  const selectedOption = useRef<HTMLInputElement>(null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="action-button action-outline theme-trigger" aria-label="Change theme">
          <Palette aria-hidden="true" />
          <span>Theme</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="theme-dialog"
        onOpenAutoFocus={(event) => {
          if (selectedOption.current) {
            event.preventDefault();
            selectedOption.current.focus();
          }
        }}
      >
        <div className="theme-dialog-heading">
          <DialogTitle>Choose a theme</DialogTitle>
          <DialogDescription>Your choice applies to every room in this browser.</DialogDescription>
        </div>
        <fieldset className="theme-options">
          <legend className="sr-only">Theme</legend>
          {THEMES.map(({ id, label }) => (
            <label className="theme-option" key={id}>
              <input
                type="radio"
                name="theme"
                value={id}
                checked={id === theme}
                ref={id === theme ? selectedOption : null}
                className="sr-only"
                onChange={() => {
                  selectTheme(id);
                  setTheme(id);
                }}
              />
              <span className="theme-swatches" data-preview-theme={id} aria-hidden="true">
                <i /><i /><i />
              </span>
              <span>{label}</span>
              {id === theme && <Check className="theme-selected" aria-hidden="true" />}
            </label>
          ))}
        </fieldset>
      </DialogContent>
    </Dialog>
  );
}

export default function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="site-header">
      <div className="site-width site-header-inner">
        <Link to="/" className="site-brand">
          <span className="brand-deck" aria-hidden="true">
            <i /><i /><i />
          </span>
          SprintVote
        </Link>
        <div className="site-header-actions">
          {children}
          <ThemePicker />
        </div>
      </div>
    </header>
  );
}
