import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/sonner";
import HomePage from "@/pages/HomePage";
import RoomPage from "@/pages/RoomPage";
import NotFoundPage from "@/pages/NotFoundPage";
import { applyTheme, useTheme } from "@/themes";
import { useEffect } from "react";

function App() {
  const { theme } = useTheme();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/room/:roomId" component={RoomPage} />
        <Route component={NotFoundPage} />
      </Switch>
      <Toaster />
    </div>
  );
}

export default App;
