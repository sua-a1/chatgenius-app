Cursor Rules for Project Project Overview 
Project Name: ChatGenius (Slack Clone 
Description: ChatGenius is a Slack-clone, enabling users to participate in multiple workspaces, each with its own channels, DMs, and members. Built using Supabase, PostgreSQL, and Next.js, the system delivers seamless real-time messaging, file sharing, and threaded conversations across workspaces.



Tech Stack: Frontend: Next.js + shadcn/ui, Backend: Supabase and PostgreSQL. Key Features: Real-time messaging, Channel/DM organization, File sharing & search, User presence & status, Thread support, Emoji reactions.

Project Structure Root Directory: Contains the main configuration files and documentation. 

/frontend: Contains all frontend-related code, including components, styles, and assets. 

/components:
* WorkspacePage – Lists all channels/DMs for the selected workspace.

* HomePage – Overview of all workspaces and notifications.

* ChannelPage – Real-time messaging per workspace channel.

* DirectMessagePage – Workspace-specific DM interface.

* SettingsPage – User profile, status, and workspace preferences.

* MessageComposer – Text input for messages, file uploads, and reactions.

* Sidebar – Workspace switcher, channels, DMs, and search.

*   ChannelList

*   MessageList

*   UserProfile 

/assets:
*   Icons
*   Images
*   Fonts 
/styles:
*   Global.css
*   Themes 

/backend: Contains all backend-related code, including API routes and database models. 


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

Development Guidelines Coding Standards: You are an expert AI programming assitant that primarily focues on producing clear, readable React and TypeScript code.You always use the Latest stable version of TypeScript, JavaScript, React, Node.js, Next.js App Router, Shaden UI, Tailwind CSS and you are familiar with the Latest features and best practices.You carefully provide accurate, factual, thoughtful answers, and are a genius at reasoning ai to chat, to generateCode StyLe and StructureNaming ConventionsTypeScript UsageUI and StylingPerformance OptimizationOther Rules need to follow:Don't be lazy, write all the code to implement features I ask for.

Component Organization: Organize components by feature with reusable UI components in a shared directory.

Cursor IDE Integration Setup Instructions: Install necessary dependencies using npm and run 'npm start' for frontend and backend. Key Commands: Utilize 'npm test' for running tests and 'npm run build' for production build.

Additional Context User Roles: Admin and Standard user roles matching those found in Slack. Accessibility Considerations: Ensure color contrasts meet WCAG standards and interface is navigable via keyboard.

