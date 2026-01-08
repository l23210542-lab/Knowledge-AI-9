import { FileText, Eye, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

const popularDocuments = [
  {
    id: 1,
    title: "Manual de Onboarding 2024",
    category: "RRHH",
    views: 342,
    lastUpdated: "Hace 2 días",
  },
  {
    id: 2,
    title: "Guía de Productos - Q1",
    category: "Ventas",
    views: 287,
    lastUpdated: "Hace 1 semana",
  },
  {
    id: 3,
    title: "Política de Trabajo Remoto",
    category: "Políticas",
    views: 256,
    lastUpdated: "Hace 3 días",
  },
  {
    id: 4,
    title: "Procedimientos de Soporte",
    category: "Operaciones",
    views: 198,
    lastUpdated: "Hace 5 días",
  },
  {
    id: 5,
    title: "FAQ Clientes",
    category: "Soporte",
    views: 176,
    lastUpdated: "Hace 1 día",
  },
];

const categoryColors: Record<string, string> = {
  RRHH: "bg-primary/10 text-primary",
  Ventas: "bg-success/10 text-success",
  Políticas: "bg-warning/10 text-warning",
  Operaciones: "bg-accent/10 text-accent",
  Soporte: "bg-destructive/10 text-destructive",
};

export function PopularDocuments() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Documentos Populares</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/documents">
            Ver todos
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {popularDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{doc.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="secondary"
                    className={categoryColors[doc.category] || ""}
                  >
                    {doc.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {doc.lastUpdated}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" />
                {doc.views}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
