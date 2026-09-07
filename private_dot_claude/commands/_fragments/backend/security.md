# Checklist Sécurité Backend

## Authentification
- JWT avec expiration courte (15min access, 7j refresh)
- HTTPS obligatoire
- Rate limiting sur endpoints auth
- Hashage bcrypt/argon2 pour passwords

## Validation
- Valider toutes les entrées côté serveur
- Échapper les sorties HTML
- Paramètres SQL préparés (jamais concaténation)
- Whitelist des champs acceptés

## Headers Sécurité
```
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000
X-XSS-Protection: 1; mode=block
```

## OWASP Top 10 Checklist
- [ ] Injection (SQL, NoSQL, LDAP)
- [ ] Broken Authentication
- [ ] Sensitive Data Exposure
- [ ] XXE
- [ ] Broken Access Control
- [ ] Security Misconfiguration
- [ ] XSS
- [ ] Insecure Deserialization
- [ ] Vulnerable Components
- [ ] Insufficient Logging
