import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Send,
  Plus,
  Bot,
  User,
  FileText,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queryChat } from "@backend/lib/api/chat";
import { useToast } from "@/hooks/use-toast";
import type { ChatMessage } from "@backend/lib/api/chat";

interface Message extends ChatMessage {
  id: string;
  timestamp: Date;
}

const STORAGE_KEY = 'knowledgehub-chat-messages';

export default function Chat() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuery);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const isInitialLoad = useRef(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Cargar mensajes desde sessionStorage al montar el componente
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(STORAGE_KEY);
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        // Convertir timestamps de string a Date
        const messagesWithDates = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(messagesWithDates);
        isInitialLoad.current = false;
      } else {
        // Si no hay mensajes guardados, marcar que la carga inicial está completa
        isInitialLoad.current = false;
      }
    } catch (error) {
      console.error('Error loading messages from sessionStorage:', error);
      // Si hay error, limpiar el storage corrupto
      sessionStorage.removeItem(STORAGE_KEY);
      isInitialLoad.current = false;
    }
  }, []);

  // Guardar mensajes en sessionStorage cada vez que cambien
  useEffect(() => {
    // No guardar en el primer render (cuando se cargan desde storage)
    if (isInitialLoad.current) {
      return;
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving messages to sessionStorage:', error);
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Procesar initialQuery solo si no hay mensajes cargados desde storage
  useEffect(() => {
    if (initialQuery && messages.length === 0 && !isInitialLoad.current) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      handleSend(initialQuery);
    }
  }, [initialQuery, messages.length]);

  const handleSend = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      // Convertir historial de mensajes al formato esperado por la API
      const conversationHistory: ChatMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        sources: msg.sources,
      }));

      // Llamar a la API de chat
      const response = await queryChat(text, conversationHistory);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error querying chat:', error);
      
      // Mensaje de error amigable
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Lo siento, no pude procesar tu consulta en este momento. Por favor, verifica que:\n\n• El backend de chat esté configurado y funcionando\n• Haya documentos subidos en el sistema\n• La conexión a la base de datos esté activa\n\nSi el problema persiste, contacta al administrador del sistema.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
      
      toast({
        title: "Error al procesar consulta",
        description: "No se pudo obtener una respuesta. Verifica la configuración del backend.",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    // Limpiar sessionStorage al iniciar nueva conversación
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Chat Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chat con IA</h1>
            <p className="text-sm text-muted-foreground">
              Pregunta cualquier cosa sobre tu base de conocimiento
            </p>
          </div>
          <Button variant="outline" onClick={handleNewChat}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva Conversación
          </Button>
        </div>

        {/* Messages Area */}
        <Card className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  ¿En qué puedo ayudarte?
                </h3>
                <p className="text-muted-foreground max-w-md">
                  Escribe tu pregunta y buscaré en toda la base de conocimiento
                  para darte la mejor respuesta.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-4",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl p-4",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs font-medium mb-2 text-muted-foreground">
                        Fuentes:
                      </p>
                      <div className="space-y-2">
                        {message.sources.map((source, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm p-2 rounded-lg bg-background/50 hover:bg-background cursor-pointer transition-colors"
                          >
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{source.title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {source.excerpt}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions for AI messages */}
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-2 mt-4 pt-2">
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        <ThumbsUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2">
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-foreground" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-secondary rounded-2xl p-4">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground animate-typing" />
                    <span
                      className="h-2 w-2 rounded-full bg-muted-foreground animate-typing"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <span
                      className="h-2 w-2 rounded-full bg-muted-foreground animate-typing"
                      style={{ animationDelay: "0.4s" }}
                    />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu pregunta..."
                className="flex-1 h-12 px-4 rounded-xl bg-secondary border-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <Button
                type="submit"
                variant="hero"
                size="lg"
                disabled={!input.trim() || isTyping}
              >
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
