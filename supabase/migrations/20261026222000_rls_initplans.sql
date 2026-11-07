begin;

-- Optimize the policies that actually exist, retaining later ownership/linkage
-- protections, role lists and any other predicates added after this timestamp.
do $$
declare
  policy_row record;
  optimized_using text;
  optimized_check text;
begin
  for policy_row in
    select relation.relname as table_name, policy.polname as policy_name,
      pg_get_expr(policy.polqual, policy.polrelid) as using_expression,
      pg_get_expr(policy.polwithcheck, policy.polrelid) as check_expression
    from pg_policy policy
    join pg_class relation on relation.oid = policy.polrelid
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = any (array[
        'body_measurements', 'exercises', 'friend_requests', 'friends',
        'profiles', 'routine_exercises', 'routines', 'sets',
        'template_exercises', 'workout_comments', 'workout_exercises',
        'workout_likes', 'workout_templates', 'workouts'
      ])
  loop
    -- pg_get_expr prints existing scalar SELECTs with this uppercase prefix.
    -- Mask them before replacing direct calls so reapplication is idempotent.
    optimized_using := replace(replace(replace(policy_row.using_expression,
      'SELECT auth.uid()', 'SELECT __lyfttrack_uid_initplan__'),
      'auth.uid()', '(select auth.uid())'),
      '__lyfttrack_uid_initplan__', 'auth.uid()');
    optimized_check := replace(replace(replace(policy_row.check_expression,
      'SELECT auth.uid()', 'SELECT __lyfttrack_uid_initplan__'),
      'auth.uid()', '(select auth.uid())'),
      '__lyfttrack_uid_initplan__', 'auth.uid()');

    if optimized_using is distinct from policy_row.using_expression then
      execute format('alter policy %I on public.%I using (%s)',
        policy_row.policy_name, policy_row.table_name, optimized_using);
    end if;
    if optimized_check is distinct from policy_row.check_expression then
      execute format('alter policy %I on public.%I with check (%s)',
        policy_row.policy_name, policy_row.table_name, optimized_check);
    end if;
  end loop;
end;
$$;

commit;
