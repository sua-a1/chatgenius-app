-- Add system user to all existing workspaces
INSERT INTO public.workspace_memberships (workspace_id, user_id, role, joined_at)
SELECT 
    id as workspace_id,
    '00000000-0000-0000-0000-000000000000'::uuid as user_id,
    'member' as role,
    NOW() as joined_at
FROM public.workspaces
WHERE NOT EXISTS (
    SELECT 1 FROM public.workspace_memberships
    WHERE workspace_id = workspaces.id
    AND user_id = '00000000-0000-0000-0000-000000000000'::uuid
);

-- Create trigger to automatically add system user to new workspaces
CREATE OR REPLACE FUNCTION public.add_system_user_to_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Add system user as a member
    INSERT INTO public.workspace_memberships (workspace_id, user_id, role, joined_at)
    VALUES (NEW.id, '00000000-0000-0000-0000-000000000000'::uuid, 'member', NOW());
    RETURN NEW;
END;
$$;

-- Create trigger for new workspace creation
DROP TRIGGER IF EXISTS on_workspace_created ON public.workspaces;
CREATE TRIGGER on_workspace_created
    AFTER INSERT ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.add_system_user_to_workspace(); 