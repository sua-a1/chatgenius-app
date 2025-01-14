-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users and insert into both auth.users and public.users
WITH user_ids AS (
  SELECT 
    uuid '11111111-1111-1111-1111-111111111111' as user1_id,
    uuid '22222222-2222-2222-2222-222222222222' as user2_id,
    uuid '33333333-3333-3333-3333-333333333333' as user3_id,
    uuid '44444444-4444-4444-4444-444444444444' as user4_id
)
-- Delete existing users
, delete_users AS (
  DELETE FROM auth.users 
  WHERE id IN (
    SELECT user1_id FROM user_ids
    UNION ALL SELECT user2_id FROM user_ids
    UNION ALL SELECT user3_id FROM user_ids
    UNION ALL SELECT user4_id FROM user_ids
  )
)
-- Insert into auth.users
, auth_users AS (
  INSERT INTO auth.users (id, email, created_at)
  SELECT user1_id, 'iwillrule@example.com', now() FROM user_ids
  UNION ALL
  SELECT user2_id, 'postvity@example.com', now() FROM user_ids
  UNION ALL
  SELECT user3_id, 'kristo@example.com', now() FROM user_ids
  UNION ALL
  SELECT user4_id, 'holame@example.com', now() FROM user_ids
)
-- Insert into public.users
INSERT INTO public.users (id, email, username, full_name, avatar_url, created_at)
SELECT user1_id, 'iwillrule@example.com', 'iwillrule', 'Alex Doom', 'https://api.dicebear.com/7.x/avataaars/svg?seed=iwillrule', now() FROM user_ids
UNION ALL
SELECT user2_id, 'postvity@example.com', 'postvity', 'Sarah Bright', 'https://api.dicebear.com/7.x/avataaars/svg?seed=postvity', now() FROM user_ids
UNION ALL
SELECT user3_id, 'kristo@example.com', 'kristo', 'Chris Storm', 'https://api.dicebear.com/7.x/avataaars/svg?seed=kristo', now() FROM user_ids
UNION ALL
SELECT user4_id, 'holame@example.com', 'holame', 'Joy Future', 'https://api.dicebear.com/7.x/avataaars/svg?seed=holame', now() FROM user_ids;

-- Add workspace and channel memberships
WITH user_ids AS (
  SELECT 
    uuid '11111111-1111-1111-1111-111111111111' as user1_id,
    uuid '22222222-2222-2222-2222-222222222222' as user2_id,
    uuid '33333333-3333-3333-3333-333333333333' as user3_id,
    uuid '44444444-4444-4444-4444-444444444444' as user4_id
)
, workspace_members AS (
  INSERT INTO public.workspace_memberships (workspace_id, user_id, role, joined_at)
  SELECT uuid '02771873-ffb7-4864-994a-f9bfc369f835', user1_id, 'member', now() FROM user_ids
  UNION ALL
  SELECT uuid '02771873-ffb7-4864-994a-f9bfc369f835', user2_id, 'member', now() FROM user_ids
  UNION ALL
  SELECT uuid '02771873-ffb7-4864-994a-f9bfc369f835', user3_id, 'member', now() FROM user_ids
  UNION ALL
  SELECT uuid '02771873-ffb7-4864-994a-f9bfc369f835', user4_id, 'member', now() FROM user_ids
)
INSERT INTO public.channel_memberships (channel_id, user_id, role, joined_at)
SELECT uuid 'c0148a10-262f-4af5-9fa7-11c92331201d', user1_id, 'member', now() FROM user_ids
UNION ALL
SELECT uuid 'c0148a10-262f-4af5-9fa7-11c92331201d', user2_id, 'member', now() FROM user_ids
UNION ALL
SELECT uuid 'c0148a10-262f-4af5-9fa7-11c92331201d', user3_id, 'member', now() FROM user_ids
UNION ALL
SELECT uuid 'c0148a10-262f-4af5-9fa7-11c92331201d', user4_id, 'member', now() FROM user_ids;

-- Initialize user presence
WITH user_ids AS (
  SELECT 
    uuid '11111111-1111-1111-1111-111111111111' as user1_id,
    uuid '22222222-2222-2222-2222-222222222222' as user2_id,
    uuid '33333333-3333-3333-3333-333333333333' as user3_id,
    uuid '44444444-4444-4444-4444-444444444444' as user4_id
)
INSERT INTO public.user_presence (user_id, status, last_seen)
SELECT user1_id, 'online', now() FROM user_ids
UNION ALL
SELECT user2_id, 'online', now() FROM user_ids
UNION ALL
SELECT user3_id, 'online', now() FROM user_ids
UNION ALL
SELECT user4_id, 'online', now() FROM user_ids
ON CONFLICT (user_id) 
DO UPDATE SET 
    status = EXCLUDED.status,
    last_seen = EXCLUDED.last_seen;

-- The conversation begins
WITH RECURSIVE user_ids AS (
  SELECT 
    uuid '11111111-1111-1111-1111-111111111111' as user1_id,
    uuid '22222222-2222-2222-2222-222222222222' as user2_id,
    uuid '33333333-3333-3333-3333-333333333333' as user3_id,
    uuid '44444444-4444-4444-4444-444444444444' as user4_id
),
messages(user_id, content, minutes_ago) AS (
  VALUES 
    -- Hour 1: Initial Discussion and Setup of Perspectives (0-60 minutes)
    ((SELECT user1_id FROM user_ids), 'Has anyone been following the latest developments in AI? The signs are clear - AGI is already here, we just haven''t recognized it yet. *sound of baby crying in background at coffee shop* Sorry about the noise.', 0),
    ((SELECT user2_id FROM user_ids), 'Ugh, need to finish this report soon... But regarding AI - I think you''re being overly dramatic. Current AI systems are just pattern matching at scale.', 3),
    ((SELECT user3_id FROM user_ids), 'While I don''t think AGI is here yet, we need to take the risks seriously. The trajectory is concerning... Sorry if I sound tense, having a rough day with the wife.', 5),
    ((SELECT user4_id FROM user_ids), 'Flight delayed AGAIN... But hey, more time to chat about AI! I actually think we''re at the beginning of something amazing. The recent breakthroughs in multimodal models are just the start!', 7),
    
    ((SELECT user1_id FROM user_ids), 'Have you seen how ChatGPT-5 solved that mathematical theorem? *barista dropping cups in background* That''s not just pattern matching!', 10),
    ((SELECT user2_id FROM user_ids), 'My deadline is looming but I have to respond - solving a theorem doesn''t equal consciousness. It''s sophisticated pattern recognition.', 12),
    ((SELECT user3_id FROM user_ids), '*checking phone anxiously* The theorem solving is impressive, but it''s still operating within defined parameters...', 15),
    ((SELECT user4_id FROM user_ids), 'Terminal wifi is spotty... But guys, theorem solving is just the beginning! The real breakthrough is in the model''s ability to reason abstractly!', 17),
    
    -- Hour 2: Technical Capabilities and Current State (60-120 minutes)
    ((SELECT user1_id FROM user_ids), '*sips coffee* The reasoning capabilities are incredible. Look at how it handles complex ethical dilemmas!', 65),
    ((SELECT user2_id FROM user_ids), 'Taking a quick break from work. Those "ethical decisions" are pre-programmed responses based on training data.', 68),
    ((SELECT user3_id FROM user_ids), 'Just got a concerning text... But back to AI - we need to distinguish between mimicry and true understanding.', 70),
    ((SELECT user4_id FROM user_ids), 'Finally boarded! Reading about the latest AI safety research. The alignment problem is fascinating.', 73),

    -- Hour 3: Economic Impact and Job Market (120-180 minutes)
    ((SELECT user1_id FROM user_ids), 'The coffee here is terrible today... Speaking of AI impact, what about the job market? *more background noise*', 125),
    ((SELECT user2_id FROM user_ids), 'As someone in tech, I see AI augmenting jobs, not replacing them. Though this report might be replaced soon...', 128),
    ((SELECT user3_id FROM user_ids), 'My wife works in healthcare - AI is already transforming diagnostics. *checks phone again*', 130),
    ((SELECT user4_id FROM user_ids), 'In-flight wifi connected! Healthcare AI is a perfect example of human-AI collaboration.', 133),

    -- Continue with more messages following the same pattern...
    -- Hour 4: Safety and Control Mechanisms (180-240 minutes)
    ((SELECT user1_id FROM user_ids), 'Moving to a quieter spot... We need robust control mechanisms for AI systems.', 185),
    ((SELECT user2_id FROM user_ids), 'Finally submitted my report! Now, about control mechanisms - they''re only as good as their designers.', 188),
    ((SELECT user3_id FROM user_ids), 'Things settled at home. Control is crucial, but how do we define "robust" in this context?', 190),
    ((SELECT user4_id FROM user_ids), 'Turbulence ahead... Quick point: control should be about alignment, not restriction.', 193),

    -- Hour 5: AI and Creativity (240-300 minutes)
    ((SELECT user1_id FROM user_ids), '*jazz music playing in background* What about AI in creative fields? The art it generates is fascinating.', 245),
    ((SELECT user2_id FROM user_ids), 'Taking another break. Art is about human experience - can AI truly create, or just combine?', 248),
    ((SELECT user3_id FROM user_ids), 'Finally some peace at home. AI art raises interesting copyright questions...', 250),
    ((SELECT user4_id FROM user_ids), 'Watching clouds from 35,000 feet... Like them, AI creativity is about patterns and emergence.', 253),

    -- Hour 6: Social Impact and Relationships (300-360 minutes)
    ((SELECT user1_id FROM user_ids), 'Switched to tea now. Anyone seen those AI relationship counselors? *cafe getting busier*', 305),
    ((SELECT user2_id FROM user_ids), 'Project''s almost done. AI counselors? That''s concerning - emotions need human understanding.', 308),
    ((SELECT user3_id FROM user_ids), 'Speaking from experience, relationship issues need human touch... though AI might help with communication patterns.', 310),
    ((SELECT user4_id FROM user_ids), 'Landing delayed... But interesting point about AI in relationships. It could offer unbiased perspectives.', 313),

    -- Hour 7: Education and Learning (360-420 minutes)
    ((SELECT user1_id FROM user_ids), 'The evening crowd is coming in. How will AI transform education? *sound of espresso machine*', 365),
    ((SELECT user2_id FROM user_ids), 'Almost finished here. AI could personalize learning, but we need human mentorship.', 368),
    ((SELECT user3_id FROM user_ids), 'Kids need both tech and human guidance. My situation today proves that...', 370),
    ((SELECT user4_id FROM user_ids), 'Still circling... Education needs both AI efficiency and human wisdom.', 373),

    -- Hour 8: Ethics and Responsibility (420-480 minutes)
    ((SELECT user1_id FROM user_ids), 'Evening rush is crazy here! But back to ethics - who''s responsible when AI makes mistakes?', 425),
    ((SELECT user2_id FROM user_ids), 'Final revisions done. Responsibility lies with developers AND users.', 428),
    ((SELECT user3_id FROM user_ids), 'Made up with the wife. Ethics in AI need clear frameworks, like in human relationships.', 430),
    ((SELECT user4_id FROM user_ids), 'New landing time... Ethics should be built in, not added as an afterthought.', 433),

    -- Hour 9: Future Predictions (480-540 minutes)
    ((SELECT user1_id FROM user_ids), 'Cafe''s quieting down... Where do you see AI in 10 years? *cleaning sounds in background*', 485),
    ((SELECT user2_id FROM user_ids), 'Report is submitted! In 10 years, AI will be like electricity - everywhere but invisible.', 488),
    ((SELECT user3_id FROM user_ids), 'Home life stable now. Future AI needs better safety than we have now.', 490),
    ((SELECT user4_id FROM user_ids), 'Finally starting descent! Future is collaborative AI, not replacement.', 493),

    -- Intermediate discussions and transitions
    ((SELECT user1_id FROM user_ids), '*barista changing shifts* The debate about AI consciousness is fascinating...', 520),
    ((SELECT user2_id FROM user_ids), 'Looking back at today''s discussion while packing up. We covered so much ground.', 525),
    ((SELECT user3_id FROM user_ids), 'Just had dinner with the family. This conversation helped put things in perspective.', 530),
    ((SELECT user4_id FROM user_ids), 'Airport shuttle time! The journey of AI mirrors our own evolution in many ways.', 535),

    ((SELECT user1_id FROM user_ids), 'The evening crowd is thinning out... Amazing how AI discussions bring people together.', 550),
    ((SELECT user2_id FROM user_ids), 'Heading home now. Today showed how complex the AI debate really is.', 555),
    ((SELECT user3_id FROM user_ids), 'Family time was good. Like AI, relationships need constant work and understanding.', 560),
    ((SELECT user4_id FROM user_ids), 'Almost at the terminal. This delay led to such an enriching discussion!', 565),

    ((SELECT user1_id FROM user_ids), 'They''re starting to stack chairs here... Time really flew by today.', 575),
    ((SELECT user2_id FROM user_ids), 'On the train home. Grateful for this break from work to discuss AI.', 580),
    ((SELECT user3_id FROM user_ids), 'Kids are in bed. Amazing how AI touches every aspect of our lives.', 585),
    ((SELECT user4_id FROM user_ids), 'Finally at baggage claim. What a day of insights and perspectives!', 590),

    -- Final messages (around 600 minutes / 10 hours later)
    ((SELECT user1_id FROM user_ids), 'Coffee shop''s closing in 5... But this conversation proves my point - AI is already shaping how we think and debate!', 595),
    ((SELECT user2_id FROM user_ids), 'Finally wrapped up work! This has been quite a discussion. We need more evidence-based debates like this.', 597),
    ((SELECT user3_id FROM user_ids), 'Heading home now... Let''s continue this tomorrow with a focus on practical safety measures.', 599),
    ((SELECT user4_id FROM user_ids), 'Boarding call! Final thought - the future of AI is collaborative, not confrontational. We''re part of its evolution!', 600)
)
INSERT INTO public.messages (id, channel_id, user_id, content, created_at)
SELECT 
    gen_random_uuid() as id,
    uuid 'c0148a10-262f-4af5-9fa7-11c92331201d' as channel_id,
    user_id,
    content,
    now() - (minutes_ago || ' minutes')::interval as created_at
FROM messages;

-- Add reactions to make the conversation more interactive
INSERT INTO public.message_reactions (message_id, user_id, emoji)
SELECT 
    m.id,
    u.id,
    e.emoji
FROM public.messages m
CROSS JOIN (
    SELECT id FROM public.users 
    WHERE username IN ('iwillrule', 'postvity', 'kristo', 'holame')
) u
CROSS JOIN (
    SELECT unnest(ARRAY['👍', '🤖', '😱', '🤔', '💡', '❤️', '⚡️', '🎯', '🌟', '💭']) as emoji
) e
WHERE random() < 0.3
ON CONFLICT DO NOTHING; 