import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";

interface HeaderProps {
  onSearch?: (query: string) => void;
}

export function Header({ onSearch }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();
    
    if (trimmedQuery) {
      onSearch?.(trimmedQuery);
      navigate(`/chat?q=${encodeURIComponent(trimmedQuery)}`);
      setSearchQuery("");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Pregunta algo sobre tu base de conocimiento..."
            className="w-full pl-10 pr-4 h-10 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </form>

      {/* User Info */}
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium leading-none">Usuario Demo</p>
          <p className="text-xs text-muted-foreground">demo@knowledgehub.ai</p>
        </div>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary text-primary-foreground">
            UD
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
