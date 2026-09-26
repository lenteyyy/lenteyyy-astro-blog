begin;

create extension if not exists pgcrypto;

create table if not exists public.ielts_profiles (
	id uuid primary key references auth.users(id) on delete cascade,
	email text not null,
	role text not null default 'student' check (role in ('student', 'admin')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.ielts_materials (
	id uuid primary key default gen_random_uuid(),
	title text not null check (char_length(title) between 1 and 120),
	category text not null check (category in ('听力', '阅读', '写作', '口语', '词汇', '语法', '备考')),
	description text not null default '' check (char_length(description) <= 300),
	storage_path text not null unique,
	file_name text not null check (char_length(file_name) between 1 and 180),
	mime_type text not null check (char_length(mime_type) <= 120),
	size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 104857600),
	published boolean not null default true,
	uploaded_by uuid references auth.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.ielts_bookings (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	email text not null,
	name text not null check (char_length(name) between 1 and 60),
	contact text not null default '' check (char_length(contact) <= 120),
	lesson_date date not null,
	lesson_time text not null check (lesson_time in ('10:30–11:30', '14:00–15:00', '16:00–17:00', '20:00–21:00')),
	notes text not null default '' check (char_length(notes) <= 500),
	status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'declined')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create unique index if not exists ielts_bookings_active_slot
	on public.ielts_bookings (lesson_date, lesson_time)
	where status in ('pending', 'confirmed');

create index if not exists ielts_bookings_user_created
	on public.ielts_bookings (user_id, created_at desc);

create table if not exists public.ielts_rate_limits (
	key_hash text primary key,
	hit_count integer not null default 1,
	expires_at timestamptz not null
);

alter table public.ielts_profiles enable row level security;
alter table public.ielts_materials enable row level security;
alter table public.ielts_bookings enable row level security;
alter table public.ielts_rate_limits enable row level security;

drop policy if exists "users read own IELTS profile" on public.ielts_profiles;
create policy "users read own IELTS profile" on public.ielts_profiles
	for select to authenticated using (auth.uid() = id);

drop policy if exists "users read published IELTS materials" on public.ielts_materials;
create policy "users read published IELTS materials" on public.ielts_materials
	for select to authenticated using (published = true);

drop policy if exists "users read own IELTS bookings" on public.ielts_bookings;
create policy "users read own IELTS bookings" on public.ielts_bookings
	for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users create own IELTS bookings" on public.ielts_bookings;
create policy "users create own IELTS bookings" on public.ielts_bookings
	for insert to authenticated with check (auth.uid() = user_id);

create or replace function public.handle_ielts_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
	insert into public.ielts_profiles (id, email)
	values (new.id, coalesce(new.email, ''))
	on conflict (id) do update set email = excluded.email, updated_at = now();
	return new;
end;
$$;

drop trigger if exists on_ielts_auth_user_created on auth.users;
create trigger on_ielts_auth_user_created
	after insert or update of email on auth.users
	for each row execute procedure public.handle_ielts_user();

create or replace function public.claim_ielts_rate_limit(
	p_key_hash text,
	p_limit integer,
	p_window_seconds integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
	current_hits integer;
begin
	if p_limit < 1 or p_window_seconds < 1 then return false; end if;
	delete from public.ielts_rate_limits where expires_at < now();
	insert into public.ielts_rate_limits (key_hash, hit_count, expires_at)
	values (p_key_hash, 1, now() + make_interval(secs => p_window_seconds))
	on conflict (key_hash) do update
		set hit_count = case
			when public.ielts_rate_limits.expires_at < now() then 1
			else public.ielts_rate_limits.hit_count + 1
		end,
		expires_at = case
			when public.ielts_rate_limits.expires_at < now() then now() + make_interval(secs => p_window_seconds)
			else public.ielts_rate_limits.expires_at
		end
	returning hit_count into current_hits;
	return current_hits <= p_limit;
end;
$$;

revoke all on function public.claim_ielts_rate_limit(text, integer, integer) from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'ielts-materials',
	'ielts-materials',
	false,
	104857600,
	array[
		'application/pdf',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'audio/mpeg',
		'audio/mp4',
		'audio/x-m4a',
		'video/mp4',
		'image/jpeg',
		'image/png',
		'image/webp'
	]
)
on conflict (id) do update set
	public = false,
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

commit;
