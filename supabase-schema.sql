-- ============================================================
-- 爱的错位 · Supabase 数据库结构
-- 在 Supabase 控制台 SQL Editor 中整段执行一次即可
-- ============================================================

-- ---------- 1. 密码表 ----------
create table if not exists passwords (
  code        text primary key,
  uses        integer not null default 3,
  used        integer not null default 0,
  disabled    boolean not null default false,
  note        text default '',
  created_at  timestamptz not null default now()
);

-- ---------- 2. 结果表 ----------
create table if not exists results (
  code        text primary key,
  mode        text not null,
  parent      jsonb,
  child       jsonb,
  combo       jsonb,
  created_at  timestamptz not null default now()
);

-- ---------- 3. 会话表（开始测评时发放，保存结果时核销） ----------
create table if not exists quiz_sessions (
  token       text primary key,
  password_code text not null,
  created_at  timestamptz not null default now(),
  used        boolean not null default false
);

-- ---------- 4. 行级安全：全部上锁，只通过 RPC 函数访问 ----------
alter table passwords      enable row level security;
alter table results        enable row level security;
alter table quiz_sessions  enable row level security;

-- 已登录的管理员（Supabase Auth 用户）可管理密码与查看数据
drop policy if exists "admin full access passwords" on passwords;
create policy "admin full access passwords" on passwords
  for all to authenticated using (true) with check (true);

drop policy if exists "admin full access results" on results;
create policy "admin full access results" on results
  for all to authenticated using (true) with check (true);

drop policy if exists "admin read sessions" on quiz_sessions;
create policy "admin read sessions" on quiz_sessions
  for select to authenticated using (true);

-- ---------- 5. 工具：生成不重复结果码 ----------
create or replace function gen_code(len int default 6)
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text := '';
  i int;
begin
  for i in 1..len loop
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out;
end; $$;

-- ---------- 6. RPC：验证密码并消耗一次（原子操作，防并发超用） ----------
create or replace function verify_password(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  p passwords%rowtype;
  v_token text;
begin
  -- 条件更新：还有次数且未停用，才 +1
  update passwords
     set used = used + 1
   where code = upper(trim(coalesce(p_code, '')))
     and disabled = false
     and used < uses
   returning * into p;

  if not found then
    select * into p from passwords where code = upper(trim(coalesce(p_code, '')));
    if not found then
      return json_build_object('ok', false, 'error', '密码不存在，请检查后重试');
    elsif p.disabled then
      return json_build_object('ok', false, 'error', '该密码已被停用，请联系客服');
    else
      return json_build_object('ok', false, 'error', '该密码的 ' || p.uses || ' 次测评已用完');
    end if;
  end if;

  v_token := gen_code(24);
  insert into quiz_sessions(token, password_code) values (v_token, p.code);

  return json_build_object(
    'ok', true, 'token', v_token, 'code', p.code,
    'remaining', p.uses - p.used, 'total', p.uses
  );
end; $$;

revoke all on function verify_password(text) from public;
grant execute on function verify_password(text) to anon, authenticated;

-- ---------- 7. RPC：保存结果（需要有效会话令牌，返回结果码） ----------
create or replace function save_result(p_token text, p_mode text, p_parent jsonb, p_child jsonb, p_combo jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare
  s quiz_sessions%rowtype;
  v_code text;
begin
  select * into s from quiz_sessions where token = p_token;
  if not found then
    return json_build_object('ok', false, 'error', '测评会话已失效，请重新输入密码');
  end if;
  if s.used then
    return json_build_object('ok', false, 'error', '该次测评的结果已保存过，请刷新页面');
  end if;

  -- 生成唯一结果码
  loop
    v_code := gen_code(6);
    exit when not exists (select 1 from results where code = v_code);
  end loop;

  insert into results(code, mode, parent, child, combo)
  values (v_code, p_mode, p_parent, p_child, p_combo);

  update quiz_sessions set used = true where token = p_token;

  return json_build_object('ok', true, 'code', v_code);
end; $$;

revoke all on function save_result(text, text, jsonb, jsonb, jsonb) from public;
grant execute on function save_result(text, text, jsonb, jsonb, jsonb) to anon, authenticated;

-- ---------- 8. RPC：按结果码读取结果（分享页用） ----------
create or replace function get_result(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare r results%rowtype;
begin
  select * into r from results where code = upper(trim(coalesce(p_code, '')));
  if not found then
    return json_build_object('ok', false, 'error', '结果不存在或链接已失效');
  end if;
  return json_build_object(
    'ok', true,
    'result', json_build_object(
      'code', r.code, 'mode', r.mode,
      'parent', r.parent, 'child', r.child, 'combo', r.combo,
      'createdAt', extract(epoch from r.created_at) * 1000
    )
  );
end; $$;

revoke all on function get_result(text) from public;
grant execute on function get_result(text) to anon, authenticated;

-- ---------- 9. 清理 24 小时前的过期会话（可在 Supabase 定时任务中每天执行） ----------
create or replace function cleanup_sessions()
returns void language sql as $$
  delete from quiz_sessions where created_at < now() - interval '24 hours';
$$;
