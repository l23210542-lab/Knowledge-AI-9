PRD – KnowledgeHub AI (MVP)
1. Product Overview
KnowledgeHub AI es una plataforma de conocimiento interno enfocada en centralizar documentación empresarial y permitir su consulta mediante un asistente de IA basado en RAG (Retrieval-Augmented Generation).

El objetivo del MVP es demostrar que los usuarios pueden subir documentos internos y consultarlos en lenguaje natural sin necesidad de leer documentos completos.

2. Problem Statement
En muchas organizaciones, la documentación se encuentra dispersa entre múltiples herramientas (Drive, correos, wikis, carpetas locales), lo que provoca:

Pérdida de tiempo buscando información

Dependencia excesiva de empleados senior

Curvas de onboarding largas

Uso de información desactualizada

El MVP busca validar que un asistente IA entrenado sobre documentación interna puede reducir significativamente este problema.

3. Product Goals (MVP)
Objetivos del Producto
Permitir subir documentación interna de forma centralizada

Consultar documentos usando lenguaje natural

Obtener respuestas basadas exclusivamente en documentos subidos

Objetivos del Usuario
Encontrar información relevante rápidamente

Evitar leer documentos largos

Saber qué documentos están disponibles en el sistema

4. Target Users
Para el MVP se asume un solo usuario demo, sin autenticación real ni roles.

Usuario único hardcodeado (ej. "Demo User")

No existen permisos, perfiles ni administración de usuarios

5. Scope Definition – MVP (2 semanas)
In-Scope (MVP)
Funcionalidades Principales
Subida de documentos (PDF y TXT)

Asignación de departamento al documento

Listado de documentos subidos

Consulta mediante chat IA usando RAG

Historial de chat solo en sesión (no persistente)

Out-of-Scope (Explícitamente fuera del MVP)
Autenticación real

Roles y permisos

Analytics y métricas

Feedback de respuestas

Persistencia de conversaciones

Integraciones externas

OCR

Seguridad avanzada

6. User Stories (MVP)
Historias de Usuario – MVP (5 US)
US-1: Document Upload
As a user, I want to upload internal documents so that they can be added to the knowledge base.

Acceptance Criteria
The interface allows uploading PDF and TXT files

Files can be selected via drag & drop or file picker

The system validates file type and file size

Upload progress and processing status are displayed

Only supported file types are accepted; otherwise, an error message is shown

Implementation Notes
Endpoint: POST /api/documents/upload

Validate file type (PDF, TXT) and maximum size (10MB)

Store the original file in Supabase Storage

Insert document metadata into the documents table

Set the initial document status to processing

US-2: Document Department Assignment
As a user, I want to assign a department to each uploaded document so that information is better organized.

Acceptance Criteria
A department must be selected for each uploaded document

The department is selected before document processing starts

The assigned department is saved with the document

The department is visible in the documents list

Documents can be filtered by department

Implementation Notes
Use predefined departments stored in the departments table

Save the selected department_id in the documents table

Validate that a department is selected before allowing upload

Join documents and departments when retrieving document lists

US-3: Uploaded Documents List
As a user, I want to view a list of uploaded documents so that I know what information is available in the system.

Acceptance Criteria
The Documents section displays all uploaded documents

Each document displays:

file name

department

upload date

processing status

Documents are sorted by upload date (most recent first)

The total number of documents is displayed

If no documents exist, a friendly empty state message is shown

Implementation Notes
Endpoint: GET /api/documents

Retrieve document metadata from Supabase

Sort documents by uploaded_at DESC

Display document statuses: processing, processed, error

Automatically refresh the list after uploads

US-4: AI-Powered Knowledge Query
As a user, I want to ask questions in natural language so that I can receive answers based on the uploaded documents.

Acceptance Criteria
The interface provides a main input field for asking questions

The system processes the question when it is submitted

The AI generates answers based only on the uploaded documents

The question and answer are displayed in a chat-style interface

If no documents have been uploaded, the system suggests uploading documents first

If no relevant information is found, the system clearly indicates this

Implementation Notes
Endpoint: POST /api/chat/query

Convert the user question into an embedding

Perform similarity search using pgvector (top 3 chunks)

Build the prompt using retrieved chunks as context

Call the OpenAI Chat Completion API

Return the AI-generated answer and source metadata to the frontend

US-5: Session-Based Conversation
As a user, I want to continue asking questions within the same session so that I can refine my search without starting over.

Acceptance Criteria
The chat interface displays the current session history

New questions and answers appear below previous messages

The user can start a new conversation that clears the current session

Chat history is not persisted after a page reload

Implementation Notes
Maintain chat messages in frontend state only

Append new messages to the session message array

Provide a “New Conversation” button to reset the chat state

Do not store conversations in the database (MVP constraint)

7. System Architecture (MVP)
Backend
Node.js + Express or Python + FastAPI

REST API

Frontend
React + Vite

Simple components (no complex UI libraries)

AI & Data
OpenAI API

Embeddings: text-embedding-3-small

Chat: gpt-3.5-turbo

Supabase

PostgreSQL for metadata

pgvector for embeddings

Supabase Storage for files

8. Data Model (Simplified MVP)
Document
id

file_name

department

upload_date

status

DocumentChunk
id

document_id

content

embedding

9. Non-Functional Requirements (MVP)
Response time: < 3 seconds per query

Max documents: ~10

Max file size: 10MB

Session-based usage (no persistence guarantees)

10. Assumptions & Constraints
Single demo user

Low document volume

No production-level security

Cost-controlled API usage

11. Success Criteria (Bootcamp)
User can upload documents successfully

User can see uploaded documents

User can ask questions and get relevant answers

System demonstrates clear RAG behavior

12. Future Enhancements (Post-MVP)
Authentication and roles

Persistent chat history

Analytics

Feedback system

Multi-user support

Advanced document formats

Improved chunking strategies