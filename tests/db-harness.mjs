import { PGlite } from '@electric-sql/pglite';
import { readdir, readFile } from 'node:fs/promises';
export async function setupDatabase() {
  const db = new PGlite();
  await db.exec(`
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,owner uuid);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    grant execute on function storage.foldername(text) to anon,authenticated,service_role;
    grant all on all tables in schema auth,storage to anon,authenticated,service_role;
    alter table storage.objects enable row level security;
    create table public.exam_results(id serial primary key, note text); insert into public.exam_results(note) values('legacy preserved');
    insert into auth.users values('11111111-1111-4111-8111-111111111111','owner@example.test'),('22222222-2222-4222-8222-222222222222','student@example.test'),('33333333-3333-4333-8333-333333333333','other@example.test');
  `);
  const dir = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(x => x.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, dir), 'utf8'));
  await db.exec("insert into public.portal_owners values('11111111-1111-4111-8111-111111111111');");
  return db;
}
export const OWNER='11111111-1111-4111-8111-111111111111', STUDENT='22222222-2222-4222-8222-222222222222', OTHER='33333333-3333-4333-8333-333333333333';
export async function asUser(db, role='postgres', id='') { await db.exec(`reset role; select set_config('request.jwt.claim.sub','${id}',false); ${role==='postgres'?'':`set role ${role};`}`); }
export async function rpc(db, name, args={}) { const keys=Object.keys(args); const cast=(k,v)=> k.endsWith('_id')||k==='p_client_nonce'?'::uuid': ['p_option_index','p_current_index','p_limit','p_seconds'].includes(k)?'::integer': typeof v==='boolean'?'::boolean': ['p_ids','p_review','p_visited','p_questions','p_patch','p_backup','p_summary'].includes(k)?'::jsonb': typeof v==='number'?'::numeric':'::text'; const sql=`select public.${name}(${keys.map((k,i)=>`$${i+1}${cast(k,args[k])}`).join(',')}) as value`; const r=await db.query(sql,Object.values(args).map(v=>v!==null&&typeof v==='object'?JSON.stringify(v):v)); return r.rows[0].value; }
export async function seed(db, settings={}) {
  await asUser(db); const id=async(sql,p)=>(await db.query(sql,p)).rows[0].id;
  const subject=await id("insert into public.portal_subjects(name,is_active) values('राजस्थान GK',true) returning id");
  const topic=await id("insert into public.portal_topics(subject_id,name) values($1,'इतिहास') returning id",[subject]);
  const part=await id("insert into public.portal_parts(topic_id,name) values($1,'Part 1') returning id",[topic]);
  const test=await id(`insert into public.portal_tests(part_id,title,duration_minutes,seconds_per_question,negative_ratio,leaderboard_published,option_count) values($1,'Secure test',${Number(settings.duration_minutes)||30},${Number(settings.seconds_per_question)||0},${settings.negative_ratio??1/3},true,${settings.option_count??4}) returning id`,[part]);
  const questions=[];
  for(let i=0;i<(settings.count??4);i++) questions.push(await id("insert into public.portal_questions(test_id,position,prompt_hi,prompt_en,options,correct_index,explanation_hi,explanation_en,marks) values($1,$2,$3,$4,$5::jsonb,$6,'व्याख्या','Explanation',$7) returning id",[test,i+1,`प्रश्न ${i+1}`,`Question ${i+1}`,JSON.stringify([{hi:'क',en:'A'},{hi:'ख',en:'B'},{hi:'ग',en:'C'},{hi:'घ',en:'D'}]),i%4,settings.per_question_marks?i+1:null]));
  if(settings.published!==false) await db.query('update public.portal_tests set is_published=true where id=$1',[test]);
  return {subject,topic,part,test,questions};
}
export async function start(db,f,name='Student',nonce=crypto.randomUUID(),secret='a'.repeat(64)) { const data=await rpc(db,'portal_start_attempt',{p_test_id:f.test,p_name:name,p_mobile_hash:null,p_consent:true,p_client_nonce:nonce,p_secret_hash:secret}); return {...data,secret}; }
export async function answer(db,a,qid,index) { return rpc(db,'portal_answer_attempt',{p_attempt_id:a.attempt_id,p_secret_hash:a.secret,p_question_id:qid,p_option_index:index}); }
export async function submit(db,a) { return rpc(db,'portal_submit_attempt',{p_attempt_id:a.attempt_id,p_secret_hash:a.secret}); }
