import { Clock, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const recentQueries = [
  {
    id: 1,
    query: "¿Cuál es el proceso de onboarding para nuevos empleados?",
    answer: "El proceso de onboarding consta de 5 etapas principales...",
    timestamp: "Hace 5 min",
  },
  {
    id: 2,
    query: "¿Cómo solicito vacaciones?",
    answer: "Para solicitar vacaciones debes acceder al portal de RRHH...",
    timestamp: "Hace 15 min",
  },
  {
    id: 3,
    query: "¿Cuáles son las políticas de trabajo remoto?",
    answer: "Nuestra política de trabajo remoto permite hasta 3 días...",
    timestamp: "Hace 1 hora",
  },
  {
    id: 4,
    query: "¿Dónde encuentro los templates de presentaciones?",
    answer: "Los templates oficiales se encuentran en el repositorio...",
    timestamp: "Hace 2 horas",
  },
];

export function RecentQueries() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Consultas Recientes</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/chat">
            Ver todas
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentQueries.map((item) => (
            <Link
              key={item.id}
              to={`/chat?q=${encodeURIComponent(item.query)}`}
              className="block p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.query}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {item.answer}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  {item.timestamp}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
