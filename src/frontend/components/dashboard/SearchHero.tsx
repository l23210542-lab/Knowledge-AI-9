import { useState } from "react";
import { Search, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const suggestedQuestions = [
  "¿Cuál es nuestra política de reembolsos?",
  "¿Cómo configuro la integración con Salesforce?",
  "¿Cuáles son los pasos para el onboarding?",
  "¿Dónde encuentro los manuales de producto?",
];

export function SearchHero() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (searchQuery: string) => {
    if (searchQuery.trim()) {
      navigate(`/chat?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border p-8 md:p-12">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary animate-pulse-subtle" />
          <span className="text-sm font-medium text-primary">IA Powered</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          ¿Qué necesitas saber hoy?
        </h1>
        <p className="text-muted-foreground mb-8 max-w-xl">
          Pregunta cualquier cosa sobre tu base de conocimiento. Obtén respuestas precisas basadas en tu documentación oficial.
        </p>

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Escribe tu pregunta aquí..."
              className="w-full h-14 pl-12 pr-32 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-md"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              type="submit"
              variant="hero"
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              Buscar
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>

        {/* Suggested Questions */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Sugerencias:</span>
          {suggestedQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleSearch(question)}
              className="text-sm px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
