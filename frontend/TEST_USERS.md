# Demo accounts

## Seeded (database only)

| Email | Name | Role | Password |
|-------|------|------|----------|
| aisha@example.com | Aisha Yusuf | Master (admin) | `Password123!` |

Everything else is created by **real API calls**:

```bash
# After backend is up and DB has been reset + seeded:
./scripts/bootstrap-contracts-api.sh
```

## Created by the bootstrap script

### Organisations
- **Arewa Contract Services Ltd** — Nigerian contracts house
- **Global Development Partners Nigeria** — international org country office

### People (all password `Password123!`)

| Email | Name | Role |
|-------|------|------|
| fatima@example.com | Fatima Bello | Group Secretary |
| habiba@example.com | Habiba Musa | Company Secretary (Arewa) |
| maryam@example.com | Maryam Ibrahim | Company Secretary (GDP) |
| yusuf@example.com | Yusuf Abdullahi | Company Admin |
| halima@example.com | Halima Sani | Company Admin |
| abubakar@example.com | Abubakar Lawal | Department Head |
| zainab@example.com | Zainab Mohammed | Department Head |
| hadiza@example.com | Hadiza Aliyu | Department Secretary |
| usman@example.com | Usman Garba | Division Head |
| amina@example.com | Amina Shehu | Manager |
| ibrahim@example.com | Ibrahim Sani | Staff |
| nafisa@example.com | Nafisa Umar | Staff |
| suleiman@example.com | Suleiman Bello | Staff |
| kabiru@example.com | Kabiru Hassan | Staff |
| rukayya@example.com | Rukayya Adamu | Receptionist |

### Folder tree (Arewa)
```
Contracts Registry
├── Nigerian Contracts
│   ├── MDAs & State Governments
│   └── Private Sector (NG)
├── International Partners
│   ├── Multilaterals
│   └── Bilateral
└── Templates
```
