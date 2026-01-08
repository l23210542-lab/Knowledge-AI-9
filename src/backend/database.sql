-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT departments_pkey PRIMARY KEY (id)
);
CREATE TABLE public.document_chunks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding USER-DEFINED,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT document_chunks_pkey PRIMARY KEY (id),
  CONSTRAINT fk_document FOREIGN KEY (document_id) REFERENCES public.documents(id)
);
CREATE TABLE public.documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  department_id uuid NOT NULL,
  uploader_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'processing'::text,
  uploaded_at timestamp with time zone DEFAULT now(),
  CONSTRAINT documents_pkey PRIMARY KEY (id),
  CONSTRAINT fk_department FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT fk_uploader FOREIGN KEY (uploader_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);