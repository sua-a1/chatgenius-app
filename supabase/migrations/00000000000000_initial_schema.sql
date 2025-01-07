-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Create tables
create table public.users (
    id uuid references auth.users on delete cascade not null primary key,
    email text not null unique,
    username text not null unique,
    avatar_url text,
    status text check (status in ('online', 'offline', 'away', 'busy')) default 'offline',
    role text check (role in ('user', 'admin')) default 'user',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.workspaces (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    owner_id uuid references public.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.workspace_memberships (
    user_id uuid references public.users(id) on delete cascade not null,
    workspace_id uuid references public.workspaces(id) on delete cascade not null,
    role text check (role in ('member', 'admin', 'owner')) default 'member',
    joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id, workspace_id)
);

create table public.channels (
    id uuid default uuid_generate_v4() primary key,
    workspace_id uuid references public.workspaces(id) on delete cascade not null,
    name text not null,
    topic text,
    is_private boolean default false,
    created_by uuid references public.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (workspace_id, name)
);

create table public.channel_memberships (
    user_id uuid references public.users(id) on delete cascade not null,
    channel_id uuid references public.channels(id) on delete cascade not null,
    role text check (role in ('member', 'admin')) default 'member',
    joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (user_id, channel_id)
);

create table public.messages (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    channel_id uuid references public.channels(id) on delete cascade not null,
    content text not null,
    reply_to uuid references public.messages(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.direct_messages (
    id uuid default uuid_generate_v4() primary key,
    workspace_id uuid references public.workspaces(id) on delete cascade not null,
    sender_id uuid references public.users(id) on delete cascade not null,
    receiver_id uuid references public.users(id) on delete cascade not null,
    message text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.files (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    workspace_id uuid references public.workspaces(id) on delete cascade not null,
    channel_id uuid references public.channels(id) on delete cascade,
    file_url text not null,
    filename text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index idx_workspace_memberships_workspace_id on public.workspace_memberships(workspace_id);
create index idx_workspace_memberships_user_id on public.workspace_memberships(user_id);
create index idx_channels_workspace_id on public.channels(workspace_id);
create index idx_channel_memberships_channel_id on public.channel_memberships(channel_id);
create index idx_channel_memberships_user_id on public.channel_memberships(user_id);
create index idx_messages_channel_id on public.messages(channel_id);
create index idx_messages_user_id on public.messages(user_id);
create index idx_direct_messages_workspace_id on public.direct_messages(workspace_id);
create index idx_direct_messages_sender_id on public.direct_messages(sender_id);
create index idx_direct_messages_receiver_id on public.direct_messages(receiver_id);
create index idx_files_workspace_id on public.files(workspace_id);
create index idx_files_channel_id on public.files(channel_id);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.channels enable row level security;
alter table public.channel_memberships enable row level security;
alter table public.messages enable row level security;
alter table public.direct_messages enable row level security;
alter table public.files enable row level security;

-- Create policies
-- Users policies
create policy "Users can view their own profile"
    on public.users for select
    using (auth.uid() = id);

create policy "Users can update their own profile"
    on public.users for update
    using (auth.uid() = id);

-- Workspaces policies
create policy "Users can view workspaces they are members of"
    on public.workspaces for select
    using (
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = id
            and user_id = auth.uid()
        )
    );

create policy "Workspace owners can update their workspaces"
    on public.workspaces for update
    using (
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = id
            and user_id = auth.uid()
            and role = 'owner'
        )
    );

-- Workspace memberships policies
create policy "Users can view workspace memberships they are part of"
    on public.workspace_memberships for select
    using (
        exists (
            select 1 from public.workspace_memberships as wm
            where wm.workspace_id = workspace_id
            and wm.user_id = auth.uid()
        )
    );

-- Channels policies
create policy "Users can view channels they are members of"
    on public.channels for select
    using (
        exists (
            select 1 from public.channel_memberships
            where channel_id = id
            and user_id = auth.uid()
        )
        or
        (
            not is_private
            and exists (
                select 1 from public.workspace_memberships
                where workspace_id = channels.workspace_id
                and user_id = auth.uid()
            )
        )
    );

-- Channel memberships policies
create policy "Users can view channel memberships they are part of"
    on public.channel_memberships for select
    using (
        exists (
            select 1 from public.channel_memberships as cm
            where cm.channel_id = channel_id
            and cm.user_id = auth.uid()
        )
    );

-- Messages policies
create policy "Users can view messages in channels they are members of"
    on public.messages for select
    using (
        exists (
            select 1 from public.channel_memberships
            where channel_id = messages.channel_id
            and user_id = auth.uid()
        )
    );

create policy "Users can create messages in channels they are members of"
    on public.messages for insert
    with check (
        exists (
            select 1 from public.channel_memberships
            where channel_id = messages.channel_id
            and user_id = auth.uid()
        )
    );

create policy "Users can update their own messages"
    on public.messages for update
    using (user_id = auth.uid());

-- Direct messages policies
create policy "Users can view their direct messages"
    on public.direct_messages for select
    using (
        auth.uid() = sender_id
        or auth.uid() = receiver_id
    );

create policy "Users can send direct messages to workspace members"
    on public.direct_messages for insert
    with check (
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = direct_messages.workspace_id
            and user_id = auth.uid()
        )
        and
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = direct_messages.workspace_id
            and user_id = receiver_id
        )
    );

-- Files policies
create policy "Users can view files in channels they are members of"
    on public.files for select
    using (
        (
            channel_id is not null
            and exists (
                select 1 from public.channel_memberships
                where channel_id = files.channel_id
                and user_id = auth.uid()
            )
        )
        or
        (
            channel_id is null
            and exists (
                select 1 from public.workspace_memberships
                where workspace_id = files.workspace_id
                and user_id = auth.uid()
            )
        )
    );

create policy "Users can upload files to channels they are members of"
    on public.files for insert
    with check (
        exists (
            select 1 from public.workspace_memberships
            where workspace_id = files.workspace_id
            and user_id = auth.uid()
        )
        and
        (
            channel_id is null
            or exists (
                select 1 from public.channel_memberships
                where channel_id = files.channel_id
                and user_id = auth.uid()
            )
        )
    ); 