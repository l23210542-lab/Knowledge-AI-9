import { useState } from "react";
import { Search, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const suggestedQuestions = [
  "¿Cuántos documentos hay actualmente?",
  "¿Qué información puedo consultar?",
  "¿Cómo funciona el sistema de búsqueda?",
  "¿Qué tipos de documentos están disponibles?",
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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border p-10 md:p-16 lg:p-20 min-h-[500px] md:min-h-[600px] flex items-center">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />

      <div className="relative z-10 w-full">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="h-6 w-6 text-primary animate-pulse-subtle" />
          <span className="text-base font-medium text-primary">IA Powered</span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 md:mb-6">
          ¿Qué necesitas saber hoy?
        </h1>
        <p className="text-base md:text-lg text-muted-foreground mb-10 md:mb-12 max-w-2xl">
          Pregunta cualquier cosa sobre tu base de conocimiento. Obtén respuestas precisas basadas en tu documentación oficial.
        </p>

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="mb-8 md:mb-10">
          <div className="relative max-w-3xl">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
            <input
              type="text"
              placeholder="Escribe tu pregunta aquí..."
              className="w-full h-16 md:h-18 pl-14 pr-36 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-lg text-base md:text-lg"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              type="submit"
              variant="hero"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-12 px-6 text-base"
            >
              Buscar
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </form>

        {/* Suggested Questions */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-base text-muted-foreground font-medium">Sugerencias:</span>
          {suggestedQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleSearch(question)}
              className="text-sm md:text-base px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
