import { useState, useCallback, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Upload as UploadIcon,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { uploadDocument } from "@backend/lib/api/documents";
import { getDepartments } from "@backend/lib/api/departments";
import { getOrCreateDemoUser } from "@backend/lib/api/users";
import type { Department } from "@backend/lib/api/documents";

interface FileUpload {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  departmentId?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [demoUserId, setDemoUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // Cargar departamentos y usuario demo al montar el componente
  useEffect(() => {
    const loadData = async () => {
      try {
        // Obtener o crear usuario demo
        const user = await getOrCreateDemoUser();
        setDemoUserId(user.id);

        // Cargar departamentos
        const depts = await getDepartments();
        setDepartments(depts);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los departamentos. Por favor, recarga la página.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingDepartments(false);
      }
    };

    loadData();
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
    ];

    const validFiles = newFiles.filter((file) => {
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const isAllowedType = allowedTypes.includes(file.type) || 
                           ['pdf', 'txt', 'md'].includes(fileExt || '');
      
      if (!isAllowedType) {
        toast({
          title: "Formato no soportado",
          description: `${file.name} no es un formato válido. Use PDF, TXT o MD.`,
          variant: "destructive",
        });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Archivo muy grande",
          description: `${file.name} excede el límite de 10MB.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    const fileUploads: FileUpload[] = validFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      status: "pending",
    }));

    setFiles((prev) => [...prev, ...fileUploads]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileDepartment = (id: string, departmentId: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, departmentId } : f))
    );
  };

  const uploadFile = async (fileUpload: FileUpload) => {
    if (!fileUpload.departmentId) {
      toast({
        title: "Departamento requerido",
        description: "Por favor, selecciona un departamento para este archivo.",
        variant: "destructive",
      });
      return;
    }

    if (!demoUserId) {
      toast({
        title: "Error",
        description: "No se pudo identificar al usuario. Por favor, recarga la página.",
        variant: "destructive",
      });
      return;
    }

    // Update to uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileUpload.id ? { ...f, status: "uploading", progress: 0 } : f)
    );

    try {
      // Simular progreso de subida (0-30%)
      for (let i = 0; i <= 30; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileUpload.id ? { ...f, progress: i } : f
          )
        );
      }

      // Update to processing
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileUpload.id ? { ...f, status: "processing", progress: 30 } : f)
      );

      // Subir documento a Supabase (esto ahora también procesa los chunks)
      // El procesamiento se hace dentro de uploadDocument
      await uploadDocument(
        fileUpload.file,
        fileUpload.departmentId,
        demoUserId
      );

      // Completar
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileUpload.id ? { ...f, status: "complete", progress: 100 } : f
        )
      );

      toast({
        title: "Documento procesado",
        description: `${fileUpload.file.name} ha sido subido y procesado correctamente.`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileUpload.id ? { ...f, status: "error" } : f
        )
      );
      toast({
        title: "Error al procesar",
        description: `No se pudo procesar ${fileUpload.file.name}. Por favor, intenta de nuevo.`,
        variant: "destructive",
      });
    }
  };

  const handleUploadAll = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    
    // Validar que todos tengan departamento asignado
    const filesWithoutDepartment = pendingFiles.filter((f) => !f.departmentId);
    if (filesWithoutDepartment.length > 0) {
      toast({
        title: "Departamento requerido",
        description: "Por favor, asigna un departamento a todos los archivos antes de subir.",
        variant: "destructive",
      });
      return;
    }

    // Subir y procesar archivos uno por uno en orden
    for (const file of pendingFiles) {
      await uploadFile(file);
    }
  };

  const pendingCount = files.filter((f) => f.status === "pending").length;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subir Documentos</h1>
          <p className="text-sm text-muted-foreground">
            Arrastra o selecciona archivos para agregar a la base de conocimiento
          </p>
        </div>

        {/* Upload Zone */}
        <Card>
          <CardContent className="p-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-12 text-center transition-all",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-secondary/30"
              )}
            >
              <input
                type="file"
                multiple
                accept=".pdf,.txt,.md"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-4">
                <div
                  className={cn(
                    "h-16 w-16 rounded-full flex items-center justify-center transition-colors",
                    isDragging ? "bg-primary/20" : "bg-primary/10"
                  )}
                >
                  <UploadIcon
                    className={cn(
                      "h-8 w-8 transition-colors",
                      isDragging ? "text-primary" : "text-primary/70"
                    )}
                  />
                </div>
                <div>
                  <p className="text-lg font-medium text-foreground">
                    {isDragging
                      ? "Suelta los archivos aquí"
                      : "Arrastra archivos o haz clic para seleccionar"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Formatos soportados: PDF, TXT, MD · Máximo 10MB por archivo
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Files List */}
        {files.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                Archivos ({files.length})
              </CardTitle>
              {pendingCount > 0 && (
                <Button variant="hero" onClick={handleUploadAll}>
                  Procesar {pendingCount} archivo{pendingCount > 1 ? "s" : ""}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {files.map((fileUpload) => (
                  <div
                    key={fileUpload.id}
                    className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <p className="font-medium text-foreground truncate">
                          {fileUpload.file.name}
                        </p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(fileUpload.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>

                      {fileUpload.status === "pending" && (
                        <div className="mt-2">
                          <Select
                            value={fileUpload.departmentId}
                            onValueChange={(value) =>
                              updateFileDepartment(fileUpload.id, value)
                            }
                            disabled={isLoadingDepartments}
                          >
                            <SelectTrigger className="w-48 h-8 text-sm">
                              <SelectValue placeholder="Seleccionar departamento" />
                            </SelectTrigger>
                            <SelectContent>
                              {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {(fileUpload.status === "uploading" ||
                        fileUpload.status === "processing") && (
                        <div className="mt-2 space-y-1">
                          <Progress value={fileUpload.progress} className="h-1.5" />
                          <p className="text-xs text-muted-foreground">
                            {fileUpload.status === "uploading"
                              ? `Subiendo... ${fileUpload.progress}%`
                              : "Procesando e indexando..."}
                          </p>
                        </div>
                      )}

                      {fileUpload.status === "complete" && (
                        <p className="mt-1 text-xs text-success flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Procesado correctamente
                        </p>
                      )}

                      {fileUpload.status === "error" && (
                        <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Error al procesar
                        </p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {fileUpload.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeFile(fileUpload.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {(fileUpload.status === "uploading" ||
                        fileUpload.status === "processing") && (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      )}
                      {fileUpload.status === "complete" && (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-4">
              Instrucciones de Subida
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                Selecciona o arrastra los archivos que deseas subir
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                Asigna un departamento a cada documento para mejor organización
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                Haz clic en "Procesar" para indexar los documentos en el sistema
              </li>
              <li className="flex items-start gap-2">
                <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                Una vez procesados, podrás consultar su contenido vía chat
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
