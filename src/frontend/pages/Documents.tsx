import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  FileText,
  Upload,
  Grid,
  List,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getDocuments } from "@backend/lib/api/documents";
import type { Document, Department } from "@backend/lib/api/documents";
import { getDepartments } from "@backend/lib/api/departments";
import { format } from "date-fns";

const departmentColors: Record<string, string> = {
  RRHH: "bg-primary/10 text-primary",
  Ventas: "bg-success/10 text-success",
  Operaciones: "bg-accent/10 text-accent",
  Soporte: "bg-destructive/10 text-destructive",
};

const statusColors: Record<string, string> = {
  processed: "bg-success/10 text-success",
  processing: "bg-warning/10 text-warning",
  error: "bg-destructive/10 text-destructive",
};

export default function Documents() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("Todos");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar documentos y departamentos
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [docsData, deptsData] = await Promise.all([
          getDocuments(),
          getDepartments(),
        ]);
        setDocuments(docsData);
        setDepartments(deptsData);
      } catch (err) {
        console.error('Error loading documents:', err);
        setError('No se pudieron cargar los documentos. Por favor, recarga la página.');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = 
      selectedDepartment === "Todos" || 
      doc.department?.id === selectedDepartment ||
      doc.department?.name === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  const departmentList = ["Todos", ...departments.map((d) => d.name)];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Documentos</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Cargando..." : `${documents.length} documento${documents.length !== 1 ? "s" : ""} en total`}
            </p>
          </div>
          <Button variant="hero" asChild>
            <Link to="/upload">
              <Upload className="mr-2 h-4 w-4" />
              Subir Documento
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar documentos..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Department Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                {departmentList.map((department) => (
                  <button
                    key={department}
                    onClick={() => setSelectedDepartment(department)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedDepartment === department
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {department}
                  </button>
                ))}
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "grid" ? "bg-background shadow-sm" : ""
                  }`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === "list" ? "bg-background shadow-sm" : ""
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="p-12 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Card>
            <CardContent className="p-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredDocuments.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {documents.length === 0
                  ? "No hay documentos subidos aún. Sube tu primer documento para comenzar."
                  : "No se encontraron documentos que coincidan con tu búsqueda."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Documents Grid/List */}
        {!isLoading && !error && filteredDocuments.length > 0 && (
          <>
            {viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredDocuments.map((doc) => {
                  const fileExt = doc.file_name.split('.').pop()?.toUpperCase() || '';
                  const uploadDate = doc.uploaded_at 
                    ? format(new Date(doc.uploaded_at), "dd MMM yyyy")
                    : "Fecha desconocida";
                  
                  return (
                    <Card key={doc.id} className="hover-lift cursor-pointer">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-foreground line-clamp-2">
                              {doc.file_name}
                            </h3>
                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              {doc.department && (
                                <Badge
                                  variant="secondary"
                                  className={departmentColors[doc.department.name] || ""}
                                >
                                  {doc.department.name}
                                </Badge>
                              )}
                              <Badge
                                variant="secondary"
                                className={statusColors[doc.status]}
                              >
                                {doc.status === "processed" ? "Procesado" : doc.status === "processing" ? "Procesando" : "Error"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              Subido: {uploadDate}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {filteredDocuments.map((doc) => {
                      const fileExt = doc.file_name.split('.').pop()?.toUpperCase() || '';
                      const uploadDate = doc.uploaded_at 
                        ? format(new Date(doc.uploaded_at), "dd MMM yyyy")
                        : "Fecha desconocida";
                      
                      return (
                        <div
                          key={doc.id}
                          className="flex items-center gap-4 p-4 hover:bg-secondary/50 transition-colors"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {doc.file_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {doc.department && (
                                <Badge
                                  variant="secondary"
                                  className={`${departmentColors[doc.department.name] || ""} text-xs`}
                                >
                                  {doc.department.name}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {fileExt}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <Badge
                              variant="secondary"
                              className={statusColors[doc.status]}
                            >
                              {doc.status === "processed" ? "Procesado" : doc.status === "processing" ? "Procesando" : "Error"}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">{uploadDate}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
