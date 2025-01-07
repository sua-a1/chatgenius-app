Product Requirements Document (PRD)

Project Overview
ChatGenius is a Slack-inspired communication platform with AI augmentation, enabling users to participate in multiple workspaces, each with its own channels, DMs, and members. Built using Supabase, PostgreSQL, and Next.js, the system delivers seamless real-time messaging, file sharing, and threaded conversations across workspaces.

User Roles & Core Workflows
Regular User – Join multiple workspaces, send messages in channels/DMs, and manage threads.
Team Lead – Create/manage channels, invite/remove members, and oversee workspace channels.
Admin/IT – Manage workspaces, control user permissions, and enforce policies.
Executive – Oversee multiple workspaces and interact across teams from a unified interface.
Technical Foundation
1. Data Models

User – id, email, username, avatar, status, role, created_at.
Workspace – id, name, owner_id, created_at.
WorkspaceMembership – user_id, workspace_id, role, joined_at.
Channel – id, workspace_id, name, topic, is_private, created_by, created_at.
ChannelMembership – user_id, channel_id, role, joined_at.
Message – id, user_id, channel_id, content, reply_to, created_at.
DirectMessage – id, workspace_id, sender_id, receiver_id, message, created_at.
File – id, user_id, workspace_id, file_url, filename, channel_id, created_at.
2. API Endpoints

Auth – POST /api/auth/signup, POST /api/auth/login, GET /api/auth/me.
Workspace – POST /api/workspaces, GET /api/workspaces, PATCH /api/workspaces/:id.
Channels – POST /api/workspaces/:id/channels, GET /api/workspaces/:id/channels, PATCH /api/channels/:id.
Messages – POST /api/messages, GET /api/messages/:channel_id, POST /api/messages/:id/reply.
DMs – POST /api/dms, GET /api/workspaces/:id/dms.
Files – POST /api/files, GET /api/files/:id.
Reactions – POST /api/messages/:id/reactions, DELETE /api/messages/:id/reactions/:emoji.
3. Key Components

WorkspacePage – Lists all channels/DMs for the selected workspace.
HomePage – Overview of all workspaces and notifications.
ChannelPage – Real-time messaging per workspace channel.
DirectMessagePage – Workspace-specific DM interface.
SettingsPage – User profile, status, and workspace preferences.
MessageComposer – Text input for messages, file uploads, and reactions.
Sidebar – Workspace switcher, channels, DMs, and search.
MVP Launch Requirements
Workspace Management – Users can create and join multiple workspaces.
Authentication – Secure user sign-up/login through Supabase across workspaces.
Real-time Messaging – WebSocket-based live chat for each workspace’s channels and DMs.
Channel Management – Workspace-specific channels with public/private settings.
File Uploads – Upload, store, and share files within specific workspaces.
Threading and Replies – Support threaded conversations in channels.
User Presence – Display workspace-specific online status and typing indicators.
Role Management – Users have different roles (member/admin/owner) per workspace.
Emoji Reactions – React to messages with emojis in channels/DMs.
Data Persistence – PostgreSQL stores workspace, channel, and message data with Supabase RLS for access control.





