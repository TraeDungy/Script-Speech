export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      export_jobs: {
        Row: {
          created_at: string;
          deliver_to_email: string | null;
          error: string | null;
          format: 'fountain' | 'fdx' | 'docx' | 'pdf';
          id: string;
          project_id: string;
          result: Json | null;
          script_doc: Json;
          status: 'queued' | 'processing' | 'completed' | 'failed';
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          deliver_to_email?: string | null;
          error?: string | null;
          format: 'fountain' | 'fdx' | 'docx' | 'pdf';
          id?: string;
          project_id: string;
          result?: Json | null;
          script_doc: Json;
          status?: 'queued' | 'processing' | 'completed' | 'failed';
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deliver_to_email?: string | null;
          error?: string | null;
          format?: 'fountain' | 'fdx' | 'docx' | 'pdf';
          id?: string;
          project_id?: string;
          result?: Json | null;
          script_doc?: Json;
          status?: 'queued' | 'processing' | 'completed' | 'failed';
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'export_jobs_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
        ];
      };
      projects: {
        Row: {
          created_at: string;
          genre: string | null;
          id: string;
          logline: string | null;
          metadata: Json;
          owner_id: string | null;
          script_type: string;
          status: 'outline' | 'draft' | 'polish' | 'locked';
          tags: string[] | null;
          target_length_unit: 'pages' | 'minutes' | 'seconds' | null;
          target_length_value: number | null;
          title: string;
          user_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          genre?: string | null;
          id?: string;
          logline?: string | null;
          metadata?: Json;
          owner_id?: string | null;
          script_type: string;
          status?: 'outline' | 'draft' | 'polish' | 'locked';
          tags?: string[] | null;
          target_length_unit?: 'pages' | 'minutes' | 'seconds' | null;
          target_length_value?: number | null;
          title: string;
          user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          genre?: string | null;
          id?: string;
          logline?: string | null;
          metadata?: Json;
          owner_id?: string | null;
          script_type?: string;
          status?: 'outline' | 'draft' | 'polish' | 'locked';
          tags?: string[] | null;
          target_length_unit?: 'pages' | 'minutes' | 'seconds' | null;
          target_length_value?: number | null;
          title?: string;
          user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      script_docs: {
        Row: {
          created_at: string;
          doc: Json;
          id: string;
          metadata: Json;
          project_id: string;
          record_type: 'version' | 'autosave';
          revision_id: string | null;
          source_version_id: string | null;
          transcript_refs: string[] | null;
          updated_at: string;
          user_id: string | null;
          version_number: number | null;
        };
        Insert: {
          created_at?: string;
          doc: Json;
          id?: string;
          metadata?: Json;
          project_id: string;
          record_type: 'version' | 'autosave';
          revision_id?: string | null;
          source_version_id?: string | null;
          transcript_refs?: string[] | null;
          updated_at?: string;
          user_id?: string | null;
          version_number?: number | null;
        };
        Update: {
          created_at?: string;
          doc?: Json;
          id?: string;
          metadata?: Json;
          project_id?: string;
          record_type?: 'version' | 'autosave';
          revision_id?: string | null;
          source_version_id?: string | null;
          transcript_refs?: string[] | null;
          updated_at?: string;
          user_id?: string | null;
          version_number?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'script_docs_project_id_fkey';
            columns: ['project_id'];
            referencedRelation: 'projects';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'script_docs_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};

export type PublicSchema = Database['public'];
export type Tables<TName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][TName]['Row'];
export type TablesInsert<TName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][TName]['Insert'];
export type TablesUpdate<TName extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][TName]['Update'];
