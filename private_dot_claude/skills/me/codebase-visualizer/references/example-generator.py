#!/usr/bin/env python3
"""Génère la section STRUCTURES/EDGES de l'atlas fp-api-rest depuis fp-scan.json.
Les chiffres viennent de la mesure ; les textes et le placement sont écrits à la main."""
import json, math
from collections import defaultdict

d = json.load(open('fp-scan.json')); M = d['modules']

# id -> (code, nom, groupe, cellule, footprint, préfixes de chemin)
B = {
 "routes":      ("RT","Routes","the way in",(0,0),2.0,["routes/"]),
 "middleware":  ("MW","Middleware & requests","the way in",(1,0),2.0,["app/Http/Middleware/","app/Http/Requests/"]),
 "admin":       ("AD","Admin modules","entity modules",(2,0),2.3,["app/Http/Modules/Admin/"]),
 "api":         ("AP","Client API modules","entity modules",(3,0),2.1,["app/Http/Modules/Api/"]),
 "payments":    ("PY","Payments","entity modules",(4,0),2.0,["app/Http/Modules/Payments/","app/Components/StripeController.php"]),
 "auth":        ("AU","Authentication","entity modules",(5,0),1.8,["app/Http/Modules/Authentication/"]),
 "schools-mod": ("SH","Schools module","entity modules",(6,0),1.6,["app/Http/Modules/Schools/"]),

 "providers":   ("PV","Providers","the house framework",(0,1),1.7,["app/Providers/"]),
 "crud":        ("CC","CRUD controller","the house framework",(1,1),1.8,["app/Components/CRUDController.php","app/Components/CRUDRules.php","app/Components/Controller.php"]),
 "abstracts":   ("AB","Abstracts & interfaces","the house framework",(2,1),2.0,["app/Components/Abstracts/","app/Components/Interfaces/"]),
 "repository":  ("RP","Repository","the house framework",(3,1),1.8,["app/Components/Repository.php"]),
 "contexts":    ("CX","Strategy contexts","the house framework",(4,1),1.7,["app/Components/Contexts/"]),
 "rules":       ("RU","Validation rules","the house framework",(5,1),1.7,["app/Rules/"]),
 "exceptions":  ("EC","Exceptions","the house framework",(6,1),1.6,["app/Exceptions/"]),

 "services":    ("SV","Domain services","services",(0,2),2.1,["app/Services/"]),
 "search":      ("SR","Search · Elasticsearch","services",(1,2),1.9,["app/Services/Search/"]),
 "models":      ("MD","Models","the domain",(2,2),2.3,["app/Models/"]),
 "enums":       ("EN","Enums","the domain",(3,2),2.0,["app/Enums/"]),
 "utils":       ("UT","Traits · utils · helpers","the domain",(4,2),1.9,["app/Traits/","app/Utils/","app/Helpers/"]),
 "jobs":        ("JB","Queued jobs","the domain",(5,2),1.7,["app/Jobs/"]),
 "console":     ("CN","Console commands","operations",(6,2),2.0,["app/Console/"]),

 "media":       ("ML","Media library","services",(0,3),1.9,["app/Services/MediaLibrary/"]),
 "export":      ("EX","Export","services",(1,3),1.9,["app/Services/Export/"]),
 "stats":       ("ST","Stats","services",(2,3),1.8,["app/Services/Stats/"]),
 "acs":         ("AC","ACS ingestion","services",(3,3),1.8,["app/Services/Acs/"]),
 "school-svc":  ("SM","School & mandates","services",(4,3),1.8,["app/Services/School/","app/Services/SchoolMandate/"]),
 "tools":       ("TL","Tooling","operations",(5,3),1.6,["tools/","scripts/"]),
 "go-import":   ("GO","Go importer","operations",(6,3),1.6,["go-import-v2/"]),

 "tests-unit":  ("UN","Unit tests","proof",(0,4),2.2,["tests/Unit/"]),
 "tests-feature":("TF","Feature tests","proof",(2,4),2.4,["tests/Feature/"]),
 "config":      ("CF","config","where state lives",(4,4),2.2,["config/"]),
 "lang":        ("LN","lang","where state lives",(6,4),2.0,["lang/"]),
 "migrations":  ("MG","Migrations","where state lives",(1,5),2.2,["database/migrations/"]),
 "seeders":     ("SD","Seeders","where state lives",(3,5),2.3,["database/seeders/"]),
 "factories":   ("FA","Factories","where state lives",(5,5),2.0,["database/factories/"]),
 "ci":          ("CI","CI & release","proof",(0,6),1.6,[".github/workflows/"]),
}
SLABS = {"config","lang","migrations","seeders","factories","tests-unit","tests-feature"}
SPEC = [p for b,(*_,ps) in B.items() if b != "services" for p in ps if p.startswith("app/Services/")]

def owns(bid, path):
    if bid == "services":
        return path.startswith("app/Services/") and not any(path.startswith(p) for p in SPEC)
    return any(path == p or path.startswith(p) for p in B[bid][5])

# LOC sur TOUS les fichiers de code (le graphe reste sur le langage dominant)
loc, files = defaultdict(int), defaultdict(int)
for p, n in d['files'].items():
    for b in B:
        if owns(b, p):
            loc[b] += n; files[b] += 1; break
mod2blk = {}
for n, m in M.items():
    for b in B:
        if owns(b, m['path']):
            mod2blk[n] = b; break

W = defaultdict(int)                       # poids d'arête entre blocs
mfi, mfo = defaultdict(set), defaultdict(set)
for e in d['edges']:
    A, Z = mod2blk.get(e['f']), mod2blk.get(e['t'])
    if A and Z and A != Z:
        W[(A, Z)] += 1; mfo[A].add(e['t']); mfi[Z].add(e['f'])

# échelle sqrt : 300k lignes sur un facteur linéaire écraserait tout le reste
h_of = lambda n: round(math.sqrt(n) / 25, 2)
fmt = lambda n: f"{n/1000:.1f}k" if n >= 10000 else f"{n:,}".replace(",", " ")
CELL = 2.6

print("/* --- STRUCTURES (chiffres générés par fp-gen.py depuis fp-scan.json) --- */")
for b, (code, name, grp, (i, j), foot, paths) in B.items():
    slab = ', slab:true' if b in SLABS else ''
    h = 0.22 if b in SLABS else h_of(loc[b])
    print(f'  {{ id:"{b}", code:"{code}", name:"{name}", group:"{grp}", loc:"{fmt(loc[b])}", '
          f'locNow:{loc[b]}, files:{files[b]}, fanIn:{len(mfi[b])}, fanOut:{len(mfo[b])}, '
          f'mod:{json.dumps(paths)}, ...at({i},{j}), w:{foot}, d:{foot}, h:{h}{slab},')
    print(f'    what:"TODO", how:"TODO" }},')

print("\n/* --- EDGES candidates (poids = nombre d'imports réels) --- */")
for (a, z), n in sorted(W.items(), key=lambda kv: -kv[1]):
    if n >= 5:
        print(f'  {{ f:"{a}", t:"{z}", src:"import", pay:"" }},   // {n} imports')
print(f"\n/* couverture : {sum(loc.values())} / {d['stats']['loc']} lignes · "
      f"{sum(files.values())} / {len(M)} fichiers */")
