-- Check channels table schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'channels'
ORDER BY ordinal_position; 