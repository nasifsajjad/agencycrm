-- 0025 — Two tables with RLS enabled and no way to write to them.
--
-- Both fail closed, so neither is a leak. Both are unfinished wiring that makes
-- a shipped feature silently inert, which is its own kind of defect: the UI
-- offers the action and the database discards it.

-- ---------------------------------------------------------------------------
-- A. comment_mentions
--
-- RLS is enabled (0007:49) and NOT ONE policy is defined for it anywhere in the
-- migration set. Under RLS, no policy means deny-all, so @mentions can never be
-- written or read through the API. The table is inert.
--
-- A mention row is a fact about a comment, so it inherits the comment's
-- visibility exactly. Getting this wrong in the other direction would be a real
-- leak — a mention row names a user against a comment id, and comments carry
-- internal/client visibility — so both policies delegate to the comments
-- policies rather than restating them.
-- ---------------------------------------------------------------------------
drop policy if exists comment_mentions_select on public.comment_mentions;
drop policy if exists comment_mentions_insert on public.comment_mentions;
drop policy if exists comment_mentions_delete on public.comment_mentions;

-- Readable exactly when the parent comment is readable. `select 1 from
-- public.comments` is itself filtered by comments_select, so a comment the
-- caller cannot see yields no row here either.
create policy comment_mentions_select on public.comment_mentions for select to authenticated
  using (exists (select 1 from public.comments c where c.id = comment_id));

-- Writable only by the author of the parent comment, and only while that
-- comment is theirs. Mentions are created alongside the comment.
create policy comment_mentions_insert on public.comment_mentions for insert to authenticated
  with check (
    exists (
      select 1 from public.comments c
      where c.id = comment_id
        and c.author_user_id = auth.uid()
        and private.is_workspace_member(c.workspace_id)
    )
  );

create policy comment_mentions_delete on public.comment_mentions for delete to authenticated
  using (
    exists (
      select 1 from public.comments c
      where c.id = comment_id
        and c.author_user_id = auth.uid()
        and private.is_workspace_member(c.workspace_id)
    )
  );

-- ---------------------------------------------------------------------------
-- B. approval_steps
--
-- 0007:567-570 defines SELECT and UPDATE only. There is no INSERT policy and no
-- RPC anywhere inserts into this table. Meanwhile approval_requests DOES have a
-- direct INSERT policy gated on approvals.request (0007:561-562).
--
-- So a user can create an approval request and then cannot create the steps
-- that constitute the actual review workflow — the request exists with no
-- approvers and can never be decided.
--
-- Steps are part of the request, so INSERT mirrors approval_requests_insert:
-- the caller must hold approvals.request in the request's workspace. DELETE is
-- allowed on the same basis but only while the step is still pending, so a
-- decided step cannot be removed to rewrite history. Decisions themselves stay
-- immutable via approval_events, which has no update or delete policy at all.
-- ---------------------------------------------------------------------------
drop policy if exists approval_steps_insert on public.approval_steps;
drop policy if exists approval_steps_delete on public.approval_steps;

create policy approval_steps_insert on public.approval_steps for insert to authenticated
  with check (
    exists (
      select 1 from public.approval_requests ar
      where ar.id = approval_request_id
        and private.has_permission(ar.workspace_id, 'approvals.request')
    )
  );

create policy approval_steps_delete on public.approval_steps for delete to authenticated
  using (
    status = 'pending'
    and exists (
      select 1 from public.approval_requests ar
      where ar.id = approval_request_id
        and private.has_permission(ar.workspace_id, 'approvals.request')
    )
  );

-- The existing approval_steps_update policy has a USING clause but no WITH
-- CHECK, so a permitted caller could move a step onto a different approval
-- request — including one in another workspace, since the check is evaluated
-- against the row's current parent rather than its new one. Restate it with
-- both clauses.
drop policy if exists approval_steps_update on public.approval_steps;
create policy approval_steps_update on public.approval_steps for update to authenticated
  using (
    exists (
      select 1 from public.approval_requests ar
      where ar.id = approval_request_id
        and (private.has_permission(ar.workspace_id, 'approvals.decide')
             or private.can_access_entity(ar.entity_type, ar.entity_id))
    )
  )
  with check (
    exists (
      select 1 from public.approval_requests ar
      where ar.id = approval_request_id
        and (private.has_permission(ar.workspace_id, 'approvals.decide')
             or private.can_access_entity(ar.entity_type, ar.entity_id))
    )
  );
