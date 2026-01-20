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
  Copy,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { queryChat } from "@backend/lib/api/chat";
import { useToast } from "@/hooks/use-toast";
import { hasDocumentsProcessing } from "@backend/lib/api/documents";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ChatMessage } from "@backend/lib/api/chat";

interface Message extends ChatMessage {
  id: string;
  timestamp: Date;
}

// Key for storing chat messages in sessionStorage
// Messages persist during browser session but are cleared when session ends
const STORAGE_KEY = 'knowledgehub-chat-messages';

export default function Chat() {
  // Get query parameter from URL (for search from Header or SearchHero)
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  
  // State management for chat messages and UI
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQuery);
  const [isTyping, setIsTyping] = useState(false);
  const [showProcessingDialog, setShowProcessingDialog] = useState(false);
  
  // Ref for scrolling to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  // Flag to track initial load and prevent saving during load
  const isInitialLoad = useRef(true);

  /**
   * Scrolls the messages container to the bottom
   * Called when new messages are added to keep latest message visible
   */
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load messages from sessionStorage when component mounts
  // Restores conversation history from previous session
  useEffect(() => {
    try {
      const savedMessages = sessionStorage.getItem(STORAGE_KEY);
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        // Convert timestamps from string to Date objects
        // sessionStorage stores dates as strings, need to convert back
        const messagesWithDates = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(messagesWithDates);
        isInitialLoad.current = false;
      } else {
        // If no saved messages, mark initial load as complete
        isInitialLoad.current = false;
      }
    } catch (error) {
      console.error('Error loading messages from sessionStorage:', error);
      // If error, clear corrupted storage
      sessionStorage.removeItem(STORAGE_KEY);
      isInitialLoad.current = false;
    }
  }, []);

  // Save messages to sessionStorage whenever they change
  // Persists conversation during browser session
  useEffect(() => {
    // Don't save on first render (when loading from storage)
    // Prevents overwriting loaded messages immediately
    if (isInitialLoad.current) {
      return;
    }

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving messages to sessionStorage:', error);
    }
  }, [messages]);

  // Auto-scroll to bottom when messages change
  // Keeps latest message visible when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Process initialQuery only if no messages loaded from storage
  // Handles search queries from URL parameters (e.g., from Header search)
  useEffect(() => {
    if (initialQuery && messages.length === 0 && !isInitialLoad.current) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      handleSend(initialQuery);
    }
  }, [initialQuery, messages.length]);

  /**
   * Handles sending a message to the chat API
   * Processes user input and gets AI response using RAG
   * 
   * @param messageText - Optional message text (if not provided, uses input state)
   */
  const handleSend = async (messageText?: string) => {
    const text = messageText || input;
    if (!text.trim()) return;

    // Check if documents are currently being processed
    // Prevent queries while documents are being chunked/embedded
    const isProcessing = await hasDocumentsProcessing();
    if (isProcessing) {
      setShowProcessingDialog(true);
      return;
    }

    // Create user message object
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    // Add user message to chat immediately (optimistic update)
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      // Convert message history to format expected by API
      // API expects ChatMessage format without id and timestamp
      const conversationHistory: ChatMessage[] = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        sources: msg.sources,
      }));

      // Call chat API with question and conversation history
      // API performs RAG search and generates AI response
      const response = await queryChat(text, conversationHistory);

      // Create AI message from API response
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      };

      // Add AI response to chat
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error querying chat:', error);
      
      // Friendly error message for user
      // Provides helpful troubleshooting information
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

  /**
   * Starts a new chat conversation
   * Clears all messages and resets the input field
   */
  const handleNewChat = () => {
    setMessages([]);
    setInput("");
    // Clear sessionStorage when starting new conversation
    // Ensures fresh start without old messages
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
    }
  };

  /**
   * Copies message content to clipboard
   * Provides user feedback via toast notification
   * 
   * @param content - The message content to copy
   */
  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copiado",
        description: "El mensaje se ha copiado al portapapeles.",
      });
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      toast({
        title: "Error",
        description: "No se pudo copiar el mensaje.",
        variant: "destructive",
      });
    }
  };

  /**
   * Regenerates an AI message by re-querying with the original user question
   * Removes the current AI message and all subsequent messages
   * Useful for getting a different response or fixing errors
   * 
   * @param messageId - ID of the AI message to regenerate
   */
  const handleRefreshMessage = async (messageId: string) => {
    // Find the current message and the last user message before it
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    // Search for the last user message before this AI message
    // Need the original question to regenerate the response
    let lastUserMessage: Message | null = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessage = messages[i];
        break;
      }
    }

    if (!lastUserMessage) {
      toast({
        title: "Error",
        description: "No se encontró la pregunta original para regenerar.",
        variant: "destructive",
      });
      return;
    }

    // Check if documents are currently being processed
    const isProcessing = await hasDocumentsProcessing();
    if (isProcessing) {
      setShowProcessingDialog(true);
      return;
    }

    // Remove current message and all messages after it
    // This allows regenerating from a specific point in the conversation
    setMessages((prev) => prev.slice(0, messageIndex));
    setIsTyping(true);

    try {
      // Get conversation history up to before the message to regenerate
      // Exclude the user message that triggered this AI response
      const conversationHistory: ChatMessage[] = messages
        .slice(0, messageIndex - 1)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
          sources: msg.sources,
        }));

      // Call chat API with original question
      // This generates a new response (potentially different due to randomness)
      const response = await queryChat(lastUserMessage.content, conversationHistory);

      const aiMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error refreshing message:', error);
      toast({
        title: "Error al regenerar",
        description: "No se pudo regenerar la respuesta. Por favor, intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsTyping(false);
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleCopyMessage(message.content)}
                        title="Copiar mensaje"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => handleRefreshMessage(message.id)}
                        disabled={isTyping}
                        title="Regenerar respuesta"
                      >
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

        {/* Dialog para documentos en proceso */}
        <Dialog open={showProcessingDialog} onOpenChange={setShowProcessingDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Documentos en proceso</DialogTitle>
              <DialogDescription>
                Espera hasta que todos los documentos en proceso se suban y procesen antes de hacer preguntas.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowProcessingDialog(false)}>
                Entendido
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
