import { FileText, MessageSquare, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  {
    name: "Documentos",
    value: "156",
    change: "+12%",
    changeType: "positive" as const,
    icon: FileText,
    description: "Total indexados",
  },
  {
    name: "Consultas",
    value: "2,847",
    change: "+23%",
    changeType: "positive" as const,
    icon: MessageSquare,
    description: "Este mes",
  },
  {
    name: "Usuarios Activos",
    value: "89",
    change: "+8%",
    changeType: "positive" as const,
    icon: Users,
    description: "Últimos 7 días",
  },
];

export function StatsCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.name} className="hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${
                  stat.changeType === "positive"
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {stat.change}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
