update storage.buckets
set
  public = false,
  file_size_limit = 4194304,
  allowed_mime_types = array['application/pdf']::text[]
where id = 'cvs';
