"use client";
import {useState} from "react";
type Result={id:number;title:string;abstract:string;status:string;author:string;venue:string|null;score:number};
export function Search(){const[q,setQ]=useState("");const[results,setResults]=useState<Result[]>([]);const[mode,setMode]=useState("");const[error,setError]=useState("");const[busy,setBusy]=useState(false);
 async function run(e:React.FormEvent){e.preventDefault();if(!q.trim())return;setBusy(true);setError("");try{const r=await fetch(`/api/search?q=${encodeURIComponent(q)}`);const d=await r.json();if(!r.ok)throw new Error(d.error||"Search failed");setResults(d.results||[]);setMode(d.mode||"");}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <div className="repository-search"><form className="search" onSubmit={run}><input aria-label="Search research papers" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search titles and abstracts…"/><button disabled={busy}>{busy?"Searching…":"Search"}</button></form>{error&&<p className="empty">{error}</p>}{mode&&<small className="search-mode">{mode} · {results.length} result(s)</small>}{results.length>0&&<div className="search-results">{results.map(p=><a className="search-result" href={`/papers/${p.id}`} key={p.id}><h3>{p.title}</h3><p>{p.author} · {p.venue||"No venue"} · {p.status}</p></a>)}</div>}</div>;
}
