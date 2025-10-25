import { ReactNode, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MainNav } from "../navigation/MainNav";
import { SiteFooter } from "./SiteFooter";
import { DebugConsole } from "../debug/DebugConsole";
import { CommandPalette, CommandOption } from "../ui/CommandPalette";
import { GlobalAnnouncementPrompt } from "../ui/GlobalAnnouncementPrompt";
import { useAuth } from "../../context/AuthContext";
import { useDebug } from "../../context/DebugContext";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toggleConsole } = useDebug();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    setPaletteOpen(false);
  }, [location.pathname]);

  const commands: CommandOption[] = useMemo(() => {
    const items: CommandOption[] = [
      {
        id: "go-studio",
        label: "Go to Studio",
        description: "Open the writing workspace",
        shortcut: "G S",
        onSelect: () => navigate("/studio"),
      },
      {
        id: "go-library",
        label: "Browse Library",
        description: "Read and review published stories",
        shortcut: "G L",
        onSelect: () => navigate("/stories"),
      },
      {
        id: "go-home",
        label: "Back to landing",
        description: "Return to the hero page",
        onSelect: () => navigate("/"),
      },
      {
        id: "toggle-debug",
        label: "Toggle debug console",
        description: "Show or hide the request log",
        shortcut: "Alt + D",
        onSelect: toggleConsole,
      },
    ];

    if (user) {
      items.splice(1, 0, {
        id: "go-settings",
        label: "Settings",
        description: "Update profile, security, and preferences",
        onSelect: () => navigate("/settings"),
      });
    }

    if ((user?.isDev || user?.isAdmin)) {
      items.push({
        id: "go-dev",
        label: "Developer tools",
        description: "Open the dev console and moderation boards",
        onSelect: () => navigate("/dev"),
      });
    }

    return items;
  }, [navigate, toggleConsole, user]);

  return (
    <div className="app-shell">
      <MainNav />
      <GlobalAnnouncementPrompt />
      <main className="app-shell__content">{children}</main>
      <SiteFooter />
      <DebugConsole />
      <CommandPalette open={isPaletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </div>
  );
}

