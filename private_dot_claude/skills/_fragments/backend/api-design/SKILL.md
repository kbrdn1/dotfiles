---
name: api-design
description: Skill migrated from _fragments/backend/api-design
user-invocable: false
---

# Design API REST

## Conventions URL
- Ressources au pluriel: `/users`, `/orders`
- IDs dans le chemin: `/users/{id}`
- Relations imbriquées: `/users/{id}/orders`
- Actions non-CRUD avec verbes: `/orders/{id}/cancel`

## Codes HTTP
| Code | Usage |
|------|-------|
| 200 | Succès lecture |
| 201 | Succès création |
| 204 | Succès sans body |
| 400 | Erreur client |
| 401 | Non authentifié |
| 403 | Non autorisé |
| 404 | Ressource inexistante |
| 422 | Validation échouée |
| 500 | Erreur serveur |

## Structure Réponse
```json
{
  "data": {},
  "meta": { "page": 1, "total": 100 },
  "errors": [{ "code": "E001", "message": "" }]
}
```

## Pagination
```
GET /users?page=2&limit=20
GET /users?cursor=abc123&limit=20
```

