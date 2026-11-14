"""Mapa de dependências de src/: importações entre áreas, pares bidirecionais, ciclos e maiores arquivos.

Uso: python3 tools/dependencias.py (a partir da raiz do repositório).
"""
import os,re,collections,sys
root='src'
files=[]
for d,_,fs in os.walk(root):
    for f in fs:
        if f.endswith(('.ts','.tsx')): files.append(os.path.join(d,f))
def resolve(src,spec):
    if spec.startswith('@/'): base=os.path.join('src',spec[2:])
    elif spec.startswith('.'): base=os.path.normpath(os.path.join(os.path.dirname(src),spec))
    else: return None
    for cand in [base+'.ts',base+'.tsx',os.path.join(base,'index.ts')]:
        if os.path.exists(cand): return cand
    return None
graph=collections.defaultdict(set); typeonly=collections.defaultdict(set)
for f in files:
    s=open(f).read()
    for m in re.finditer(r"^(import|export)\s+(type\s+)?[^;]*?from\s+'([^']+)'",s,re.M|re.S):
        t=resolve(f,m.group(3))
        if t:
            (typeonly if m.group(2) else graph)[f].add(t)
def area(p):
    parts=p.split('/')
    if parts[1]=='engine' and len(parts)>3:
        return 'engine/'+parts[2]+('/race' if parts[2]=='simulation' and len(parts)>4 else '')
    if parts[1]=='engine': return 'engine/(root)'
    if parts[1]=='ui': return 'ui'
    return parts[1]
mat=collections.Counter()
for f,ts in graph.items():
    for t in ts:
        a,b=area(f),area(t)
        if a!=b: mat[(a,b)]+=1
print('== dependências entre áreas (imports de valor) ==')
for (a,b),n in sorted(mat.items()): print(f'{a:26} -> {b:26} {n}')
# cycles between areas
areas=set(x for k in mat for x in k)
print('== pares bidirecionais ==')
for a in sorted(areas):
    for b in sorted(areas):
        if a<b and mat[(a,b)] and mat[(b,a)]: print(a,'<->',b, mat[(a,b)], mat[(b,a)])
# file-level cycles (Tarjan)
idx={};low={};st=[];on=set();res=[];c=[0]
sys.setrecursionlimit(10000)
def sc(v):
    idx[v]=low[v]=c[0];c[0]+=1;st.append(v);on.add(v)
    for w in graph.get(v,()):
        if w not in idx: sc(w);low[v]=min(low[v],low[w])
        elif w in on: low[v]=min(low[v],idx[w])
    if low[v]==idx[v]:
        comp=[]
        while True:
            w=st.pop();on.discard(w);comp.append(w)
            if w==v:break
        if len(comp)>1:res.append(comp)
for f in files:
    if f not in idx: sc(f)
print('== ciclos de arquivos (componentes fortemente conexos) ==')
for comp in res: print(len(comp), sorted(x.replace('src/','') for x in comp))
print('== fan-in (quem mais é importado) ==')
fin=collections.Counter()
for f,ts in graph.items():
    for t in ts: fin[t]+=1
for f,n in fin.most_common(10): print(n,f)
print('== maiores arquivos ==')
sizes=sorted(((sum(1 for _ in open(f)),f) for f in files),reverse=True)[:14]
for n,f in sizes: print(n,f)
