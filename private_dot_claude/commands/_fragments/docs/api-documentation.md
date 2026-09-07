# Template Documentation API

## Structure Endpoint
```markdown
## `METHOD /path`

**Description**: Courte description de l'endpoint.

**Authentification**: Bearer token requis | Public

### Paramètres
| Nom | Type | Requis | Description |
|-----|------|--------|-------------|
| id | string | oui | ID ressource |

### Body (si POST/PUT)
```json
{
  "field": "value"
}
```

### Réponse (200)
```json
{
  "data": {}
}
```

### Erreurs
| Code | Description |
|------|-------------|
| 400 | Paramètres invalides |
| 404 | Ressource non trouvée |
```

## Structure README API
```markdown
# API [Nom]

## Base URL
`https://api.example.com/v1`

## Authentification
Bearer token dans header Authorization

## Endpoints
- [Resource 1](#resource-1)
- [Resource 2](#resource-2)

## Rate Limiting
100 requêtes/minute par token
```
