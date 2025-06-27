# SQLiteBridge

![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

SQLiteBridge is a TypeScript toolkit for cross-platform SQLite database management in Ionic/Capacitor applications. It enables seamless development across mobile and web platforms by generating TypeScript models, Dexie.js schemas, and services from SQLite migrations.

## Features

- **TypeScript Model Generation**: Create strongly-typed interfaces and classes from SQLite migration files
- **Dexie.js Schema Generation**: Automatically generate Dexie.js compatible schemas for web platform support
- **Service Class Generation**: Generate ready-to-use Angular services for database operations
- **Migration Management**: Simplify SQLite migration handling across platforms
- **Cross-Platform Support**: Works with `@capacitor-community/sqlite` on mobile and Dexie.js on web

## Installation

```bash
npm install sqlitebridge --save-dev
```

## Prerequisites

SQLiteBridge works best with the following peer dependencies:

```
@capacitor-community/sqlite: ^7.0.0
dexie: ^4.0.0
```

For a typical Ionic/Capacitor project, install them using:

```bash
npm install @capacitor-community/sqlite dexie
```

## Basic Usage

### CLI Commands

SQLiteBridge provides a command-line interface for generating code from your SQL migrations:

```bash
# Generate all artifacts (models, migrations, services, and optionally Dexie schema)
npx sqlitebridge all [--dexie]

# Generate only TypeScript models
npx sqlitebridge model [--file <filepath>] [--output-dir <output-dir>]

# Generate SQLite migrations
npx sqlitebridge migration [--output-file <output-file>]

# Generate service classes
npx sqlitebridge service [--file <filepath>] [--output-dir <output-dir>]

# Generate Dexie.js schema
npx sqlitebridge dexie [--output-file <output-file>]

# Display version information
npx sqlitebridge version
```

### Configuration

Create a `sqlitebridge.config.json` file in your project root to customize paths and options:

```json
{
  "migrationsPath": "./migrations",
  "queriesPath": "./queries",
  "generatedPath": {
    "migrations": "./src/app/core/database/migrations.ts",
    "models": "./src/app/core/database/models",
    "dexie": "./src/app/core/database/dexie-schema.ts",
    "services": "./src/app/core/database/services"
  },
  "withDexie": true
}
```

## Project Structure

### Migration Files

Place your SQLite migration files in the `migrationsPath` directory following the naming convention:

```
V<version>__<description>.sql
```

For example:
- `V1__initial_schema.sql`
- `V2__add_user_tables.sql`
- `V3__add_indexes.sql`

### Query Files

Place your custom SQL query files in the `queriesPath` directory with the table name as the file name:

```
<tablename>.sql
```

Each query should be preceded by a comment with the query name:

```sql
-- :findByEmail
SELECT * FROM users WHERE email = ? LIMIT 1;

-- :getUsersWithRoles
SELECT u.*, r.name as role_name 
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id;
```

## Generated Files

### Models

For each table, SQLiteBridge generates:
- An interface with camelCase properties
- A table interface with snake_case properties (for direct DB access)
- A base model for common fields (optional)

Example:
```typescript
// Generated from users table
export interface User extends BaseModel<number> {
  email: string;
  firstName: string;
  lastName: string;
  roleId?: number;
}

export interface UserTable extends BaseTable<number> {
  email: string;
  first_name: string;
  last_name: string;
  role_id?: number;
}
```

### Services

For each table, a corresponding Angular service is generated with:
- Basic CRUD operations
- Custom queries from matching SQL files
- Automatic mapping between snake_case (DB) and camelCase (model)
- Dexie.js support (if enabled)

Example:
```typescript
@Injectable({ providedIn: 'root' })
export class UserService {
  constructor(private databaseService: DatabaseService) {}

  async create(user: User): Promise<number | undefined> {
    // Implementation...
  }

  async getById(id: number): Promise<User | null> {
    // Implementation...
  }

  async findByEmail(email: string): Promise<User | null> {
    // Implementation of custom query...
  }
}
```

### Migrations

A TypeScript file with migrations array and helper functions:

```typescript
export const ALL_MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial Schema',
    queries: [
      `CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        first_name TEXT,
        last_name TEXT,
        created_at TEXT,
        updated_at TEXT
      )`
    ]
  }
];

export function prepareMigrations(): capSQLiteVersionUpgrade[] {
  // Implementation...
}
```

### Dexie Schema

A TypeScript file with Dexie database class:

```typescript
export class AppDatabase extends Dexie {
  users: Dexie.Table<any, number>;

  constructor(dbName: string = 'AppDatabase') {
    super(dbName);

    this.version(1).stores({
      users: '++id, email, first_name, last_name'
    });

    this.users = this.table('users');
  }
}

export const db = new AppDatabase();
```

## Integration Example

Here's how to use the generated files in an Ionic/Capacitor application:

```typescript
import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { DatabaseService } from './core/database/database.service';
import { UserService } from './core/database/services/user.service';
import { User } from './core/database/models';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  constructor(
    private platform: Platform,
    private databaseService: DatabaseService,
    private userService: UserService
  ) {}

  async ngOnInit() {
    await this.platform.ready();
    await this.databaseService.initialize();
    
    // Now you can use the services
    const users = await this.userService.getAll();
    console.log('Users:', users);
    
    // Create a new user
    const newUser: User = {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    };
    
    const userId = await this.userService.create(newUser);
    console.log('Created user with ID:', userId);
  }
}
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
