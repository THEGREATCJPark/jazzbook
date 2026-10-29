export const API='https://qyckjkidscpiyrdzqxoc.supabase.co/functions/v1/jazzbook-api';
const KEY='jazzbook.session.v1';
export function session(){try{return sessionStorage.getItem(KEY)||''}catch{return ''}}
export function remember(token){try{token?sessionStorage.setItem(KEY,token):sessionStorage.removeItem(KEY)}catch{}}
export async function request(body){const response=await fetch(API,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(session()?{'X-Jazzbook-Session':session()}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await response.json();if(!response.ok){if(response.status===401&&body?.action!=='login'&&body?.action!=='password')remember('');const e=new Error(data.error||'서버 연결을 확인해주세요.');e.status=response.status;throw e;}return data;}
export async function login(password){const data=await request({action:'login',password});remember(data.token);return data;}
export async function logout(){try{await request({action:'logout'})}finally{remember('')}}
